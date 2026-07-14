// 全局状态与所有数据变更入口:每次变更写 localStorage 并追加操作日志;
// 锁定校验在此层强制执行(UI 只是提示)。动作返回错误文案(undefined = 成功)。
import dayjs from 'dayjs';
import { create } from 'zustand';
import { STAGE_LABELS } from '../constants/stages';
import { lastProductionStage, recalcSchedule } from '../utils/schedule';
import { loadDb, saveDb, uid } from './persist';
import { buildOrder, seedDb } from './seed';
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

interface AppState {
  db: Db;
  currentUser: User | null;
  login: (userId: string) => void;
  logout: () => void;
  addUser: (name: string, role: Role) => string | undefined;
  removeUser: (userId: string) => string | undefined;
  createOrder: (input: SalesInput) => { id?: string; error?: string };
  updateSales: (orderId: string, patch: Partial<SalesInput> & { status?: OrderStatus }) => string | undefined;
  updateStage: (orderId: string, key: StageKey, patch: Partial<StageData>) => string | undefined;
  toggleLock: (orderId: string, target: StageKey | 'sales') => string | undefined;
  deleteOrder: (orderId: string) => string | undefined;
  addInventoryMove: (m: {
    productModel: string;
    type: InventoryMoveType;
    qty: number;
    remark?: string;
  }) => string | undefined;
  setDefaultCycle: (key: StageKey, days: number) => void;
  importDb: (db: Db) => void;
}

