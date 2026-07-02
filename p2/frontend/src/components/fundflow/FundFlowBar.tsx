import type { FundFlowDay } from '../../api/types'
import { fmtAmount, fmtSigned } from '../../utils/format'
import { signColor, TEXT_2 } from '../../theme'

/** 当日五档单型净流入:零轴居中的发散条形图(左流出/右流入,颜色+方向+符号三重编码)。 */
export default function FundFlowBar({ day }: { day: FundFlowDay }) {
  const rows = [
    { label: '主力', net: day.main_net, pct: day.main_pct, em: true },
    { label: '超大单', net: day.xl_net, pct: day.xl_pct },
    { label: '大单', net: day.lg_net, pct: day.lg_pct },
    { label: '中单', net: day.md_net, pct: day.md_pct },
    { label: '小单', net: day.sm_net, pct: day.sm_pct },
  ]
  const max = Math.max(...rows.map(r => Math.abs(r.net)), 1)
  return (
    <div>
      <div style={{ color: TEXT_2, fontSize: 12, marginBottom: 8 }}>
        {day.date} 资金净流入(万) · 主力 = 超大单 + 大单
      </div>
      {rows.map(r => {
        const w = Math.abs(r.net) / max * 50 // 半宽百分比
        return (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', margin: '6px 0', gap: 8 }}>
            <span style={{ width: 44, fontSize: 12, color: TEXT_2, fontWeight: r.em ? 600 : 400 }}>{r.label}</span>
            <div style={{ flex: 1, position: 'relative', height: r.em ? 16 : 12 }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#3a3a3a' }} />
              <div
                style={{
                  position: 'absolute',
                  top: 0, bottom: 0,
                  left: r.net >= 0 ? '50%' : `${50 - w}%`,
                  width: `${w}%`,
                  background: signColor(r.net),
                  borderRadius: r.net >= 0 ? '0 4px 4px 0' : '4px 0 0 4px',
                }}
              />
            </div>
            <span style={{ width: 86, textAlign: 'right', fontSize: 13, color: signColor(r.net), fontVariantNumeric: 'tabular-nums' }}>
              {r.net > 0 ? '+' : ''}{fmtAmount(r.net)}
            </span>
            <span style={{ width: 52, textAlign: 'right', fontSize: 12, color: TEXT_2 }}>
              {fmtSigned(r.pct)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
