import ReactECharts from 'echarts-for-react';
import type { ParetoRow } from '../../types/cp';

/** 失效 Bin 累计分布(CDF)折线图 */
export default function CdfChart({ rows }: { rows: ParetoRow[] }) {
  const labels = rows.map((r) => `${r.bin}`);
  const option = {
    grid: { left: 48, right: 24, top: 24, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: labels,
      name: 'Bin#',
      nameLocation: 'middle',
      nameGap: 26,
      axisLabel: { fontSize: 10 },
    },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', fontSize: 10 } },
    series: [
      {
        type: 'line',
        data: rows.map((r) => r.cumPct),
        smooth: false,
        symbol: 'circle',
        symbolSize: 6,
        areaStyle: { opacity: 0.12 },
        lineStyle: { color: '#1677ff' },
        itemStyle: { color: '#1677ff' },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 260 }} />;
}
