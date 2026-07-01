import { Empty, Tabs } from 'antd';
import SmartSplitControl from './SmartSplitControl';
import TrendChart from './TrendChart';

/** 左/中:Yield Trend 面板。Line Chart 已实现,Box Plot / Bin Trend 占位。 */
export default function YieldTrendPanel() {
  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        className="panel-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <span>Yield Trend</span>
        <SmartSplitControl />
      </div>
      <div style={{ padding: 8, flex: 1 }}>
        <Tabs
          size="small"
          items={[
            { key: 'line', label: 'Line Chart', children: <TrendChart /> },
            {
              key: 'box',
              label: 'Box Plot',
              children: <Empty description="Box Plot 待实现" style={{ marginTop: 60 }} />,
            },
            {
              key: 'bin',
              label: 'Bin Trend',
              children: <Empty description="Bin Trend 待实现" style={{ marginTop: 60 }} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
