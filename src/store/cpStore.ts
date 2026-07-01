import { create } from 'zustand';
import type { BinType, MapMode, Product, SmartSplit } from '../types/cp';
import { generateMockData } from '../mock/generateMockData';
import { realCp1 } from '../data/realCp1';

export type DataSource = 'mock' | 'real' | 'upload';

const mockProduct = generateMockData();

// 便携版(单文件 HTML)可注入 window.__DE_YMS_SOURCE__='real' 让打开即显示真实 STDF 数据
const initialSource: DataSource =
  typeof window !== 'undefined' && (window as { __DE_YMS_SOURCE__?: string }).__DE_YMS_SOURCE__ === 'real'
    ? 'real'
    : 'mock';

interface CpState {
  dataSource: DataSource; // mock 演示数据 / 内置真实 STDF / 用户上传解析
  product: Product;
  uploadedProduct: Product | null; // 用户上传的 STDF 解析结果
  binType: BinType;
  smartSplit: SmartSplit;
  mapMode: MapMode;
  selectedWaferIds: string[]; // 趋势图刷选(用于 Selected 对比图,最多 2 片)
  highlightedBin: number | null; // 表/帕累托 ↔ wafermap 联动高亮

  setDataSource: (s: DataSource) => void;
  loadUploadedProduct: (p: Product) => void; // 上传解析成功后调用
  setBinType: (t: BinType) => void;
  setSmartSplit: (s: SmartSplit) => void;
  setMapMode: (m: MapMode) => void;
  setSelectedWafers: (ids: string[]) => void;
  setHighlightedBin: (bin: number | null) => void;
}

export const useCpStore = create<CpState>((set, get) => ({
  dataSource: initialSource,
  product: initialSource === 'real' ? realCp1 : mockProduct,
  uploadedProduct: null,
  binType: 'HBin',
  smartSplit: 'Day',
  mapMode: 'stacked',
  selectedWaferIds: [],
  highlightedBin: null,

  // 切换数据源时重置联动选择状态,避免残留旧 wafer id / bin
  setDataSource: (dataSource) => {
    const { uploadedProduct } = get();
    const product =
      dataSource === 'real' ? realCp1 : dataSource === 'upload' ? uploadedProduct ?? mockProduct : mockProduct;
    set({ dataSource, product, selectedWaferIds: [], highlightedBin: null });
  },
  loadUploadedProduct: (uploadedProduct) =>
    set({ uploadedProduct, dataSource: 'upload', product: uploadedProduct, selectedWaferIds: [], highlightedBin: null }),
  setBinType: (binType) => set({ binType }),
  setSmartSplit: (smartSplit) => set({ smartSplit }),
  setMapMode: (mapMode) => set({ mapMode }),
  // 仅保留最近选择的 2 片,贴合手册 "Select 2pcs wafers for yield comparison"
  setSelectedWafers: (ids) => set({ selectedWaferIds: ids.slice(-2) }),
  setHighlightedBin: (highlightedBin) => set({ highlightedBin }),
}));
