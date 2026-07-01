// 浏览器内 STDF 解析器:把 .stdf / .stdf.gz 解析为本工具的 Product 数据模型。
// 纯前端、无依赖:gzip 用浏览器原生 DecompressionStream 解压。
// 逻辑与离线 Python 版一致(已用真实文件核对:wafer PC8C32-01B7 -> yield 99.24%)。
import type { Bin, BinKind, Die, ParamData, Product, TestItem, Wafer } from '../types/cp';

const FAIL_COLORS = [
  '#1f77b4', '#ff7f0e', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
  '#17becf', '#bcbd22', '#2ca02c', '#ff9896', '#c5b0d5', '#c49c94', '#f7b6d2',
];
const PASS_COLOR = '#73d13d';
const INVALID_COORD = -32768;

/** 由各 bin 计数 + 名称/类型元数据生成带配色的 Bin 定义(pass 在前,fail 按数量降序上色)。 */
export function buildBinsFrom(
  totals: Map<number, number>,
  meta: Map<number, { name: string; type: BinKind }>
): Bin[] {
  const rows: { bin: number; name: string; type: BinKind; cnt: number }[] = [];
  for (const [bin, cnt] of totals) {
    const m = meta.get(bin);
    rows.push({ bin, name: m?.name || `BIN${bin}`, type: m?.type ?? 'fail', cnt });
  }
  const passes = rows.filter((r) => r.type === 'pass').sort((a, b) => b.cnt - a.cnt);
  const fails = rows.filter((r) => r.type === 'fail').sort((a, b) => b.cnt - a.cnt);
  return [
    ...passes.map((r) => ({ bin: r.bin, name: r.name, type: r.type, color: PASS_COLOR })),
    ...fails.map((r, i) => ({
      bin: r.bin, name: r.name, type: r.type, color: FAIL_COLORS[i % FAIL_COLORS.length],
    })),
  ];
}

interface WipWafer {
  waferId: string;
  dateT: number; // unix 秒
  final: Map<string, [number, number]>; // "x,y" -> [hard, soft],保留重测最终结果
  params: Map<number, number[]>; // testNum -> 该片所有 die 的实测值
}

/** 若为 gzip(魔数 1f 8b)则用原生 DecompressionStream 解压 */
async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const ds = new DecompressionStream('gzip');
    const stream = new Blob([buf]).stream().pipeThrough(ds);
    return await new Response(stream).arrayBuffer();
  }
  return buf;
}

