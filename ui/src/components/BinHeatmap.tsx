import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { getBins, getReplenBins, type BinRecord } from '../api/client';
import { useTranslation } from '../i18n';

// ── Coordinate parsing ────────────────────────────────────────────────────────

function parseCoords(bin: string): { aisle: string; col: string; level: string } | null {
  const parts = bin.split('-');
  if (parts.length === 3) return { aisle: parts[0], col: parts[1], level: parts[2] };
  return null;
}

// ── Status / color helpers ────────────────────────────────────────────────────

type BinStatus = 'empty' | 'occupied' | 'full' | 'blocked';
type ViewMode  = 'occupancy' | 'age' | 'replenishment';

function binStatus(b: BinRecord): BinStatus {
  if (b.blockedPutaway || b.blockedRemoval) return 'blocked';
  if (b.full) return 'full';
  if (b.empty) return 'empty';
  return 'occupied';
}

function daysAgo(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? Infinity : Math.floor((Date.now() - d.getTime()) / 86400000);
}

const OCC_CLS: Record<BinStatus, string> = {
  empty:    'bg-wm-surface border-wm-border hover:border-wm-border-hover',
  occupied: 'bg-wm-primary/60 border-wm-primary hover:bg-wm-primary/80',
  full:     'bg-amber-500/70 border-amber-400 hover:bg-amber-500/90',
  blocked:  'bg-red-500/70 border-red-400 hover:bg-red-500/90',
};

