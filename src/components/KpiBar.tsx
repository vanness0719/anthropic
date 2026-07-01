import { useMemo } from 'react';
import { useCpStore } from '../store/cpStore';
import {
  aggregateBinPareto,
  avgYield,
  edgeYield,
  nonEdgeYield,
  passBinSet,
  topFailBin,
  yoyDelta,
} from '../utils/yieldCalc';

function Metric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div style={{ padding: '0 18px', borderRight: '1px solid #f0f0f0', minWidth: 96 }}>
      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, lineHeight: '24px' }}>{value}</div>
      {sub != null && <div style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

/** 顶部 KPI 栏:良率、批次/晶圆数、Top Fail Bin、Edge/Non-Edge 良率 */
export default function KpiBar() {
  const product = useCpStore((s) => s.product);
  const binType = useCpStore((s) => s.binType);

  const m = useMemo(() => {
    const wafers = product.wafers;
    const passBins = passBinSet(product.hbins);
    const pareto = aggregateBinPareto(product, wafers, binType);
    const top = topFailBin(pareto);
    const lots = new Set(wafers.map((w) => w.lotId)).size;
    const scrap = wafers.filter((w) => w.yield < 30).length;
    return {
      avg: avgYield(wafers),
      delta: yoyDelta(wafers),
      lots,
      wafers: wafers.length,
      scrap,
      top,
      edge: edgeYield(wafers, passBins),
      nonEdge: nonEdgeYield(wafers, passBins),
    };
  }, [product, binType]);

  const deltaColor = m.delta >= 0 ? '#52c41a' : '#ff4d4f';
  const deltaArrow = m.delta >= 0 ? '▲' : '▼';

  return (
    <div
      className="panel"
      style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', marginBottom: 8 }}
    >
      <Metric
        label="ProductCS"
        value={product.productId}
        sub={
          <span style={{ color: '#8c8c8c' }}>
            {product.dateRange[0]} ~ {product.dateRange[1]}
          </span>
        }
      />
      <Metric
        label="Avg.Yield"
        value={`${m.avg}%`}
        sub={
          <span style={{ color: deltaColor }}>
            {deltaArrow} {Math.abs(m.delta)}%
          </span>
        }
      />
      <Metric label="# Lot" value={m.lots} />
      <Metric label="Wafers" value={m.wafers} />
      <Metric label="Scrap" value={m.scrap} />
      <Metric
        label="Top Fail Bin"
        value={<span style={{ fontSize: 14 }}>{m.top ? `${m.top.bin}:${m.top.name}` : '-'}</span>}
        sub={<span style={{ color: '#fa8c16' }}>{m.top ? `${m.top.pct}%` : ''}</span>}
      />
      <Metric label="Wafer Edge Yield" value={`${m.edge}%`} />
      <Metric label="Non-Edge Yield" value={`${m.nonEdge}%`} />
    </div>
  );
}
