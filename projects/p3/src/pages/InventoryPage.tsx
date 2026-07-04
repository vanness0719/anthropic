// 库存:各型号余额(期初+入库+调整-出货)与全部流水;支持手工录入期初/调整。
import { useState } from 'react';
import { AutoComplete, Button, Card, InputNumber, Input, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAppStore } from '../store/appStore';
import { signedQty, stockBalances, type StockRow } from '../utils/inventory';
import type { InventoryMove, InventoryMoveType } from '../types';

const TYPE_LABELS: Record<InventoryMoveType, string> = {
  initial: '期初库存',
  produced: '生产入库',
  shipped: '出货',
  adjust: '调整',
};
const TYPE_COLORS: Record<InventoryMoveType, string> = {
  initial: 'blue',
  produced: 'green',
  shipped: 'orange',
  adjust: 'purple',
};

export default function InventoryPage() {
  const moves = useAppStore((s) => s.db.inventoryMoves);
  const orders = useAppStore((s) => s.db.orders);
  const addMove = useAppStore((s) => s.addInventoryMove);

  const [model, setModel] = useState('');
  const [type, setType] = useState<InventoryMoveType>('initial');
  const [qty, setQty] = useState<number | null>(null);
  const [remark, setRemark] = useState('');

  const knownModels = [...new Set([...moves.map((m) => m.productModel), ...orders.map((o) => o.productModel)])];

  const balanceCols: ColumnsType<StockRow> = [
    { title: '产品型号', dataIndex: 'productModel', width: 160 },
    { title: '期初', dataIndex: 'initial', align: 'right', render: (v: number) => v.toLocaleString() },
    { title: '生产入库', dataIndex: 'produced', align: 'right', render: (v: number) => v.toLocaleString() },
    { title: '调整', dataIndex: 'adjust', align: 'right', render: (v: number) => v.toLocaleString() },
    { title: '累计出货', dataIndex: 'shipped', align: 'right', render: (v: number) => v.toLocaleString() },
    {
      title: '当前余额',
      dataIndex: 'balance',
      align: 'right',
      render: (v: number) => <b style={v < 0 ? { color: '#ff4d4f' } : undefined}>{v.toLocaleString()}</b>,
    },
  ];

  const moveCols: ColumnsType<InventoryMove> = [
    { title: '时间', dataIndex: 'at', width: 150, render: (v: string) => v.slice(0, 16).replace('T', ' ') },
    { title: '型号', dataIndex: 'productModel', width: 140 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      filters: Object.entries(TYPE_LABELS).map(([value, text]) => ({ value, text })),
      onFilter: (v, m) => m.type === v,
      render: (v: InventoryMoveType) => <Tag color={TYPE_COLORS[v]}>{TYPE_LABELS[v]}</Tag>,
    },
    {
      title: '数量',
      align: 'right',
      width: 100,
      render: (_, m) => {
        const q = signedQty(m);
        return <span style={q < 0 ? { color: '#fa8c16' } : undefined}>{q > 0 ? `+${q.toLocaleString()}` : q.toLocaleString()}</span>;
      },
    },
    { title: '关联订单', dataIndex: 'orderNo', width: 140, render: (v?: string) => v ?? '-' },
    { title: '经手人', dataIndex: 'byName', width: 90 },
    { title: '备注', dataIndex: 'remark', render: (v?: string) => v ?? '-' },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small" title="库存余额(按型号)">
        <Table size="small" rowKey="productModel" columns={balanceCols} dataSource={stockBalances(moves)} pagination={false} />
      </Card>
      <Card size="small" title="手工录入流水(期初库存 / 调整;生产入库与订单出货通常由阶段完成自动生成)">
        <Space wrap>
          <AutoComplete
            style={{ width: 180 }}
            placeholder="产品型号"
            value={model}
            onChange={setModel}
            options={knownModels.map((m) => ({ value: m }))}
          />
          <Select
            style={{ width: 120 }}
            value={type}
            onChange={setType}
            options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <InputNumber placeholder="数量(颗)" style={{ width: 130 }} value={qty} onChange={setQty} />
          <Input placeholder="备注" style={{ width: 200 }} value={remark} onChange={(e) => setRemark(e.target.value)} />
          <Button
            type="primary"
            onClick={() => {
              const err = addMove({ productModel: model, type, qty: qty ?? 0, remark: remark || undefined });
              if (err) message.error(err);
              else {
                message.success('已记录');
                setModel('');
                setQty(null);
                setRemark('');
              }
            }}
          >
            添加
          </Button>
        </Space>
      </Card>
      <Card size="small" title="库存流水">
        <Table size="small" rowKey="id" columns={moveCols} dataSource={moves} pagination={{ pageSize: 15, showSizeChanger: false }} />
      </Card>
    </Space>
  );
}
