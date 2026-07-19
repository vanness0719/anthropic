// 纯函数业务核心:所有数据变更的唯一权威逻辑(锁校验、字段级日志、库存联动、排期重算)。
// 浏览器单机模式与服务器模式都调用它,保证两端行为完全一致。
// 无副作用、无浏览器/Node 专有 API —— 只吃 (db, currentUser, action),吐 { db, error?, result? }。
import dayjs from 'dayjs';
import { STAGE_LABELS } from '../constants/stages';
import { lastProductionStage, recalcSchedule } from '../utils/schedule';
import { uid } from '../utils/id';
import { buildOrder } from '../store/seed';
import type {
  Db,
  InventoryMove,
  InventoryMoveType,
  LogEntry,
  Order,
  OrderStatus,
  Role,
  SalesInput,
  StageData,
  StageKey,
  User,
} from '../types';

/** 这些阶段字段变更后需要重算全链计划时间 */
const SCHEDULE_FIELDS: (keyof StageData)[] = ['enabled', 'cycleDays', 'manualDates', 'planStart', 'planEnd'];

const SALES_FIELD_LABELS: Record<string, string> = {
  customer: '客户',
  customerContact: '客户联系人',
  productModel: '产品型号',
  waferName: '晶圆名称',
  waferVersion: '晶圆版本',
  quantity: '数量',
  unitPrice: '单价',
  currency: '币种',
  orderDate: '下单日期',
  requiredDeliveryDate: '要求交期',
  poNo: 'PO号',
  notes: '备注',
  fromStockQty: '库存抵扣数量',
  status: '订单状态',
};

const STAGE_FIELD_LABELS: Record<string, string> = {
  enabled: '启用',
  cycleDays: '周期(天)',
  manualDates: '手动日期',
  planStart: '计划开始',
  planEnd: '计划结束',
  actualStart: '实际开始',
  actualEnd: '实际结束',
  status: '状态',
  qtyIn: '投入数量',
  qtyOut: '产出数量',
  owner: '负责人',
  remark: '备注',
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(空)';
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
}

/** 所有变更动作(可辨识联合)。login/logout/importDb 不在此列(在各模式外壳处理)。 */
export type Action =
  | { type: 'createOrder'; input: SalesInput }
  | { type: 'updateSales'; orderId: string; patch: Partial<SalesInput> & { status?: OrderStatus } }
  | { type: 'updateStage'; orderId: string; key: StageKey; patch: Partial<StageData> }
  | { type: 'toggleLock'; orderId: string; target: StageKey | 'sales' }
  | { type: 'deleteOrder'; orderId: string }
  | { type: 'addInventoryMove'; move: { productModel: string; type: InventoryMoveType; qty: number; remark?: string } }
  | { type: 'setDefaultCycle'; key: StageKey; days: number }
  | { type: 'addUser'; name: string; role: Role; userId?: string }
  | { type: 'removeUser'; userId: string };

export interface ActionResult {
  db: Db;
  error?: string;
  /** createOrder 返回新订单 id */
  result?: { id?: string };
}

/**
 * 应用一个动作到 db(纯函数)。currentUser 为当前操作者(服务器由 token 定位,浏览器为已登录用户)。
 * 返回新 db;若被拒返回 { db(可能含 denied 日志), error }。
 */
