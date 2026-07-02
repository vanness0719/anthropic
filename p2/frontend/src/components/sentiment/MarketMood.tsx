import type { MarketMoodResp } from '../../api/types'
import { DOWN, PANEL, TEXT, TEXT_2, UP } from '../../theme'

/** 大盘情绪条:涨跌家数发散占比 + 涨停/跌停/活跃度。 */
export default function MarketMood({ data }: { data: MarketMoodResp }) {
  const total = data.up + data.down + data.flat || 1
  const upPct = data.up / total * 100
  const downPct = data.down / total * 100
  return (
    <div style={{ background: PANEL, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT_2, marginBottom: 6 }}>
        <span>大盘情绪 · {data.date.slice(0, 10)}</span>
        <span>赚钱效应 {data.activity.toFixed(1)}%</span>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
        <div style={{ width: `${upPct}%`, background: UP }} />
        <div style={{ flex: 1, background: '#3a3a3a' }} />
        <div style={{ width: `${downPct}%`, background: DOWN }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6, color: TEXT }}>
        <span style={{ color: UP }}>涨 {data.up} · 涨停 {data.limit_up}</span>
        <span style={{ color: TEXT_2 }}>平 {data.flat}</span>
        <span style={{ color: DOWN }}>跌 {data.down} · 跌停 {data.limit_down}</span>
      </div>
    </div>
  )
}
