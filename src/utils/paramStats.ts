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

export interface Histogram {
  centers: number[];
  counts: number[];
  binWidth: number;
}

/** 等宽直方图;bins 默认 40 */
export function histogram(values: number[], bins = 40): Histogram {
  if (!values.length) return { centers: [], counts: [], binWidth: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    return { centers: [min], counts: [values.length], binWidth: 1 };
  }
  const width = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  const centers = counts.map((_, i) => +(min + width * (i + 0.5)).toPrecision(6));
  return { centers, counts, binWidth: width };
}

/** 数值格式化:自动在过大/过小时用科学计数法 */
export function fmt(v: number): string {
  if (!isFinite(v)) return '-';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(3);
  return +v.toFixed(4) + '';
}
