import { useMemo, useState, type CSSProperties } from 'react'
import type { BacktestResult } from '../../api/types'
import { fmtDate } from '../../utils/format'
import { ACCENT, BORDER, NEUTRAL, PANEL, TEXT, TEXT_2 } from '../../theme'

const W = 340
const H = 170
const PAD = { l: 6, r: 6, t: 8, b: 18 }

/** 净值曲线:策略(蓝)vs 买入持有基准(灰虚线),触摸显示十字线数值。 */
export default function EquityCurve({ result }: { result: BacktestResult }) {
  const { equity } = result
  const [idx, setIdx] = useState<number | null>(null)

  const { min, max } = useMemo(() => {
    const vals = equity.flatMap(e => [e.value, e.benchmark])
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [equity])

  if (equity.length < 2) return null
  const x = (i: number) => PAD.l + i / (equity.length - 1) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min || 1)) * (H - PAD.t - PAD.b)
  const path = (key: 'value' | 'benchmark') => equity.map((e, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(e[key]).toFixed(1)}`).join('')

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect()
    const i = Math.round((clientX - r.left) / r.width * (equity.length - 1))
    setIdx(Math.max(0, Math.min(equity.length - 1, i)))
  }
  const cur = idx != null ? equity[idx] : equity[equity.length - 1]

  return (
    <div style={{ background: PANEL, borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: TEXT }}><i style={dot(ACCENT)} />策略净值</span>
        <span style={{ color: TEXT_2 }}><i style={dot(NEUTRAL)} />买入持有</span>
        <span style={{ marginLeft: 'auto', color: TEXT_2, fontVariantNumeric: 'tabular-nums' }}>
          {fmtDate(cur.timestamp)} 策略 {cur.value.toFixed(0)} / 基准 {cur.benchmark.toFixed(0)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', touchAction: 'pan-y' }}
        onPointerDown={e => pick(e.clientX, e.currentTarget)}
        onPointerMove={e => e.buttons > 0 && pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setIdx(null)}
      >
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + f * (H - PAD.t - PAD.b)} y2={PAD.t + f * (H - PAD.t - PAD.b)} stroke={BORDER} strokeDasharray="3 3" />
        ))}
        <path d={path('benchmark')} fill="none" stroke={NEUTRAL} strokeWidth={1.5} strokeDasharray="5 4" />
        <path d={path('value')} fill="none" stroke={ACCENT} strokeWidth={2} />
        {idx != null && (
          <>
            <line x1={x(idx)} x2={x(idx)} y1={PAD.t} y2={H - PAD.b} stroke={TEXT_2} strokeWidth={1} />
            <circle cx={x(idx)} cy={y(equity[idx].value)} r={4} fill={ACCENT} stroke={PANEL} strokeWidth={2} />
            <circle cx={x(idx)} cy={y(equity[idx].benchmark)} r={4} fill={NEUTRAL} stroke={PANEL} strokeWidth={2} />
          </>
        )}
        <text x={PAD.l} y={H - 5} fontSize={10} fill={TEXT_2}>{fmtDate(equity[0].timestamp)}</text>
        <text x={W - PAD.r} y={H - 5} fontSize={10} fill={TEXT_2} textAnchor="end">{fmtDate(equity[equity.length - 1].timestamp)}</text>
      </svg>
    </div>
  )
}

const dot = (color: string): CSSProperties => ({
  display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color, marginRight: 5,
})
