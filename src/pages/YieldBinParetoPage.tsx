import { Breadcrumb } from 'antd';
import KpiBar from '../components/KpiBar';
import YieldTrendPanel from '../components/trend/YieldTrendPanel';
import BinParetoPanel from '../components/pareto/BinParetoPanel';
import WafermapPanel from '../components/wafermap/WafermapPanel';

/** CP Single Product · Yield/Bin Pareto 页面布局(三区联动) */
export default function YieldBinParetoPage() {
  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 8, fontSize: 12 }}
        items={[{ title: 'CP' }, { title: 'Single Product' }, { title: 'Yield/Bin Pareto' }]}
      />
      <KpiBar />

      {/* 上排:趋势(左) + 帕累托(右) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 60%', minWidth: 0 }}>
          <YieldTrendPanel />
        </div>
        <div style={{ flex: '1 1 40%', minWidth: 320 }}>
          <BinParetoPanel />
        </div>
      </div>

      {/* 下排:晶圆图 */}
      <WafermapPanel />
    </div>
  );
}
