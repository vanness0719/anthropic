import { useMemo, useState } from 'react';
import { Segmented } from 'antd';
import { useCpStore } from '../../store/cpStore';
import WaferMap from './WaferMap';
import WaferMapContextMenu, { type MenuPos } from './WaferMapContextMenu';

/** 底部晶圆图面板:Baseline 叠加图 vs 选中对比图,含地图模式切换与右键菜单 */
export default function WafermapPanel() {
  const product = useCpStore((s) => s.product);
  const highlightedBin = useCpStore((s) => s.highlightedBin);
  const mapMode = useCpStore((s) => s.mapMode);
  const setMapMode = useCpStore((s) => s.setMapMode);
  // 订阅原始 id 数组(而非选择器函数),保证选择变化时重渲染
  const selectedWaferIds = useCpStore((s) => s.selectedWaferIds);

  const baselineWafers = useMemo(() => {
    const set = new Set(product.baselineWaferIds);
    return product.wafers.filter((w) => set.has(w.waferId));
  }, [product]);
  const selectedWafers = useMemo(() => {
    const set = new Set(selectedWaferIds);
    return product.wafers.filter((w) => set.has(w.waferId));
  }, [product, selectedWaferIds]);

  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [colorBy, setColorBy] = useState<'yield' | 'bin'>('yield');

  const openMenu = (e: React.MouseEvent) => setMenuPos({ x: e.clientX, y: e.clientY });

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Segmented
          size="small"
          value={mapMode}
          onChange={(v) => setMapMode(v as 'stacked' | 'stackedByLot')}
          options={[
            { label: 'Stacked Map', value: 'stacked' },
            { label: 'Stacked Map by Lot', value: 'stackedByLot' },
          ]}
        />
        <Segmented
          size="small"
          value={colorBy}
          onChange={(v) => setColorBy(v as 'yield' | 'bin')}
          options={[
            { label: 'Color: Yield', value: 'yield' },
            { label: 'Color: Bin', value: 'bin' },
          ]}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, padding: 12, flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Baseline ({baselineWafers.length} wafers)</div>
          <WaferMap
            wafers={baselineWafers}
            bins={product.hbins}
            highlightedBin={highlightedBin}
            colorBy={colorBy}
            onContextMenu={openMenu}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            Selected ({selectedWafers.length} wafers)
          </div>
          <WaferMap
            wafers={selectedWafers}
            bins={product.hbins}
            highlightedBin={highlightedBin}
            colorBy={colorBy}
            onContextMenu={openMenu}
          />
        </div>
        <div style={{ fontSize: 11, color: '#8c8c8c', alignSelf: 'flex-end', maxWidth: 180 }}>
          在上方趋势图中刷选 wafer 进行与 baseline 的对比;右键晶圆图查看更多功能。
        </div>
      </div>

      <WaferMapContextMenu pos={menuPos} onClose={() => setMenuPos(null)} />
    </div>
  );
}
