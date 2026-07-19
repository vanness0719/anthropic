// 登录门。server 模式:用户名 + 密码;local 模式(便携/单机):选用户名即进(信任制)。
import { useState } from 'react';
import { Button, Card, Input, Select, Spin, Typography, message } from 'antd';
import { ROLE_LABELS } from '../constants/stages';
import { useAppStore } from '../store/appStore';

export default function LoginGate() {
  const mode = useAppStore((s) => s.mode);
  const users = useAppStore((s) => s.db.users);
  const login = useAppStore((s) => s.login);

  const [userId, setUserId] = useState<string>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (mode === 'connecting') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="连接服务器中…" />
      </div>
    );
  }

  const doServerLogin = async () => {
    if (!username.trim()) return;
    setLoading(true);
    const err = await login(username.trim(), password);
    setLoading(false);
    if (err) message.error(err);
  };

  const doLocalLogin = () => {
    if (userId) void login(userId);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card title="P3 · 销售-生产-交付协同跟踪" style={{ width: 380 }}>
        {mode === 'server' ? (
          <>
            <Input
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onPressEnter={doServerLogin}
              style={{ marginBottom: 8 }}
            />
            <Input.Password
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPressEnter={doServerLogin}
            />
            <Button type="primary" block style={{ marginTop: 12 }} loading={loading} onClick={doServerLogin}>
              登录
            </Button>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
              多人在线模式:请用管理员分配的账号密码登录。演示账号默认口令 <b>p3admin</b>,
              首次登录后请在「设置」中修改。所有操作按登录身份记入日志。
            </Typography.Paragraph>
          </>
        ) : (
          <>
            <Select
              style={{ width: '100%' }}
              placeholder="选择你的用户名"
              value={userId}
              onChange={setUserId}
              options={users.map((u) => ({ value: u.id, label: `${u.name}(${ROLE_LABELS[u.role]})` }))}
            />
            <Button type="primary" block style={{ marginTop: 12 }} disabled={!userId} onClick={doLocalLogin}>
              进入系统
            </Button>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
              单机模式(数据存本浏览器)。所有操作以所选身份记入操作日志。新增用户请在「设置」页维护。
            </Typography.Paragraph>
          </>
        )}
      </Card>
    </div>
  );
}
