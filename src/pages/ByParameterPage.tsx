import { useMemo, useState } from 'react';
import { Breadcrumb, Empty, Input, Select, Table, Tag } from 'antd';
import ReactECharts from 'echarts-for-react';
import { useCpStore } from '../store/cpStore';
import { computeStats, histogram, fmt } from '../utils/paramStats';

/** SP/WS Analysis · By Parameter:查看每个测试项的实测数据分布与统计 */
export default function ByParameterPage() {
  const product = useCpStore((s) => s.product);
  const param = product.paramData;
  const [q, setQ] = useState('');
  const [selKey, setSelKey] = useState<string | null>(null);
  const [waferId, setWaferId] = useState<string>('__all__');

  const items = param?.items ?? [];
  const selected = useMemo(() => items.find((it) => it.key === selKey) ?? items[0], [items, selKey]);
  const isFunctional = selected?.kind === 'F';

  const wafersWithData = useMemo(() => {
    if (!param || !selected) return [];
    return [...(param.values.get(selected.key)?.keys() ?? [])];
  }, [param, selected]);

  const values = useMemo(() => {
    if (!param || !selected) return [];
    const byWafer = param.values.get(selected.key);
    if (!byWafer) return [];
    if (waferId === '__all__') return ([] as number[]).concat(...byWafer.values());
    return byWafer.get(waferId) ?? [];
  }, [param, selected, waferId]);

  const stats = useMemo(() => computeStats(values, selected?.lo ?? null, selected?.hi ?? null), [values, selected]);
  const hist = useMemo(() => (isFunctional ? null : histogram(values, 40)), [values, isFunctional]);

  const filteredItems = useMemo(
    () => (q ? items.filter((it) => it.name.toLowerCase().includes(q.toLowerCase()) || String(it.num).includes(q)) : items),
    [items, q]
  );

  // 每片 wafer 的统计(参数=均值,功能=失败率%)
  const perWafer = useMemo(() => {
    if (!param || !selected) return [];
    const byWafer = param.values.get(selected.key);
    if (!byWafer) return [];
    return [...byWafer].map(([wid, arr]) => {
      const n = arr.length || 1;
      const sum = arr.reduce((s, v) => s + v, 0);
      return { waferId: wid, n: arr.length, metric: isFunctional ? +((sum / n) * 100).toFixed(2) : sum / n };
    });
  }, [param, selected, isFunctional]);

  if (!param || !items.length) {
    return (
      <div>
        <Breadcrumb style={{ marginBottom: 8, fontSize: 12 }} items={[{ title: 'CP' }, { title: 'SP/WS Analysis' }, { title: 'By Parameter' }]} />
        <div className="panel" style={{ padding: 40 }}>
          <Empty
            description={
              <span>
                当前数据没有参数测试记录(PTR/MPR/FTR)。<br />
                请点右上角 <b>「打开 STDF(可多选)」</b> 上传包含测试记录的 STDF 文件后查看。
                <br />
                <span style={{ color: '#8c8c8c', fontSize: 12 }}>(内置 Mock / 真实STDF 数据集不含逐点测试数据)</span>
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
  const nP = items.filter((i) => i.kind === 'P').length;
  const nF = items.length - nP;

  // 参数测试直方图(value 轴 + 自绘矩形,LO/HI/μ 参考线仅在范围内绘制)
  let histOption: Record<string, unknown> | null = null;
  if (hist && hist.bins.length) {
    const [rlo, rhi] = hist.range;
    const marks: Record<string, unknown>[] = [];
    const inRange = (v: number) => v >= rlo && v <= rhi;
    if (lo != null && inRange(lo)) marks.push({ xAxis: lo, lineStyle: { color: '#ff4d4f' }, label: { formatter: `LO ${fmt(lo)}`, color: '#ff4d4f', fontSize: 10, position: 'insideEndTop' } });
    if (hi != null && inRange(hi)) marks.push({ xAxis: hi, lineStyle: { color: '#ff4d4f' }, label: { formatter: `HI ${fmt(hi)}`, color: '#ff4d4f', fontSize: 10, position: 'insideEndTop' } });
    if (inRange(stats.mean)) marks.push({ xAxis: stats.mean, lineStyle: { color: '#1677ff', type: 'dashed' }, label: { formatter: `μ ${fmt(stats.mean)}`, color: '#1677ff', fontSize: 10, position: 'insideEndBottom' } });
    histOption = {
      grid: { left: 56, right: 24, top: 16, bottom: 44 },
      tooltip: { trigger: 'item', formatter: (p: { data: number[] }) => `[${fmt(p.data[0])}, ${fmt(p.data[1])})<br/>数量 <b>${p.data[2]}</b>` },
      xAxis: { type: 'value', min: rlo, max: rhi, name: selected?.units || '', nameLocation: 'end', axisLabel: { formatter: (v: number) => fmt(v), fontSize: 9, hideOverlap: true } },
      yAxis: { type: 'value', name: '数量', axisLabel: { fontSize: 10 } },
      series: [
        {
          type: 'custom',
          renderItem: (_params: unknown, api: { value: (i: number) => number; coord: (d: number[]) => number[]; style: () => unknown }) => {
            const x0 = api.value(0);
            const x1 = api.value(1);
            const yv = api.value(2);
            const p0 = api.coord([x0, 0]);
            const p1 = api.coord([x1, yv]);
            const w = p1[0] - p0[0];
            return { type: 'rect', shape: { x: p0[0] + 0.5, y: p1[1], width: Math.max(w - 1, 0.5), height: p0[1] - p1[1] }, style: api.style() };
          },
          encode: { x: [0, 1], y: 2 },
          data: hist.bins.map((bn) => [bn.x0, bn.x1, bn.count]),
          itemStyle: { color: '#69b1ff' },
          markLine: { silent: true, symbol: 'none', data: marks },
        },
      ],
    };
  }

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 8, fontSize: 12 }} items={[{ title: 'CP' }, { title: 'SP/WS Analysis' }, { title: 'By Parameter' }]} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        {/* 左:测试项列表 */}
        <div className="panel" style={{ width: 270, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">
            测试项 {items.length} <span style={{ fontWeight: 400, color: '#8c8c8c', fontSize: 12 }}>(参数 {nP} · 功能 {nF})</span>
          </div>
          <div style={{ padding: 8 }}>
            <Input.Search size="small" allowClear placeholder="搜索测试项 / 编号" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 560 }}>
            {filteredItems.map((it) => {
              const active = it.num === selected?.num;
              return (
                <div
                  key={it.key}
                  className="param-row"
                  onClick={() => setSelKey(it.key)}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: 12,
                    background: active ? '#e6f4ff' : undefined,
                    borderLeft: active ? '3px solid #1677ff' : '3px solid transparent',
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.kind === 'F' && <Tag color="orange" style={{ marginRight: 4, lineHeight: '16px', padding: '0 4px' }}>功能</Tag>}
                    {it.name}
                  </div>
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

        {/* 右:统计 + 直方图 / 通过失败 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="panel">
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {selected?.name} <span style={{ color: '#8c8c8c', fontWeight: 400 }}>#{selected?.num}{selected?.units ? ` · ${selected.units}` : ''}{isFunctional ? ' · 功能测试' : ''}</span>
              </span>
              <Select
                size="small"
                style={{ width: 220 }}
                value={waferId}
                onChange={setWaferId}
                options={[{ label: `全部 wafer (${wafersWithData.length} 片)`, value: '__all__' }, ...wafersWithData.map((w) => ({ label: w, value: w }))]}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', rowGap: 10, padding: '10px 4px' }}>
              {isFunctional ? (
                <>
                  {stat('N', stats.n.toLocaleString())}
                  {stat('Pass', (stats.n - stats.failCount).toLocaleString(), '#52c41a')}
                  {stat('Fail', stats.failCount.toLocaleString(), stats.failCount ? '#ff4d4f' : undefined)}
                  {stat('Fail%', `${stats.failPct}%`, stats.failCount ? '#ff4d4f' : undefined)}
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>

          {!isFunctional && histOption && (
            <div className="panel">
              <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>分布直方图</span>
                {hist?.clipped && (
                  <span style={{ fontSize: 11, color: '#fa8c16', fontWeight: 400 }}>
                    为清晰显示已裁剪离群点:低 {hist.below} · 高 {hist.above}(统计值仍基于全部 {stats.n} 点)
                  </span>
                )}
              </div>
              <ReactECharts option={histOption} style={{ height: 300 }} notMerge />
            </div>
          )}

          {isFunctional && (
            <div className="panel" style={{ padding: 16, color: '#8c8c8c', fontSize: 13 }}>
              功能测试仅有通过/失败结果,无实测数值分布。上方为通过/失败统计;下表为各片失败率。
            </div>
          )}

          {perWafer.length > 1 && (
            <div className="panel">
              <div className="panel-title">片间{isFunctional ? '失败率' : '均值'}对比 ({perWafer.length} 片)</div>
              <Table
                size="small"
                rowKey="waferId"
                pagination={false}
                scroll={{ y: 200 }}
                dataSource={perWafer}
                columns={[
                  { title: 'Wafer', dataIndex: 'waferId' },
                  { title: 'N', dataIndex: 'n', width: 90 },
                  {
                    title: isFunctional ? 'Fail%' : 'Mean',
                    dataIndex: 'metric',
                    width: 140,
                    render: (v: number) => (isFunctional ? `${v}%` : fmt(v)),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
