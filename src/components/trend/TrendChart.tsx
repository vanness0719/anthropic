import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useCpStore } from '../../store/cpStore';
import type { Wafer } from '../../types/cp';

/** 趋势图 X 轴标签按 Smart Split 粒度生成 */
function labelOf(w: Wafer, split: string): string {
  if (split === 'Month') return w.date.slice(0, 7);
  if (split === 'Week') {
    const d = new Date(w.date);
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((+d - +onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return w.date;
}

/**
 * Yield Trend 折线/散点图(wafer 级)。
 * 通过 brush 框选 wafer -> 写入 store(保留最近 2 片)做 baseline 对比。
 */
export default function TrendChart() {
  const product = useCpStore((s) => s.product);
  const smartSplit = useCpStore((s) => s.smartSplit);
  const setSelectedWafers = useCpStore((s) => s.setSelectedWafers);
  const selectedWaferIds = useCpStore((s) => s.selectedWaferIds);
  const chartRef = useRef<ReactECharts>(null);

  const sorted = useMemo(
    () => [...product.wafers].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [product.wafers]
  );

  const option = useMemo(() => {
    const labels = sorted.map((w) => labelOf(w, smartSplit));
    const recentCount = Math.max(1, Math.floor(sorted.length * 0.15));
    const recentStart = sorted.length - recentCount;
    const selectedSet = new Set(selectedWaferIds);

    return {
      grid: { left: 48, right: 24, top: 16, bottom: 64 },
      tooltip: {
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const w = sorted[p.dataIndex];
          return `${w.waferId}<br/>Lot: ${w.lotId}<br/>Date: ${w.date}<br/>Yield: ${w.yield}%`;
        },
      },
      brush: {
        toolbox: ['rect', 'clear'],
        xAxisIndex: 0,
        throttleType: 'debounce',
        throttleDelay: 200,
        brushStyle: { borderColor: '#fa541c', color: 'rgba(250,84,28,0.12)' },
      },
      toolbox: {
        show: true,
        right: 10,
        top: -4,
        feature: { brush: { type: ['rect', 'clear'], title: { rect: '框选 wafer', clear: '清除' } } },
      },
      xAxis: {
        type: 'category',
        data: labels,
        name: `${smartSplit} > LotID > WaferNo`,
        nameLocation: 'middle',
        nameGap: 42,
        axisLabel: { fontSize: 9, interval: 'auto', rotate: 30, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        name: 'Hard Bin Yield (%)',
        min: (v: { min: number }) => Math.max(0, Math.floor(v.min - 5)),
        max: 100,
        axisLabel: { formatter: '{value}%', fontSize: 10 },
      },
      series: [
        // 连接线(不参与 brush)
        {
          type: 'line',
          showSymbol: false,
          silent: true,
          data: sorted.map((w) => w.yield),
          lineStyle: { color: '#1677ff', width: 1 },
          z: 1,
        },
        // 散点(brush 可选;line 系列的 brush 不上报 dataIndex,scatter 才可靠)
        {
          type: 'scatter',
          symbolSize: (_: unknown, p: { dataIndex: number }) =>
            selectedSet.has(sorted[p.dataIndex].waferId) ? 13 : 7,
          data: sorted.map((w, i) => ({
            value: w.yield,
            itemStyle: {
              color: selectedSet.has(w.waferId)
                ? '#fa541c'
                : i >= recentStart
                  ? '#52c41a'
                  : '#1677ff',
              borderColor: selectedSet.has(w.waferId) ? '#820014' : undefined,
              borderWidth: selectedSet.has(w.waferId) ? 2 : 0,
            },
          })),
          z: 2,
        },
      ],
    };
  }, [sorted, smartSplit, selectedWaferIds]);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      notMerge
      style={{ height: 280 }}
      onEvents={{
        // 框选 -> 收集选中 wafer(ECharts 事件名为小写 brushselected;合并各系列选中项)
        brushselected: (params: { batch?: { selected?: { dataIndex?: number[] }[] }[] }) => {
          const idxs = new Set<number>();
          for (const sel of params.batch?.[0]?.selected ?? []) {
            for (const i of sel.dataIndex ?? []) idxs.add(i);
          }
          if (idxs.size) {
            setSelectedWafers([...idxs].map((i) => sorted[i].waferId));
          }
        },
        // 单击点也可加入选择
        click: (p: { dataIndex: number }) => {
          const w = sorted[p.dataIndex];
          if (w) setSelectedWafers([...selectedWaferIds, w.waferId]);
        },
      }}
    />
  );
}
