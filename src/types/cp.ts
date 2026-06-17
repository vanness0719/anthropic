// CP (Circuit Probe) Single Product 数据模型
// 服务于 Yield/Bin Pareto 页面的趋势 / 帕累托 / 晶圆图三联动

export type BinKind = 'pass' | 'fail';

/** 单个 Bin 定义(HBin / SBin 共用结构) */
export interface Bin {
  bin: number; // Bin#,如 0(pass)、24、98
  name: string; // 如 "FUSABLE RAMS MAX"
  type: BinKind;
  color: string; // 图例 / 帕累托 / wafermap 颜色
}

/** 晶圆上单个 die */
export interface Die {
  x: number; // die 网格列坐标
  y: number; // die 网格行坐标
  bin: number; // 命中的 HBin#
  edge: boolean; // 是否边缘 die(用于 Edge / Non-Edge Yield)
}

/** 单片晶圆 */
export interface Wafer {
  waferId: string; // 全局唯一,如 "LOT001-W01"
  lotId: string;
  waferNo: number;
  date: string; // 测试日期 YYYY-MM-DD
  yield: number; // hard bin yield %
  dies: Die[];
  hbinCounts: Record<number, number>; // HBin# -> 数量
  sbinCounts: Record<number, number>; // SBin# -> 数量
}

/** 单个产品(本页 = CP1) */
export interface Product {
  productId: string; // "CP1"
  dateRange: [string, string];
  hbins: Bin[];
  sbins: Bin[];
  wafers: Wafer[];
  baselineWaferIds: string[]; // 基线晶圆集合(用于对比)
  gridSize: number; // 晶圆 die 网格边长(正方形栅格)
}

export type BinType = 'HBin' | 'SBin' | 'SBinGroup';
export type SmartSplit = 'Day' | 'Week' | 'Month';
export type MapMode = 'stacked' | 'stackedByLot';

/** 帕累托一行 */
export interface ParetoRow {
  bin: number;
  name: string;
  color: string;
  type: BinKind;
  count: number;
  pct: number; // bin% = count / total dies
  cumPct: number; // 累计 %(用于 CDF / 帕累托折线)
}
