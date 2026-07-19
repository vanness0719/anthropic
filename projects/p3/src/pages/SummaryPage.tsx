// 汇总统计:按客户×型号(含客户合计)、按型号、各阶段在制订单。
import { useState } from 'react';
import type { Dayjs } from 'dayjs';
import { Button, Card, DatePicker, Select, Space, Table, Typography, message } from 'antd';
import { exportSummaryExcel } from '../utils/excel';
import type { ColumnsType } from 'antd/es/table';
import { useAppStore } from '../store/appStore';
import {
  byCustomer,
  byModel,
  fmtAmounts,
  stageWip,
  type CustomerModelRow,
  type ModelRow,
  type StageWipRow,
} from '../utils/summary';

export default function SummaryPage() {
  const orders = useAppStore((s) => s.db.orders);
  const [customer, setCustomer] = useState<string>();
  const [model, setModel] = useState<string>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const start = range?.[0]?.format('YYYY-MM-DD');
  const end = range?.[1]?.format('YYYY-MM-DD');

  const filtered = orders.filter(
    (o) =>
      (!customer || o.customer === customer) &&
      (!model || o.productModel === model) &&
      (!start || o.orderDate >= start) &&
      (!end || o.orderDate <= end)
  );

  const customerCols: ColumnsType<CustomerModelRow> = [
    { title: '客户', dataIndex: 'customer', width: 160, render: (v, r) => (r.isSubtotal ? <b>{v}</b> : v) },
    { title: '产品型号', dataIndex: 'productModel', width: 160, render: (v, r) => (r.isSubtotal ? <b>{v}</b> : v) },
    { title: '订单数', dataIndex: 'orderCount', align: 'right', width: 90 },
    { title: '总数量(颗)', dataIndex: 'qty', align: 'right', width: 120, render: (v: number) => v.toLocaleString() },
    { title: '总金额', align: 'right', render: (_, r) => fmtAmounts(r.amounts) },
  ];

  const modelCols: ColumnsType<ModelRow> = [
    { title: '产品型号', dataIndex: 'productModel', width: 160 },
    { title: '订单数', dataIndex: 'orderCount', align: 'right', width: 90 },
    { title: '总数量(颗)', dataIndex: 'totalQty', align: 'right', width: 120, render: (v: number) => v.toLocaleString() },
    { title: '已交付(颗)', dataIndex: 'deliveredQty', align: 'right', width: 120, render: (v: number) => v.toLocaleString() },
    { title: '在产(颗)', dataIndex: 'wipQty', align: 'right', width: 120, render: (v: number) => v.toLocaleString() },
    { title: '总金额', align: 'right', render: (_, r) => fmtAmounts(r.amounts) },
  ];

  const wipCols: ColumnsType<StageWipRow> = [
    { title: '当前阶段', dataIndex: 'stageLabel', width: 140 },
    { title: '在制订单数', dataIndex: 'orderCount', align: 'right', width: 110 },
    { title: '订单号', dataIndex: 'orderNos' },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space>
        <Select
          allowClear
          placeholder="按客户筛选"
          style={{ width: 200 }}
          value={customer}
          onChange={setCustomer}
          options={[...new Set(orders.map((o) => o.customer))].map((v) => ({ value: v, label: v }))}
        />
        <Select
          allowClear
          placeholder="按型号筛选"
          style={{ width: 200 }}
          value={model}
          onChange={setModel}
          options={[...new Set(orders.map((o) => o.productModel))].map((v) => ({ value: v, label: v }))}
        />
        <DatePicker.RangePicker
          allowEmpty={[true, true]}
          placeholder={['起始日期', '结束日期']}
          value={range}
          onChange={(v) => setRange(v)}
        />
        <Typography.Text type="secondary">
          按下单日期筛选,命中 {filtered.length} 单
        </Typography.Text>
        <Button
          type="primary"
          onClick={() => {
            if (!filtered.length) {
              message.warning('当前筛选下没有订单可导出');
              return;
            }
            exportSummaryExcel(filtered, { customer, model, start, end });
            message.success('已导出 Excel(含汇总与订单明细)');
          }}
        >
          导出 Excel
        </Button>
      </Space>
      <Card size="small" title="按客户汇总(各型号数量与金额,含客户合计;不含已取消订单)">
        <Table
          size="small"
          rowKey="key"
          columns={customerCols}
          dataSource={byCustomer(filtered)}
          pagination={false}
          rowClassName={(r) => (r.isSubtotal ? 'subtotal-row' : '')}
        />
      </Card>
      <Card size="small" title="按型号汇总(总量 / 已交付 / 在产)">
        <Table size="small" rowKey="key" columns={modelCols} dataSource={byModel(filtered)} pagination={false} />
      </Card>
      <Card size="small" title="各阶段在制订单(仅进行中订单,按其当前所处阶段)">
        <Table size="small" rowKey="key" columns={wipCols} dataSource={stageWip(filtered)} pagination={false} />
      </Card>
    </Space>
  );
}
