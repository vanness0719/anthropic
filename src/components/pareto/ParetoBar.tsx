import ReactECharts from 'echarts-for-react';
import type { ParetoRow } from '../../types/cp';
import { useCpStore } from '../../store/cpStore';

/** 失效 Bin 横向帕累托条形图 + 累计折线;点击柱 -> 高亮 wafermap */
export default function ParetoBar({ rows }: { rows: ParetoRow[] }) {
  const setHighlightedBin = useCpStore((s) => s.setHighlightedBin);
  const highlightedBin = useCpStore((s) => s.highlightedBin);

  // 横向条形图:类目从上到下,故反转使最大在顶部
  const data = [...rows].reverse();
  const labels = data.map((r) => `${r.bin}:${r.name}`);

  const option = {
    grid: { left: 160, right: 48, top: 16, bottom: 28 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%', fontSize: 10 } },
    yAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10 } },
    series: [
      {
        type: 'bar',
        data: data.map((r) => ({
          value: r.pct,
          itemStyle: {
            color: r.color,
            opacity: highlightedBin == null || highlightedBin === r.bin ? 1 : 0.35,
          },
        })),
        barWidth: '60%',
        label: { show: true, position: 'right', formatter: '{c}%', fontSize: 10 },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 260 }}
      onEvents={{
        click: (p: { dataIndex: number }) => {
          const r = data[p.dataIndex];
          if (r) setHighlightedBin(highlightedBin === r.bin ? null : r.bin);
        },
      }}
    />
  );
}
