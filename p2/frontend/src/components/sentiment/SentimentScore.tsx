import type { SentimentResp } from '../../api/types'
import { fmtAmount } from '../../utils/format'
import { ACCENT, DOWN, NEUTRAL, PANEL, TEXT, TEXT_2, UP } from '../../theme'

const DIM_META: { key: keyof SentimentResp['dimensions']; name: string; detail: (d: Record<string, unknown>) => string }[] = [
  { key: 'fund', name: '资金面', detail: d => `近${d.days}日主力净流入 ${fmtAmount(Number(d.main_net_sum ?? 0))}(占比均值 ${d.main_pct_avg}%)` },
  { key: 'heat', name: '热度面', detail: d => `人气排名 ${d.hot_rank ? '#' + d.hot_rank : '—'} · 关注指数 ${d.focus_index ?? '—'}` },
  { key: 'institution', name: '机构面', detail: d => `机构参与度 ${d.institution_pct != null ? d.institution_pct + '%' : '—'}` },
  { key: 'market', name: '大盘面', detail: d => `涨${d.up}家 / 跌${d.down}家 · 涨停${d.limit_up} 跌停${d.limit_down}` },
]

/** 个股情绪:综合分 hero + 四维得分条(单色 accent,分值为幅度而非涨跌语义)。 */
export default function SentimentScore({ data }: { data: SentimentResp }) {
  const tone = data.score >= 60 ? UP : data.score < 40 ? DOWN : NEUTRAL
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 40, fontWeight: 700, color: tone, fontVariantNumeric: 'tabular-nums' }}>
          {data.score.toFixed(1)}
        </span>
        <span style={{ fontSize: 14, color: tone, border: `1px solid ${tone}`, borderRadius: 10, padding: '1px 8px' }}>
          {data.label}
        </span>
        <span style={{ fontSize: 12, color: TEXT_2 }}>市场情绪综合分(0-100)</span>
      </div>
      {DIM_META.map(m => {
        const dim = data.dimensions[m.key]
        return (
          <div key={m.key} style={{ background: PANEL, borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: TEXT }}>
              <span>{m.name}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dim.score}</span>
            </div>
            <div style={{ height: 6, background: '#2a2a2a', borderRadius: 3, margin: '6px 0' }}>
              <div style={{ width: `${dim.score}%`, height: '100%', background: ACCENT, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: TEXT_2 }}>{m.detail(dim as Record<string, unknown>)}</div>
          </div>
        )
      })}
    </div>
  )
}
