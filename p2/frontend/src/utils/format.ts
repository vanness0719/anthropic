/** 金额(元)→ 万/亿 中文单位 */
export function fmtAmount(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(v / 1e4).toFixed(1)}万`
  return v.toFixed(0)
}

export function fmtSigned(v: number, digits = 2): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`
}

export function fmtDate(ts: number, withTime = false): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  return withTime ? `${date} ${p(d.getHours())}:${p(d.getMinutes())}` : date
}
