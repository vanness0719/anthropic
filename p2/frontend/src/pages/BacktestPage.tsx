import { Button, Collapse, Form, Input, NavBar, Selector, Tag, Toast } from 'antd-mobile'
import EquityCurve from '../components/backtest/EquityCurve'
import TradeList from '../components/backtest/TradeList'
import { useBacktest } from '../store/backtestStore'
import { fmtSigned } from '../utils/format'
import { PANEL, signColor, TEXT, TEXT_2 } from '../theme'

const STRATEGIES = [
  { label: '双均线金叉', value: 'ma_cross' },
  { label: 'MACD 金叉死叉', value: 'macd' },
  { label: 'KDJ 超买超卖', value: 'kdj' },
]

// 各策略可调参数(留空用后端默认值)
const PARAM_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  ma_cross: [
    { key: 'fast', label: '快线周期', placeholder: '默认 5' },
    { key: 'slow', label: '慢线周期', placeholder: '默认 20' },
  ],
  macd: [
    { key: 'fast', label: '快线', placeholder: '默认 12' },
    { key: 'slow', label: '慢线', placeholder: '默认 26' },
    { key: 'signal', label: 'DEA', placeholder: '默认 9' },
  ],
  kdj: [
    { key: 'oversold', label: '超卖阈值', placeholder: '默认 30' },
    { key: 'overbought', label: '超买阈值', placeholder: '默认 70' },
  ],
}

export default function BacktestPage() {
  const { form, result, loading, error, setForm, run } = useBacktest()

  const submit = () => {
    if (!/^\d{6}$/.test(form.code)) { Toast.show('请输入 6 位股票代码'); return }
    void run()
  }

  return (
    <div style={{ paddingBottom: 70 }}>
      <NavBar back={null} right={result?.source === 'mock' ? <Tag color="warning" fill="outline">模拟数据</Tag> : undefined}>
        策略回测
      </NavBar>

      <Form layout="horizontal" style={{ '--border-top': 'none' } as never}>
        <Form.Item label="股票代码">
          <Input placeholder="如 600519" value={form.code} onChange={v => setForm({ code: v })} />
        </Form.Item>
        <Form.Item label="策略">
          <Selector
            options={STRATEGIES}
            value={[form.strategy]}
            onChange={v => v.length && setForm({ strategy: v[0] as typeof form.strategy, params: {} })}
          />
        </Form.Item>
        <Collapse>
          <Collapse.Panel key="advanced" title={<span style={{ fontSize: 13, color: TEXT_2 }}>参数设置(可选)</span>}>
            {PARAM_FIELDS[form.strategy].map(f => (
              <Form.Item key={f.key} label={f.label}>
                <Input
                  type="number"
                  placeholder={f.placeholder}
                  value={form.params[f.key]?.toString() ?? ''}
                  onChange={v => {
                    const params = { ...form.params }
                    if (v === '') delete params[f.key]
                    else params[f.key] = Number(v)
                    setForm({ params })
                  }}
                />
              </Form.Item>
            ))}
            <Form.Item label="开始日期">
              <Input placeholder="YYYY-MM-DD,默认全部" value={form.start_date ?? ''}
                     onChange={v => setForm({ start_date: v || undefined })} />
            </Form.Item>
            <Form.Item label="单边费率">
              <Input type="number" value={String(form.fee_rate)}
                     onChange={v => setForm({ fee_rate: Number(v) || 0 })} />
            </Form.Item>
          </Collapse.Panel>
        </Collapse>
      </Form>

      <div style={{ padding: '8px 12px' }}>
        <Button block color="primary" loading={loading} onClick={submit}>开始回测</Button>
        {error && <div style={{ color: '#f04848', fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>

      {result && (
        <div style={{ padding: '0 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '8px 0' }}>
            <Metric label="总收益" value={`${fmtSigned(result.total_return_pct)}%`} tone={result.total_return_pct} />
            <Metric label="年化收益" value={`${fmtSigned(result.annual_return_pct)}%`} tone={result.annual_return_pct} />
            <Metric label="最大回撤" value={`${result.max_drawdown_pct}%`} tone={-1} />
            <Metric label="基准收益" value={`${fmtSigned(result.benchmark_return_pct)}%`} tone={result.benchmark_return_pct} />
            <Metric label="胜率" value={result.win_rate_pct != null ? `${result.win_rate_pct}%` : '—'} />
            <Metric label="交易次数" value={String(result.num_trades)} />
          </div>
          <EquityCurve result={result} />
          <div style={{ color: TEXT_2, fontSize: 13, margin: '12px 0 6px' }}>逐笔交易(信号收盘确认,次日开盘成交)</div>
          <TradeList trades={result.trades} />
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div style={{ background: PANEL, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: TEXT_2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                    color: tone === undefined ? TEXT : signColor(tone) }}>
        {value}
      </div>
    </div>
  )
}
