import { registerIndicator } from 'klinecharts'
import { DOWN, UP } from '../../theme'

export const FUND_INDICATOR = 'FUND'

interface FundData {
  main: number | null
}

let registered = false

/** 主力净流入副图:数据由 K 线 bar 上附加的 mainNet(元)字段提供,与时间轴天然对齐。 */
export function ensureFundIndicator() {
  if (registered) return
  registered = true
  registerIndicator<FundData>({
    name: FUND_INDICATOR,
    shortName: '主力净流入(万)',
    precision: 0,
    figures: [
      {
        key: 'main',
        title: '主力净流入(万): ',
        type: 'bar',
        baseValue: 0,
        styles: (data) => {
          const v = data.current.indicatorData?.main ?? 0
          return { color: v >= 0 ? UP : DOWN }
        },
      },
    ],
    calc: (dataList) =>
      dataList.map(d => ({
        main: typeof d.mainNet === 'number' ? Math.round(d.mainNet / 1e4) : null,
      })),
  })
}
