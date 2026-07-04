// P3 应用外壳:未登录显示登录门;登录后 = 顶栏(导出/导入/当前用户) + 左侧菜单 + 页面。
import { useState } from 'react';
import { Button, Layout, Menu, Space, Tag, Upload, message } from 'antd';
import LoginGate from './components/LoginGate';
import { ROLE_LABELS } from './constants/stages';
import InventoryPage from './pages/InventoryPage';
import LogsPage from './pages/LogsPage';
import OrdersPage from './pages/OrdersPage';
import SettingsPage from './pages/SettingsPage';
import SummaryPage from './pages/SummaryPage';
import { useAppStore } from './store/appStore';
import { exportDb, readDbFile } from './store/persist';

const MENU_ITEMS = [
  { key: 'orders', label: '订单总表' },
  { key: 'inventory', label: '库存' },
  { key: 'summary', label: '汇总统计' },
  { key: 'logs', label: '操作日志' },
  { key: 'settings', label: '设置' },
];

export default function App() {
  const currentUser = useAppStore((s) => s.currentUser);
  const db = useAppStore((s) => s.db);
  const importDb = useAppStore((s) => s.importDb);
  const logout = useAppStore((s) => s.logout);
  const [page, setPage] = useState('orders');

  if (!currentUser) return <LoginGate />;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 46,
          paddingInline: 16,
          background: '#1f2a3d',
        }}
      >
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>P3 · 销售-生产-交付协同跟踪</span>
        <Space>
          <Button size="small" onClick={() => exportDb(db)}>
            导出数据
          </Button>
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={(f) => {
              readDbFile(f)
                .then((d) => {
                  importDb(d);
                  message.success('导入成功');
                })
                .catch((e: Error) => message.error(e.message || '导入失败'));
              return false;
            }}
          >
            <Button size="small">导入数据</Button>
          </Upload>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {currentUser.name} · {ROLE_LABELS[currentUser.role]}
          </Tag>
          <Button size="small" onClick={logout}>
            退出
          </Button>
        </Space>
      </Layout.Header>
      <Layout>
        <Layout.Sider width={140} theme="light">
          <Menu mode="inline" selectedKeys={[page]} onClick={(e) => setPage(e.key)} items={MENU_ITEMS} />
        </Layout.Sider>
        <Layout.Content style={{ padding: 12 }}>
          {page === 'orders' && <OrdersPage />}
          {page === 'inventory' && <InventoryPage />}
          {page === 'summary' && <SummaryPage />}
          {page === 'logs' && <LogsPage />}
          {page === 'settings' && <SettingsPage />}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
