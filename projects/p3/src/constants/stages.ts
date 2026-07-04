// 阶段顺序、中文名、默认周期等常量。
import type { LogAction, Role, StageKey, StageStatus } from '../types';

/** 生产链固定顺序(基板生产实际可与晶圆并行,并行时用"手动日期"直接指定) */
export const STAGE_ORDER: StageKey[] = [
  'waferFab',
  'cp1',
  'cp2',
  'cp3',
  'cp4',
  'substrate',
  'assembly',
  'burnIn',
  'ft1',
  'ft2',
  'ft3',
  'stockOut',
  'delivery',
];

export const STAGE_LABELS: Record<StageKey, string> = {
  waferFab: '晶圆制造',
  cp1: 'CP1',
  cp2: 'CP2',
  cp3: 'CP3',
  cp4: 'CP4',
  substrate: '基板生产',
  assembly: '封装',
  burnIn: 'Burn-in',
  ft1: 'FT1',
  ft2: 'FT2',
  ft3: 'FT3',
  stockOut: '库存出货',
  delivery: '客户收货',
};

/** 默认周期(天),可在设置页修改,新建订单时预填 */
export const DEFAULT_CYCLES: Record<StageKey, number> = {
  waferFab: 60,
  cp1: 5,
  cp2: 5,
  cp3: 5,
  cp4: 5,
  substrate: 30,
  assembly: 14,
  burnIn: 7,
  ft1: 5,
  ft2: 5,
  ft3: 5,
  stockOut: 3,
  delivery: 7,
};

export const ROLE_LABELS: Record<Role, string> = {
  sales: '销售',
  planner: '生产计划',
  production: '生产执行',
  admin: '管理员',
};

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  pending: '未开始',
  inProgress: '进行中',
  done: '完成',
  issue: '异常',
};

/** AntD Tag / Badge 用色 */
export const STAGE_STATUS_COLORS: Record<StageStatus, string> = {
  pending: 'default',
  inProgress: 'processing',
  done: 'success',
  issue: 'error',
};

export const ACTION_LABELS: Record<LogAction, string> = {
  login: '登录',
  create: '新建订单',
  update: '修改',
  delete: '删除订单',
  lock: '锁定',
  unlock: '解锁',
  denied: '修改被拒(已锁)',
  import: '导入数据',
  inventory: '库存操作',
  settings: '修改设置',
  user: '用户管理',
};

export const CURRENCY_SYMBOLS: Record<'CNY' | 'USD', string> = { CNY: '¥', USD: '$' };
