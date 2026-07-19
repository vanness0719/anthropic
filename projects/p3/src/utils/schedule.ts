// 计划时间链式计算与订单进度派生。
import dayjs from 'dayjs';
import { STAGE_LABELS, STAGE_ORDER } from '../constants/stages';
import type { Order, StageData, StageKey } from '../types';

const FMT = 'YYYY-MM-DD';

/**
 * 按阶段顺序重算全链计划时间(纯函数):
 * - 起点 = 下单日期;planEnd = planStart + cycleDays - 1;下一阶段 planStart = 前一阶段 planEnd 次日。
 * - manualDates 的阶段使用手填起止(只填开始则按周期推结束),后续阶段从它继续链式计算。
 * - 停用且非手动的阶段清空计划时间,链条跳过。
 */
export function recalcSchedule(order: Order): Record<StageKey, StageData> {
  const stages = { ...order.stages };
  let cursor = dayjs(order.orderDate || undefined);
  for (const key of STAGE_ORDER) {
    const s = stages[key];
    if (!s.enabled) {
      if (!s.manualDates) stages[key] = { ...s, planStart: undefined, planEnd: undefined };
      continue;
    }
    const cycle = Math.max(1, Math.round(s.cycleDays || 1));
    if (s.manualDates && (s.planStart || s.planEnd)) {
      const start = s.planStart ? dayjs(s.planStart) : dayjs(s.planEnd).subtract(cycle - 1, 'day');
      const end = s.planEnd ? dayjs(s.planEnd) : start.add(cycle - 1, 'day');
      stages[key] = { ...s, planStart: start.format(FMT), planEnd: end.format(FMT) };
      cursor = end.add(1, 'day');
    } else {
      const start = cursor;
      const end = start.add(cycle - 1, 'day');
      stages[key] = { ...s, planStart: start.format(FMT), planEnd: end.format(FMT) };
      cursor = end.add(1, 'day');
    }
  }
  return stages;
}

export function enabledStages(order: Order): StageKey[] {
  return STAGE_ORDER.filter((k) => order.stages[k].enabled);
}

/** 整单计划完成日期 = 最后一个启用阶段的 planEnd */
export function planFinish(order: Order): string | undefined {
  const keys = enabledStages(order);
  return keys.length ? order.stages[keys[keys.length - 1]].planEnd : undefined;
}

/** 计划完成晚于客户要求交期 → 延期预警 */
export function isDelayed(order: Order): boolean {
  const finish = planFinish(order);
  return !!finish && !!order.requiredDeliveryDate && finish > order.requiredDeliveryDate;
}

/** 已完成的启用阶段占比(%) */
export function progressPct(order: Order): number {
  const keys = enabledStages(order);
  if (!keys.length) return 0;
  const done = keys.filter((k) => order.stages[k].status === 'done').length;
  return Math.round((done / keys.length) * 100);
}

/** 当前所处阶段 = 第一个未完成的启用阶段;全部完成返回 null */
export function currentStageKey(order: Order): StageKey | null {
  for (const k of enabledStages(order)) {
    if (order.stages[k].status !== 'done') return k;
  }
  return null;
}

export function currentStageLabel(order: Order): string {
  const k = currentStageKey(order);
  return k ? STAGE_LABELS[k] : '全部完成';
}

/** 最后一个启用的生产阶段(不含出货/收货),其完成即产出入库 */
export function lastProductionStage(order: Order): StageKey | null {
  const keys = enabledStages(order).filter((k) => k !== 'stockOut' && k !== 'delivery');
  return keys.length ? keys[keys.length - 1] : null;
}

/** 阶段实际完成与计划的偏差天数(正 = 延后) */
export function stageDeviationDays(s: StageData): number | null {
  if (!s.actualEnd || !s.planEnd) return null;
  return dayjs(s.actualEnd).diff(dayjs(s.planEnd), 'day');
}
