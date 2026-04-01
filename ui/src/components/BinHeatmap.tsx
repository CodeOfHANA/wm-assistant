import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { getBins, type BinRecord } from '../api/client';
import { useTranslation } from '../i18n';

// Parse AA-BB-CC → { aisle, col, level }.  Returns null for other formats.
function parseCoords(bin: string): { aisle: string; col: string; level: string } | null {
  const parts = bin.split('-');
  if (parts.length === 3) return { aisle: parts[0], col: parts[1], level: parts[2] };
  return null;
}

type BinStatus = 'empty' | 'occupied' | 'full' | 'blocked';

function binStatus(b: BinRecord): BinStatus {
  if (b.blockedPutaway || b.blockedRemoval) return 'blocked';
  if (b.full) return 'full';
  if (b.empty) return 'empty';
  return 'occupied';
}

const CELL_CLS: Record<BinStatus, string> = {
  empty:    'bg-wm-surface border-wm-border hover:border-wm-border-hover',
  occupied: 'bg-wm-primary/60 border-wm-primary hover:bg-wm-primary/80',
  full:     'bg-amber-500/70 border-amber-400 hover:bg-amber-500/90',
  blocked:  'bg-red-500/70 border-red-400 hover:bg-red-500/90',
};

interface TooltipState { bin: BinRecord; x: number; y: number }

interface Props { warehouse: string }