export function applyAction(db: Db, currentUser: User | null, action: Action): ActionResult {
  const mkLog = (partial: Omit<LogEntry, 'id' | 'time' | 'userId' | 'userName'>): LogEntry => ({
    id: uid(),
    time: new Date().toISOString(),
    userId: currentUser?.id ?? '-',
    userName: currentUser?.name ?? '-',
    ...partial,
  });
  const withLog = (d: Db, ...entries: LogEntry[]): Db => ({ ...d, logs: [...entries, ...d.logs] });
  const replaceOrder = (d: Db, order: Order): Db => ({
    ...d,
    orders: d.orders.map((o) => (o.id === order.id ? order : o)),
  });

  if (!currentUser) return { db, error: '请先登录' };

  switch (action.type) {
    case 'createOrder': {
      const { input } = action;
      if (!input.customer.trim() || !input.productModel.trim()) return { db, error: '客户与产品型号必填' };
      const orderNo = `P3-${dayjs().format('YYYYMMDD')}-${String(db.orders.length + 1).padStart(3, '0')}`;
      const order = buildOrder(input, orderNo, currentUser.name, db.settings.defaultCycles);
      const newDb = withLog(
        { ...db, orders: [order, ...db.orders] },
        mkLog({
          action: 'create',
          orderId: order.id,
          orderNo,
          detail: `${input.customer} / ${input.productModel} × ${input.quantity}`,
        })
      );
      return { db: newDb, result: { id: order.id } };
    }

    case 'updateSales': {
      const { orderId, patch } = action;
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return { db, error: '订单不存在' };
      if (order.salesLock) {
        return {
          db: withLog(
            db,
            mkLog({
              action: 'denied',
              orderId,
              orderNo: order.orderNo,
              stage: 'sales',
              detail: `尝试修改被 ${order.salesLock.byName} 锁定的销售信息`,
            })
          ),
          error: `销售信息已被 ${order.salesLock.byName} 锁定,需其解锁后才能修改`,
        };
      }
      const entries: LogEntry[] = [];
      const updated: Order = { ...order };
      for (const [k, v] of Object.entries(patch)) {
        const before = (order as unknown as Record<string, unknown>)[k];
        const same = before === v || ((before === undefined || before === '') && (v === undefined || v === ''));
        if (same) continue;
        (updated as unknown as Record<string, unknown>)[k] = v;
        entries.push(
          mkLog({
            action: 'update',
            orderId,
            orderNo: order.orderNo,
            stage: 'sales',
            field: SALES_FIELD_LABELS[k] ?? k,
            before: fmtVal(before),
            after: fmtVal(v),
          })
        );
      }
      if (!entries.length) return { db };
      if (patch.orderDate && patch.orderDate !== order.orderDate) {
        updated.stages = recalcSchedule(updated);
      }
      return { db: withLog(replaceOrder(db, updated), ...entries) };
    }

    case 'updateStage': {
      const { orderId, key, patch } = action;
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return { db, error: '订单不存在' };
      const stage = order.stages[key];
      if (stage.lock) {
        return {
          db: withLog(
            db,
            mkLog({
              action: 'denied',
              orderId,
              orderNo: order.orderNo,
              stage: key,
              detail: `尝试修改被 ${stage.lock.byName} 锁定的 ${STAGE_LABELS[key]}`,
            })
          ),
          error: `${STAGE_LABELS[key]} 已被 ${stage.lock.byName} 锁定,需其解锁后才能修改`,
        };
      }
      const entries: LogEntry[] = [];
      const newStage: StageData = { ...stage };
      for (const [k, v] of Object.entries(patch)) {
        const before = (stage as unknown as Record<string, unknown>)[k];
        const same = before === v || ((before === undefined || before === '') && (v === undefined || v === ''));
        if (same) continue;
        (newStage as unknown as Record<string, unknown>)[k] = v;
        entries.push(
          mkLog({
            action: 'update',
            orderId,
            orderNo: order.orderNo,
            stage: key,
            field: STAGE_FIELD_LABELS[k] ?? k,
            before: fmtVal(before),
            after: fmtVal(v),
          })
        );
      }
      if (!entries.length) return { db };
      newStage.updatedBy = currentUser.name;
      newStage.updatedAt = new Date().toISOString();
      const updated: Order = { ...order, stages: { ...order.stages, [key]: newStage } };
      if (SCHEDULE_FIELDS.some((f) => f in patch)) {
        updated.stages = recalcSchedule(updated);
      }
      let newDb = replaceOrder(db, updated);

      // 库存联动:最后一个生产阶段完成 → 入库;库存出货完成 → 出库
      if (patch.status === 'done' && stage.status !== 'done') {
        const now = new Date().toISOString();
        const moves: InventoryMove[] = [];
        if (key === lastProductionStage(updated)) {
          const qty = newStage.qtyOut ?? Math.max(0, order.quantity - order.fromStockQty);
          if (qty > 0 && !db.inventoryMoves.some((m) => m.orderId === orderId && m.type === 'produced')) {
            moves.push({
              id: uid(),
              productModel: order.productModel,
              type: 'produced',
              qty,
              orderId,
              orderNo: order.orderNo,
              remark: `生产完成入库(${STAGE_LABELS[key]})`,
              by: currentUser.id,
              byName: currentUser.name,
              at: now,
            });
          }
        }
        if (key === 'stockOut') {
          const qty = newStage.qtyOut ?? order.quantity;
          if (qty > 0 && !db.inventoryMoves.some((m) => m.orderId === orderId && m.type === 'shipped')) {
            moves.push({
              id: uid(),
              productModel: order.productModel,
              type: 'shipped',
              qty,
              orderId,
              orderNo: order.orderNo,
              remark: order.fromStockQty > 0 ? `订单出货(含库存抵扣 ${order.fromStockQty} 颗)` : '订单出货',
              by: currentUser.id,
              byName: currentUser.name,
              at: now,
            });
          }
        }
        if (moves.length) {
          newDb = { ...newDb, inventoryMoves: [...moves, ...newDb.inventoryMoves] };
          entries.push(
            ...moves.map((m) =>
              mkLog({
                action: 'inventory',
                orderId,
                orderNo: order.orderNo,
                detail: `${m.type === 'produced' ? '自动入库' : '自动出货'} ${m.productModel} × ${m.qty}`,
              })
            )
          );
        }
      }
      return { db: withLog(newDb, ...entries) };
    }

    case 'toggleLock': {
      const { orderId, target } = action;
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return { db, error: '订单不存在' };
      const lock = target === 'sales' ? order.salesLock : order.stages[target].lock;
      const label = target === 'sales' ? '销售信息' : STAGE_LABELS[target];
      if (lock) {
        if (lock.by !== currentUser.id && currentUser.role !== 'admin') {
          return {
            db: withLog(
              db,
              mkLog({
                action: 'denied',
                orderId,
                orderNo: order.orderNo,
                stage: target,
                detail: `尝试解锁被 ${lock.byName} 锁定的${label}`,
              })
            ),
            error: `只有锁定人 ${lock.byName} 或管理员可以解锁`,
          };
        }
        const updated: Order =
          target === 'sales'
            ? { ...order, salesLock: null }
            : { ...order, stages: { ...order.stages, [target]: { ...order.stages[target], lock: null } } };
        return {
          db: withLog(
            replaceOrder(db, updated),
            mkLog({ action: 'unlock', orderId, orderNo: order.orderNo, stage: target, detail: `解锁${label}` })
          ),
        };
      }
      const info = { by: currentUser.id, byName: currentUser.name, at: new Date().toISOString() };
      const updated: Order =
        target === 'sales'
          ? { ...order, salesLock: info }
          : { ...order, stages: { ...order.stages, [target]: { ...order.stages[target], lock: info } } };
      return {
        db: withLog(
          replaceOrder(db, updated),
          mkLog({ action: 'lock', orderId, orderNo: order.orderNo, stage: target, detail: `锁定${label}` })
        ),
      };
    }

    case 'deleteOrder': {
      const { orderId } = action;
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return { db, error: '订单不存在' };
      if (currentUser.role !== 'admin' && currentUser.name !== order.createdBy) {
        return { db, error: '仅订单录入人或管理员可删除订单' };
      }
      const hasLock = !!order.salesLock || Object.values(order.stages).some((s) => s.lock);
      if (hasLock && currentUser.role !== 'admin') return { db, error: '订单存在锁定区块,仅管理员可删除' };
      return {
        db: withLog(
          { ...db, orders: db.orders.filter((o) => o.id !== orderId) },
          mkLog({ action: 'delete', orderId, orderNo: order.orderNo, detail: `${order.customer} / ${order.productModel}` })
        ),
      };
    }

    case 'addInventoryMove': {
      const m = action.move;
      if (!m.productModel.trim()) return { db, error: '型号不能为空' };
      if (!m.qty) return { db, error: '数量不能为 0' };
      const move: InventoryMove = {
        id: uid(),
        productModel: m.productModel.trim(),
        type: m.type,
        qty: m.qty,
        remark: m.remark,
        by: currentUser.id,
        byName: currentUser.name,
        at: new Date().toISOString(),
      };
      return {
        db: withLog(
          { ...db, inventoryMoves: [move, ...db.inventoryMoves] },
          mkLog({
            action: 'inventory',
            detail: `手工${m.type === 'shipped' ? '出货' : '入库/调整'} ${move.productModel} × ${m.qty}`,
          })
        ),
      };
    }

    case 'setDefaultCycle': {
      const { key, days } = action;
      const before = db.settings.defaultCycles[key];
      if (before === days || days < 1) return { db };
      return {
        db: withLog(
          { ...db, settings: { ...db.settings, defaultCycles: { ...db.settings.defaultCycles, [key]: days } } },
          mkLog({
            action: 'settings',
            field: `${STAGE_LABELS[key]}默认周期`,
            before: String(before),
            after: String(days),
          })
        ),
      };
    }

    // 单机模式的无密码用户新增(服务器模式走独立带密码端点,不用此分支)
    case 'addUser': {
      const { name, role, userId } = action;
      if (currentUser.role !== 'admin') return { db, error: '仅管理员可管理用户' };
      if (!name.trim()) return { db, error: '用户名不能为空' };
      if (db.users.some((u) => u.name === name.trim())) return { db, error: '用户名已存在' };
      const user: User = { id: userId ?? uid(), name: name.trim(), role };
      return {
        db: withLog(
          { ...db, users: [...db.users, user] },
          mkLog({ action: 'user', detail: `新增用户 ${user.name}` })
        ),
      };
    }

    case 'removeUser': {
      const { userId } = action;
      if (currentUser.role !== 'admin') return { db, error: '仅管理员可管理用户' };
      if (userId === currentUser.id) return { db, error: '不能删除当前登录用户' };
      const user = db.users.find((u) => u.id === userId);
      if (!user) return { db, error: '用户不存在' };
      return {
        db: withLog(
          { ...db, users: db.users.filter((u) => u.id !== userId) },
          mkLog({ action: 'user', detail: `删除用户 ${user.name}` })
        ),
      };
    }
  }
}
