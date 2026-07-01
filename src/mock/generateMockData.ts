// 生成确定性的 mock 数据(无真实晶圆数据时用于开发/演示)
// 设计为可重复:使用简单的种子随机,保证每次渲染一致。

import type { Bin, Die, Product, Wafer } from '../types/cp';

// --- 可重复随机 ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Bin 定义(对齐手册截图中的失效 bin 名称)---
export const HBINS: Bin[] = [
  { bin: 0, name: 'PASS', type: 'pass', color: '#73d13d' },
  { bin: 24, name: 'FUSABLE RAMS MAX', type: 'fail', color: '#1f77b4' },
  { bin: 25, name: 'NON-FUSABLE MAX', type: 'fail', color: '#ff7f0e' },
  { bin: 21, name: 'SCAN SHIFT MAX', type: 'fail', color: '#d62728' },
  { bin: 22, name: 'SCAN MAX', type: 'fail', color: '#9467bd' },
  { bin: 7, name: 'VDD CONTACT', type: 'fail', color: '#8c564b' },
  { bin: 98, name: 'CONTINUITY', type: 'fail', color: '#e377c2' },
  { bin: 26, name: 'IDDQ', type: 'fail', color: '#7f7f7f' },
];

// SBin 比 HBin 更细分
export const SBINS: Bin[] = [
  { bin: 1, name: 'PASS-BIN1', type: 'pass', color: '#73d13d' },
  { bin: 240, name: 'FUSABLE RAMS A', type: 'fail', color: '#1f77b4' },
  { bin: 241, name: 'FUSABLE RAMS B', type: 'fail', color: '#17becf' },
  { bin: 250, name: 'NON-FUSABLE A', type: 'fail', color: '#ff7f0e' },
  { bin: 210, name: 'SCAN SHIFT', type: 'fail', color: '#d62728' },
  { bin: 220, name: 'SCAN STUCK', type: 'fail', color: '#9467bd' },
  { bin: 70, name: 'VDD CONTACT', type: 'fail', color: '#8c564b' },
  { bin: 980, name: 'CONTINUITY OPEN', type: 'fail', color: '#e377c2' },
  { bin: 260, name: 'IDDQ HIGH', type: 'fail', color: '#7f7f7f' },
];

const FAIL_HBINS = HBINS.filter((b) => b.type === 'fail').map((b) => b.bin);
// HBin -> 该 HBin 下属的 SBin 候选(用于一致性映射)
const HBIN_TO_SBINS: Record<number, number[]> = {
  24: [240, 241],
  25: [250],
  21: [210],
  22: [220],
  7: [70],
  98: [980],
  26: [260],
};

const GRID = 28; // die 网格边长
const RADIUS = GRID / 2;

/** 判断 (x,y) 是否落在圆形晶圆内 */
function inWafer(x: number, y: number): boolean {
  const dx = x - RADIUS + 0.5;
  const dy = y - RADIUS + 0.5;
  return dx * dx + dy * dy <= (RADIUS - 0.5) * (RADIUS - 0.5);
}

/** 边缘 die:到圆心距离接近半径 */
function isEdge(x: number, y: number): boolean {
  const dx = x - RADIUS + 0.5;
  const dy = y - RADIUS + 0.5;
  const r = Math.sqrt(dx * dx + dy * dy);
  return r >= RADIUS - 2.2;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 为单片晶圆生成 die 图谱。failBias 让不同晶圆良率有差异。 */
function buildWafer(
  rand: () => number,
  lotId: string,
  waferNo: number,
  date: string,
  failBias: number
): Wafer {
  const dies: Die[] = [];
  const hbinCounts: Record<number, number> = {};
  const sbinCounts: Record<number, number> = {};

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!inWafer(x, y)) continue;
      const edge = isEdge(x, y);
      // 边缘 die 失效率更高(贴近真实晶圆边缘良率偏低的规律)
      const failProb = (edge ? 0.28 : 0.08) + failBias;
      let hbin = 0;
      let sbin = 1;
      if (rand() < failProb) {
        hbin = FAIL_HBINS[Math.floor(rand() * FAIL_HBINS.length)];
        const sCandidates = HBIN_TO_SBINS[hbin] ?? [1];
        sbin = sCandidates[Math.floor(rand() * sCandidates.length)];
      }
      dies.push({ x, y, bin: hbin, edge });
      hbinCounts[hbin] = (hbinCounts[hbin] ?? 0) + 1;
      sbinCounts[sbin] = (sbinCounts[sbin] ?? 0) + 1;
    }
  }

  const total = dies.length;
  const pass = hbinCounts[0] ?? 0;
  return {
    waferId: `${lotId}-W${pad(waferNo)}`,
    lotId,
    waferNo,
    date,
    yield: +((pass / total) * 100).toFixed(2),
    dies,
    hbinCounts,
    sbinCounts,
  };
}

export interface MockOptions {
  productId?: string;
  lots?: number;
  wafersPerLot?: number;
  seed?: number;
}

/** 生成一个完整产品的数据集 */
export function generateMockData(opts: MockOptions = {}): Product {
  const { productId = 'CP1', lots = 8, wafersPerLot = 13, seed = 42 } = opts;
  const rand = mulberry32(seed);
  const start = new Date('2023-03-24');

  const wafers: Wafer[] = [];
  let dayCursor = 0;
  for (let l = 0; l < lots; l++) {
    const lotId = `LOT${pad(l + 1, 3)}`;
    // 每个 lot 一个整体良率偏置,制造趋势波动
    const lotBias = (rand() - 0.45) * 0.12;
    dayCursor += Math.floor(rand() * 5) + 1;
    for (let w = 0; w < wafersPerLot; w++) {
      const waferBias = lotBias + (rand() - 0.5) * 0.04;
      const date = addDays(start, dayCursor);
      wafers.push(buildWafer(rand, lotId, w + 1, date, waferBias));
    }
  }

  // 基线:取前 60% 晶圆作为 baseline 集合
  const baselineCount = Math.floor(wafers.length * 0.6);
  const baselineWaferIds = wafers.slice(0, baselineCount).map((w) => w.waferId);

  const dates = wafers.map((w) => w.date).sort();
  return {
    productId,
    dateRange: [dates[0], dates[dates.length - 1]],
    hbins: HBINS,
    sbins: SBINS,
    wafers,
    baselineWaferIds,
    gridSize: GRID,
  };
}