export const useAppStore = create<AppState>((set, get) => {
  const initial = loadDb() ?? seedDb();
  saveDb(initial);

  const persist = (db: Db) => {
    saveDb(db);
    set({ db });
  };

  const mkLog = (partial: Omit<LogEntry, 'id' | 'time' | 'userId' | 'userName'>): LogEntry => {
    const u = get().currentUser;
    return {
      id: uid(),
      time: new Date().toISOString(),
      userId: u?.id ?? '-',
      userName: u?.name ?? '-',
      ...partial,
    };
  };

  const withLog = (db: Db, ...entries: LogEntry[]): Db => ({ ...db, logs: [...entries, ...db.logs] });

  const replaceOrder = (db: Db, order: Order): Db => ({
    ...db,
    orders: db.orders.map((o) => (o.id === order.id ? order : o)),
  });

  return {
    db: initial,
    currentUser: null,

    login(userId) {
      const user = get().db.users.find((u) => u.id === userId);
      if (!user) return;
      set({ currentUser: user });
      persist(withLog(get().db, mkLog({ action: 'login' })));
    },

    logout() {
      set({ currentUser: null });
    },

    addUser(name, role) {
      const { db, currentUser } = get();
      if (currentUser?.role !== 'admin') return '仅管理员可管理用户';
      if (!name.trim()) return '用户名不能为空';
      if (db.users.some((u) => u.name === name.trim())) return '用户名已存在';
      const user: User = { id: uid(), name: name.trim(), role };
      persist(withLog({ ...db, users: [...db.users, user] }, mkLog({ action: 'user', detail: `新增用户 ${user.name}` })));
      return undefined;
    },

    removeUser(userId) {
      const { db, currentUser } = get();
      if (currentUser?.role !== 'admin') return '仅管理员可管理用户';
      if (userId === currentUser.id) return '不能删除当前登录用户';
      const user = db.users.find((u) => u.id === userId);
      if (!user) return '用户不存在';
      persist(
        withLog(
          { ...db, users: db.users.filter((u) => u.id !== userId) },
          mkLog({ action: 'user', detail: `删除用户 ${user.name}` })
        )
      );
      return undefined;
    },

    createOrder(input) {
      const { db, currentUser } = get();
      if (!currentUser) return { error: '请先登录' };
      if (!input.customer.trim() || !input.productModel.trim()) return { error: '客户与产品型号必填' };
      const orderNo = `P3-${dayjs().format('YYYYMMDD')}-${String(db.orders.length + 1).padStart(3, '0')}`;
      const order = buildOrder(input, orderNo, currentUser.name, db.settings.defaultCycles);
      persist(
        withLog(
          { ...db, orders: [order, ...db.orders] },
          mkLog({
            action: 'create',
            orderId: order.id,
            orderNo,
            detail: `${input.customer} / ${input.productModel} × ${input.quantity}`,
          })
        )
      );
      return { id: order.id };
    },

    updateSales(orderId, patch) {
      const { db, currentUser } = get();
      if (!currentUser) return '请先登录';
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return '订单不存在';
      if (order.salesLock) {
        persist(
          withLog(
            db,
            mkLog({
              action: 'denied',
              orderId,
              orderNo: order.orderNo,
              stage: 'sales',
              detail: `尝试修改被 ${order.salesLock.byName} 锁定的销售信息`,
            })
          )
        );
        return `销售信息已被 ${order.salesLock.byName} 锁定,需其解锁后才能修改`;
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
      if (!entries.length) return undefined;
      if (patch.orderDate && patch.orderDate !== order.orderDate) {
        updated.stages = recalcSchedule(updated);
      }
      persist(withLog(replaceOrder(db, updated), ...entries));
      return undefined;
    },

    updateStage(orderId, key, patch) {
      const { db, currentUser } = get();
      if (!currentUser) return '请先登录';
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return '订单不存在';
      const stage = order.stages[key];
      if (stage.lock) {
        persist(
          withLog(
            db,
            mkLog({
              action: 'denied',
              orderId,
              orderNo: order.orderNo,
              stage: key,
              detail: `尝试修改被 ${stage.lock.byName} 锁定的 ${STAGE_LABELS[key]}`,
            })
          )
        );
        return `${STAGE_LABELS[key]} 已被 ${stage.lock.byName} 锁定,需其解锁后才能修改`;
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
      if (!entries.length) return undefined;
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
      persist(withLog(newDb, ...entries));
      return undefined;
    },

    toggleLock(orderId, target) {
      const { db, currentUser } = get();
      if (!currentUser) return '请先登录';
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return '订单不存在';
      const lock = target === 'sales' ? order.salesLock : order.stages[target].lock;
      const label = target === 'sales' ? '销售信息' : STAGE_LABELS[target];
      if (lock) {
        if (lock.by !== currentUser.id && currentUser.role !== 'admin') {
          persist(
            withLog(
              db,
              mkLog({
                action: 'denied',
                orderId,
                orderNo: order.orderNo,
                stage: target,
                detail: `尝试解锁被 ${lock.byName} 锁定的${label}`,
              })
            )
          );
          return `只有锁定人 ${lock.byName} 或管理员可以解锁`;
        }
        const updated: Order =
          target === 'sales'
            ? { ...order, salesLock: null }
            : { ...order, stages: { ...order.stages, [target]: { ...order.stages[target], lock: null } } };
        persist(
          withLog(
            replaceOrder(db, updated),
            mkLog({ action: 'unlock', orderId, orderNo: order.orderNo, stage: target, detail: `解锁${label}` })
          )
        );
        return undefined;
      }
      const info = { by: currentUser.id, byName: currentUser.name, at: new Date().toISOString() };
      const updated: Order =
        target === 'sales'
          ? { ...order, salesLock: info }
          : { ...order, stages: { ...order.stages, [target]: { ...order.stages[target], lock: info } } };
      persist(
        withLog(
          replaceOrder(db, updated),
          mkLog({ action: 'lock', orderId, orderNo: order.orderNo, stage: target, detail: `锁定${label}` })
        )
      );
      return undefined;
    },

    deleteOrder(orderId) {
      const { db, currentUser } = get();
      if (!currentUser) return '请先登录';
      const order = db.orders.find((o) => o.id === orderId);
      if (!order) return '订单不存在';
      if (currentUser.role !== 'admin' && currentUser.name !== order.createdBy) {
        return '仅订单录入人或管理员可删除订单';
      }
      const hasLock = !!order.salesLock || Object.values(order.stages).some((s) => s.lock);
      if (hasLock && currentUser.role !== 'admin') return '订单存在锁定区块,仅管理员可删除';
      persist(
        withLog(
          { ...db, orders: db.orders.filter((o) => o.id !== orderId) },
          mkLog({ action: 'delete', orderId, orderNo: order.orderNo, detail: `${order.customer} / ${order.productModel}` })
        )
      );
      return undefined;
    },

    addInventoryMove(m) {
      const { db, currentUser } = get();
      if (!currentUser) return '请先登录';
      if (!m.productModel.trim()) return '型号不能为空';
      if (!m.qty) return '数量不能为 0';
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
      persist(
        withLog(
          { ...db, inventoryMoves: [move, ...db.inventoryMoves] },
          mkLog({ action: 'inventory', detail: `手工${m.type === 'shipped' ? '出货' : '入库/调整'} ${move.productModel} × ${m.qty}` })
        )
      );
      return undefined;
    },

    setDefaultCycle(key, days) {
      const { db } = get();
      const before = db.settings.defaultCycles[key];
      if (before === days || days < 1) return;
      persist(
        withLog(
          { ...db, settings: { ...db.settings, defaultCycles: { ...db.settings.defaultCycles, [key]: days } } },
          mkLog({
            action: 'settings',
            field: `${STAGE_LABELS[key]}默认周期`,
            before: String(before),
            after: String(days),
          })
        )
      );
    },

    importDb(db) {
      const { currentUser } = get();
      const stillExists = currentUser && db.users.some((u) => u.id === currentUser.id);
      const entry = mkLog({ action: 'import', detail: `导入数据:${db.orders.length} 订单 / ${db.users.length} 用户` });
      const newDb = { ...db, logs: [entry, ...db.logs] };
      saveDb(newDb);
      set({ db: newDb, currentUser: stillExists ? currentUser : null });
    },
  };
});
