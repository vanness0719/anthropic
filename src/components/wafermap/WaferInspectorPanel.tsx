import { useMemo, useState } from 'react';
import { Button, Empty, Input, Segmented } from 'antd';
import { useCpStore } from '../../store/cpStore';
import type { BinType } from '../../types/cp';
import { aggregateBinPareto } from '../../utils/yieldCalc';
import WaferMap from './WaferMap';
import BinParetoTable from '../pareto/BinParetoTable';

/** 良率 0-100 → 红→绿 圆点 */
function yieldColor(pct: number): string {
  return `hsl(${(pct / 100) * 120}, 75%, 45%)`;
}

/** 单片 Wafer 检视:左侧选片列表,中间该片晶圆图,右侧该片 Bin 明细。 */
export default function WaferInspectorPanel() {
  const product = useCpStore((s) => s.product);
  const inspectedWaferId = useCpStore((s) => s.inspectedWaferId);
  const setInspectedWafer = useCpStore((s) => s.setInspectedWafer);
  const highlightedBin = useCpStore((s) => s.highlightedBin);
  const [colorBy, setColorBy] = useState<'yield' | 'bin'>('bin');
  const [binType, setBinType] = useState<BinType>('HBin');
  const [q, setQ] = useState('');

  const wafers = product.wafers;
  // 解析当前检视的 wafer(默认第一片)
  const wafer = useMemo(
    () => wafers.find((w) => w.waferId === inspectedWaferId) ?? wafers[0],
    [wafers, inspectedWaferId]
  );

  const rows = useMemo(
    () => (wafer ? aggregateBinPareto(product, [wafer], binType) : []),
    [product, wafer, binType]
  );

  const filtered = useMemo(
    () => (q ? wafers.filter((w) => w.waferId.toLowerCase().includes(q.toLowerCase())) : wafers),
    [wafers, q]
  );

  if (!wafer) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <Empty description="无 wafer 数据" />
      </div>
    );
  }

  const idx = wafers.findIndex((w) => w.waferId === wafer.waferId);
  const go = (d: number) => {
    const n = wafers[(idx + d + wafers.length) % wafers.length];
    if (n) setInspectedWafer(n.waferId);
  };
  const dieCount = wafer.dies.length;

  return (
    <div className="panel" style={{ marginTop: 8 }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Wafer Detail · 单片检视</span>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
          {wafers.length} 片 · 当前第 {idx + 1} 片
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* 左:选片列表 */}
        <div style={{ width: 200, display: 'flex', flexDirection: 'column' }}>
          <Input.Search
            size="small"
            allowClear
            placeholder="搜索 Wafer ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ marginBottom: 6 }}
          />
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}>
            {filtered.map((w) => {
              const active = w.waferId === wafer.waferId;
              return (
                <div
                  key={w.waferId}
                  className="wafer-row"
                  onClick={() => setInspectedWafer(w.waferId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    background: active ? '#e6f4ff' : undefined,
                    borderLeft: active ? '3px solid #1677ff' : '3px solid transparent',
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: yieldColor(w.yield),
                      flex: '0 0 auto',
                    }}
                  />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.waferId}
                  </span>
                  <span style={{ color: '#8c8c8c' }}>{w.yield}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 中:该片晶圆图 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
            <Button size="small" onClick={() => go(-1)}>
              ‹ 上一片
            </Button>
            <Segmented
              size="small"
              value={colorBy}
              onChange={(v) => setColorBy(v as 'yield' | 'bin')}
              options={[
                { label: 'Bin', value: 'bin' },
                { label: 'Yield', value: 'yield' },
              ]}
            />
            <Button size="small" onClick={() => go(1)}>
              下一片 ›
            </Button>
          </div>
          <WaferMap
            wafers={[wafer]}
            bins={product.hbins}
            highlightedBin={highlightedBin}
            colorBy={colorBy}
            size={280}
          />
          <div style={{ fontSize: 12, marginTop: 4 }}>
            <b>{wafer.waferId}</b> · Lot {wafer.lotId} · {wafer.date}
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            Yield <b style={{ color: yieldColor(wafer.yield) }}>{wafer.yield}%</b> · {dieCount.toLocaleString()} die
          </div>
        </div>

        {/* 右:该片 Bin 明细 */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>该片 Bin 明细(点击行高亮左图)</span>
            <Segmented
              size="small"
              value={binType}
              onChange={(v) => setBinType(v as BinType)}
              options={['HBin', 'SBin', 'SBinGroup']}
            />
          </div>
          <BinParetoTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
