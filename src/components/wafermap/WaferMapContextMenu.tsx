import { useEffect } from 'react';
import { message } from 'antd';

export interface MenuPos {
  x: number;
  y: number;
}

interface Item {
  label: string;
  sep?: boolean;
  // 已实现的项可传 onClick;其余弹"待接入"占位
  done?: boolean;
}

// 复刻手册右键菜单项;Overlay/Source 类暂为占位
const ITEMS: Item[] = [
  { label: 'Select All' },
  { label: 'Invert Selection' },
  { label: 'Deselect All' },
  { label: '', sep: true },
  { label: 'Overlay with Defect' },
  { label: 'Overlay with WAT' },
  { label: 'Overlay with Metrology' },
  { label: '', sep: true },
  { label: 'Export Data' },
  { label: 'Maximize Visualization' },
  { label: 'View Source File' },
  { label: 'Retrieve to DE-G' },
];

export default function WaferMapContextMenu({
  pos,
  onClose,
}: {
  pos: MenuPos | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!pos) return;
    const close = () => onClose();
    // 延迟一帧再挂监听,避免打开菜单的同一次 contextmenu / click 立即把它关掉
    const t = window.setTimeout(() => {
      window.addEventListener('click', close);
      window.addEventListener('contextmenu', close);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [pos, onClose]);

  if (!pos) return null;

  return (
    <div className="context-menu" style={{ left: pos.x, top: pos.y }}>
      {ITEMS.map((it, i) =>
        it.sep ? (
          <div key={i} className="context-menu-sep" />
        ) : (
          <div
            key={i}
            className="context-menu-item"
            onClick={() => {
              message.info(`「${it.label}」功能待接入`);
              onClose();
            }}
          >
            {it.label}
          </div>
        )
      )}
    </div>
  );
}
