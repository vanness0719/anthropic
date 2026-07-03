import { useState } from 'react'
import type { FundFlowDay } from '../../api/types'
import { fmtAmount } from '../../utils/format'
import { BORDER, PANEL, signColor, TEXT_2 } from '../../theme'

const W = 340
const H = 96
const PAD = 4

/** 近 N 日主力净流入柱状趋势(点击/滑动查看单日数值)。 */
export default function FundFlowTrend({ history, days = 20 }: { history: FundFlowDay[]; days?: number }) {
  const data = history.slice(-days)
  const [active, setActive] = useState<number | null>(null)
  if (!data.length) return null

  const max = Math.max(...data.map(d => Math.abs(d.main_net)), 1)
  const zero = H / 2
  const bw = (W - PAD * 2) / data.length
  const sum5 = history.slice(-5).reduce((s, d) => s + d.main_net, 0)
  const sumN = data.reduce((s, d) => s + d.main_net, 0)
  const shown = active != null ? data[active] : null

  const pick = (clientX: number, el: SVGSVGElement) => {
    const x = (clientX - el.getBoundingClientRect().left) / el.getBoundingClientRect().width * W
    setActive(Math.max(0, Math.min(data.length - 1, Math.floor((x - PAD) / bw))))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, margin: '4px 0 10px' }}>
        <Stat label="近5日主力净流入" value={sum5} />
        <Stat label={`近${data.length}日主力净流入`} value={sumN} />
      </div>
      <div style={{ color: TEXT_2, fontSize: 12, marginBottom: 4 }}>
        {shown ? `${shown.date} 主力净流入 ${shown.main_net > 0 ? '+' : ''}${fmtAmount(shown.main_net)}` : `近${data.length}日主力净流入趋势(点击柱子查看)`}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', touchAction: 'pan-y' }}
        onPointerDown={e => pick(e.clientX, e.currentTarget)}
        onPointerMove={e => e.buttons > 0 && pick(e.clientX, e.currentTarget)}
      >
        <line x1={PAD} x2={W - PAD} y1={zero} y2={zero} stroke={BORDER} />
        {data.map((d, i) => {
          const h = Math.abs(d.main_net) / max * (H / 2 - PAD)
          return (
            <rect
              key={d.date}
              x={PAD + i * bw + 1}
              width={Math.max(1, bw - 2)}
              y={d.main_net >= 0 ? zero - h : zero}
              height={Math.max(1, h)}
              rx={2}
              fill={signColor(d.main_net)}
              opacity={active == null || active === i ? 1 : 0.35}
            />
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: TEXT_2, fontSize: 11 }}>
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: 1, background: PANEL, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: TEXT_2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: signColor(value), fontVariantNumeric: 'tabular-nums' }}>
        {value > 0 ? '+' : ''}{fmtAmount(value)}
      </div>
    </div>
  )
}
