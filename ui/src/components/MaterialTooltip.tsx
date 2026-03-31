import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getMaterialStock } from '../api/client';
import type { MaterialStock } from '../api/client';

const TOOLTIP_W = 176; // w-44 = 11rem = 176px

// Module-level cache — persists across renders, cleared only on page reload
const cache = new Map<string, MaterialStock | 'error'>();

interface Props {
  material: string;
  warehouse: string | null;
}

export function MaterialTooltip({ material, warehouse }: Props) {
  const [data, setData]       = useState<MaterialStock | 'error' | null>(null);
  const [pos, setPos]         = useState<{ x: number; y: number; above: boolean } | null>(null);
  const anchorRef             = useRef<HTMLSpanElement>(null);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Flip below if not enough room above (less than 110px)
      const above = rect.top > 110;
      setPos({
        x: Math.min(rect.left, window.innerWidth - TOOLTIP_W - 8),
        y: above ? rect.top - 4 : rect.bottom + 4,
        above,
      });

      const key = `${warehouse}:${material}`;
      if (!warehouse) { setData(null); return; }
      if (cache.has(key)) { setData(cache.get(key)!); return; }

      getMaterialStock(warehouse, material)
        .then(d  => { cache.set(key, d);       setData(d); })
        .catch(() => { cache.set(key, 'error'); setData('error'); });
    }, 350);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPos(null);
    setData(null);
  };

  const tooltip = pos ? createPortal(
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        ...(pos.above
          ? { bottom: window.innerHeight - pos.y }
          : { top: pos.y }),
        width: TOOLTIP_W,
        zIndex: 9999,
      }}
      className="bg-wm-surface border border-wm-border rounded-lg shadow-xl px-3 py-2 pointer-events-none"
    >
      <p className="text-[10px] font-semibold text-wm-muted mb-1.5 uppercase tracking-wide">{material}</p>
      {!data && <p className="text-[11px] text-wm-muted">Loading…</p>}
      {data === 'error' && <p className="text-[11px] text-red-600">Lookup failed</p>}
      {data && data !== 'error' && (
        <div className="space-y-0.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-wm-muted">Total stock</span>
            <span className="text-wm-text font-medium tabular-nums">{data.total} {data.uom}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-wm-muted">Available</span>
            <span className="text-wm-text font-medium tabular-nums">{data.available} {data.uom}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-wm-muted">Bins</span>
            <span className="text-wm-text font-medium tabular-nums">{data.bins}</span>
          </div>
        </div>
      )}
    </div>,
    document.body,
  ) : null;

  return (
    <span
      ref={anchorRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="font-mono cursor-default border-b border-dashed border-wm-border hover:border-wm-accent transition-colors">
        {material}
      </span>
      {tooltip}
    </span>
  );
}