/** 解析已解压的 STDF 字节流 → Product(可含多片晶圆) */
export function parseStdfRecords(buf: ArrayBuffer): Product {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const n = buf.byteLength;
  if (n < 6) throw new Error('文件过小,不是有效的 STDF');

  // 字节序:FAR(0,10) 的 CPU_TYPE 位于首记录头(4字节)之后。2 = little-endian。
  const cpu = bytes[4];
  const LE = cpu !== 1; // 1=big-endian(sun),其余按 little
  const u2 = (o: number) => dv.getUint16(o, LE);
  const u4 = (o: number) => dv.getUint32(o, LE);
  const i2 = (o: number) => dv.getInt16(o, LE);
  const f4 = (o: number) => dv.getFloat32(o, LE);
  // 长度前缀字符串 Cn(latin1)
  const cn = (o: number): [string, number] => {
    if (o >= n) return ['', o];
    const len = bytes[o];
    let s = '';
    for (let i = 0; i < len && o + 1 + i < n; i++) s += String.fromCharCode(bytes[o + 1 + i]);
    return [s, o + 1 + len];
  };

  let mirLot = '';
  let mirPart = '';
  let mirStart = 0;
  const wafers: WipWafer[] = [];
  let cur: WipWafer | null = null;
  const hName = new Map<number, { name: string; pf: string }>();
  const sName = new Map<number, { name: string; pf: string }>();
  // 参数测试项元数据(名称/单位/上下限,首次出现时捕获);Map 有序,保留出现顺序
  const testMeta = new Map<number, { name: string; units: string; lo: number | null; hi: number | null }>();

  const ensureWafer = (): WipWafer => {
    if (!cur) {
      cur = { waferId: '', dateT: mirStart, final: new Map(), params: new Map() };
      wafers.push(cur);
    }
    return cur;
  };

  let o = 0;
  while (o + 4 <= n) {
    const rlen = u2(o);
    const typ = bytes[o + 2];
    const sub = bytes[o + 3];
    const b = o + 4; // body 起始
    const next = b + rlen;
    if (next > n) break;

    if (typ === 1 && sub === 10) {
      // MIR: setup U4, start U4, STAT_NUM U1, MODE/RTST/PROT C1x3, BURN U2, CMOD C1, LOT_ID Cn, PART_TYP Cn
      mirStart = u4(b + 4);
      let p = b + 8 + 1 + 3 + 2 + 1;
      [mirLot, p] = cn(p);
      [mirPart, p] = cn(p);
    } else if (typ === 2 && sub === 10) {
      // WIR: head U1, sitegrp U1, start U4, wafer_id Cn
      const startT = u4(b + 2);
      const [wid] = cn(b + 6);
      cur = { waferId: wid, dateT: startT || mirStart, final: new Map(), params: new Map() };
      wafers.push(cur);
    } else if (typ === 2 && sub === 20) {
      // WRR: head U1, sitegrp U1, finish U4, part/rtst/abrt/good/func U4x5, wafer_id Cn
      const [wid] = cn(b + 26);
      if (cur && wid) cur.waferId = wid;
      cur = null;
    } else if (typ === 5 && sub === 20) {
      // PRR: head U1, site U1, part_flg B1, num_test U2, hard U2, soft U2, x I2, y I2
      const hard = u2(b + 5);
      const soft = u2(b + 7);
      const x = i2(b + 9);
      const y = i2(b + 11);
      if (x !== INVALID_COORD && y !== INVALID_COORD) {
        ensureWafer().final.set(`${x},${y}`, [hard, soft]);
      }
    } else if (typ === 1 && sub === 40) {
      // HBR: head U1, site U1, hbin U2, cnt U4, pf C1, name Cn
      const num = u2(b + 2);
      const pf = String.fromCharCode(bytes[b + 8]);
      const [name] = cn(b + 9);
      const e = hName.get(num) ?? { name: '', pf: '' };
      if (name) e.name = name;
      if (pf === 'P' || pf === 'F') e.pf = pf;
      hName.set(num, e);
    } else if (typ === 1 && sub === 50) {
      // SBR:结构同 HBR
      const num = u2(b + 2);
      const pf = String.fromCharCode(bytes[b + 8]);
      const [name] = cn(b + 9);
      const e = sName.get(num) ?? { name: '', pf: '' };
      if (name) e.name = name;
      if (pf === 'P' || pf === 'F') e.pf = pf;
      sName.set(num, e);
    } else if (typ === 15 && sub === 10) {
      // PTR 参数测试: TEST_NUM U4, HEAD U1, SITE U1, TEST_FLG B1, PARM_FLG B1, RESULT R4,
      //   TEST_TXT Cn, ALARM_ID Cn, OPT_FLAG B1, RES/LLM/HLM_SCAL I1x3, LO_LIMIT R4, HI_LIMIT R4, UNITS Cn ...
      const testNum = u4(b);
      const result = f4(b + 8);
      const w = ensureWafer();
      let arr = w.params.get(testNum);
      if (!arr) {
        arr = [];
        w.params.set(testNum, arr);
      }
      arr.push(result);
      // 仅在首次遇到该测试项时解析名称/单位/上下限(后续记录多为精简版,省这些字段)
      if (!testMeta.has(testNum)) {
        let p = b + 12;
        const [testTxt, p2] = cn(p); // TEST_TXT
        p = p2;
        const [, p3] = cn(p); // ALARM_ID
        p = p3;
        let lo: number | null = null;
        let hi: number | null = null;
        let units = '';
        // OPT_FLAG(1) + 3×SCAL(1) 之后才是 LO/HI_LIMIT;需记录体足够长
        if (p + 1 + 3 + 8 <= next) {
          const optFlag = bytes[p];
          p += 1 + 3; // 跳过 OPT_FLAG 与 RES/LLM/HLM_SCAL
          const loRaw = f4(p);
          const hiRaw = f4(p + 4);
          p += 8;
          // OPT_FLAG bit4=LO 无效, bit5=HI 无效, bit6=LO 缺省, bit7=HI 缺省
          if (!(optFlag & 0x40) && !(optFlag & 0x10)) lo = loRaw;
          if (!(optFlag & 0x80) && !(optFlag & 0x20)) hi = hiRaw;
          [units] = cn(p); // UNITS
        }
        testMeta.set(testNum, { name: testTxt, units, lo, hi });
      }
    }
    o = next;
  }

  if (!wafers.length) throw new Error('未找到任何 die 结果(PRR),可能不是 CP wafer STDF');

  const passH = new Set([...hName].filter(([, v]) => v.pf === 'P').map(([k]) => k));
  const hTotal = new Map<number, number>();
  const sTotal = new Map<number, number>();
  let maxCoord = 0;

  const filteredWip = wafers.filter((w) => w.final.size > 0);
  const outWafers: Wafer[] = filteredWip
    .map((w, idx) => {
      const tested = new Set(w.final.keys());
      const isEdge = (x: number, y: number) =>
        !tested.has(`${x + 1},${y}`) || !tested.has(`${x - 1},${y}`) ||
        !tested.has(`${x},${y + 1}`) || !tested.has(`${x},${y - 1}`);

      const dies: Die[] = [];
      const hbinCounts: Record<number, number> = {};
      const sbinCounts: Record<number, number> = {};
      let pass = 0;
      for (const [key, [hard, soft]] of w.final) {
        const [x, y] = key.split(',').map(Number);
        if (x > maxCoord) maxCoord = x;
        if (y > maxCoord) maxCoord = y;
        dies.push({ x, y, bin: hard, edge: isEdge(x, y) });
        hbinCounts[hard] = (hbinCounts[hard] ?? 0) + 1;
        sbinCounts[soft] = (sbinCounts[soft] ?? 0) + 1;
        hTotal.set(hard, (hTotal.get(hard) ?? 0) + 1);
        sTotal.set(soft, (sTotal.get(soft) ?? 0) + 1);
        if (passH.has(hard)) pass++;
      }
      const total = dies.length;
      const date = new Date(w.dateT * 1000).toISOString().slice(0, 10);
      return {
        waferId: w.waferId || `${mirLot || 'LOT'}-W${String(idx + 1).padStart(2, '0')}`,
        lotId: mirLot || 'LOT',
        waferNo: idx + 1,
        date,
        yield: total ? +((pass / total) * 100).toFixed(2) : 0,
        dies,
        hbinCounts,
        sbinCounts,
      } as Wafer;
    });

  const toTypeMeta = (names: Map<number, { name: string; pf: string }>) =>
    new Map([...names].map(([k, v]) => [k, { name: v.name, type: (v.pf === 'P' ? 'pass' : 'fail') as BinKind }]));

  // 参数测试数据:测试项列表(按出现顺序)+ testNum -> waferId -> 实测值
  let paramData: ParamData | undefined;
  if (testMeta.size) {
    const items: TestItem[] = [...testMeta].map(([num, m]) => ({
      num, name: m.name || `TEST ${num}`, units: m.units, lo: m.lo, hi: m.hi,
    }));
    const values = new Map<number, Map<string, number[]>>();
    for (const num of testMeta.keys()) values.set(num, new Map());
    filteredWip.forEach((w, idx) => {
      const wid = outWafers[idx].waferId;
      for (const [num, arr] of w.params) {
        let m = values.get(num);
        if (!m) {
          m = new Map();
          values.set(num, m);
        }
        m.set(wid, arr);
      }
    });
    paramData = { items, values };
  }

  const dates = outWafers.map((w) => w.date).sort();
  return {
    productId: mirPart || 'CP',
    dateRange: [dates[0], dates[dates.length - 1]],
    hbins: buildBinsFrom(hTotal, toTypeMeta(hName)),
    sbins: buildBinsFrom(sTotal, toTypeMeta(sName)),
    wafers: outWafers,
    baselineWaferIds: outWafers.map((w) => w.waferId),
    gridSize: maxCoord + 1,
    paramData,
  };
}