function cellCls(b: BinRecord, mode: ViewMode, ageThreshold: number, replenSet: Set<string>): string {
  if (mode === 'occupancy') return OCC_CLS[binStatus(b)];

  if (mode === 'replenishment') {
    return replenSet.has(b.bin)
      ? 'bg-amber-500/80 border-amber-400 hover:bg-amber-500 cursor-pointer'
      : binStatus(b) === 'empty'
        ? 'bg-wm-surface border-wm-border opacity-40 cursor-pointer'
        : 'bg-wm-surface-2 border-wm-border opacity-50 cursor-pointer';
  }

  // age mode
  const days = daysAgo(b.lastMovement);
  if (days === Infinity)       return 'bg-wm-bg border-wm-border opacity-30 cursor-pointer';
  if (days <= 7)               return 'bg-emerald-500/70 border-emerald-400 hover:bg-emerald-500/90 cursor-pointer';
  if (days <= 30)              return 'bg-wm-accent/70 border-wm-accent hover:bg-wm-accent/90 cursor-pointer';
  if (days <= ageThreshold)    return 'bg-amber-400/70 border-amber-400 hover:bg-amber-400/90 cursor-pointer';
  return 'bg-red-500/70 border-red-400 hover:bg-red-500/90 cursor-pointer';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TooltipState { bin: BinRecord; x: number; y: number }
interface Props {
  warehouse: string;
  onInvestigateBin?: (bin: BinRecord) => void;
}

export function BinHeatmap({ warehouse, onInvestigateBin }: Props) {
  const { t } = useTranslation();
  const [bins, setBins]             = useState<BinRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [activeType, setActiveType] = useState('');
  const [tooltip, setTooltip]       = useState<TooltipState | null>(null);

  // Smart features state
  const [viewMode, setViewMode]         = useState<ViewMode>('occupancy');
  const [ageThreshold, setAgeThreshold] = useState(60);
  const [replenBins, setReplenBins]     = useState<Set<string>>(new Set());
  const [replenLoading, setReplenLoading] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = () => {
    setLoading(true);
    setError('');
    setTooltip(null);
    getBins(warehouse)
      .then(r => {
        setBins(r.bins);
        setActiveType(prev => {
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

  // Fetch replenishment bin names when mode switches
  useEffect(() => {
    if (viewMode !== 'replenishment') return;
    setReplenLoading(true);
    getReplenBins(warehouse)
      .then(r => setReplenBins(new Set(r.bins)))
      .catch(() => setReplenBins(new Set()))
      .finally(() => setReplenLoading(false));
  }, [viewMode, warehouse]);

  // ── Derived data ────────────────────────────────────────────────────────────

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
      levels: [...levels].sort().reverse(),
    };
  }, [gridData]);

  const occStats = useMemo(() => {
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const showTooltip = (b: BinRecord, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ bin: b, x: rect.right + 10, y: rect.top });
  };

  const handleCellClick = (b: BinRecord) => {
    setTooltip(null);
    onInvestigateBin?.(b);
  };

  const getCls = (b: BinRecord) => cellCls(b, viewMode, ageThreshold, replenBins);

  // ── Early returns ────────────────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">

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

      {/* View mode strip */}
      <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
        <div className="flex rounded-lg border border-wm-border overflow-hidden">
          {(['occupancy', 'age', 'replenishment'] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={[
                'px-3 py-1 text-xs font-medium transition-colors',
                viewMode === m
                  ? 'bg-wm-primary text-white'
                  : 'text-wm-text-dim hover:bg-wm-surface-2 hover:text-wm-text',
              ].join(' ')}
            >
              {t(`slotting.mode.${m === 'replenishment' ? 'replen' : m}` as never)}
            </button>
          ))}
        </div>

        {/* Age threshold slider — shown in age mode only */}
        {viewMode === 'age' && (
          <div className="flex items-center gap-2 text-[11px] text-wm-muted">
            <span>{t('slotting.ageThreshold')}</span>
            <input
              type="range"
              min={30} max={180} step={30}
              value={ageThreshold}
              onChange={e => setAgeThreshold(Number(e.target.value))}
              className="w-24 accent-[#015c61]"
            />
            <span className="text-wm-text font-medium tabular-nums w-12">{ageThreshold} {t('slotting.days')}</span>
          </div>
        )}

        {/* Replen loading indicator */}
        {viewMode === 'replenishment' && replenLoading && (
          <span className="text-[11px] text-wm-muted animate-pulse">{t('slotting.loadingReplen')}</span>
        )}
      </div>

      {/* Legend (changes per mode) */}
      <div className="flex items-center gap-4 text-[11px] text-wm-muted flex-shrink-0 flex-wrap">
        <span>{activeBins.length} {t('slotting.bins')}</span>
        {viewMode === 'occupancy' && (
          <>
            <LegendItem cls="bg-wm-surface border-wm-border"    label={t('slotting.empty')}    count={occStats.empty} />
            <LegendItem cls="bg-wm-primary/60 border-wm-primary" label={t('slotting.occupied')} count={occStats.occupied} />
            {occStats.full    > 0 && <LegendItem cls="bg-amber-500/70 border-amber-400" label={t('slotting.full')}    count={occStats.full} />}
            {occStats.blocked > 0 && <LegendItem cls="bg-red-500/70 border-red-400"    label={t('slotting.blocked')} count={occStats.blocked} textCls="text-red-400" />}
          </>
        )}
        {viewMode === 'age' && (
          <>
            <LegendItem cls="bg-emerald-500/70 border-emerald-400" label={t('slotting.ageActive')} />
            <LegendItem cls="bg-wm-accent/70 border-wm-accent"     label={t('slotting.ageRecent')} />
            <LegendItem cls="bg-amber-400/70 border-amber-400"     label={t('slotting.ageOld', { n: String(ageThreshold) })} />
            <LegendItem cls="bg-red-500/70 border-red-400"         label={t('slotting.ageDead', { n: String(ageThreshold) })} textCls="text-red-400" />
            <LegendItem cls="bg-wm-bg border-wm-border opacity-30" label={t('slotting.ageNever')} />
          </>
        )}
        {viewMode === 'replenishment' && !replenLoading && (
          <>
            <LegendItem cls="bg-amber-500/80 border-amber-400" label={t('slotting.needsReplen')} count={replenBins.size > 0 ? [...replenBins].filter(bn => activeBins.some(b => b.bin === bn)).length : undefined} textCls="text-amber-400" />
            <LegendItem cls="bg-wm-surface-2 border-wm-border opacity-50" label={t('slotting.noReplen')} />
          </>
        )}
        {onInvestigateBin && (
          <span className="ml-auto text-[10px] text-wm-border-hover italic">{t('slotting.clickInvestigate')}</span>
        )}
      </div>

      {/* Grid or badge list */}
      <div className="flex-1 overflow-auto">
        {isGridType && gridData && gridAxes ? (
          <div className="flex gap-10 flex-wrap items-start pb-4">
            {gridAxes.aisles.map(aisle => (
              <div key={aisle} className="flex-shrink-0">
                <p className="text-[10px] text-wm-muted mb-2 font-medium uppercase tracking-wide">
                  {t('slotting.aisle')} {aisle}
                </p>
                <div className="flex items-start gap-1">
                  {/* Level axis labels */}
                  <div className="flex flex-col gap-1 items-end mr-0.5">
                    {gridAxes.levels.map(lvl => (
                      <div key={lvl} className="w-5 h-6 flex items-center justify-end">
                        <span className="text-[9px] text-wm-muted tabular-nums">{lvl}</span>
                      </div>
                    ))}
                    <div className="h-5" />
                  </div>
                  {/* Columns */}
                  <div className="flex gap-1">
                    {gridAxes.cols.map(col => {
                      const levelMap = gridData.get(aisle)?.get(col);
                      return (
                        <div key={col} className="flex flex-col gap-1">
                          {gridAxes.levels.map(lvl => {
                            const b = levelMap?.get(lvl);
                            if (!b) return (
                              <div key={lvl} className="w-6 h-6 rounded-sm border border-wm-bg bg-wm-bg/30 opacity-20" />
                            );
                            return (
                              <motion.div
                                key={lvl}
                                className={`w-6 h-6 rounded-sm border cursor-pointer transition-colors ${getCls(b)}`}
                                onMouseEnter={e => showTooltip(b, e)}
                                onMouseLeave={() => setTooltip(null)}
                                onClick={() => handleCellClick(b)}
                                whileHover={{ scale: 1.2, zIndex: 10 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              />
                            );
                          })}
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
          <div className="flex flex-wrap gap-1.5 pb-4">
            {activeBins.map(b => (
              <motion.div
                key={b.bin}
                className={`px-2 py-1 rounded-md border text-[10px] font-mono cursor-pointer transition-colors ${getCls(b)}`}
                onMouseEnter={e => showTooltip(b, e)}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => handleCellClick(b)}
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                {b.bin}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <BinTooltip
          bin={tooltip.bin}
          x={tooltip.x}
          y={tooltip.y}
          viewMode={viewMode}
          ageThreshold={ageThreshold}
          replenBins={replenBins}
          onInvestigate={onInvestigateBin ? () => handleCellClick(tooltip.bin) : undefined}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LegendItem({
  cls, label, count, textCls,
}: { cls: string; label: string; count?: number; textCls?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-3 h-3 rounded-sm border inline-block flex-shrink-0 ${cls}`} />
      {label}{count !== undefined ? ': ' : ''}<b className={textCls ?? 'text-wm-text'}>{count}</b>
    </span>
  );
}

function BinTooltip({
  bin, x, y, viewMode, ageThreshold, replenBins, onInvestigate,
}: {
  bin: BinRecord; x: number; y: number;
  viewMode: ViewMode; ageThreshold: number; replenBins: Set<string>;
  onInvestigate?: () => void;
}) {
  const { t } = useTranslation();
  const clampedX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 220);
  const st       = binStatus(bin);
  const days     = daysAgo(bin.lastMovement);

  return (
    <div
      className="fixed z-50 pointer-events-none bg-wm-surface border border-wm-border rounded-lg p-3 shadow-xl min-w-[180px]"
      style={{ left: clampedX, top: y, transform: 'translateY(-30%)' }}
    >
      <p className="font-mono font-semibold text-wm-text text-xs mb-2">{bin.bin}</p>
      <div className="space-y-0.5 text-[11px] text-wm-text-dim">
        <Row label={t('slotting.quants')} value={String(bin.quants)} />
        {bin.occupiedWeight > 0 && (
          <Row label={t('slotting.weight')} value={`${bin.occupiedWeight} ${bin.weightUnit}`} />
        )}
        <Row
          label={t('slotting.lastMove')}
          value={days === Infinity ? t('slotting.ageNever') : `${bin.lastMovement} (${days}d)`}
        />
        {/* Mode-specific context */}
        {viewMode === 'age' && days !== Infinity && days > ageThreshold && (
          <p className="text-red-400 font-medium mt-1">{t('slotting.ageDead', { n: String(ageThreshold) })}</p>
        )}
        {viewMode === 'replenishment' && replenBins.has(bin.bin) && (
          <p className="text-amber-400 font-medium mt-1">{t('slotting.needsReplen')}</p>
        )}
        {viewMode === 'occupancy' && st !== 'empty' && st !== 'occupied' && (
          <p className={`mt-1 font-medium ${st === 'blocked' ? 'text-red-400' : 'text-amber-400'}`}>
            {st === 'blocked'
              ? [bin.blockedPutaway && t('slotting.blkPutaway'), bin.blockedRemoval && t('slotting.blkRemoval')]
                  .filter(Boolean).join(' · ')
              : t('slotting.full')}
          </p>
        )}
      </div>
      {onInvestigate && (
        <p className="mt-2 text-[10px] text-wm-accent">{t('slotting.investigate')}</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <p>{label}: <span className="text-wm-text">{value}</span></p>;
}
