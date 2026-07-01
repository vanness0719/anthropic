import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bin, Wafer } from '../../types/cp';
import { passBinSet, stackWafermap, type StackedDie } from '../../utils/yieldCalc';

interface Props {
  wafers: Wafer[];
  bins: Bin[];
  highlightedBin: number | null;
  /** 上色方式:yield = 绿→红良率渐变;bin = 按 topBin 颜色 */
  colorBy: 'yield' | 'bin';
  size?: number;
  /** 是否绘制坐标轴刻度 */
  showAxes?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}

/** 良率 0-100 映射到 红->黄->绿 */
function yieldColor(pct: number): string {
  const h = (pct / 100) * 120; // 0=red, 120=green
  return `hsl(${h}, 75%, 48%)`;
}

/** 坐标轴刻度步长:让轴上大致 5~7 个刻度且为 1/2/5×10ⁿ 的整值 */
function tickStep(range: number): number {
  const raw = range / 6;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  for (const m of [1, 2, 5, 10]) if (pow * m >= raw) return pow * m;
  return pow * 10;
}

interface Layout {
  minX: number; minY: number; maxX: number; maxY: number;
  cellW: number; cellH: number; ox: number; oy: number;
}

interface HoverInfo {
  x: number; y: number; left: number; top: number; cell: StackedDie;
}

/** 自研 Canvas 晶圆图:矩形网格 + 真实圆心;坐标轴、悬停提示、失效 die 描边突出。 */
export default function WaferMap({
  wafers,
  bins,
  highlightedBin,
  colorBy,
  size = 220,
  showAxes = true,
  onContextMenu,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<Layout | null>(null);
  const passBins = useMemo(() => passBinSet(bins), [bins]);
  const stacked = useMemo(() => stackWafermap(wafers, passBins), [wafers, passBins]);
  const binColor = useMemo(() => new Map(bins.map((b) => [b.bin, b.color])), [bins]);
  const binName = useMemo(() => new Map(bins.map((b) => [b.bin, b.name])), [bins]);
  const cellLookup = useMemo(() => {
    const m = new Map<string, StackedDie>();
    for (const d of stacked) m.set(`${d.x},${d.y}`, d);
    return m;
  }, [stacked]);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const gutter = showAxes ? 20 : 0;

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
      layoutRef.current = null;
      return;
    }

    // 由实际 die 坐标推导网格范围(真实晶圆多为矩形排布,如 103×120)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const d of stacked) {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    }
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;

    const margin = 2;
    const D = size - gutter - 2 * margin; // 圆内接正方区
    const cellW = D / cols;
    const cellH = D / rows;
    const ox = gutter + margin;
    const oy = gutter + margin;
    const gap = Math.min(0.5, Math.min(cellW, cellH) * 0.12);
    layoutRef.current = { minX, minY, maxX, maxY, cellW, cellH, ox, oy };

    // --- 第一遍:所有 die 底色 ---
    for (const d of stacked) {
      let fill = colorBy === 'yield' ? yieldColor(d.passRate) : binColor.get(d.topBin) ?? '#d9d9d9';
      let alpha = 1;
      if (highlightedBin != null) {
        if ((d.binTally[highlightedBin] ?? 0) > 0) fill = binColor.get(highlightedBin) ?? '#1677ff';
        else alpha = 0.1;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fillRect(ox + (d.x - minX) * cellW, oy + (d.y - minY) * cellH,
        Math.max(cellW - gap, 0.5), Math.max(cellH - gap, 0.5));
    }
    ctx.globalAlpha = 1;

    // --- 第二遍:失效 die 放大 + 深色描边,盖在底色之上更醒目 ---
    const marker = Math.max(cellW, cellH, 4);
    for (const d of stacked) {
      const isFail = !passBins.has(d.topBin);
      if (!isFail) continue;
      if (highlightedBin != null && (d.binTally[highlightedBin] ?? 0) === 0) continue; // 高亮时只留目标 bin
      const cx = ox + (d.x - minX + 0.5) * cellW;
      const cy = oy + (d.y - minY + 0.5) * cellH;
      ctx.fillStyle = binColor.get(d.topBin) ?? '#d62728';
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.rect(cx - marker / 2, cy - marker / 2, marker, marker);
      ctx.fill();
      ctx.stroke();
    }

    // --- 晶圆外轮廓圆 ---
    const cxc = ox + D / 2;
    const cyc = oy + D / 2;
    ctx.strokeStyle = '#8c8c8c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cxc, cyc, D / 2, 0, Math.PI * 2);
    ctx.stroke();

    // --- 坐标轴刻度 ---
    if (showAxes) {
      ctx.fillStyle = '#8c8c8c';
      ctx.strokeStyle = '#d9d9d9';
      ctx.lineWidth = 1;
      ctx.font = '8px sans-serif';
      const xStep = tickStep(cols);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (let x = Math.ceil(minX / xStep) * xStep; x <= maxX; x += xStep) {
        const px = ox + (x - minX + 0.5) * cellW;
        ctx.fillText(String(x), px, gutter - 8);
        ctx.beginPath();
        ctx.moveTo(px, gutter - 4);
        ctx.lineTo(px, gutter - 1);
        ctx.stroke();
      }
      const yStep = tickStep(rows);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let y = Math.ceil(minY / yStep) * yStep; y <= maxY; y += yStep) {
        const py = oy + (y - minY + 0.5) * cellH;
        ctx.fillText(String(y), gutter - 6, py);
        ctx.beginPath();
        ctx.moveTo(gutter - 4, py);
        ctx.lineTo(gutter - 1, py);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#bfbfbf';
      ctx.fillText('X→', 2, gutter - 8);
    }
  }, [stacked, binColor, highlightedBin, colorBy, size, passBins, gutter, showAxes]);

  const onMove = (e: React.MouseEvent) => {
    const lay = layoutRef.current;
    const canvas = canvasRef.current;
    if (!lay || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const gx = lay.minX + Math.floor((mx - lay.ox) / lay.cellW);
    const gy = lay.minY + Math.floor((my - lay.oy) / lay.cellH);
    const cell = cellLookup.get(`${gx},${gy}`);
    if (cell && gx >= lay.minX && gx <= lay.maxX && gy >= lay.minY && gy <= lay.maxY) {
      setHover({ x: gx, y: gy, left: mx, top: my, cell });
    } else if (hover) {
      setHover(null);
    }
  };

  const tip = hover
    ? {
        name: binName.get(hover.cell.topBin) ?? `BIN${hover.cell.topBin}`,
        fail: !passBins.has(hover.cell.topBin),
      }
    : null;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <canvas
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e);
        }}
        style={{ display: 'block', cursor: 'crosshair' }}
      />
      {hover && tip && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(hover.left + 12, size - 96),
            top: Math.min(hover.top + 12, size - 56),
            background: 'rgba(0,0,0,0.82)',
            color: '#fff',
            fontSize: 11,
            lineHeight: '15px',
            padding: '4px 7px',
            borderRadius: 4,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <div>X:{hover.x} &nbsp; Y:{hover.y}</div>
          <div>
            <span style={{ color: tip.fail ? '#ff7875' : '#95de64' }}>●</span> Bin {hover.cell.topBin} · {tip.name}
          </div>
          {hover.cell.total > 1 && (
            <div style={{ color: '#bfbfbf' }}>
              {hover.cell.total} 片 · pass {hover.cell.passRate}%
            </div>
          )}
        </div>
      )}
    </div>
  );
}
