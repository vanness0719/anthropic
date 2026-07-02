import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CapsuleTabs, DotLoading, ErrorBlock, NavBar, Selector, Tabs, Tag } from 'antd-mobile'
import KLineChart, { type SubIndicator } from '../components/kline/KLineChart'
import { FUND_INDICATOR } from '../components/kline/fundFlowIndicator'
import FundFlowBar from '../components/fundflow/FundFlowBar'
import FundFlowTrend from '../components/fundflow/FundFlowTrend'
import SentimentScore from '../components/sentiment/SentimentScore'
import MarketMood from '../components/sentiment/MarketMood'
import { useStock, type Period } from '../store/stockStore'
import { useWatchlist } from '../store/watchlistStore'
import { fmtSigned } from '../utils/format'
import { signColor, TEXT_2 } from '../theme'

const PERIODS: { label: string; value: Period }[] = [
  { label: '日K', value: 'daily' },
  { label: '周K', value: 'weekly' },
  { label: '月K', value: 'monthly' },
  { label: '60分', value: '60' },
  { label: '15分', value: '15' },
]

export default function StockDetailPage() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const { period, bars, klineSource, fundflow, sentiment, market, loading, error, setPeriod, loadAll } = useStock()
  const quote = useWatchlist(s => s.quotes[code])
  const [subs, setSubs] = useState<SubIndicator[]>(['MACD', FUND_INDICATOR])

  useEffect(() => { void loadAll(code) }, [code, loadAll])

  // 日线周期时把每日主力净流入对齐到 K 线时间轴,喂给 FUND 副图
  const mainNetByDate = useMemo(() => {
    if (period !== 'daily' || !fundflow) return undefined
    return Object.fromEntries(fundflow.history.map(d => [d.date, d.main_net]))
  }, [period, fundflow])

  const name = quote?.name ?? code

  return (
    <div style={{ paddingBottom: 20 }}>
      <NavBar
        onBack={() => nav(-1)}
        right={klineSource === 'mock' ? <Tag color="warning" fill="outline">模拟数据</Tag> : undefined}
      >
        {name} <span style={{ color: TEXT_2, fontSize: 12 }}>{code}</span>
      </NavBar>

      {quote && (
        <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: signColor(quote.change_pct), fontVariantNumeric: 'tabular-nums' }}>
            {quote.price.toFixed(2)}
          </span>
          <span style={{ color: signColor(quote.change_pct), fontSize: 14 }}>
            {fmtSigned(quote.change)} ({fmtSigned(quote.change_pct)}%)
          </span>
          <span style={{ color: TEXT_2, fontSize: 12, marginLeft: 'auto' }}>换手 {quote.turnover}%</span>
        </div>
      )}

      <CapsuleTabs activeKey={period} onChange={k => void setPeriod(k as Period)}>
        {PERIODS.map(p => <CapsuleTabs.Tab title={p.label} key={p.value} />)}
      </CapsuleTabs>

      <div style={{ padding: '4px 8px 0' }}>
        <Selector
          multiple
          options={[
            { label: 'MACD', value: 'MACD' },
            { label: 'KDJ', value: 'KDJ' },
            { label: '主力资金', value: FUND_INDICATOR },
          ]}
          value={subs}
          onChange={v => setSubs(v as SubIndicator[])}
          style={{ '--padding': '3px 10px', fontSize: 12 } as never}
        />
      </div>

      {error
        ? <ErrorBlock status="disconnected" title="数据加载失败" description={error} />
        : bars.length
          ? <KLineChart bars={bars} mainNetByDate={mainNetByDate} subIndicators={subs} height={430} />
          : <div style={{ textAlign: 'center', padding: 60 }}><DotLoading />{loading && ' 加载中'}</div>}

      <Tabs defaultActiveKey="fundflow" style={{ marginTop: 4 }}>
        <Tabs.Tab title="大单资金流" key="fundflow">
          {fundflow?.latest ? (
            <div style={{ padding: '0 4px' }}>
              <FundFlowBar day={fundflow.latest} />
              <div style={{ height: 12 }} />
              <FundFlowTrend history={fundflow.history} />
            </div>
          ) : <DotLoading />}
        </Tabs.Tab>
        <Tabs.Tab title="市场情绪" key="sentiment">
          {sentiment ? (
            <div style={{ padding: '0 4px' }}>
              <SentimentScore data={sentiment} />
              {market && <MarketMood data={market} />}
            </div>
          ) : <DotLoading />}
        </Tabs.Tab>
      </Tabs>
    </div>
  )
}
