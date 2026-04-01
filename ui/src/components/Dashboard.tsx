import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw, AlertTriangle, TrendingDown, ArrowRightLeft,
  Package, Activity, Inbox, PackageCheck, BarChart2,
  MessageSquarePlus, Clock, Printer, ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { getDashboard } from '../api/client';
import type { DashboardData } from '../api/client';
import { useTranslation } from '../i18n';

interface Props {
  warehouse: string;
  onAskAI: (query: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—';
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(v) ? String(n) : v.toLocaleString();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

type Level = 'ok' | 'amber' | 'red' | 'neutral';

function KpiCard({
  label, value, suffix, icon: Icon, level, onClick,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  icon: React.ElementType;
  level: Level;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const borderBg: Record<Level, string> = {
    ok:      'border-emerald-500/25 bg-emerald-500/5',
    amber:   'border-amber-500/25 bg-amber-500/5',
    red:     'border-red-500/25 bg-red-500/5',
    neutral: 'border-wm-border bg-wm-surface',
  };
  const numColor: Record<Level, string> = {
    ok:      'text-emerald-600',
    amber:   'text-amber-600',
    red:     'text-red-600',
    neutral: 'text-wm-text',
  };
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-3 flex flex-col gap-1.5 text-left w-full',
        borderBg[level],
        onClick ? 'cursor-pointer hover:brightness-110 transition-all' : 'cursor-default',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-wm-muted uppercase tracking-wide font-medium leading-none">
          {label}
        </span>
        <Icon size={12} className="text-wm-muted opacity-50" />
      </div>
      <span className={clsx('text-2xl font-bold tabular-nums leading-none', numColor[level])}>
        {value == null ? '—' : value.toLocaleString()}{suffix}
      </span>
      {onClick && (
        <span className="text-[9px] text-wm-muted leading-none">{t('dashboard.askAI')}</span>
      )}
    </motion.button>
  );
}

function SectionHeader({
  title, onAsk,
}: {
  title: string;
  onAsk?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[11px] font-semibold text-wm-text-dim uppercase tracking-wider">{title}</h3>
      {onAsk && (
        <button
          onClick={onAsk}
          className="no-print flex items-center gap-1 text-[10px] text-wm-accent hover:text-wm-text transition-colors px-1.5 py-0.5 rounded hover:bg-wm-surface-2"
        >
          <MessageSquarePlus size={11} />
          {t('dashboard.askAI')}
        </button>
      )}
    </div>
  );
}

function AgeBadge({ days }: { days?: number | null }) {
  const { t } = useTranslation();
  if (days == null) return <span className="text-wm-muted text-[10px]">—</span>;
  if (days === 0)   return <span className="text-emerald-600 font-medium text-[10px]">{t('dashboard.today')}</span>;
  if (days === 1)   return <span className="text-yellow-600 font-medium text-[10px]">1d</span>;
  return <span className="text-red-600 font-semibold text-[10px]">{days}d</span>;
}

function UtilBar({ label, used, total, utilPct }: {
  label: string;
  used?: number;
  total?: number;
  utilPct?: number;
}) {
  const { t } = useTranslation();
  const pct = utilPct ?? (total && total > 0 ? Math.round(((used ?? 0) / total) * 100) : 0);
  const barColor = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-wm-muted w-16 flex-shrink-0 font-mono">{t('dashboard.utilType', { label })}</span>
      <div className="flex-1 h-1.5 bg-wm-surface-2 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[11px] text-wm-text tabular-nums w-8 text-right">{pct}%</span>
      {total != null && (
        <span className="text-[10px] text-wm-muted w-20 text-right">{used}/{total} {t('dashboard.bins')}</span>
      )}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-wm-surface-2', className)} />;
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-wm-border">
        {cols.map(c => (
          <th key={c} className="text-left py-1.5 px-2.5 text-[10px] font-medium text-wm-muted uppercase tracking-wide whitespace-nowrap">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Dashboard({ warehouse, onAskAI }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getDashboard(warehouse);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dashboard.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, [warehouse]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handlePrint = () => {
    const prev = document.title;
    document.title = `WM Dashboard — WH ${warehouse} — ${new Date().toLocaleDateString()}`;
    window.print();
    document.title = prev;
  };

  const avgUtil = data?.utilization.byStorageType.length
    ? Math.round(
        data.utilization.byStorageType.reduce((s, r) => s + (r.utilization ?? 0), 0) /
        data.utilization.byStorageType.length,
      )
    : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Print-only header ─────────────────────────────────────────────── */}
      <div className="hidden print:block px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">RELACON IT Consulting</p>
            <h1 className="text-lg font-bold text-gray-900 mt-0.5">Warehouse Dashboard — WH {warehouse}</h1>
          </div>
          <p className="text-xs text-gray-400">{new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="no-print flex items-center justify-between px-6 py-3.5 border-b border-wm-border bg-wm-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-wm-text">{t('dashboard.title')}</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-wm-primary/20 border border-wm-primary/40 text-wm-accent font-mono font-medium">
            WH {warehouse}
          </span>
          {data && !loading && (
            <span className="flex items-center gap-1 text-[10px] text-wm-muted">
              <Clock size={10} />
              {fmtTime(data.fetchedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-xs text-wm-muted hover:text-wm-text transition-colors px-2 py-1 rounded-lg hover:bg-wm-surface-2"
            title={t('chat.printTitle')}
          >
            <Printer size={12} />
            {t('dashboard.print')}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-wm-muted hover:text-wm-text transition-colors px-2 py-1 rounded-lg hover:bg-wm-surface-2 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {t('dashboard.refresh')}
          </button>
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 xl:grid-cols-7 gap-3">
          {loading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-xl" />
            ))
          ) : (
            <>
              <KpiCard label={t('dashboard.kpi.openTOs')}  value={data?.openTOs.count ?? null}
                icon={ArrowRightLeft} level={data?.openTOs.count ? 'amber' : 'ok'}
                onClick={() => onAskAI(t('dashboard.q.openTOs', { wh: warehouse }))} />
              <KpiCard label={t('dashboard.kpi.negStock')} value={data?.negativeStock.count ?? null}
                icon={TrendingDown}   level={data?.negativeStock.count ? 'red' : 'ok'}
                onClick={() => onAskAI(t('dashboard.q.negStock', { wh: warehouse }))} />
              <KpiCard label={t('dashboard.kpi.replenish')} value={data?.replenishment.count ?? null}
                icon={Package}        level={data?.replenishment.count ? 'amber' : 'ok'}
                onClick={() => onAskAI(t('dashboard.q.replen', { wh: warehouse }))} />
              <KpiCard label={t('dashboard.kpi.anomalies')} value={data?.anomalies.count ?? null}
                icon={Activity}       level={data?.anomalies.count ? 'red' : 'ok'}
                onClick={() => onAskAI(t('dashboard.q.anomalies', { wh: warehouse }))} />
              <KpiCard label={t('dashboard.kpi.grPending')} value={data?.grPending.count ?? null}
                icon={Inbox}          level="neutral"
                onClick={() => onAskAI(t('dashboard.q.gr', { wh: warehouse }))} />
              <KpiCard label={t('dashboard.kpi.giPending')} value={data?.giPending.count ?? null}
                icon={PackageCheck}   level="neutral"
                onClick={() => onAskAI(t('dashboard.q.gi', { wh: warehouse }))} />
              <KpiCard label={t('dashboard.kpi.avgUtil')}  value={avgUtil} suffix="%"
                icon={BarChart2}
                level={avgUtil == null ? 'neutral' : avgUtil > 85 ? 'red' : avgUtil > 65 ? 'amber' : 'ok'}
                onClick={() => onAskAI(t('dashboard.q.util', { wh: warehouse }))} />
            </>
          )}
        </div>

        {/* ── GR zone alert chip ──────────────────────────────────────────── */}
        {!loading && (data?.grPending.count ?? 0) > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700">
            <Inbox size={12} className="flex-shrink-0" />
            <span>{t('dashboard.grAlert', { n: String(data!.grPending.count) })}</span>
            <button
              onClick={() => onAskAI(t('dashboard.q.gr', { wh: warehouse }))}
              className="ml-auto flex items-center gap-1 font-medium hover:underline flex-shrink-0"
            >
              {t('dashboard.investigate')} <ArrowRight size={10} />
            </button>
          </div>
        )}

        {/* ── Open TOs + Alerts (two columns) ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Open Transfer Orders */}
          <div className="lg:col-span-3 bg-wm-surface border border-wm-border rounded-xl p-4">
            <SectionHeader
              title={`${t('dashboard.section.openTOs')}${data?.openTOs.count ? ` (${data.openTOs.count})` : ''}`}
              onAsk={() => onAskAI(t('dashboard.q.openTOs', { wh: warehouse }))}
            />
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : !data?.openTOs.topOrders.length ? (
              <p className="text-[11px] text-emerald-600 py-4 text-center">{t('dashboard.noOpenTOs')}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-wm-border">
                        {t('dashboard.toCols').split(',').map(c => (
                          <th key={c} className="text-left py-1.5 px-2.5 text-[10px] font-medium text-wm-muted uppercase tracking-wide whitespace-nowrap">
                            {c}
                          </th>
                        ))}
                        <th className="py-1.5 px-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.openTOs.topOrders.map((o, i) => (
                        <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/50 transition-colors group/tor">
                          <td className="py-1.5 px-2.5 text-[11px] font-mono text-wm-accent whitespace-nowrap">{o.toNumber}</td>
                          <td className="py-1.5 px-2.5 text-[11px] text-wm-text">{o.material ?? '—'}</td>
                          <td className="py-1.5 px-2.5 text-[11px] whitespace-nowrap">
                            <span className="text-wm-muted">{o.sourceType}/</span>
                            <span className="text-wm-text">{o.sourceBin}</span>
                            <span className="text-wm-muted mx-1">→</span>
                            <span className="text-wm-muted">{o.destType}/</span>
                            <span className="text-wm-text">{o.destBin}</span>
                          </td>
                          <td className="py-1.5 px-2.5 text-[11px] text-right text-wm-text tabular-nums whitespace-nowrap">
                            {fmtNum(o.openQty)} {o.uom}
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <AgeBadge days={o.daysSinceCreation} />
                          </td>
                          <td className="py-1.5 px-2.5 text-right">
                            <button
                              onClick={() => onAskAI(`Investigate transfer order ${o.toNumber} in warehouse ${warehouse}: show all items, current status, source and destination bins, material details, and whether it can be confirmed`)}
                              title={t('dashboard.investigateTO')}
                              className="opacity-0 group-hover/tor:opacity-100 transition-opacity text-wm-accent hover:text-wm-text flex items-center gap-0.5 text-[10px] whitespace-nowrap"
                            >
                              {t('dashboard.investigateTO')} <ArrowRight size={10} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.openTOs.count != null && data.openTOs.count > data.openTOs.topOrders.length && (
                  <p className="text-[10px] text-wm-muted mt-2 text-center">
                    {t('dashboard.moreRows', { n: String(data.openTOs.count - data.openTOs.topOrders.length) })}{' '}
                    <button
                      onClick={() => onAskAI(t('dashboard.q.seeAll', { wh: warehouse }))}
                      className="text-wm-accent hover:underline"
                    >
                      {t('dashboard.seeAllChat')}
                    </button>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Alerts: negative stock + anomalies */}
          <div className="lg:col-span-2 bg-wm-surface border border-wm-border rounded-xl p-4 space-y-4">
            <SectionHeader title={t('dashboard.section.alerts')} />

            {/* Negative stock */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
                  <TrendingDown size={12} />
                  {t('dashboard.negStockLabel', { n: fmtNum(data?.negativeStock.count) })}
                </span>
                {data?.negativeStock.count ? (
                  <button
                    onClick={() => onAskAI(t('dashboard.q.negStock', { wh: warehouse }))}
                    className="text-[10px] text-wm-muted hover:text-wm-accent transition-colors"
                  >
                    {t('dashboard.details')}
                  </button>
                ) : null}
              </div>
              {loading ? (
                <Skeleton className="h-16" />
              ) : !data?.negativeStock.items.length ? (
                <p className="text-[10px] text-emerald-600 pl-0.5">{t('dashboard.noneOk')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.negativeStock.items.map((q, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="font-mono text-wm-text font-medium">{q.material ?? '—'}</span>
                      <span className="text-wm-muted truncate">{q.storageType}/{q.bin}</span>
                      <span className="text-red-600 font-semibold tabular-nums ml-auto">{fmtNum(q.qty)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-wm-border" />

            {/* Anomalies */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
                  <AlertTriangle size={12} />
                  {t('dashboard.anomaliesLabel', { n: fmtNum(data?.anomalies.count) })}
                </span>
                {data?.anomalies.count ? (
                  <button
                    onClick={() => onAskAI(t('dashboard.q.anomalies', { wh: warehouse }))}
                    className="text-[10px] text-wm-muted hover:text-wm-accent transition-colors"
                  >
                    {t('dashboard.details')}
                  </button>
                ) : null}
              </div>
              {loading ? (
                <Skeleton className="h-16" />
              ) : !data?.anomalies.items.length ? (
                <p className="text-[10px] text-emerald-600 pl-0.5">{t('dashboard.noneOk')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.anomalies.items.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="text-wm-text-dim leading-snug">{a.description ?? a.type ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── Replenishment Needs ─────────────────────────────────────────── */}
        {(loading || (data?.replenishment.count ?? 0) > 0) && (
          <div className="bg-wm-surface border border-wm-border rounded-xl p-4">
            <SectionHeader
              title={`${t('dashboard.section.replen')}${data?.replenishment.count ? ` (${data.replenishment.count})` : ''}`}
              onAsk={() => onAskAI(t('dashboard.q.replen', { wh: warehouse }))}
            />
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : !data?.replenishment.bins.length ? (
              <p className="text-[11px] text-emerald-600 py-2">{t('dashboard.noReplen')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <TableHeader cols={t('dashboard.replenCols').split(',').slice(0, 5)} />
                  <tbody>
                    {data.replenishment.bins.map((b, i) => (
                      <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/50 transition-colors">
                        <td className="py-1.5 px-2.5 text-[11px] font-mono text-wm-text">{b.bin ?? '—'}</td>
                        <td className="py-1.5 px-2.5 text-[11px] text-wm-muted">{b.storageType ?? '—'}</td>
                        <td className="py-1.5 px-2.5 text-[11px] text-wm-text">{b.material ?? '—'}</td>
                        <td className="py-1.5 px-2.5 text-[11px] text-right text-wm-text tabular-nums whitespace-nowrap">
                          {fmtNum(b.currentQty)} {b.uom}
                        </td>
                        <td className="py-1.5 px-2.5 text-[11px] text-right text-amber-600 font-semibold tabular-nums">
                          {fmtNum(b.replenishmentQty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Bin Utilization ─────────────────────────────────────────────── */}
        {(loading || (data?.utilization.byStorageType.length ?? 0) > 0) && (
          <div className="bg-wm-surface border border-wm-border rounded-xl p-4">
            <SectionHeader
              title={t('dashboard.section.util')}
              onAsk={() => onAskAI(t('dashboard.q.util', { wh: warehouse }))}
            />
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4" />)}
              </div>
            ) : !data?.utilization.byStorageType.length ? (
              <p className="text-[11px] text-wm-muted py-2">{t('dashboard.noUtilData')}</p>
            ) : (
              <div className="space-y-2.5">
                {data.utilization.byStorageType.map((r, i) => (
                  <UtilBar
                    key={i}
                    label={r.storageType ?? String(i + 1)}
                    used={r.usedBins}
                    total={r.totalBins}
                    utilPct={r.utilization}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
