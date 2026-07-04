// 设置:各阶段默认周期(新建订单预填)与用户管理(仅管理员)。
import { useState } from 'react';
import { Button, Card, Input, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ROLE_LABELS, STAGE_LABELS, STAGE_ORDER } from '../constants/stages';
import { useAppStore } from '../store/appStore';
import type { Role, StageKey, User } from '../types';

export default function SettingsPage() {
  const settings = useAppStore((s) => s.db.settings);
  const users = useAppStore((s) => s.db.users);
  const currentUser = useAppStore((s) => s.currentUser);
  const setDefaultCycle = useAppStore((s) => s.setDefaultCycle);
  const addUser = useAppStore((s) => s.addUser);
  const removeUser = useAppStore((s) => s.removeUser);

  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('sales');

  const isAdmin = currentUser?.role === 'admin';

  const cycleRows = STAGE_ORDER.map((key) => ({ key, label: STAGE_LABELS[key], days: settings.defaultCycles[key] }));
  const cycleCols: ColumnsType<(typeof cycleRows)[number]> = [
    { title: '阶段', dataIndex: 'label', width: 160 },
    {
      title: '默认周期(天)',
      width: 160,
      render: (_, r) => (
        <InputNumber
          size="small"
          min={1}
          value={r.days}
          onChange={(v) => v != null && setDefaultCycle(r.key as StageKey, v)}
        />
      ),
    },
  ];

  const userCols: ColumnsType<User> = [
    { title: '用户名', dataIndex: 'name', width: 140 },
    { title: '角色', dataIndex: 'role', width: 120, render: (v: Role) => <Tag>{ROLE_LABELS[v]}</Tag> },
    {
      title: '操作',
      width: 90,
      render: (_, u) => (
        <Popconfirm
          title={`确认删除用户 ${u.name}?`}
          disabled={!isAdmin}
          onConfirm={() => {
            const err = removeUser(u.id);
            if (err) message.error(err);
          }}
        >
          <Typography.Link type="danger" disabled={!isAdmin}>
            删除
          </Typography.Link>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small" title="阶段默认周期(仅影响之后新建的订单;已有订单在订单详情内单独调整)">
        <Table size="small" rowKey="key" columns={cycleCols} dataSource={cycleRows} pagination={false} style={{ maxWidth: 420 }} />
      </Card>
      <Card size="small" title="用户管理(仅管理员可增删)">
        <Space style={{ marginBottom: 10 }}>
          <Input placeholder="用户名" style={{ width: 160 }} value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
          <Select
            style={{ width: 140 }}
            value={role}
            onChange={setRole}
            disabled={!isAdmin}
            options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Button
            type="primary"
            disabled={!isAdmin}
            onClick={() => {
              const err = addUser(name, role);
              if (err) message.error(err);
              else {
                message.success('已添加');
                setName('');
              }
            }}
          >
            添加用户
          </Button>
        </Space>
        <Table size="small" rowKey="id" columns={userCols} dataSource={users} pagination={false} style={{ maxWidth: 480 }} />
      </Card>
    </Space>
  );
}
