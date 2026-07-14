// P3 全局数据模型:订单(销售信息+生产阶段)、库存流水、操作日志、用户与设置。

export type Role = 'sales' | 'planner' | 'production' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
}

/** 生产/交付阶段(固定顺序见 constants/stages.ts,每单可启用/停用) */
export type StageKey =
  | 'waferFab'
  | 'cp1'
  | 'cp2'
  | 'cp3'
  | 'cp4'
  | 'substrate'
  | 'assembly'
  | 'burnIn'
  | 'ft1'
  | 'ft2'
  | 'ft3'
  | 'stockOut'
  | 'delivery';

export type StageStatus = 'pending' | 'inProgress' | 'done' | 'issue';

export interface LockInfo {
  by: string; // 锁定人 userId
  byName: string;
  at: string; // ISO 时间
}

export interface StageData {
  enabled: boolean;
  /** 预填周期(天),自动排期用 */
  cycleDays: number;
  /** true = 手动指定计划起止,不随前序阶段联动;后续阶段从手动日期继续链式计算 */
  manualDates: boolean;
  planStart?: string; // YYYY-MM-DD
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  status: StageStatus;
  qtyIn?: number; // 投入颗数
  qtyOut?: number; // 产出颗数
  owner?: string; // 阶段负责人(姓名)
  remark?: string;
  lock: LockInfo | null;
  updatedBy?: string; // 最近修改人姓名
  updatedAt?: string;
}

export type Currency = 'CNY' | 'USD';
export type OrderStatus = 'active' | 'completed' | 'cancelled';

/** 销售录入的订单信息 */
export interface SalesInput {
  customer: string;
  customerContact?: string;
  productModel: string;
  waferName?: string; // 晶圆名称
  waferVersion?: string; // 晶圆版本
  quantity: number; // 订购数量(颗)
  unitPrice: number;
  currency: Currency;
  orderDate: string; // 下单日期 YYYY-MM-DD,自动排期起点
  requiredDeliveryDate?: string; // 客户要求交期
  poNo?: string;
  notes?: string;
  /** 用现有库存抵扣的数量(颗) */
  fromStockQty: number;
}

export interface Order extends SalesInput {
  id: string;
  orderNo: string;
  status: OrderStatus;
  /** 销售信息区的锁(锁定后销售信息不可改) */
  salesLock: LockInfo | null;
  stages: Record<StageKey, StageData>;
  createdBy: string; // 姓名
  createdAt: string;
}

export type InventoryMoveType = 'initial' | 'produced' | 'shipped' | 'adjust';

export interface InventoryMove {
  id: string;
  productModel: string;
  type: InventoryMoveType;
  /** 数量(颗)。shipped 按负数计入余额,其余按正负号原样计入 */
  qty: number;
  orderId?: string;
  orderNo?: string;
  remark?: string;
  by: string; // userId
  byName: string;
  at: string;
}

export type LogAction =
  | 'login'
  | 'create'
  | 'update'
  | 'delete'
  | 'lock'
  | 'unlock'
  | 'denied'
  | 'import'
  | 'inventory'
  | 'settings'
  | 'user';

export interface LogEntry {
  id: string;
  time: string; // ISO
  userId: string;
  userName: string;
  action: LogAction;
  orderId?: string;
  orderNo?: string;
  /** 'sales' 表示销售信息区 */
  stage?: StageKey | 'sales';
  field?: string;
  before?: string;
  after?: string;
  detail?: string;
}

export interface Settings {
  /** 各阶段默认周期(天),新建订单时预填 */
  defaultCycles: Record<StageKey, number>;
}

export interface Db {
  schemaVersion: number;
  users: User[];
  orders: Order[];
  inventoryMoves: InventoryMove[];
  logs: LogEntry[];
  settings: Settings;
}
