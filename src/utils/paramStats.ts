// 参数测试项的统计与直方图计算

export interface ParamStats {
  n: number;
  mean: number;
  std: number; // 样本标准差
  min: number;
  max: number;
  median: number;
  cp: number | null; // (hi-lo)/(6σ)
  cpk: number | null; // min(hi-μ, μ-lo)/(3σ)
  failCount: number; // 超出规格的点数
  failPct: number;
}

export function computeStats(values: number[], lo: number | null, hi: number | null): ParamStats {
  const n = values.length;
  if (!n) {
    return { n: 0, mean: 0, std: 0, min: 0, max: 0, median: 0, cp: null, cpk: null, failCount: 0, failPct: 0 };
  }
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / n;
  let sq = 0;
  for (const v of values) sq += (v - mean) ** 2;
  const std = n > 1 ? Math.sqrt(sq / (n - 1)) : 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  let cp: number | null = null;
  let cpk: number | null = null;
  if (lo != null && hi != null && std > 0) {
    cp = (hi - lo) / (6 * std);
    cpk = Math.min(hi - mean, mean - lo) / (3 * std);
  } else if (std > 0 && (lo != null || hi != null)) {
    // 单边规格只算 Cpk
    cpk = hi != null ? (hi - mean) / (3 * std) : (mean - lo!) / (3 * std);
  }

  let failCount = 0;
  for (const v of values) {
    if ((lo != null && v < lo) || (hi != null && v > hi)) failCount++;
  }

  return {
    n,
    mean,
    std,
    min,
    max,
    median,
    cp: cp != null ? +cp.toFixed(3) : null,
    cpk: cpk != null ? +cpk.toFixed(3) : null,
    failCount,
    failPct: +((failCount / n) * 100).toFixed(2),
  };
}

export interface HistBin {
  x0: number;
  x1: number;
  count: number;
}
export interface Histogram {
  bins: HistBin[];
  range: [number, number]; // 实际显示范围(已按 IQR 栅栏裁剪离群点)
  below: number; // 低于显示范围、未计入柱的点数
  above: number; // 高于显示范围
  binWidth: number;
  clipped: boolean; // 是否裁剪了离群点
}

function quantile(sorted: number[], f: number): number {
  const n = sorted.length;
  const idx = (n - 1) * f;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * 等宽直方图,自动裁剪极端离群点使分布充满坐标轴。
 * 显示范围 = [Q1-3·IQR, Q3+3·IQR] ∩ [min,max]:数据干净时不裁剪,只有远离群点被裁掉。
 */
export function histogram(values: number[], binCount = 40): Histogram {
  const n = values.length;
  if (!n) return { bins: [], range: [0, 0], below: 0, above: 0, binWidth: 0, clipped: false };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];

  // 稳健范围:IQR 栅栏,退化时回退到 P0.5–P99.5,再退回 min/max
  let lo: number;
  let hi: number;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr > 0) {
    lo = Math.max(min, q1 - 3 * iqr);
    hi = Math.min(max, q3 + 3 * iqr);
  } else {
    lo = quantile(sorted, 0.005);
    hi = quantile(sorted, 0.995);
  }
  if (!(hi > lo)) {
    lo = min;
    hi = max;
  }
  if (!(hi > lo)) {
    // 全部相同
    return { bins: [{ x0: lo - 0.5, x1: lo + 0.5, count: n }], range: [lo - 0.5, lo + 0.5], below: 0, above: 0, binWidth: 1, clipped: false };
  }

  const width = (hi - lo) / binCount;
  const counts = new Array(binCount).fill(0);
  let below = 0;
  let above = 0;
  for (const v of values) {
    if (v < lo) { below++; continue; }
    if (v > hi) { above++; continue; }
    let idx = Math.floor((v - lo) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const bins: HistBin[] = counts.map((c, i) => ({ x0: lo + width * i, x1: lo + width * (i + 1), count: c }));
  return { bins, range: [lo, hi], below, above, binWidth: width, clipped: below + above > 0 };
}

/** 数值格式化:自动在过大/过小时用科学计数法 */
export function fmt(v: number): string {
  if (!isFinite(v)) return '-';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(3);
  return +v.toFixed(4) + '';
}
