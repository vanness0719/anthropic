// 汇总统计导出为 .xlsx(多 sheet,随当前筛选生效)。纯前端生成,便携版同样可用。
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { byCustomer, byModel, orderAmount, stageWip } from './summary';
import { currentStageLabel, planFinish, progressPct } from './schedule';
import type { Order } from '../types';

const ORDER_STATUS_LABELS = { active: '进行中', completed: '已完成', cancelled: '已取消' } as const;

export interface SummaryExportMeta {
  customer?: string;
  model?: string;
  start?: string;
  end?: string;
}

function sheet(rows: Record<string, unknown>[], colWidths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = colWidths.map((wch) => ({ wch }));
  return ws;
}

export function exportSummaryExcel(orders: Order[], meta: SummaryExportMeta): void {
  const wb = XLSX.utils.book_new();

  const info = [
    { 项目: '导出时间', 内容: dayjs().format('YYYY-MM-DD HH:mm') },
    { 项目: '客户筛选', 内容: meta.customer ?? '(全部)' },
    { 项目: '型号筛选', 内容: meta.model ?? '(全部)' },
    { 项目: '下单日期起', 内容: meta.start ?? '(不限)' },
    { 项目: '下单日期止', 内容: meta.end ?? '(不限)' },
    { 项目: '命中订单数', 内容: orders.length },
  ];
  XLSX.utils.book_append_sheet(wb, sheet(info, [14, 24]), '说明');

  const customerRows = byCustomer(orders).map((r) => ({
    客户: r.customer,
    产品型号: r.productModel,
    订单数: r.orderCount,
    '总数量(颗)': r.qty,
    '金额(CNY)': r.amounts.CNY,
    '金额(USD)': r.amounts.USD,
  }));
  XLSX.utils.book_append_sheet(wb, sheet(customerRows, [16, 16, 8, 12, 14, 14]), '按客户汇总');

  const modelRows = byModel(orders).map((r) => ({
    产品型号: r.productModel,
    订单数: r.orderCount,
    '总数量(颗)': r.totalQty,
    '已交付(颗)': r.deliveredQty,
    '在产(颗)': r.wipQty,
    '金额(CNY)': r.amounts.CNY,
    '金额(USD)': r.amounts.USD,
  }));
  XLSX.utils.book_append_sheet(wb, sheet(modelRows, [16, 8, 12, 12, 12, 14, 14]), '按型号汇总');

  const wipRows = stageWip(orders).map((r) => ({
    当前阶段: r.stageLabel,
    在制订单数: r.orderCount,
    订单号: r.orderNos,
  }));
  XLSX.utils.book_append_sheet(wb, sheet(wipRows, [12, 10, 40]), '阶段在制');

  const detailRows = orders.map((o) => ({
    订单号: o.orderNo,
    客户: o.customer,
    产品型号: o.productModel,
    '数量(颗)': o.quantity,
    单价: o.unitPrice,
    币种: o.currency,
    金额: orderAmount(o),
    下单日期: o.orderDate,
    要求交期: o.requiredDeliveryDate ?? '',
    计划完成: planFinish(o) ?? '',
    当前阶段: currentStageLabel(o),
    '进度(%)': progressPct(o),
    状态: ORDER_STATUS_LABELS[o.status],
    录入人: o.createdBy,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    sheet(detailRows, [16, 14, 14, 10, 8, 6, 12, 11, 11, 11, 10, 8, 8, 8]),
    '订单明细'
  );

  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  // 文件名用 ASCII,部分浏览器(无头/旧版)会丢弃含非 ASCII 字符的 download 文件名
  a.download = `p3-summary-${dayjs().format('YYYY-MM-DD')}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
