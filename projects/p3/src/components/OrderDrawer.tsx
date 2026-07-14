// 订单抽屉:上半部分销售信息(可锁定),下半部分生产阶段明细表。
// openKey = 'new' 时为新建订单;创建成功后由父组件切换到该订单继续编辑阶段。
import dayjs, { type Dayjs } from 'dayjs';
import {
  Button,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { CURRENCY_SYMBOLS } from '../constants/stages';
import { useAppStore } from '../store/appStore';
import { stockOf } from '../utils/inventory';
import { currentStageLabel, isDelayed, planFinish, progressPct } from '../utils/schedule';
import LockButton from './LockButton';
import StageTable from './StageTable';
import type { Currency, OrderStatus, SalesInput } from '../types';

interface FormVals {
  customer: string;
  customerContact?: string;
  productModel: string;
  waferName?: string;
  waferVersion?: string;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  orderDate: Dayjs;
  requiredDeliveryDate?: Dayjs;
  poNo?: string;
  notes?: string;
  fromStockQty?: number;
  status?: OrderStatus;
}

function toInput(v: FormVals): SalesInput & { status?: OrderStatus } {
  return {
    ...v,
    fromStockQty: v.fromStockQty ?? 0,
    orderDate: v.orderDate.format('YYYY-MM-DD'),
    requiredDeliveryDate: v.requiredDeliveryDate?.format('YYYY-MM-DD'),
  };
}

const ORDER_STATUS_OPTIONS = [
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

interface Props {
  openKey: string | null; // 'new' | 订单id | null(关闭)
  onClose: () => void;
  onCreated: (id: string) => void;
}

export default function OrderDrawer({ openKey, onClose, onCreated }: Props) {
  const isNew = openKey === 'new';
  const order = useAppStore((s) => (openKey && !isNew ? (s.db.orders.find((o) => o.id === openKey) ?? null) : null));
  const moves = useAppStore((s) => s.db.inventoryMoves);
  const createOrder = useAppStore((s) => s.createOrder);
  const updateSales = useAppStore((s) => s.updateSales);
  const toggleLock = useAppStore((s) => s.toggleLock);

  const onFinish = (v: FormVals) => {
    if (isNew) {
      const res = createOrder(toInput(v));
      if (res.error) message.error(res.error);
      else {
        message.success('订单已创建,可继续编辑生产阶段');
        onCreated(res.id!);
      }
    } else if (order) {
      const err = updateSales(order.id, toInput(v));
      if (err) message.error(err);
      else message.success('销售信息已保存');
    }
  };

  const initialValues: Partial<FormVals> = order
    ? {
        ...order,
        orderDate: dayjs(order.orderDate),
        requiredDeliveryDate: order.requiredDeliveryDate ? dayjs(order.requiredDeliveryDate) : undefined,
      }
    : { currency: 'CNY', orderDate: dayjs(), quantity: 1000, unitPrice: 0, fromStockQty: 0 };

  const locked = !!order?.salesLock;
  const finish = order ? planFinish(order) : undefined;

  return (
    <Drawer
      title={isNew ? '新建订单' : `订单 ${order?.orderNo ?? ''}`}
      open={!!openKey}
      onClose={onClose}
      width={1180}
      destroyOnClose
    >
      {order && (
        <Descriptions size="small" column={4} style={{ marginBottom: 12 }}>
          <Descriptions.Item label="录入人">
            {order.createdBy}({order.createdAt.slice(0, 10)})
          </Descriptions.Item>
          <Descriptions.Item label="当前阶段">{currentStageLabel(order)}</Descriptions.Item>
          <Descriptions.Item label="进度">
            <Progress percent={progressPct(order)} size="small" style={{ width: 120 }} />
          </Descriptions.Item>
          <Descriptions.Item label="计划完成">
            {finish ?? '-'}
            {isDelayed(order) && (
              <Tag color="red" style={{ marginLeft: 6 }}>
                晚于要求交期
              </Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="订单金额">
            {CURRENCY_SYMBOLS[order.currency]}
            {(order.quantity * order.unitPrice).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="该型号当前库存">
            {stockOf(moves, order.productModel).toLocaleString()} 颗
          </Descriptions.Item>
          <Descriptions.Item label="库存抵扣">{order.fromStockQty.toLocaleString()} 颗</Descriptions.Item>
        </Descriptions>
      )}

      <Divider orientation="left" style={{ marginTop: 0 }}>
        销售信息
        {order && (
          <span style={{ marginLeft: 12 }}>
            <LockButton lock={order.salesLock} onToggle={() => toggleLock(order.id, 'sales')} />
          </span>
        )}
      </Divider>

      <Form<FormVals>
        key={openKey ?? 'closed'}
        layout="vertical"
        size="small"
        initialValues={initialValues}
        onFinish={onFinish}
        disabled={locked}
      >
        <Row gutter={12}>
          <Col span={6}>
            <Form.Item name="customer" label="客户" rules={[{ required: true, message: '必填' }]}>
              <Input placeholder="客户名称" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="customerContact" label="客户联系人">
              <Input />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="productModel" label="产品型号" rules={[{ required: true, message: '必填' }]}>
              <Input placeholder="如 CCFC2011BC" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="poNo" label="PO 号">
              <Input />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="waferName" label="晶圆名称">
              <Input placeholder="如 CCFC2011" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="waferVersion" label="晶圆版本">
              <Input placeholder="如 B2" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="quantity" label="数量(颗)" rules={[{ required: true, message: '必填' }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="unitPrice" label="单价" rules={[{ required: true, message: '必填' }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="currency" label="币种">
              <Select
                options={[
                  { value: 'CNY', label: 'CNY(¥)' },
                  { value: 'USD', label: 'USD($)' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="fromStockQty" label="库存抵扣数量(颗)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="orderDate"
              label="下单日期(自动排期起点)"
              rules={[{ required: true, message: '必填' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="requiredDeliveryDate" label="要求交期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          {!isNew && (
            <Col span={6}>
              <Form.Item name="status" label="订单状态">
                <Select options={ORDER_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          )}
          <Col span={isNew ? 12 : 6}>
            <Form.Item name="notes" label="备注">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Space>
          <Button type="primary" htmlType="submit">
            {isNew ? '创建订单' : '保存销售信息'}
          </Button>
          {locked && (
            <Typography.Text type="secondary">
              已被 {order?.salesLock?.byName} 锁定,解锁后才能修改
            </Typography.Text>
          )}
        </Space>
      </Form>

      {order && (
        <>
          <Divider orientation="left">生产阶段</Divider>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            计划时间按「周期(天)」自上而下自动链式计算;打开「手动日期」可直接指定该阶段计划起止(如基板与晶圆并行),
            后续阶段从手动日期继续推算。「库存出货」置为完成时自动生成出货流水;最后一个生产阶段完成时自动入库。
            锁定某阶段后该行不可编辑,仅锁定人或管理员可解锁。
          </Typography.Paragraph>
          <StageTable order={order} />
        </>
      )}
      {isNew && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          创建后将按「设置」页的默认周期自动生成全部生产阶段排期,可再逐阶段调整。
        </Typography.Paragraph>
      )}
    </Drawer>
  );
}
