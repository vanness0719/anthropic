import type { Trade } from '../../api/types'
import { fmtDate, fmtSigned } from '../../utils/format'
import { PANEL, signColor, TEXT, TEXT_2 } from '../../theme'

export default function TradeList({ trades }: { trades: Trade[] }) {
  if (!trades.length) return <div style={{ color: TEXT_2, fontSize: 13, padding: 12 }}>区间内无交易</div>
  return (
    <div>
      {trades.map((t, i) => (
        <div key={t.entry_ts} style={{ background: PANEL, borderRadius: 8, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: TEXT_2, fontSize: 12, width: 20 }}>{i + 1}</span>
          <div style={{ flex: 1, fontSize: 13, color: TEXT }}>
            <div>{fmtDate(t.entry_ts)} 买入 {t.entry_price}</div>
            <div style={{ color: TEXT_2 }}>
              {fmtDate(t.exit_ts)} {t.exit_reason === 'end' ? '期末结算' : '卖出'} {t.exit_price}
            </div>
          </div>
          <span style={{ color: signColor(t.pnl_pct), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {fmtSigned(t.pnl_pct)}%
          </span>
        </div>
      ))}
    </div>
  )
}
