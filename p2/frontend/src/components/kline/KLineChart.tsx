import { useEffect, useRef } from 'react'
import { dispose, init, type Chart, type KLineData } from 'klinecharts'
import type { KlineBar } from '../../api/types'
import { BORDER, DOWN, NEUTRAL, PANEL, TEXT_2, UP } from '../../theme'
import { ensureFundIndicator, FUND_INDICATOR } from './fundFlowIndicator'

export type SubIndicator = 'MACD' | 'KDJ' | typeof FUND_INDICATOR

interface Props {
  bars: KlineBar[]
  /** date(YYYY-MM-DD) → 主力净流入(元),日线周期时附加到 bar 供 FUND 副图使用 */
  mainNetByDate?: Record<string, number>
  subIndicators: SubIndicator[]
  height: number
}

const A_SHARE_STYLES = {
  grid: {
    horizontal: { color: BORDER, style: 'dashed' },
    vertical: { show: false },
  },
  candle: {
    bar: { upColor: UP, downColor: DOWN, noChangeColor: NEUTRAL,
           upBorderColor: UP, downBorderColor: DOWN, noChangeBorderColor: NEUTRAL,
           upWickColor: UP, downWickColor: DOWN, noChangeWickColor: NEUTRAL },
    priceMark: { last: { upColor: UP, downColor: DOWN, noChangeColor: NEUTRAL } },
    tooltip: { text: { color: TEXT_2 } },
  },
  indicator: {
    bars: [{ style: 'fill', borderStyle: 'solid', borderSize: 1, borderDashedValue: [2, 2],
             upColor: 'rgba(240,72,72,0.72)', downColor: 'rgba(59,162,114,0.72)', noChangeColor: NEUTRAL }],
    tooltip: { text: { color: TEXT_2 } },
  },
  xAxis: { axisLine: { color: BORDER }, tickText: { color: TEXT_2 }, tickLine: { color: BORDER } },
  yAxis: { axisLine: { color: BORDER }, tickText: { color: TEXT_2 }, tickLine: { color: BORDER } },
  separator: { color: BORDER },
  crosshair: {
    horizontal: { line: { color: NEUTRAL }, text: { backgroundColor: PANEL } },
    vertical: { line: { color: NEUTRAL }, text: { backgroundColor: PANEL } },
  },
} as const

export default function KLineChart({ bars, mainNetByDate, subIndicators, height }: Props) {
  const holder = useRef<HTMLDivElement>(null)
  const chart = useRef<Chart | null>(null)
  const panes = useRef<Record<string, string>>({}) // 指标名 → paneId

  useEffect(() => {
    ensureFundIndicator()
    const c = init(holder.current!)
    if (!c) return
    c.setStyles(A_SHARE_STYLES as never)
    c.createIndicator('VOL', false, { height: 60 })
    chart.current = c
    return () => {
      dispose(holder.current!)
      chart.current = null
      panes.current = {}
    }
  }, [])

  useEffect(() => {
    const data: KLineData[] = bars.map(b => ({
      timestamp: b.timestamp,
      open: b.open, high: b.high, low: b.low, close: b.close,
      volume: b.volume, turnover: b.amount,
      mainNet: mainNetByDate?.[dateKey(b.timestamp)] ?? null,
    }))
    chart.current?.applyNewData(data)
  }, [bars, mainNetByDate])

  useEffect(() => {
    const c = chart.current
    if (!c) return
    for (const name of subIndicators) {
      if (!panes.current[name]) {
        const paneId = c.createIndicator(name, false, { height: 72 })
        if (paneId) panes.current[name] = paneId
      }
    }
    for (const [name, paneId] of Object.entries(panes.current)) {
      if (!subIndicators.includes(name as SubIndicator)) {
        c.removeIndicator(paneId, name)
        delete panes.current[name]
      }
    }
  }, [subIndicators])

  return <div ref={holder} style={{ width: '100%', height }} />
}

function dateKey(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
