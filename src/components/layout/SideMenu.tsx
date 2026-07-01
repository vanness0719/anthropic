// 左侧 CP 模块菜单。"Yield/Bin Pareto" 与 "By Parameter" 可点击切换,其余为占位。
import { useCpStore, type ActiveView } from '../../store/cpStore';

const GROUPS: { group: string; items: string[] }[] = [
  { group: 'Single Product', items: ['Yield/Bin Pareto', 'Zonal Analysis', 'Reticle Analysis', 'Site Analysis'] },
  { group: 'Multi Products', items: ['Yield/Bin Pareto', 'Yield Summary', 'BinMap Gallery'] },
  { group: 'SP/WS Analysis', items: ['By Parameter', 'Cpk Trend', 'Fail Pareto', 'Correlation', 'By Test Sites', 'Sensitivity Analysis'] },
  { group: 'Test Check', items: ['Testing Check', 'Tester Usage', 'Test Performance', 'Retest Analysis'] },
];

// 可点击的菜单项 -> 视图 key
const ROUTES: Record<string, ActiveView> = {
  'Single Product/Yield/Bin Pareto': 'yield',
  'SP/WS Analysis/By Parameter': 'byParameter',
};

export default function SideMenu() {
  const activeView = useCpStore((s) => s.activeView);
  const setActiveView = useCpStore((s) => s.setActiveView);

  return (
    <div className="deyms-side">
      <div style={{ padding: '4px 14px 8px', fontWeight: 700, fontSize: 13 }}>CP ▾</div>
      {GROUPS.map((g) => (
        <div key={g.group}>
          <div className="side-group">{g.group}</div>
          {g.items.map((it) => {
            const route = ROUTES[`${g.group}/${it}`];
            const active = route != null && route === activeView;
            return (
              <div
                key={`${g.group}/${it}`}
                className={`side-item${active ? ' active' : ''}`}
                onClick={route ? () => setActiveView(route) : undefined}
                style={{ cursor: route ? 'pointer' : 'default', opacity: route ? 1 : 0.55 }}
              >
                {it}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
