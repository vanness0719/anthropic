import { useMemo, useState } from 'react';
import { Breadcrumb, Empty, Input, Select, Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useCpStore } from '../store/cpStore';
import { computeStats, histogram, fmt } from '../utils/paramStats';

/** SP/WS Analysis · By Parameter:查看每个测试项的实测数据分布与统计 */
export default function ByParameterPage() {
  const product = useCpStore((s) => s.product);
  const param = product.paramData;
  const [q, setQ] = useState('');
  const [selNum, setSelNum] = useState<number | null>(null);
  const [waferId, setWaferId] = useState<string>('__all__');

  const items = param?.items ?? [];
  const selected = useMemo(
    () => items.find((it) => it.num === selNum) ?? items[0],
    [items, selNum]
  );

  const wafersWithData = useMemo(() => {
    if (!param || !selected) return [];
    return [...(param.values.get(selected.num)?.keys() ?? [])];
  }, [param, selected]);

  // 当前测试项 + 选定 wafer 的实测值
  const values = useMemo(() => {
    if (!param || !selected) return [];
    const byWafer = param.values.get(selected.num);
    if (!byWafer) return [];
    if (waferId === '__all__') return ([] as number[]).concat(...byWafer.values());
    return byWafer.get(waferId) ?? [];
  }, [param, selected, waferId]);

  const stats = useMemo(
    () => computeStats(values, selected?.lo ?? null, selected?.hi ?? null),
    [values, selected]
  );
  const hist = useMemo(() => histogram(values, 40), [values]);

  const filteredItems = useMemo(
    () =>
      q
        ? items.filter((it) => it.name.toLowerCase().includes(q.toLowerCase()) || String(it.num).includes(q))
        : items,
    [items, q]
  );

  // 每片 wafer 的均值(片间对比)
  const perWaferMean = useMemo(() => {
    if (!param || !selected) return [];
    const byWafer = param.values.get(selected.num);
    if (!byWafer) return [];
    return [...byWafer].map(([wid, arr]) => ({
      waferId: wid,
      mean: arr.reduce((s, v) => s + v, 0) / (arr.length || 1),
      n: arr.length,
    }));
  }, [param, selected]);

  if (!param || !items.length) {
    return (
      <div>
        <Breadcrumb style={{ marginBottom: 8, fontSize: 12 }} items={[{ title: 'CP' }, { title: 'SP/WS Analysis' }, { title: 'By Parameter' }]} />
        <div className="panel" style={{ padding: 40 }}>
          <Empty
            description={
              <span>
                当前数据没有参数测试记录(PTR)。<br />
                请点右上角 <b>「打开 STDF(可多选)」</b> 上传包含参数测试的 STDF 文件后查看。
                <br />
                <span style={{ color: '#8c8c8c', fontSize: 12 }}>(内置 Mock / 真实STDF 数据集不含逐点参数数据)</span>
              </span>
            }
          />
        </div>
      </div>
    );
  }

  const stat = (label: string, value: React.ReactNode, color?: string) => (
    <div style={{ padding: '0 16px', borderRight: '1px solid #f0f0f0' }}>
      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color }}>{value}</div>
    </div>
  );

  const lo = selected?.lo ?? null;
  const hi = selected?.hi ?? null;
  const markLines = [];
  if (lo != null) markLines.push({ xAxis: lo, name: 'LO', lineStyle: { color: '#ff4d4f' }, label: { formatter: `LO ${fmt(lo)}`, color: '#ff4d4f', fontSize: 10 } });
  if (hi != null) markLines.push({ xAxis: hi, name: 'HI', lineStyle: { color: '#ff4d4f' }, label: { formatter: `HI ${fmt(hi)}`, color: '#ff4d4f', fontSize: 10 } });
  markLines.push({ xAxis: stats.mean, name: 'μ', lineStyle: { color: '#1677ff', type: 'dashed' as const }, label: { formatter: `μ ${fmt(stats.mean)}`, color: '#1677ff', fontSize: 10 } });

  const histOption = {
    grid: { left: 48, right: 24, top: 24, bottom: 40 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: hist.centers.map((c) => fmt(c)), name: selected?.units || '', nameLocation: 'end', axisLabel: { fontSize: 9, hideOverlap: true } },
    yAxis: { type: 'value', name: '数量', axisLabel: { fontSize: 10 } },
    series: [
      {
        type: 'bar',
        data: hist.counts,
        barWidth: '96%',
        itemStyle: { color: '#69b1ff' },
        markLine: { symbol: 'none', data: markLines },
      },
    ],
  };

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 8, fontSize: 12 }} items={[{ title: 'CP' }, { title: 'SP/WS Analysis' }, { title: 'By Parameter' }]} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        {/* 左:测试项列表 */}
        <div className="panel" style={{ width: 260, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">测试项 ({items.length})</div>
          <div style={{ padding: 8 }}>
            <Input.Search size="small" allowClear placeholder="搜索测试项 / 编号" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 560 }}>
            {filteredItems.map((it) => {
              const active = it.num === selected?.num;
              return (
                <div
                  key={it.num}
                  className="param-row"
                  onClick={() => setSelNum(it.num)}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: 12,
                    background: active ? '#e6f4ff' : undefined,
                    borderLeft: active ? '3px solid #1677ff' : '3px solid transparent',
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                  <div style={{ color: '#8c8c8c' }}>
                    #{it.num}
                    {it.units ? ` · ${it.units}` : ''}
                    {it.lo != null || it.hi != null ? ` · [${it.lo != null ? fmt(it.lo) : ''}, ${it.hi != null ? fmt(it.hi) : ''}]` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右:统计 + 直方图 + 片间均值 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="panel">
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {selected?.name} <span style={{ color: '#8c8c8c', fontWeight: 400 }}>#{selected?.num}{selected?.units ? ` · ${selected.units}` : ''}</span>
              </span>
              <Select
                size="small"
                style={{ width: 220 }}
                value={waferId}
                onChange={setWaferId}
                options={[
                  { label: `全部 wafer (${wafersWithData.length} 片)`, value: '__all__' },
                  ...wafersWithData.map((w) => ({ label: w, value: w })),
                ]}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 10, padding: '10px 4px' }}>
              {stat('N', stats.n.toLocaleString())}
              {stat('Mean', fmt(stats.mean))}
              {stat('Std', fmt(stats.std))}
              {stat('Min', fmt(stats.min))}
              {stat('Max', fmt(stats.max))}
              {stat('Median', fmt(stats.median))}
              {stat('LO', lo != null ? fmt(lo) : '-')}
              {stat('HI', hi != null ? fmt(hi) : '-')}
              {stat('Cp', stats.cp ?? '-')}
              {stat('Cpk', stats.cpk ?? '-', stats.cpk != null && stats.cpk < 1.33 ? '#fa8c16' : undefined)}
              {stat('超限', `${stats.failCount} (${stats.failPct}%)`, stats.failCount ? '#ff4d4f' : undefined)}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">分布直方图</div>
            <ReactECharts option={histOption} style={{ height: 300 }} notMerge />
          </div>

          {waferId === '__all__' && perWaferMean.length > 1 && (
            <div className="panel">
              <div className="panel-title">片间均值对比 ({perWaferMean.length} 片)</div>
              <Table
                size="small"
                rowKey="waferId"
                pagination={false}
                scroll={{ y: 200 }}
                dataSource={perWaferMean}
                columns={[
                  { title: 'Wafer', dataIndex: 'waferId' },
                  { title: 'N', dataIndex: 'n', width: 90 },
                  { title: 'Mean', dataIndex: 'mean', width: 140, render: (v: number) => fmt(v) },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
