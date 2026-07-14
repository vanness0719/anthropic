// 初始演示数据:内置用户、示例订单与期初库存,首次打开即可看到完整流程。
import dayjs from 'dayjs';
import { DEFAULT_CYCLES, STAGE_ORDER } from '../constants/stages';
import { recalcSchedule } from '../utils/schedule';
import { SCHEMA_VERSION, uid } from './persist';
import type { Db, Order, SalesInput, StageData, StageKey } from '../types';

const FMT = 'YYYY-MM-DD';

export function makeStages(cycles: Record<StageKey, number>): Record<StageKey, StageData> {
  const stages = {} as Record<StageKey, StageData>;
  for (const k of STAGE_ORDER) {
    stages[k] = { enabled: true, cycleDays: cycles[k], manualDates: false, status: 'pending', lock: null };
  }
  return stages;
}

export function buildOrder(
  input: SalesInput,
  orderNo: string,
  createdBy: string,
  cycles: Record<StageKey, number>
): Order {
  const order: Order = {
    ...input,
    id: uid(),
    orderNo,
    status: 'active',
    salesLock: null,
    stages: makeStages(cycles),
    createdBy,
    createdAt: new Date().toISOString(),
  };
  order.stages = recalcSchedule(order);
  return order;
}

export function seedDb(): Db {
  const users = [
    { id: 'u-sales', name: '张伟', role: 'sales' as const },
    { id: 'u-planner', name: '李静', role: 'planner' as const },
    { id: 'u-prod', name: '王强', role: 'production' as const },
    { id: 'u-admin', name: '管理员', role: 'admin' as const },
  ];

  // 订单1:在产,晶圆/CP1 已完成,CP2 进行中;销售信息已被生产计划锁定
  const o1 = buildOrder(
    {
      customer: '华芯科技',
      customerContact: '陈经理',
      productModel: 'CCFC2011BC',
      waferName: 'CCFC2011',
      waferVersion: 'B2',
      quantity: 10000,
      unitPrice: 12.5,
      currency: 'CNY',
      orderDate: dayjs().subtract(75, 'day').format(FMT),
      requiredDeliveryDate: dayjs().add(90, 'day').format(FMT),
      poNo: 'PO-HX-2601',
      notes: '首批量产订单',
      fromStockQty: 0,
    },
    'P3-DEMO-001',
    '张伟',
    DEFAULT_CYCLES
  );
  o1.stages.cp4.enabled = false;
  o1.stages.ft3.enabled = false;
  o1.stages.waferFab.status = 'done';
  o1.stages.waferFab.actualStart = o1.orderDate;
  o1.stages.waferFab.actualEnd = dayjs(o1.orderDate).add(62, 'day').format(FMT);
  o1.stages.waferFab.qtyIn = 25;
  o1.stages.waferFab.qtyOut = 25;
  o1.stages.waferFab.owner = '王强';
  o1.stages.cp1.status = 'done';
  o1.stages.cp1.actualStart = dayjs(o1.orderDate).add(63, 'day').format(FMT);
  o1.stages.cp1.actualEnd = dayjs(o1.orderDate).add(68, 'day').format(FMT);
  o1.stages.cp1.qtyIn = 12000;
  o1.stages.cp1.qtyOut = 11400;
  o1.stages.cp1.owner = '王强';
  o1.stages.cp2.status = 'inProgress';
  o1.stages.cp2.actualStart = dayjs(o1.orderDate).add(69, 'day').format(FMT);
  o1.stages.cp2.owner = '王强';
  o1.stages = recalcSchedule(o1);
  o1.salesLock = { by: 'u-planner', byName: '李静', at: new Date().toISOString() };
  o1.stages.waferFab.lock = { by: 'u-prod', byName: '王强', at: new Date().toISOString() };

  // 订单2:新订单,含 1500 颗库存抵扣
  const o2 = buildOrder(
    {
      customer: '星辰半导体',
      customerContact: 'Ms. Lin',
      productModel: 'CCFC3022AD',
      waferName: 'CCFC3022',
      waferVersion: 'A1',
      quantity: 5000,
      unitPrice: 3.2,
      currency: 'USD',
      orderDate: dayjs().subtract(5, 'day').format(FMT),
      requiredDeliveryDate: dayjs().add(120, 'day').format(FMT),
      poNo: 'PO-SC-0088',
      notes: '其中 1500 颗用现有库存抵扣',
      fromStockQty: 1500,
    },
    'P3-DEMO-002',
    '张伟',
    DEFAULT_CYCLES
  );
  o2.stages.cp3.enabled = false;
  o2.stages.cp4.enabled = false;
  o2.stages.burnIn.enabled = false;

  return {
    schemaVersion: SCHEMA_VERSION,
    users,
    orders: [o2, o1],
    inventoryMoves: [
      {
        id: uid(),
        productModel: 'CCFC2011BC',
        type: 'initial',
        qty: 5000,
        remark: '期初库存',
        by: 'u-admin',
        byName: '管理员',
        at: new Date().toISOString(),
      },
      {
        id: uid(),
        productModel: 'CCFC3022AD',
        type: 'initial',
        qty: 2000,
        remark: '期初库存',
        by: 'u-admin',
        byName: '管理员',
        at: new Date().toISOString(),
      },
    ],
    logs: [],
    settings: { defaultCycles: { ...DEFAULT_CYCLES } },
  };
}