export function BinHeatmap({ warehouse }: Props) {
  const { t } = useTranslation();
  const [bins, setBins]           = useState<BinRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeType, setActiveType] = useState('');
  const [tooltip, setTooltip]     = useState<TooltipState | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    setTooltip(null);
    getBins(warehouse)
      .then(r => {
        setBins(r.bins);
        setActiveType(prev => {
          // Preserve selection if it still exists; else pick first grid-capable type
          if (prev && r.bins.some(b => b.storageType === prev)) return prev;
          const types = [...new Set(r.bins.map(b => b.storageType))].sort();
          const gridFirst = types.find(st =>
            r.bins.filter(b => b.storageType === st).some(b => parseCoords(b.bin) !== null)
          );
          return gridFirst ?? types[0] ?? '';
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [warehouse]); // eslint-disable-line react-hooks/exhaustive-deps

  const storageTypes = useMemo(
    () => [...new Set(bins.map(b => b.storageType))].sort(),
    [bins],
  );

  const activeBins = useMemo(
    () => bins.filter(b => b.storageType === activeType),
    [bins, activeType],
  );

  const isGridType = useMemo(
    () => activeBins.some(b => parseCoords(b.bin) !== null),
    [activeBins],
  );

  // Build aisle → col → level → BinRecord map
  const gridData = useMemo(() => {
    if (!isGridType) return null;
    const map = new Map<string, Map<string, Map<string, BinRecord>>>();
    for (const b of activeBins) {
      const c = parseCoords(b.bin);
      if (!c) continue;
      if (!map.has(c.aisle)) map.set(c.aisle, new Map());
      const am = map.get(c.aisle)!;
      if (!am.has(c.col)) am.set(c.col, new Map());
      am.get(c.col)!.set(c.level, b);
    }
    return map;
  }, [activeBins, isGridType]);

  const gridAxes = useMemo(() => {
    if (!gridData) return null;
    const cols = new Set<string>(), levels = new Set<string>();
    gridData.forEach(am => {
      am.forEach((lm, col) => {
        cols.add(col);
        lm.forEach((_, lvl) => levels.add(lvl));
      });
    });
    return {
      aisles: [...gridData.keys()].sort(),
      cols:   [...cols].sort(),
      levels: [...levels].sort().reverse(), // highest shelf first
    };
  }, [gridData]);

  const stats = useMemo(() => {
    const s = { empty: 0, occupied: 0, full: 0, blocked: 0 };
    activeBins.forEach(b => { s[binStatus(b)]++; });
    return s;
  }, [activeBins]);

  const stStats = useMemo(() => {
    const m: Record<string, Record<BinStatus, number>> = {};
    bins.forEach(b => {
      if (!m[b.storageType]) m[b.storageType] = { empty: 0, occupied: 0, full: 0, blocked: 0 };
      m[b.storageType][binStatus(b)]++;
    });
    return m;
  }, [bins]);

  const showTooltip = (b: BinRecord, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ bin: b, x: rect.right + 10, y: rect.top });
  };

  // ── Loading / error / empty states ──────────────────────────────────────────

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-wm-muted animate-pulse">{t('slotting.loading')}</p>
    </div>
  );

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-red-500">{t('slotting.error')}: {error}</p>
    </div>
  );

  if (bins.length === 0) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-wm-muted text-center max-w-xs">{t('slotting.noData')}</p>
    </div>
  );

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-wm-text font-semibold text-sm">
          {t('slotting.title')} — WH {warehouse}
        </h2>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-wm-muted hover:text-wm-text transition-colors"
        >
          <RefreshCw size={12} />
          {t('slotting.refresh')}
        </button>
      </div>

      {/* Storage type tabs */}
      <div className="flex gap-2 flex-wrap flex-shrink-0">
        {storageTypes.map(st => {
          const s = stStats[st] ?? { empty: 0, occupied: 0, full: 0, blocked: 0 };
          const total = bins.filter(b => b.storageType === st).length;
          return (
            <button
              key={st}
              onClick={() => setActiveType(st)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                activeType === st
                  ? 'bg-wm-primary text-white border-wm-primary'
                  : 'bg-wm-surface-2 text-wm-text-dim border-wm-border hover:border-wm-border-hover hover:text-wm-text',
              ].join(' ')}
            >
              ST {st} · {total}
              {s.blocked > 0 && <span className="ml-1 text-red-400">⚠</span>}
            </button>
          );
        })}
      </div>

      {/* Stats legend */}
      <div className="flex items-center gap-4 text-[11px] text-wm-muted flex-shrink-0 flex-wrap">
        <span>{activeBins.length} {t('slotting.bins')}</span>
        <LegendItem cls="bg-wm-surface border-wm-border" label={t('slotting.empty')} count={stats.empty} />
        <LegendItem cls="bg-wm-primary/60 border-wm-primary" label={t('slotting.occupied')} count={stats.occupied} />
        {stats.full > 0 && (
          <LegendItem cls="bg-amber-500/70 border-amber-400" label={t('slotting.full')} count={stats.full} />
        )}
        {stats.blocked > 0 && (
          <LegendItem cls="bg-red-500/70 border-red-400" label={t('slotting.blocked')} count={stats.blocked} textCls="text-red-400" />
        )}
      </div>

      {/* Grid or list */}
      <div className="flex-1 overflow-auto">
        {isGridType && gridData && gridAxes ? (
          <div className="flex gap-10 flex-wrap items-start pb-4">
            {gridAxes.aisles.map(aisle => (
              <div key={aisle} className="flex-shrink-0">
                <p className="text-[10px] text-wm-muted mb-2 font-medium uppercase tracking-wide">
                  {t('slotting.aisle')} {aisle}
                </p>
                <div className="flex items-start gap-1">
                  {/* Level labels (Y axis — level 01 = floor = bottom) */}
                  <div className="flex flex-col gap-1 items-end mr-0.5">
                    {gridAxes.levels.map(lvl => (
                      <div key={lvl} className="w-5 h-6 flex items-center justify-end">
                        <span className="text-[9px] text-wm-muted tabular-nums">{lvl}</span>
                      </div>
                    ))}
                    <div className="h-5" /> {/* col-label spacer */}
                  </div>

                  {/* Columns */}
                  <div className="flex gap-1">
                    {gridAxes.cols.map(col => {
                      const levelMap = gridData.get(aisle)?.get(col);
                      return (
                        <div key={col} className="flex flex-col gap-1">
                          {gridAxes.levels.map(lvl => {
                            const b = levelMap?.get(lvl);
                            if (!b) {
                              return (
                                <div
                                  key={lvl}
                                  className="w-6 h-6 rounded-sm border border-wm-bg bg-wm-bg/30 opacity-20"
                                />
                              );
                            }
                            const st = binStatus(b);
                            return (
                              <motion.div
                                key={lvl}
                                className={`w-6 h-6 rounded-sm border cursor-pointer transition-colors ${CELL_CLS[st]}`}
                                onMouseEnter={e => showTooltip(b, e)}
                                onMouseLeave={() => setTooltip(null)}
                                whileHover={{ scale: 1.2, zIndex: 10 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              />
                            );
                          })}
                          {/* Column label */}
                          <div className="w-6 h-5 flex items-center justify-center mt-0.5">
                            <span className="text-[9px] text-wm-muted tabular-nums">{col}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Non-grid types: badge list */
          <div className="flex flex-wrap gap-1.5 pb-4">
            {activeBins.map(b => {
              const st = binStatus(b);
              return (
                <motion.div
                  key={b.bin}
                  className={`px-2 py-1 rounded-md border text-[10px] font-mono cursor-pointer transition-colors ${CELL_CLS[st]}`}
                  onMouseEnter={e => showTooltip(b, e)}
                  onMouseLeave={() => setTooltip(null)}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  {b.bin}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <BinTooltip
          bin={tooltip.bin}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LegendItem({
  cls, label, count, textCls,
}: { cls: string; label: string; count: number; textCls?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-3 h-3 rounded-sm border inline-block flex-shrink-0 ${cls}`} />
      {label}: <b className={textCls ?? 'text-wm-text'}>{count}</b>
    </span>
  );
}

function BinTooltip({ bin, x, y }: { bin: BinRecord; x: number; y: number }) {
  const { t } = useTranslation();
  const clampedX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220);
  const st = binStatus(bin);

  return (
    <div
      className="fixed z-50 pointer-events-none bg-wm-surface border border-wm-border rounded-lg p-3 shadow-xl min-w-[170px]"
      style={{ left: clampedX, top: y, transform: 'translateY(-30%)' }}
    >
      <p className="font-mono font-semibold text-wm-text text-xs mb-2">{bin.bin}</p>
      <div className="space-y-0.5 text-[11px] text-wm-text-dim">
        <Row label={t('slotting.quants')} value={String(bin.quants)} />
        {bin.occupiedWeight > 0 && (
          <Row label={t('slotting.weight')} value={`${bin.occupiedWeight} ${bin.weightUnit}`} />
        )}
        {bin.lastMovement && (
          <Row label={t('slotting.lastMove')} value={bin.lastMovement} />
        )}
        {st !== 'empty' && st !== 'occupied' && (
          <p className={`mt-1 font-medium ${st === 'blocked' ? 'text-red-400' : 'text-amber-400'}`}>
            {st === 'blocked'
              ? [bin.blockedPutaway && t('slotting.blkPutaway'), bin.blockedRemoval && t('slotting.blkRemoval')]
                  .filter(Boolean).join(' · ')
              : t('slotting.full')}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p>{label}: <span className="text-wm-text">{value}</span></p>
  );
}
