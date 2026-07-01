import { useMemo } from 'react';
import { Segmented, Tabs } from 'antd';
import { useCpStore } from '../../store/cpStore';
import type { BinType } from '../../types/cp';
import { aggregateBinPareto, failPareto } from '../../utils/yieldCalc';
import BinParetoTable from './BinParetoTable';
import ParetoBar from './ParetoBar';
import CdfChart from './CdfChart';

/** 右侧帕累托面板:Bin 类型切换 + 表 + (Bin Pareto / CDF) */
export default function BinParetoPanel() {
  const product = useCpStore((s) => s.product);
  const binType = useCpStore((s) => s.binType);
  const setBinType = useCpStore((s) => s.setBinType);

  const { rows, fails } = useMemo(() => {
    const r = aggregateBinPareto(product, product.wafers, binType);
    return { rows: r, fails: failPareto(r) };
  }, [product, binType]);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Bin Pareto</span>
        <Segmented
          size="small"
          value={binType}
          onChange={(v) => setBinType(v as BinType)}
          options={['HBin', 'SBin', 'SBinGroup']}
        />
      </div>
      <div style={{ padding: 8 }}>
        <BinParetoTable rows={rows} />
        <Tabs
          size="small"
          items={[
            { key: 'pareto', label: 'Bin Pareto', children: <ParetoBar rows={fails} /> },
            { key: 'cdf', label: 'CDF Plot', children: <CdfChart rows={fails} /> },
          ]}
        />
      </div>
    </div>
  );
}
