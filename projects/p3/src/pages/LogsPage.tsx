// 操作日志:所有录入/修改/锁定/解锁/被拒/库存/导入等动作,可按人、动作、关键字筛选。
import { useState } from 'react';
import { Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ACTION_LABELS, STAGE_LABELS } from '../constants/stages';
import { useAppStore } from '../store/appStore';
import type { LogAction, LogEntry } from '../types';

const ACTION_COLORS: Partial<Record<LogAction, string>> = {
  create: 'blue',
  update: 'geekblue',
  delete: 'volcano',
  lock: 'orange',
  unlock: 'green',
  denied: 'red',
  import: 'purple',
  inventory: 'cyan',
};

export default function LogsPage() {
  const logs = useAppStore((s) => s.db.logs);
  const [user, setUser] = useState<string>();
  const [action, setAction] = useState<LogAction>();
  const [kw, setKw] = useState('');

  const filtered = logs.filter((l) => {
    if (user && l.userName !== user) return false;
    if (action && l.action !== action) return false;
    if (kw) {
      const t = kw.toLowerCase();
      const hay = [l.orderNo ?? '', l.detail ?? '', l.field ?? '', l.before ?? '', l.after ?? ''].join(' ').toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  });

  const columns: ColumnsType<LogEntry> = [
    { title: '时间', dataIndex: 'time', width: 150, render: (v: string) => v.slice(0, 19).replace('T', ' ') },
    { title: '用户', dataIndex: 'userName', width: 90 },
    {
      title: '动作',
      dataIndex: 'action',
      width: 110,
      render: (v: LogAction) => <Tag color={ACTION_COLORS[v]}>{ACTION_LABELS[v]}</Tag>,
    },
    { title: '订单号', dataIndex: 'orderNo', width: 140, render: (v?: string) => v ?? '-' },
    {
      title: '区块/阶段',
      dataIndex: 'stage',
      width: 100,
      render: (v?: LogEntry['stage']) => (v ? (v === 'sales' ? '销售信息' : STAGE_LABELS[v]) : '-'),
    },
    { title: '字段', dataIndex: 'field', width: 110, render: (v?: string) => v ?? '-' },
    {
      title: '变更',
      width: 220,
      render: (_, l) =>
        l.before !== undefined || l.after !== undefined ? (
          <span>
            <Typography.Text type="secondary">{l.before}</Typography.Text> → {l.after}
          </span>
        ) : (
          '-'
        ),
    },
    { title: '说明', dataIndex: 'detail', render: (v?: string) => v ?? '-' },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 10 }} wrap>
        <Select
          allowClear
          placeholder="按用户筛选"
          style={{ width: 160 }}
          value={user}
          onChange={setUser}
          options={[...new Set(logs.map((l) => l.userName))].map((v) => ({ value: v, label: v }))}
        />
        <Select
          allowClear
          placeholder="按动作筛选"
          style={{ width: 160 }}
          value={action}
          onChange={setAction}
          options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Input.Search
          allowClear
          placeholder="搜索订单号 / 字段 / 说明"
          style={{ width: 260 }}
          onSearch={setKw}
          onChange={(e) => !e.target.value && setKw('')}
        />
        <Typography.Text type="secondary">共 {filtered.length} 条</Typography.Text>
      </Space>
      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />
    </div>
  );
}
