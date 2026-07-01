import { useEffect, useMemo, useRef } from 'react';
import type { Bin, Wafer } from '../../types/cp';
import { passBinSet, stackWafermap } from '../../utils/yieldCalc';

interface Props {
  wafers: Wafer[];
  gridSize: number;
  bins: Bin[];
  highlightedBin: number | null;
  /** 上色方式:yield = 绿→红良率渐变;bin = 按 topBin 颜色 */
  colorBy: 'yield' | 'bin';
  size?: number;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** 良率 0-100 映射到 红->黄->绿 */
function yieldColor(pct: number): string {
  const h = (pct / 100) * 120; // 0=red, 120=green
  return `hsl(${h}, 75%, 48%)`;
}

/** 自研 Canvas 晶圆图:绘制 die 网格,圆形裁剪,支持 stacked 叠加与 bin 高亮 */
export default function WaferMap({
  wafers,
  gridSize,
  bins,
  highlightedBin,
  colorBy,
  size = 220,
  onContextMenu,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const passBins = useMemo(() => passBinSet(bins), [bins]);
  const stacked = useMemo(() => stackWafermap(wafers, passBins), [wafers, passBins]);
  const binColor = useMemo(() => new Map(bins.map((b) => [b.bin, b.color])), [bins]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (!stacked.length) {
      ctx.fillStyle = '#bfbfbf';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No wafers selected', size / 2, size / 2);
      return;
    }

    const cell = size / gridSize;
    for (const d of stacked) {
      let fill: string;
      if (colorBy === 'yield') {
        fill = yieldColor(d.passRate);
      } else {
        fill = binColor.get(d.topBin) ?? '#d9d9d9';
      }
      // 高亮模式:仅突出包含该 bin 的 die,其余淡化
      let alpha = 1;
      if (highlightedBin != null) {
        const has = (d.binTally[highlightedBin] ?? 0) > 0;
        if (has) {
          fill = binColor.get(highlightedBin) ?? '#1677ff';
          alpha = 1;
        } else {
          alpha = 0.12;
        }
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fillRect(d.x * cell, d.y * cell, cell - 0.5, cell - 0.5);
    }
    ctx.globalAlpha = 1;

    // 晶圆外轮廓圆
    ctx.strokeStyle = '#8c8c8c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [stacked, gridSize, binColor, highlightedBin, colorBy, size]);

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      style={{ display: 'block', cursor: 'context-menu' }}
    />
  );
}
