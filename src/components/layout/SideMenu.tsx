// 左侧 CP 模块菜单。当前仅 "Yield/Bin Pareto" 可用并高亮,其余为静态占位。
const GROUPS: { group: string; items: string[] }[] = [
  { group: 'Single Product', items: ['Yield/Bin Pareto', 'Zonal Analysis', 'Reticle Analysis', 'Site Analysis'] },
  { group: 'Multi Products', items: ['Yield/Bin Pareto', 'Yield Summary', 'BinMap Gallery'] },
  { group: 'SP/WS Analysis', items: ['By Parameter', 'Cpk Trend', 'Fail Pareto', 'Correlation', 'By Test Sites', 'Sensitivity Analysis'] },
  { group: 'Test Check', items: ['Testing Check', 'Tester Usage', 'Test Performance', 'Retest Analysis'] },
];

export default function SideMenu() {
  return (
    <div className="deyms-side">
      <div style={{ padding: '4px 14px 8px', fontWeight: 700, fontSize: 13 }}>CP ▾</div>
      {GROUPS.map((g) => (
        <div key={g.group}>
          <div className="side-group">{g.group}</div>
          {g.items.map((it, idx) => {
            const active = g.group === 'Single Product' && idx === 0;
            return (
              <div key={it} className={`side-item${active ? ' active' : ''}`}>
                {it}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
