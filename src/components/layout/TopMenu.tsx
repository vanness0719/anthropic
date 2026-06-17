import { Space } from 'antd';

const MENUS = ['Summary', 'CP', 'FT', 'WAT', 'Metrology', 'Defect', 'MORE'];

/** 顶部主菜单条,复刻 DE-YMS 顶栏样式 */
export default function TopMenu() {
  return (
    <div
      style={{
        height: 40,
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 24,
      }}
    >
      <div style={{ fontWeight: 700, color: '#1677ff', fontSize: 16, letterSpacing: 0.5 }}>
        DE-YMS
      </div>
      <Space size={20}>
        {MENUS.map((m) => (
          <span
            key={m}
            style={{
              fontSize: 13,
              color: m === 'CP' ? '#1677ff' : '#595959',
              fontWeight: m === 'CP' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {m} {m !== 'MORE' ? '▾' : ''}
          </span>
        ))}
      </Space>
      <div style={{ flex: 1 }} />
      <Space size={16} style={{ color: '#8c8c8c', fontSize: 13 }}>
        <span>DE-G</span>
        <span>⚙ Config</span>
        <span>👤 user</span>
      </Space>
    </div>
  );
}
