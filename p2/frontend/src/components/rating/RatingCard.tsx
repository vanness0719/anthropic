import { useState } from 'react'
import type { RatingResp } from '../../api/types'
import { BORDER, DOWN, NEUTRAL, PANEL, signColor, TEXT, TEXT_2, UP } from '../../theme'

export const actionColor = (action: string) =>
  action.includes('买入') ? UP : action === '观望' ? NEUTRAL : DOWN

const SIGNAL_TAG: Record<string, { text: string; color: string }> = {
  bullish: { text: '看多', color: UP },
  bearish: { text: '看空', color: DOWN },
  neutral: { text: '中性', color: NEUTRAL },
}

/** 赚钱指数综合评级卡:总分 + 操作建议 + 一句话策略,五维信号可展开。 */
export default function RatingCard({ data }: { data: RatingResp }) {
  const [open, setOpen] = useState(false)
  const tone = actionColor(data.action)
  return (
    <div style={{ background: PANEL, borderRadius: 10, margin: '4px 12px 8px', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ textAlign: 'center', minWidth: 74 }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: signColor(data.score - 50), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {data.score.toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: TEXT_2 }}>赚钱指数</div>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: tone, border: `1.5px solid ${tone}`, borderRadius: 6, padding: '2px 10px' }}>
            {data.action}
          </span>
          <div style={{ fontSize: 12.5, color: TEXT, marginTop: 6, lineHeight: 1.5 }}>{data.strategy}</div>
        </div>
      </div>

      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', gap: 6, marginTop: 10, cursor: 'pointer', flexWrap: 'wrap' }}
      >
        {data.signals.map(s => (
          <span key={s.key} style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 4,
            background: '#2a2a2a', color: SIGNAL_TAG[s.signal].color,
          }}>
            {s.name} {s.score.toFixed(0)}
          </span>
        ))}
        <span style={{ fontSize: 11, color: TEXT_2, marginLeft: 'auto' }}>{open ? '收起 ▲' : '明细 ▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
          {data.signals.map(s => (
            <div key={s.key} style={{ display: 'flex', gap: 8, alignItems: 'baseline', margin: '5px 0' }}>
              <span style={{ width: 58, fontSize: 12, color: TEXT }}>{s.name}</span>
              <span style={{ fontSize: 11, color: SIGNAL_TAG[s.signal].color, width: 30 }}>
                {SIGNAL_TAG[s.signal].text}
              </span>
              <span style={{ flex: 1, fontSize: 11.5, color: TEXT_2, lineHeight: 1.45 }}>{s.detail}</span>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: TEXT_2, marginTop: 6, opacity: 0.75 }}>{data.disclaimer}</div>
        </div>
      )}
    </div>
  )
}
