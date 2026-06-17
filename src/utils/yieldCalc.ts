// 良率 / 帕累托 / 晶圆图聚合的派生计算
import type { Bin, BinType, ParetoRow, Product, SmartSplit, Wafer } from '../types/cp';

function binDefs(product: Product, binType: BinType): Bin[] {
  // SBinGroup 暂用 HBin 分组口径(后续可细化)
  return binType === 'SBin' ? product.sbins : product.hbins;
}

function counts(wafer: Wafer, binType: BinType): Record<number, number> {
  return binType === 'SBin' ? wafer.sbinCounts : wafer.hbinCounts;
}

/** 帕累托:按 bin% 降序,fail bin 在前。包含累计百分比。 */
export function aggregateBinPareto(
  product: Product,
  wafers: Wafer[],
  binType: BinType
): ParetoRow[] {
  const defs = binDefs(product, binType);
  const defMap = new Map(defs.map((d) => [d.bin, d]));
  const agg: Record<number, number> = {};
  let total = 0;
  for (const w of wafers) {
    const c = counts(w, binType);
    for (const k of Object.keys(c)) {
      const bin = Number(k);
      agg[bin] = (agg[bin] ?? 0) + c[bin];
      total += c[bin];
    }
  }

  const rows: ParetoRow[] = Object.keys(agg).map((k) => {
    const bin = Number(k);
    const def = defMap.get(bin);
    const count = agg[bin];
    return {
      bin,
      name: def?.name ?? `BIN${bin}`,
      color: def?.color ?? '#bfbfbf',
      type: def?.type ?? 'fail',
      count,
      pct: total ? +((count / total) * 100).toFixed(2) : 0,
      cumPct: 0,
    };
  });

  rows.sort((a, b) => b.pct - a.pct);
  let cum = 0;
  for (const r of rows) {
    cum += r.pct;
    r.cumPct = +cum.toFixed(2);
  }
  return rows;
}

/** 仅失效 bin 的帕累托(供失效条形图 / CDF) */
export function failPareto(rows: ParetoRow[]): ParetoRow[] {
  const fails = rows.filter((r) => r.type === 'fail');
  const failTotal = fails.reduce((s, r) => s + r.count, 0);
  let cum = 0;
  return fails.map((r) => {
    const pct = failTotal ? +((r.count / failTotal) * 100).toFixed(2) : 0;
    cum += pct;
    return { ...r, cumPct: +cum.toFixed(2) };
  });
}

export function avgYield(wafers: Wafer[]): number {
  if (!wafers.length) return 0;
  return +(wafers.reduce((s, w) => s + w.yield, 0) / wafers.length).toFixed(2);
}

function zoneYield(wafers: Wafer[], wantEdge: boolean): number {
  let pass = 0;
  let total = 0;
  for (const w of wafers) {
    for (const d of w.dies) {
      if (d.edge !== wantEdge) continue;
      total++;
      if (d.bin === 0) pass++;
    }
  }
  return total ? +((pass / total) * 100).toFixed(2) : 0;
}

export const edgeYield = (wafers: Wafer[]) => zoneYield(wafers, true);
export const nonEdgeYield = (wafers: Wafer[]) => zoneYield(wafers, false);

/** Avg.Yield 相对前半段晶圆的环比变化(百分点) */
export function yoyDelta(wafers: Wafer[]): number {
  if (wafers.length < 2) return 0;
  const mid = Math.floor(wafers.length / 2);
  const prev = avgYield(wafers.slice(0, mid));
  const curr = avgYield(wafers.slice(mid));
  return +(curr - prev).toFixed(2);
}

export function topFailBin(rows: ParetoRow[]): ParetoRow | null {
  return rows.find((r) => r.type === 'fail') ?? null;
}

export interface StackedDie {
  x: number;
  y: number;
  total: number; // 该坐标累计 die 数(参与的晶圆数)
  passRate: number; // 0-100 平均良率
  topBin: number; // 出现最多的 bin
  binTally: Record<number, number>;
}

/** 把一组晶圆按 die 坐标叠加,得到 stacked wafermap */
export function stackWafermap(wafers: Wafer[]): StackedDie[] {
  const map = new Map<string, StackedDie>();
  for (const w of wafers) {
    for (const d of w.dies) {
      const key = `${d.x},${d.y}`;
      let cell = map.get(key);
      if (!cell) {
        cell = { x: d.x, y: d.y, total: 0, passRate: 0, topBin: 0, binTally: {} };
        map.set(key, cell);
      }
      cell.total++;
      cell.binTally[d.bin] = (cell.binTally[d.bin] ?? 0) + 1;
    }
  }
  for (const cell of map.values()) {
    const pass = cell.binTally[0] ?? 0;
    cell.passRate = cell.total ? +((pass / cell.total) * 100).toFixed(1) : 0;
    let max = -1;
    for (const k of Object.keys(cell.binTally)) {
      const bin = Number(k);
      if (cell.binTally[bin] > max) {
        max = cell.binTally[bin];
        cell.topBin = bin;
      }
    }
  }
  return [...map.values()];
}

// --- Smart Split:趋势图 X 轴聚合 ---
export interface TrendPoint {
  key: string; // X 轴分类标签
  yield: number; // 平均良率
  waferIds: string[]; // 该聚合点包含的晶圆
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((+d - +onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function buildTrend(wafers: Wafer[], split: SmartSplit): TrendPoint[] {
  const groups = new Map<string, Wafer[]>();
  const keyOf = (w: Wafer): string => {
    if (split === 'Month') return w.date.slice(0, 7);
    if (split === 'Week') return weekKey(w.date);
    return w.date; // Day
  };
  for (const w of wafers) {
    const k = keyOf(w);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(w);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, ws]) => ({
      key,
      yield: avgYield(ws),
      waferIds: ws.map((w) => w.waferId),
    }));
}
