// 库存余额派生计算:余额 = 期初 + 生产入库 + 调整 − 出货。
import type { InventoryMove } from '../types';

/** 流水计入余额的带符号数量(shipped 恒为负) */
export function signedQty(m: InventoryMove): number {
  return m.type === 'shipped' ? -Math.abs(m.qty) : m.qty;
}

export interface StockRow {
  productModel: string;
  initial: number;
  produced: number;
  shipped: number;
  adjust: number;
  balance: number;
}

/** 按型号汇总库存 */
export function stockBalances(moves: InventoryMove[]): StockRow[] {
  const map = new Map<string, StockRow>();
  for (const m of moves) {
    let row = map.get(m.productModel);
    if (!row) {
      row = { productModel: m.productModel, initial: 0, produced: 0, shipped: 0, adjust: 0, balance: 0 };
      map.set(m.productModel, row);
    }
    if (m.type === 'initial') row.initial += m.qty;
    else if (m.type === 'produced') row.produced += m.qty;
    else if (m.type === 'shipped') row.shipped += Math.abs(m.qty);
    else row.adjust += m.qty;
    row.balance += signedQty(m);
  }
  return [...map.values()].sort((a, b) => a.productModel.localeCompare(b.productModel));
}

/** 某型号当前库存余额 */
export function stockOf(moves: InventoryMove[], productModel: string): number {
  return moves.filter((m) => m.productModel === productModel).reduce((s, m) => s + signedQty(m), 0);
}
