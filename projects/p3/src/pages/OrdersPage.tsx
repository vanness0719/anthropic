// 订单总表:全部订单一览(销售信息 + 阶段色条 + 进度 + 延期预警),点击进入抽屉编辑。
import { useState } from 'react';
import { Button, Input, Popconfirm, Progress, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CURRENCY_SYMBOLS } from '../constants/stages';
import OrderDrawer from '../components/OrderDrawer';
import StageStrip from '../components/StageStrip';
import { useAppStore } from '../store/appStore';
import { currentStageKey, currentStageLabel, isDelayed, planFinish, progressPct } from '../utils/schedule';
import type { Order } from '../types';

const ORDER_STATUS = {
  active: { label: '进行中', color: 'processing' },
  completed: { label: '已完成', color: 'success' },
  cancelled: { label: '已取消', color: 'default' },
} as const;

export default function OrdersPage() {
  const orders = useAppStore((s) => s.db.orders);
  const deleteOrder = useAppStore((s) => s.deleteOrder);
  const [kw, setKw] = useState('');
  const [drawerKey, setDrawerKey] = useState<string | null>(null);

  const filtered = orders.filter((o) => {
    if (!kw) return true;
    const t = kw.toLowerCase();
    return [o.orderNo, o.customer, o.productModel, o.poNo ?? ''].some((v) => v.toLowerCase().includes(t));
  });

  const uniq = (get: (o: Order) => string) =>
    [...new Set(orders.map(get))].map((v) => ({ text: v, value: v }));

  const columns: ColumnsType<Order> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      fixed: 'left',
      width: 140,
      render: (v, o) => (
        <Typography.Link onClick={() => setDrawerKey(o.id)}>
          {o.salesLock ? '🔒 ' : ''}
          {v}
        </Typography.Link>
      ),
    },
    { title: '客户', dataIndex: 'customer', width: 110, filters: uniq((o) => o.customer), onFilter: (v, o) => o.customer === v },
    { title: '型号', dataIndex: 'productModel', width: 120, filters: uniq((o) => o.productModel), onFilter: (v, o) => o.productModel === v },
    { title: '数量', dataIndex: 'quantity', width: 80, align: 'right', render: (v: number) => v.toLocaleString() },
    {
      title: '单价',
      width: 80,
      align: 'right',
      render: (_, o) => `${CURRENCY_SYMBOLS[o.currency]}${o.unitPrice}`,
    },
    {
      title: '金额',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.quantity * a.unitPrice - b.quantity * b.unitPrice,
      render: (_, o) => `${CURRENCY_SYMBOLS[o.currency]}${(o.quantity * o.unitPrice).toLocaleString()}`,
    },
    { title: '下单日期', dataIndex: 'orderDate', width: 100, sorter: (a, b) => a.orderDate.localeCompare(b.orderDate) },
    { title: '要求交期', dataIndex: 'requiredDeliveryDate', width: 100, render: (v?: string) => v ?? '-' },
    {
      title: '计划完成',
      width: 130,
      render: (_, o) => {
        const f = planFinish(o);
        return (
          <span>
            {f ?? '-'}
            {isDelayed(o) && <Tag color="red" style={{ marginLeft: 4 }}>延期</Tag>}
          </span>
        );
      },
    },
    {
      title: '当前阶段',
      width: 100,
      render: (_, o) => {
        const k = currentStageKey(o);
        const issue = k && o.stages[k].status === 'issue';
        return <span style={issue ? { color: '#ff4d4f', fontWeight: 600 } : undefined}>{currentStageLabel(o)}{issue ? ' ⚠' : ''}</span>;
      },
    },
    { title: '阶段一览', width: 190, render: (_, o) => <StageStrip order={o} /> },
    {
      title: '进度',
      width: 110,
      sorter: (a, b) => progressPct(a) - progressPct(b),
      render: (_, o) => <Progress percent={progressPct(o)} size="small" />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 84,
      filters: Object.entries(ORDER_STATUS).map(([value, s]) => ({ value, text: s.label })),
      onFilter: (v, o) => o.status === v,
      render: (v: Order['status']) => <Tag color={ORDER_STATUS[v].color}>{ORDER_STATUS[v].label}</Tag>,
    },
    { title: '录入人', dataIndex: 'createdBy', width: 80 },
    {
      title: '操作',
      fixed: 'right',
      width: 110,
      render: (_, o) => (
        <Space size="small">
          <Typography.Link onClick={() => setDrawerKey(o.id)}>详情</Typography.Link>
          <Popconfirm
            title="确认删除该订单?"
            onConfirm={() => {
              const err = deleteOrder(o.id);
              if (err) message.error(err);
              else message.success('已删除');
            }}
          >
            <Typography.Link type="danger">删除</Typography.Link>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 10 }}>
        <Button type="primary" onClick={() => setDrawerKey('new')}>
          + 新建订单
        </Button>
        <Input.Search
          allowClear
          placeholder="搜索订单号 / 客户 / 型号 / PO"
          style={{ width: 280 }}
          onSearch={setKw}
          onChange={(e) => !e.target.value && setKw('')}
        />
        <Typography.Text type="secondary">共 {filtered.length} 单</Typography.Text>
      </Space>
      <Table<Order>
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        scroll={{ x: 1560 }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />
      <OrderDrawer openKey={drawerKey} onClose={() => setDrawerKey(null)} onCreated={(id) => setDrawerKey(id)} />
    </div>
  );
}
