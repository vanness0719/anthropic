import { create } from 'zustand';
import type { BinType, Product, SmartSplit } from '../types/cp';
import { generateMockData } from '../mock/generateMockData';
import { realCp1 } from '../data/realCp1';
import { mergeProducts } from '../utils/stdfParser';

export type DataSource = 'mock' | 'real' | 'upload';
export type ActiveView = 'yield' | 'byParameter';

const mockProduct = generateMockData();

// 便携版(单文件 HTML)可注入 window.__DE_YMS_SOURCE__='real' 让打开即显示真实 STDF 数据
const initialSource: DataSource =
  typeof window !== 'undefined' && (window as { __DE_YMS_SOURCE__?: string }).__DE_YMS_SOURCE__ === 'real'
    ? 'real'
    : 'mock';

interface CpState {
  activeView: ActiveView; // 左侧菜单当前视图
  dataSource: DataSource; // mock 演示数据 / 内置真实 STDF / 用户上传解析
  product: Product;
  uploadedProduct: Product | null; // 用户上传的 STDF 解析结果
  binType: BinType;
  smartSplit: SmartSplit;
  selectedWaferIds: string[]; // 趋势图刷选(用于 Selected 对比图,最多 2 片)
  highlightedBin: number | null; // 表/帕累托 ↔ wafermap 联动高亮
  inspectedWaferId: string | null; // 单片检视:选中查看某一片 wafer 的 map + bin

  setActiveView: (v: ActiveView) => void;
  setDataSource: (s: DataSource) => void;
  addUploadedProducts: (products: Product[]) => void; // 上传解析成功后调用(累加合并多片)
  clearUploaded: () => void;
  setBinType: (t: BinType) => void;
  setSmartSplit: (s: SmartSplit) => void;
  setSelectedWafers: (ids: string[]) => void;
  setHighlightedBin: (bin: number | null) => void;
  setInspectedWafer: (id: string | null) => void;
}

export const useCpStore = create<CpState>((set, get) => ({
  activeView: 'yield',
  dataSource: initialSource,
  product: initialSource === 'real' ? realCp1 : mockProduct,
  uploadedProduct: null,
  binType: 'HBin',
  smartSplit: 'Day',
  selectedWaferIds: [],
  highlightedBin: null,
  inspectedWaferId: null,

  setActiveView: (activeView) => set({ activeView }),
  // 切换数据源时重置联动选择状态,避免残留旧 wafer id / bin
  setDataSource: (dataSource) => {
    const { uploadedProduct } = get();
    const product =
      dataSource === 'real' ? realCp1 : dataSource === 'upload' ? uploadedProduct ?? mockProduct : mockProduct;
    set({ dataSource, product, selectedWaferIds: [], highlightedBin: null, inspectedWaferId: null });
  },
  // 累加合并:新上传的文件与已有上传数据集一起,支持"分多次加载,同时看多片"
  addUploadedProducts: (products) => {
    const { uploadedProduct } = get();
    const merged = mergeProducts([...(uploadedProduct ? [uploadedProduct] : []), ...products]);
    set({ uploadedProduct: merged, dataSource: 'upload', product: merged, selectedWaferIds: [], highlightedBin: null, inspectedWaferId: null });
  },
  clearUploaded: () => {
    const src: DataSource = 'mock';
    set({ uploadedProduct: null, dataSource: src, product: mockProduct, selectedWaferIds: [], highlightedBin: null, inspectedWaferId: null });
  },
  setBinType: (binType) => set({ binType }),
  setSmartSplit: (smartSplit) => set({ smartSplit }),
  // 仅保留最近选择的 2 片,贴合手册 "Select 2pcs wafers for yield comparison"
  setSelectedWafers: (ids) => set({ selectedWaferIds: ids.slice(-2) }),
  setHighlightedBin: (highlightedBin) => set({ highlightedBin }),
  setInspectedWafer: (inspectedWaferId) => set({ inspectedWaferId }),
}));
