// 汇总统计:按客户×型号、按型号、各阶段在制。
import { CURRENCY_SYMBOLS, STAGE_LABELS, STAGE_ORDER } from '../constants/stages';
import { currentStageKey } from './schedule';
import type { Order, StageKey } from '../types';

export function orderAmount(o: Order): number {
  return o.quantity * o.unitPrice;
}

/** 金额展示:分币种合并成 "¥1,234,000 / $56,000" */
export function fmtAmounts(amounts: { CNY: number; USD: number }): string {
  const parts: string[] = [];
  (['CNY', 'USD'] as const).forEach((c) => {
    if (amounts[c] > 0) parts.push(`${CURRENCY_SYMBOLS[c]}${amounts[c].toLocaleString()}`);
  });
  return parts.join(' / ') || '-';
}

export interface CustomerModelRow {
  key: string;
  customer: string;
  productModel: string;
  orderCount: number;
  qty: number;
  amounts: { CNY: number; USD: number };
  isSubtotal?: boolean;
}

/** 按客户分组、组内按型号汇总,并为每个客户追加"合计"行 */
export function byCustomer(orders: Order[]): CustomerModelRow[] {
  const customers = new Map<string, Map<string, CustomerModelRow>>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    let models = customers.get(o.customer);
    if (!models) {
      models = new Map();
      customers.set(o.customer, models);
    }
    let row = models.get(o.productModel);
    if (!row) {
      row = {
        key: `${o.customer}|${o.productModel}`,
        customer: o.customer,
        productModel: o.productModel,
        orderCount: 0,
        qty: 0,
        amounts: { CNY: 0, USD: 0 },
      };
      models.set(o.productModel, row);
    }
    row.orderCount += 1;
    row.qty += o.quantity;
    row.amounts[o.currency] += orderAmount(o);
  }
  const rows: CustomerModelRow[] = [];
  for (const [customer, models] of [...customers.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sub: CustomerModelRow = {
      key: `${customer}|__subtotal`,
      customer,
      productModel: '合计',
      orderCount: 0,
      qty: 0,
      amounts: { CNY: 0, USD: 0 },
      isSubtotal: true,
    };
    for (const row of models.values()) {
      rows.push(row);
      sub.orderCount += row.orderCount;
      sub.qty += row.qty;
      sub.amounts.CNY += row.amounts.CNY;
      sub.amounts.USD += row.amounts.USD;
    }
    rows.push(sub);
  }
  return rows;
}

export interface ModelRow {
  key: string;
  productModel: string;
  orderCount: number;
  totalQty: number;
  deliveredQty: number;
  wipQty: number;
  amounts: { CNY: number; USD: number };
}

/** 按型号汇总:总量、已交付(客户收货完成)、在产 */
export function byModel(orders: Order[]): ModelRow[] {
  const map = new Map<string, ModelRow>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    let row = map.get(o.productModel);
    if (!row) {
      row = {
        key: o.productModel,
        productModel: o.productModel,
        orderCount: 0,
        totalQty: 0,
        deliveredQty: 0,
        wipQty: 0,
        amounts: { CNY: 0, USD: 0 },
      };
      map.set(o.productModel, row);
    }
    row.orderCount += 1;
    row.totalQty += o.quantity;
    const delivered = o.stages.delivery.status === 'done' || o.status === 'completed';
    if (delivered) row.deliveredQty += o.quantity;
    else row.wipQty += o.quantity;
    row.amounts[o.currency] += orderAmount(o);
  }
  return [...map.values()].sort((a, b) => a.productModel.localeCompare(b.productModel));
}

export interface StageWipRow {
  key: StageKey;
  stageLabel: string;
  orderCount: number;
  orderNos: string;
}

/** 各阶段当前在制订单统计(订单当前所处阶段) */
export function stageWip(orders: Order[]): StageWipRow[] {
  const rows = STAGE_ORDER.map<StageWipRow>((k) => ({
    key: k,
    stageLabel: STAGE_LABELS[k],
    orderCount: 0,
    orderNos: '',
  }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const o of orders) {
    if (o.status !== 'active') continue;
    const k = currentStageKey(o);
    if (!k) continue;
    const row = byKey.get(k)!;
    row.orderCount += 1;
    row.orderNos = row.orderNos ? `${row.orderNos}, ${o.orderNo}` : o.orderNo;
  }
  return rows.filter((r) => r.orderCount > 0);
}
