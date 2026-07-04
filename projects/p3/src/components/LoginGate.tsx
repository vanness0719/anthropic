// 登录门:选择用户名进入(信任制,无密码);所有操作以所选身份记日志。
import { useState } from 'react';
import { Button, Card, Select, Typography } from 'antd';
import { ROLE_LABELS } from '../constants/stages';
import { useAppStore } from '../store/appStore';

export default function LoginGate() {
  const users = useAppStore((s) => s.db.users);
  const login = useAppStore((s) => s.login);
  const [userId, setUserId] = useState<string>();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card title="P3 · 销售-生产-交付协同跟踪" style={{ width: 380 }}>
        <Select
          style={{ width: '100%' }}
          placeholder="选择你的用户名"
          value={userId}
          onChange={setUserId}
          options={users.map((u) => ({ value: u.id, label: `${u.name}(${ROLE_LABELS[u.role]})` }))}
        />
        <Button type="primary" block style={{ marginTop: 12 }} disabled={!userId} onClick={() => userId && login(userId)}>
          进入系统
        </Button>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          所有录入、修改、锁定操作都会以所选身份记入操作日志。新增用户请由管理员在「设置」页维护。
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