/** 合并多个 Product(来自多个 STDF 文件)为一个多晶圆数据集。 */
export function mergeProducts(products: Product[]): Product {
  const wafers: Wafer[] = [];
  const seen = new Set<string>();
  const idMaps = new Map<Product, Map<string, string>>(); // 每个来源产品的 oldId->newId(用于同步 paramData)
  for (const p of products) {
    const m = new Map<string, string>();
    idMaps.set(p, m);
    for (const w of p.wafers) {
      let id = w.waferId;
      if (seen.has(id)) {
        let k = 2;
        while (seen.has(`${id}#${k}`)) k++;
        id = `${id}#${k}`;
      }
      seen.add(id);
      m.set(w.waferId, id);
      wafers.push(id === w.waferId ? w : { ...w, waferId: id });
    }
  }

  const hMeta = new Map<number, { name: string; type: BinKind }>();
  const sMeta = new Map<number, { name: string; type: BinKind }>();
  for (const p of products) {
    for (const b of p.hbins) if (!hMeta.has(b.bin)) hMeta.set(b.bin, { name: b.name, type: b.type });
    for (const b of p.sbins) if (!sMeta.has(b.bin)) sMeta.set(b.bin, { name: b.name, type: b.type });
  }

  const hTotal = new Map<number, number>();
  const sTotal = new Map<number, number>();
  let grid = 0;
  for (const w of wafers) {
    for (const k in w.hbinCounts) hTotal.set(+k, (hTotal.get(+k) ?? 0) + w.hbinCounts[+k]);
    for (const k in w.sbinCounts) sTotal.set(+k, (sTotal.get(+k) ?? 0) + w.sbinCounts[+k]);
    for (const d of w.dies) {
      if (d.x > grid) grid = d.x;
      if (d.y > grid) grid = d.y;
    }
  }

  // 合并参数测试数据:union 测试项,按重映射后的 waferId 汇集实测值
  let paramData: ParamData | undefined;
  const withParam = products.filter((p) => p.paramData);
  if (withParam.length) {
    const items: TestItem[] = [];
    const seenTest = new Set<number>();
    for (const p of withParam) {
      for (const it of p.paramData!.items) {
        if (!seenTest.has(it.num)) {
          seenTest.add(it.num);
          items.push(it);
        }
      }
    }
    const values = new Map<number, Map<string, number[]>>();
    for (const p of withParam) {
      const m = idMaps.get(p)!;
      for (const [num, byWafer] of p.paramData!.values) {
        let dst = values.get(num);
        if (!dst) {
          dst = new Map();
          values.set(num, dst);
        }
        for (const [oldId, arr] of byWafer) dst.set(m.get(oldId) ?? oldId, arr);
      }
    }
    paramData = { items, values };
  }

  const dates = wafers.map((w) => w.date).sort();
  const pids = [...new Set(products.map((p) => p.productId))];
  return {
    productId: pids.length === 1 ? pids[0] : `${pids[0]} +${pids.length - 1}`,
    dateRange: [dates[0], dates[dates.length - 1]],
    hbins: buildBinsFrom(hTotal, hMeta),
    sbins: buildBinsFrom(sTotal, sMeta),
    wafers,
    baselineWaferIds: wafers.map((w) => w.waferId),
    gridSize: grid + 1,
    paramData,
  };
}

/** 从用户选择的 File 解析(自动处理 .gz)。 */
export async function parseStdfFile(file: File): Promise<Product> {
  const buf = await file.arrayBuffer();
  const raw = await gunzipIfNeeded(buf);
  return parseStdfRecords(raw);
}
