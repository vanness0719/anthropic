import { create } from 'zustand';
import type { BinType, MapMode, Product, SmartSplit } from '../types/cp';
import { generateMockData } from '../mock/generateMockData';

interface CpState {
  product: Product;
  binType: BinType;
  smartSplit: SmartSplit;
  mapMode: MapMode;
  selectedWaferIds: string[]; // 趋势图刷选(用于 Selected 对比图,最多 2 片)
  highlightedBin: number | null; // 表/帕累托 ↔ wafermap 联动高亮

  setBinType: (t: BinType) => void;
  setSmartSplit: (s: SmartSplit) => void;
  setMapMode: (m: MapMode) => void;
  setSelectedWafers: (ids: string[]) => void;
  setHighlightedBin: (bin: number | null) => void;
}

export const useCpStore = create<CpState>((set) => ({
  product: generateMockData(),
  binType: 'HBin',
  smartSplit: 'Day',
  mapMode: 'stacked',
  selectedWaferIds: [],
  highlightedBin: null,

  setBinType: (binType) => set({ binType }),
  setSmartSplit: (smartSplit) => set({ smartSplit }),
  setMapMode: (mapMode) => set({ mapMode }),
  // 仅保留最近选择的 2 片,贴合手册 "Select 2pcs wafers for yield comparison"
  setSelectedWafers: (ids) => set({ selectedWaferIds: ids.slice(-2) }),
  setHighlightedBin: (highlightedBin) => set({ highlightedBin }),
}));
