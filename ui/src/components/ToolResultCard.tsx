import React from 'react';
import { CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import { clsx } from 'clsx';
import { MaterialTooltip } from './MaterialTooltip';
import { useToast } from './Toaster';
import { useTranslation } from '../i18n';

async function exportToXlsx(headers: string[], rows: (string | number | null | undefined)[][], filename: string): Promise<boolean> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const xlsxFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: xlsxFilename,
        types: [{ description: 'Excel file', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch { return false; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = xlsxFilename; a.click();
  URL.revokeObjectURL(url);
  return true;
}

function ExcelBtn({ onClick }: { onClick: () => Promise<boolean> }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const handleClick = async () => {
    const saved = await onClick();
    if (saved) toast(t('toast.exportedXlsx'));
  };
  return (
    <button
      onClick={handleClick}
      title={t('tool.exportExcel')}
      className="flex items-center gap-1 text-[10px] text-wm-muted hover:text-emerald-600 transition-colors px-1.5 py-0.5 rounded hover:bg-wm-surface"
    >
      <FileSpreadsheet size={11} />
      {t('tool.excel')}
    </button>
  );
}

export interface ActionMeta {
  sourceType?: string;
  sourceBin?: string;
  destType?: string;
  destBin?: string;
  material?: string;
  qty?: number;
  uom?: string;
}

interface Props {
  toolName: string;
  result: unknown;
  warehouse?: string;
  onAction?: (message: string, meta?: ActionMeta) => void;
}

// ── Shared table primitives ────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-wm-muted uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className, noTitle }: { children: React.ReactNode; className?: string; noTitle?: boolean }) {
  const { t } = useTranslation();
  const [flash, setFlash] = React.useState(false);

  const handleClick = () => {
    if (noTitle) return;
    const text = typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : (document.getSelection()?.toString() || '');
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    });
  };

  return (
    <td
      onClick={handleClick}
      title={noTitle ? undefined : t('tool.clickCopy')}
      className={`px-2 py-1.5 text-[11px] text-wm-text whitespace-nowrap ${noTitle ? '' : 'cursor-pointer transition-colors duration-150'} ${flash ? 'bg-wm-primary/20' : noTitle ? '' : 'hover:bg-wm-surface-2/60'} ${className ?? ''}`}
    >
      {children}
    </td>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-wm-border">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

type BadgeColor = 'green' | 'amber' | 'red' | 'blue' | 'default';

function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: BadgeColor }) {
  const palette: Record<BadgeColor, string> = {
    green:   'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    amber:   'bg-amber-500/15 text-amber-600 border-amber-500/30',
    red:     'bg-red-500/15 text-red-600 border-red-500/30',
    blue:    'bg-blue-500/15 text-blue-600 border-blue-500/30',
    default: 'bg-wm-surface text-wm-muted border-wm-border',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${palette[color]}`}>
      {children}
    </span>
  );
}

function Truncated() {
  const { t } = useTranslation();
  return (
    <p className="text-[10px] text-amber-600 mt-2 px-0.5">
      {t('tool.truncated')}
    </p>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-wm-surface border border-wm-border rounded-lg px-3 py-2 min-w-[72px]">
      <p className="text-[10px] text-wm-muted uppercase tracking-wide leading-tight">{label}</p>
      <p className="text-sm font-semibold text-wm-text leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-wm-muted">{sub}</p>}
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] px-2 py-0.5 rounded-full bg-wm-primary/20 border border-wm-primary/50 text-wm-accent hover:bg-wm-primary/50 transition-colors whitespace-nowrap"
    >
      {label}
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d || d === 'never' || d === 'unknown') return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return d;
  }
}

function fmtNum(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—';
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(v) ? String(n) : v.toLocaleString();
}

// ── Transfer Orders ───────────────────────────────────────────────────────────

type ToRow = {
  toNumber: string; toItem: string; status: string; ageFlag: string;
  daysSinceCreation: number | null; material: string;
  sourceType: string; sourceBin: string; destType: string; destBin: string;
  openQty: number; uom: string;
};

function toAgeBadge(days: number | null, todayLabel: string): { label: string; cls: string; rowCls: string } {
  if (days == null) return { label: '—', cls: 'text-wm-muted', rowCls: '' };
  if (days === 0)   return { label: todayLabel,   cls: 'text-emerald-600',            rowCls: '' };
  if (days === 1)   return { label: '1d',         cls: 'text-yellow-400',             rowCls: 'bg-yellow-500/5' };
  return              { label: `${days}d`,        cls: 'text-red-600 font-semibold',  rowCls: 'bg-red-500/5' };
}

const GI_TYPES = new Set(['916', '999', '998']);

/** Normalize both flat (get_open_transfer_orders) and nested (get_transfer_order_history) shapes. */
function normalizeToRow(o: Record<string, unknown>): ToRow & { extraItems?: number } {
  // Nested history format: material lives in items[], age in created.daysAgo
  if (Array.isArray(o.items)) {
    const items = o.items as Record<string, unknown>[];
    const first = items[0] ?? {};
    const created = o.created as Record<string, unknown> | undefined;
    return {
      toNumber:         String(o.toNumber ?? ''),
      toItem:           String(first.item ?? ''),
      status:           String(o.status ?? ''),
      ageFlag:          '',
      daysSinceCreation: (created?.daysAgo as number | null) ?? null,
      material:         String(first.material ?? ''),
      sourceType:       String(first.sourceType ?? ''),
      sourceBin:        String(first.sourceBin ?? ''),
      destType:         String(first.destType ?? ''),
      destBin:          String(first.destBin ?? ''),
      openQty:          (first.requiredQty as number) ?? 0,
      uom:              String(first.uom ?? ''),
      extraItems:       items.length > 1 ? items.length - 1 : 0,
    };
  }
  // Flat format — pass through as-is
  return { ...(o as unknown as ToRow), extraItems: 0 };
}

function TransferOrderTable({ data, warehouse, onAction }: { data: Record<string, unknown>; warehouse?: string | null; onAction?: (msg: string, meta?: ActionMeta) => void }) {
  const { t } = useTranslation();
  const orders = (data.orders as Record<string, unknown>[]).map(normalizeToRow);
  const wh = data.warehouse as string;
  if (!orders.length) return <p className="text-[11px] text-wm-muted">{t('tool.empty.tos')}</p>;
  const openOrders = orders.filter(o => o.status !== 'confirmed');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-wm-muted">
          {data.count as number} TO{(data.count as number) !== 1 ? 's' : ''} · WH {wh}
        </p>
        <div className="flex items-center gap-2">
          <ExcelBtn onClick={() => exportToXlsx(
            ['TO#', 'Item', 'Material', 'From Type', 'From Bin', 'To Type', 'To Bin', 'Open Qty', 'UOM', 'Age (days)', 'Status'],
            orders.map(o => [o.toNumber, o.toItem, o.material, o.sourceType, o.sourceBin, o.destType, o.destBin, o.openQty, o.uom, o.daysSinceCreation, o.status]),
            `transfer-orders-WH${wh}`,
          )} />
          {onAction && openOrders.length > 1 && openOrders.length <= 10 && (
            <ActionButton
              label={t('tool.action.confirmAll', { n: String(openOrders.length) })}
              onClick={() => onAction(`Confirm all open transfer orders in warehouse ${wh}`)}
            />
          )}
        </div>
      </div>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>{t('tool.col.toNum')}</Th><Th>{t('tool.col.material')}</Th>
            <Th>{t('tool.col.from')}</Th><Th>{t('tool.col.to')}</Th>
            <Th>{t('tool.col.openQty')}</Th><Th>{t('tool.col.age')}</Th><Th>{t('tool.col.status')}</Th>
            {onAction && <Th>{t('tool.col.action')}</Th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const age = toAgeBadge(o.daysSinceCreation, t('tool.today'));
            return (
              <tr key={i} className={clsx('border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors', age.rowCls)}>
                <Td>
                  <span className="font-mono text-wm-accent">{o.toNumber}</span>
                  {(o as ToRow & { extraItems?: number }).extraItems ? (
                    <span className="ml-1 text-[9px] text-wm-muted">+{(o as ToRow & { extraItems?: number }).extraItems}</span>
                  ) : null}
                </Td>
                <Td>{o.material ? <MaterialTooltip material={o.material} warehouse={warehouse ?? wh} /> : '—'}</Td>
                <Td><span className="text-wm-muted">{o.sourceType}/</span>{o.sourceBin}</Td>
                <Td><span className="text-wm-muted">{o.destType}/</span>{o.destBin}</Td>
                <Td>{fmtNum(o.openQty)} {o.uom}</Td>
                <Td><span className={age.cls}>{age.label}</span></Td>
                <Td>
                  <Badge color={o.ageFlag?.includes('OVERDUE') ? 'amber' : 'green'}>
                    {o.status}
                  </Badge>
                </Td>
                {onAction && (
                  <Td noTitle>
                    <ActionButton
                      label={t('tool.action.confirm')}
                      onClick={() => onAction(
                        `Confirm transfer order ${o.toNumber} in warehouse ${wh}`,
                        { sourceType: o.sourceType, sourceBin: o.sourceBin, destType: o.destType, destBin: o.destBin, material: o.material, qty: o.openQty, uom: o.uom },
                      )}
                    />
                  </Td>
                )}
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      {data.truncated && <Truncated />}
    </div>
  );
}

// ── Bins (bin status / empty bins) ────────────────────────────────────────────

type BinRow = {
  bin: string; storageType: string; storageSection: string;
  empty: boolean; full: boolean; blockedPutaway: boolean; blockedRemoval: boolean;
  quants: number; totalCapacity: number; remainingCapacity: number;
  weightUnit: string; lastMovement: string;
};

function BinTable({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation();
  const bins = data.bins as BinRow[];
  if (!bins.length) return <p className="text-[11px] text-wm-muted">{t('tool.empty.bins')}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-wm-muted">
          {data.count as number} bin{(data.count as number) !== 1 ? 's' : ''} · WH {data.warehouse as string}
        </p>
        <ExcelBtn onClick={() => exportToXlsx(
          ['Bin', 'Storage Type', 'Empty', 'Full', 'Blk Putaway', 'Blk Removal', 'Quants', 'Remaining Cap', 'Total Cap', 'Weight Unit', 'Last Movement'],
          (data.bins as BinRow[]).map(b => [b.bin, b.storageType, b.empty ? 'Yes' : 'No', b.full ? 'Yes' : 'No', b.blockedPutaway ? 'Yes' : 'No', b.blockedRemoval ? 'Yes' : 'No', b.quants, b.remainingCapacity, b.totalCapacity, b.weightUnit, b.lastMovement]),
          `bins-WH${data.warehouse as string}`,
        )} />
      </div>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>{t('tool.col.bin')}</Th><Th>{t('tool.col.type')}</Th><Th>{t('tool.col.status')}</Th>
            <Th>{t('tool.col.quants')}</Th><Th>{t('tool.col.capRem')}</Th><Th>{t('tool.col.lastMove')}</Th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td><span className="font-mono">{b.bin}</span></Td>
              <Td>{b.storageType}</Td>
              <Td>
                <div className="flex gap-1 flex-wrap">
                  {b.empty          && <Badge color="green">{t('tool.badge.empty')}</Badge>}
                  {b.full           && <Badge color="amber">{t('tool.badge.full')}</Badge>}
                  {b.blockedPutaway && <Badge color="red">{t('tool.badge.blkUp')}</Badge>}
                  {b.blockedRemoval && <Badge color="red">{t('tool.badge.blkDown')}</Badge>}
                  {!b.empty && !b.full && !b.blockedPutaway && !b.blockedRemoval
                    && <Badge>{t('tool.badge.active')}</Badge>}
                </div>
              </Td>
              <Td>{b.quants ?? '—'}</Td>
              <Td>
                {b.remainingCapacity != null
                  ? `${fmtNum(b.remainingCapacity)} / ${fmtNum(b.totalCapacity)} ${b.weightUnit ?? ''}`.trim()
                  : '—'}
              </Td>
              <Td>{fmtDate(b.lastMovement)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {data.truncated && <Truncated />}
    </div>
  );
}

// ── Stock (material stock / stock by type) ────────────────────────────────────

type StockRow = {
  bin: string; storageType: string; material: string; plant: string;
  totalStock: number; availableStock: number; uom: string; lastMovement: string;
};

function StockTable({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation();
  const stock = data.stock as StockRow[];
  if (!stock.length) return <p className="text-[11px] text-wm-muted">{t('tool.empty.stock')}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-wm-muted">
          {data.count as number} quant{(data.count as number) !== 1 ? 's' : ''} · WH {data.warehouse as string}
          {data.material && data.material !== 'all' ? ` · ${data.material}` : ''}
        </p>
        <ExcelBtn onClick={() => exportToXlsx(
          ['Bin', 'Storage Type', 'Material', 'Plant', 'Total Stock', 'Available Stock', 'UOM', 'Last Movement'],
          (data.stock as StockRow[]).map(s => [s.bin, s.storageType, s.material, s.plant, s.totalStock, s.availableStock, s.uom, s.lastMovement]),
          `stock-WH${data.warehouse as string}`,
        )} />
      </div>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>{t('tool.col.bin')}</Th><Th>{t('tool.col.type')}</Th><Th>{t('tool.col.material')}</Th>
            <Th>{t('tool.col.total')}</Th><Th>{t('tool.col.available')}</Th><Th>UOM</Th><Th>{t('tool.col.lastMove')}</Th>
          </tr>
        </thead>
        <tbody>
          {stock.map((s, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td><span className="font-mono">{s.bin}</span></Td>
              <Td>{s.storageType}</Td>
              <Td>{s.material}</Td>
              <Td>{fmtNum(s.totalStock)}</Td>
              <Td>{fmtNum(s.availableStock)}</Td>
              <Td>{s.uom}</Td>
              <Td>{fmtDate(s.lastMovement)}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {data.truncated && <Truncated />}
    </div>
  );
}

// ── Stock Aging ───────────────────────────────────────────────────────────────

type AgedRow = {
  storageType: string; bin: string; material: string;
  totalStock: number; uom: string; lastMove: string;
  daysSinceMove: number | null; ageBand: string;
};

const ageBandColor = (band: string): BadgeColor =>
  band === '>1 year' ? 'red' : band === '6-12 months' ? 'amber' : 'default';

function AgingTable({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation();
  const stock = data.stock as AgedRow[];
  if (!stock.length) return <p className="text-[11px] text-emerald-600">{t('tool.empty.aging')}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-wm-muted">
          {data.count as number} aged quant{(data.count as number) !== 1 ? 's' : ''} · WH {data.warehouse as string}
        </p>
        <ExcelBtn onClick={() => exportToXlsx(
          ['Storage Type', 'Bin', 'Material', 'Total Stock', 'UOM', 'Last Move', 'Days Since Move', 'Age Band'],
          (data.stock as AgedRow[]).map(a => [a.storageType, a.bin, a.material, a.totalStock, a.uom, a.lastMove, a.daysSinceMove, a.ageBand]),
          `aging-stock-WH${data.warehouse as string}`,
        )} />
      </div>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>{t('tool.col.type')}</Th><Th>{t('tool.col.bin')}</Th><Th>{t('tool.col.material')}</Th>
            <Th>{t('tool.col.stock')}</Th><Th>UOM</Th><Th>{t('tool.col.lastMove')}</Th><Th>{t('tool.col.age')}</Th>
          </tr>
        </thead>
        <tbody>
          {stock.map((a, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td>{a.storageType}</Td>
              <Td><span className="font-mono">{a.bin}</span></Td>
              <Td>{a.material}</Td>
              <Td>{fmtNum(a.totalStock)}</Td>
              <Td>{a.uom}</Td>
              <Td>{fmtDate(a.lastMove)}</Td>
              <Td><Badge color={ageBandColor(a.ageBand)}>{a.ageBand}</Badge></Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {data.truncated && <Truncated />}
    </div>
  );
}

// ── Bin Utilization ───────────────────────────────────────────────────────────

type UtilSummary = {
  totalBins: number; emptyBins: number; occupiedBins: number; fullBins: number;
  blockedForPutaway: number; blockedForRemoval: number; utilizationPct: number;
};
type UtilByType = { storageType: string; total: number; empty: number; occupied: number; utilizationPct: number };

function UtilizationPanel({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation();
  const s = data.summary as UtilSummary;
  const byType = data.byStorageType as UtilByType[];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatCard label={t('tool.stat.totalBins')}   value={s.totalBins} />
        <StatCard label={t('tool.stat.empty')}       value={s.emptyBins} />
        <StatCard label={t('tool.stat.occupied')}    value={s.occupiedBins} />
        <StatCard label={t('tool.stat.utilization')} value={`${s.utilizationPct}%`} />
        {s.blockedForPutaway > 0 && <StatCard label={t('tool.stat.blkPutaway')} value={s.blockedForPutaway} />}
        {s.blockedForRemoval > 0 && <StatCard label={t('tool.stat.blkRemoval')} value={s.blockedForRemoval} />}
      </div>
      {byType && byType.length > 0 && (
        <TableWrap>
          <thead>
            <tr className="border-b border-wm-border bg-wm-surface-2">
              <Th>{t('tool.col.type')}</Th><Th>{t('tool.col.total')}</Th>
              <Th>{t('tool.col.stock')}</Th><Th>{t('tool.col.occupied')}</Th><Th>{t('tool.col.utilization')}</Th>
            </tr>
          </thead>
          <tbody>
            {byType.map((row, i) => (
              <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
                <Td>{row.storageType}</Td>
                <Td>{row.total}</Td>
                <Td>{row.empty}</Td>
                <Td>{row.occupied}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-wm-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-wm-primary"
                        style={{ width: `${row.utilizationPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-wm-muted">{row.utilizationPct}%</span>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      {data.truncated && <Truncated />}
    </div>
  );
}

// ── Inventory Anomalies ───────────────────────────────────────────────────────

type AnomalyRow = {
  type: string; severity: string; storageType: string; bin: string;
  lockCode: string; inventoryDoc: string | null; message: string;
};

const severityColor = (s: string): BadgeColor =>
  s === 'HIGH' ? 'red' : s === 'MEDIUM' ? 'amber' : 'default';

function AnomalyList({ data, onAction }: { data: Record<string, unknown>; onAction?: (msg: string) => void }) {
  const { t } = useTranslation();
  const anomalies = data.anomalies as AnomalyRow[];
  const wh = data.warehouse as string;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {data.count as number} anomal{(data.count as number) !== 1 ? 'ies' : 'y'} · WH {wh}
      </p>
      {!anomalies.length ? (
        <p className="text-[11px] text-emerald-600">{t('tool.empty.anomalies')}</p>
      ) : anomalies.map((a, i) => (
        <div key={i} className="bg-wm-surface border border-wm-border rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={severityColor(a.severity)}>{a.severity}</Badge>
            <span className="font-mono text-[11px] text-wm-muted">{a.storageType}/{a.bin}</span>
            <span className="text-[10px] text-wm-muted/70">{a.type}</span>
            {a.inventoryDoc && (
              <span className="text-[10px] text-wm-muted">Doc {a.inventoryDoc}</span>
            )}
            {onAction && (
              <ActionButton
                label={t('tool.action.investigate')}
                onClick={() => onAction(`Show stock and open transfer orders for bin ${a.bin} in storage type ${a.storageType}, warehouse ${wh}`)}
              />
            )}
          </div>
          <p className="text-[11px] text-wm-text leading-snug">{a.message}</p>
        </div>
      ))}
    </div>
  );
}

// ── WM / IM Variance ──────────────────────────────────────────────────────────

type VarianceRow = {
  material: string; plant: string; uom: string;
  wmStock: number; imStock: number; variance: number; status: string;
};

function VarianceTable({ data, onAction }: { data: Record<string, unknown>; onAction?: (msg: string) => void }) {
  const { t } = useTranslation();
  const variances = data.variances as VarianceRow[];
  const wh = data.warehouse as string;
  if (!variances.length) return <p className="text-[11px] text-emerald-600">{t('tool.empty.variance')}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-wm-muted">
          {variances.length} material{variances.length !== 1 ? 's' : ''} with variance · WH {wh}
          {data.note ? <span className="text-amber-600"> · {data.note as string}</span> : ''}
        </p>
        <ExcelBtn onClick={() => exportToXlsx(
          ['Material', 'Plant', 'WM Stock', 'IM Stock', 'Variance', 'UOM', 'Status'],
          variances.map(v => [v.material, v.plant, v.wmStock, v.imStock, v.variance, v.uom, v.status]),
          `wm-im-variance-WH${wh}`,
        )} />
      </div>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>{t('tool.col.material')}</Th><Th>{t('tool.col.plant')}</Th>
            <Th>{t('tool.col.wmStock')}</Th><Th>{t('tool.col.imStock')}</Th>
            <Th>{t('tool.col.variance')}</Th><Th>UOM</Th>
            {onAction && <Th>{t('tool.col.action')}</Th>}
          </tr>
        </thead>
        <tbody>
          {variances.map((v, i) => {
            const neg = v.variance < 0;
            return (
              <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
                <Td>{v.material}</Td>
                <Td>{v.plant}</Td>
                <Td>{fmtNum(v.wmStock)}</Td>
                <Td>{fmtNum(v.imStock)}</Td>
                <Td className={neg ? 'text-red-600' : 'text-amber-600'}>
                  {neg ? '' : '+'}{fmtNum(v.variance)}
                </Td>
                <Td>{v.uom}</Td>
                {onAction && (
                  <Td noTitle>
                    <ActionButton
                      label={t('tool.action.investigate')}
                      onClick={() => onAction(`Show stock quants for material ${v.material} in warehouse ${wh} and check for open transfer orders`)}
                    />
                  </Td>
                )}
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
      {data.truncated && <Truncated />}
    </div>
  );
}

// ── Cycle Count Candidates ────────────────────────────────────────────────────

type CandidateRow = {
  storageType: string; bin: string; lastCountDate: string;
  daysSinceCount: number | null; quantCount: number;
};

function CycleCountTable({ data, onAction }: { data: Record<string, unknown>; onAction?: (msg: string) => void }) {
  const { t } = useTranslation();
  const candidates = data.candidates as CandidateRow[];
  const wh = data.warehouse as string;
  if (!candidates.length) return <p className="text-[11px] text-emerald-600">{t('tool.empty.cycleCount')}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-wm-muted">
          {data.count as number} bin{(data.count as number) !== 1 ? 's' : ''} due for count · WH {wh}
        </p>
        <div className="flex items-center gap-2">
          <ExcelBtn onClick={() => exportToXlsx(
            ['Bin', 'Storage Type', 'Quants', 'Last Count Date', 'Days Since Count'],
            candidates.map(c => [c.bin, c.storageType, c.quantCount, c.lastCountDate, c.daysSinceCount]),
            `cycle-count-WH${wh}`,
          )} />
          {onAction && (candidates.length as number) <= 10 && (
            <ActionButton
              label={t('tool.action.countAll', { n: String(candidates.length) })}
              onClick={() => onAction(`Create cycle count documents for all ${candidates.length} candidate bins in warehouse ${wh}`)}
            />
          )}
        </div>
      </div>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>{t('tool.col.bin')}</Th><Th>{t('tool.col.type')}</Th><Th>{t('tool.col.quants')}</Th>
            <Th>{t('tool.col.lastCount')}</Th><Th>{t('tool.col.daysSince')}</Th>
            {onAction && <Th>{t('tool.col.action')}</Th>}
          </tr>
        </thead>
        <tbody>
          {candidates.map((c, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td><span className="font-mono">{c.bin}</span></Td>
              <Td>{c.storageType}</Td>
              <Td>{c.quantCount}</Td>
              <Td>{c.lastCountDate === 'never' ? <Badge color="red">{t('tool.badge.never')}</Badge> : fmtDate(c.lastCountDate)}</Td>
              <Td>
                {c.daysSinceCount != null
                  ? <Badge color={c.daysSinceCount > 365 ? 'red' : c.daysSinceCount > 180 ? 'amber' : 'default'}>{c.daysSinceCount}d</Badge>
                  : <Badge color="red">{t('tool.badge.never')}</Badge>}
              </Td>
              {onAction && (
                <Td noTitle>
                  <ActionButton
                    label={t('tool.action.createCount')}
                    onClick={() => onAction(`Create a cycle count document for bin ${c.bin} in storage type ${c.storageType}, warehouse ${wh}`)}
                  />
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {data.truncated && <Truncated />}
    </div>
  );
}

// ── Negative Stock ────────────────────────────────────────────────────────────

type NegativeRow = {
  storageType: string; bin: string; material: string;
  totalStock: number; uom: string; likely_cause: string;
};

function NegativeStockTable({ data, onAction }: { data: Record<string, unknown>; onAction?: (msg: string) => void }) {
  const { t } = useTranslation();
  const rows = data.negativeQuants as NegativeRow[];
  const wh = data.warehouse as string;
  if (!rows.length) return <p className="text-[11px] text-emerald-600">{t('tool.empty.negStock')}</p>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-wm-muted">
          {data.count as number} negative quant{(data.count as number) !== 1 ? 's' : ''} · WH {wh}
        </p>
        <ExcelBtn onClick={() => exportToXlsx(
          ['Storage Type', 'Bin', 'Material', 'Qty', 'UOM', 'Likely Cause'],
          rows.map(n => [n.storageType, n.bin, n.material, n.totalStock, n.uom, n.likely_cause]),
          `negative-stock-WH${wh}`,
        )} />
      </div>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>{t('tool.col.type')}</Th><Th>{t('tool.col.bin')}</Th><Th>{t('tool.col.material')}</Th>
            <Th>{t('tool.col.qty')}</Th><Th>UOM</Th><Th>{t('tool.col.likelyCause')}</Th>
            {onAction && <Th>{t('tool.col.action')}</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((n, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td>{n.storageType}</Td>
              <Td><span className="font-mono">{n.bin}</span></Td>
              <Td>{n.material}</Td>
              <Td className="text-red-600 font-medium">{fmtNum(n.totalStock)}</Td>
              <Td>{n.uom}</Td>
              <Td className="max-w-[200px] whitespace-normal text-wm-muted">{n.likely_cause}</Td>
              {onAction && (
                <Td noTitle>
                  <ActionButton
                    label={t('tool.action.investigate')}
                    onClick={() => onAction(`Show open transfer orders for bin ${n.bin} in storage type ${n.storageType}, warehouse ${wh}`)}
                  />
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

// ── Replenishment Needs ───────────────────────────────────────────────────────

type ReplenRow = {
  storageType: string; bin: string; material: string; plant: string;
  currentStock: number; replenishmentQty: number; uom: string;
  urgency: string; openReplenTO: boolean; openTONumber: string | null;
};

function ReplenishmentTable({ data, warehouse, onAction }: { data: Record<string, unknown>; warehouse?: string | null; onAction?: (msg: string) => void }) {
  const { t } = useTranslation();
  const bins = data.bins as ReplenRow[];
  const wh = data.warehouse as string;
  if (!bins.length) return <p className="text-[11px] text-emerald-600">{t('tool.empty.replen')}</p>;
  const summary = data.summary as { critical: number; low: number } | undefined;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {summary?.critical != null && summary.critical > 0 && <StatCard label={t('tool.stat.critical')} value={summary.critical} />}
          {summary?.low      != null && summary.low      > 0 && <StatCard label={t('tool.stat.low')}      value={summary.low} />}
        </div>
        <ExcelBtn onClick={() => exportToXlsx(
          ['Bin', 'Storage Type', 'Material', 'Plant', 'Current Stock', 'Replenish Qty', 'UOM', 'Urgency', 'Open Replen TO', 'TO Number'],
          bins.map(b => [b.bin, b.storageType, b.material, b.plant, b.currentStock, b.replenishmentQty, b.uom, b.urgency, b.openReplenTO ? 'Yes' : 'No', b.openTONumber ?? '']),
          `replenishment-WH${wh}`,
        )} />
      </div>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>{t('tool.col.bin')}</Th><Th>{t('tool.col.material')}</Th>
            <Th>{t('tool.col.currentStock')}</Th><Th>{t('tool.col.replenQty')}</Th>
            <Th>UOM</Th><Th>{t('tool.col.urgency')}</Th><Th>{t('tool.col.openTO')}</Th>
            {onAction && <Th>{t('tool.col.actions')}</Th>}
          </tr>
        </thead>
        <tbody>
          {bins.map((b, i) => (
            <tr key={i} className={clsx(
              'border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors',
              b.urgency === 'critical' && 'bg-red-500/5',
            )}>
              <Td><span className="font-mono">{b.bin}</span></Td>
              <Td><MaterialTooltip material={b.material} warehouse={warehouse ?? wh} /></Td>
              <Td>{fmtNum(b.currentStock)}</Td>
              <Td>{fmtNum(b.replenishmentQty)}</Td>
              <Td>{b.uom}</Td>
              <Td>
                <Badge color={b.urgency === 'critical' ? 'red' : 'amber'}>
                  {b.urgency}
                </Badge>
              </Td>
              <Td>
                {b.openReplenTO
                  ? <Badge color="blue">{b.openTONumber}</Badge>
                  : <span className="text-wm-muted">—</span>}
              </Td>
              {onAction && (
                <Td noTitle>
                  <div className="flex flex-col gap-1">
                    {!b.openReplenTO ? (
                      <ActionButton
                        label={t('tool.action.replenish')}
                        onClick={() => onAction(`Create a replenishment transfer order for bin ${b.bin} material ${b.material} in storage type ${b.storageType}, warehouse ${wh}`)}
                      />
                    ) : (
                      <span className="text-[10px] text-wm-muted">{t('tool.action.toOpen')}</span>
                    )}
                    <ActionButton
                      label={t('tool.action.blockedPicks')}
                      onClick={() => onAction(`Show open transfer requirements for material ${b.material} in warehouse ${wh}`)}
                    />
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {data.truncated && <Truncated />}
    </div>
  );
}

// ── Action Result ─────────────────────────────────────────────────────────────

function ActionResult({ data }: { data: Record<string, unknown> }) {
  const { t } = useTranslation();
  const ok = data.success === true;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'
    }`}>
      {ok
        ? <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        : <XCircle    size={16} className="text-red-600 flex-shrink-0 mt-0.5" />}
      <div className="space-y-0.5 min-w-0">
        <p className={`text-xs font-semibold ${ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {ok ? t('tool.result.success') : t('tool.result.failed')}
          {data.transferOrderNumber ? ` — TO ${data.transferOrderNumber}` : ''}
          {data.inventoryDocument   ? ` — Inv Doc ${data.inventoryDocument}` : ''}
        </p>
        {data.warning && (
          <p className="text-[11px] text-amber-600">{data.warning as string}</p>
        )}
        {data.message && (
          <p className="text-[11px] text-wm-muted">{data.message as string}</p>
        )}
        {!ok && data.error && (
          <p className="text-[11px] text-red-300">{data.error as string}</p>
        )}
      </div>
    </div>
  );
}

// ── Goods Receipt / Putaway ───────────────────────────────────────────────────

type GrStockRow = { bin: string; material: string; plant: string; qty: number; uom: string };
type InboundTrRow = { trNumber: string; material: string; requiredQty: number; uom: string; daysSinceCreation: number | null; assignedTO: string | null };

function GoodsReceiptCard({ data, warehouse, onAction }: { data: Record<string, unknown>; warehouse?: string | null; onAction?: (msg: string) => void }) {
  const { t } = useTranslation();
  const wh      = data.warehouse as string;
  const grArea  = data.grArea  as { pendingPutaway: number; stock: GrStockRow[] };
  const inbound = data.inboundTRs as { count: number; requirements: InboundTrRow[] };

  return (
    <div className="space-y-3">
      {/* Summary pills */}
      <div className="flex gap-3 text-[11px]">
        <span className="px-2 py-0.5 rounded-full bg-wm-primary/20 border border-wm-primary/40 text-wm-muted">
          {t('tool.grZone')} <span className={clsx('font-medium', grArea.pendingPutaway > 0 ? 'text-amber-600' : 'text-emerald-600')}>{grArea.pendingPutaway} {t('tool.awaitingPutaway')}</span>
        </span>
        <span className="px-2 py-0.5 rounded-full bg-wm-primary/20 border border-wm-primary/40 text-wm-muted">
          Inbound TRs: <span className={clsx('font-medium', inbound.count > 0 ? 'text-wm-accent' : 'text-emerald-600')}>{inbound.count}</span>
        </span>
      </div>

      {/* GR area stock awaiting putaway */}
      {grArea.stock.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-wm-muted uppercase tracking-wide">
            {t('tool.awaitingPutawayHeader', { type: data.grStorageType as string })}
          </p>
          <TableWrap>
            <thead>
              <tr className="border-b border-wm-border bg-wm-surface-2">
                <Th>{t('tool.col.bin')}</Th><Th>{t('tool.col.material')}</Th>
                <Th>{t('tool.col.qty')}</Th><Th>UOM</Th>
                {onAction && <Th>{t('tool.col.actions')}</Th>}
              </tr>
            </thead>
            <tbody>
              {grArea.stock.map((r, i) => (
                <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
                  <Td><span className="font-mono">{r.bin}</span></Td>
                  <Td><MaterialTooltip material={r.material} warehouse={warehouse ?? wh} /></Td>
                  <Td>{fmtNum(r.qty)}</Td>
                  <Td>{r.uom}</Td>
                  {onAction && (
                    <Td noTitle>
                      <div className="flex flex-col gap-1">
                        <ActionButton
                          label={t('tool.action.findBins')}
                          onClick={() => onAction(`Find empty bins suitable for putaway of material ${r.material} in warehouse ${wh}`)}
                        />
                        <ActionButton
                          label={t('tool.action.createPutaway')}
                          onClick={() => onAction(`Create a transfer order to putaway material ${r.material} quantity ${r.qty} ${r.uom} from GR zone bin ${r.bin} in warehouse ${wh}`)}
                        />
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}

      {/* Open inbound TRs */}
      {inbound.requirements.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-wm-muted uppercase tracking-wide">
            {t('tool.openInboundTRs')}
          </p>
          <TableWrap>
            <thead>
              <tr className="border-b border-wm-border bg-wm-surface-2">
                <Th>{t('tool.col.trNum')}</Th><Th>{t('tool.col.material')}</Th>
                <Th>{t('tool.col.qty')}</Th><Th>{t('tool.col.age')}</Th><Th>TO</Th>
                {onAction && <Th>{t('tool.col.action')}</Th>}
              </tr>
            </thead>
            <tbody>
              {inbound.requirements.map((r, i) => (
                <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
                  <Td><span className="font-mono text-wm-accent">{r.trNumber}</span></Td>
                  <Td><MaterialTooltip material={r.material} warehouse={warehouse ?? wh} /></Td>
                  <Td>{fmtNum(r.requiredQty)} {r.uom}</Td>
                  <Td><span className={r.daysSinceCreation != null && r.daysSinceCreation > 1 ? 'text-amber-600' : 'text-wm-muted'}>
                    {r.daysSinceCreation != null ? (r.daysSinceCreation === 0 ? t('tool.today') : `${r.daysSinceCreation}d`) : '—'}
                  </span></Td>
                  <Td>{r.assignedTO ? <Badge color="blue">{r.assignedTO}</Badge> : <span className="text-wm-muted">—</span>}</Td>
                  {onAction && !r.assignedTO && (
                    <Td noTitle>
                      <ActionButton
                        label={t('tool.action.createTO')}
                        onClick={() => onAction(`Create a transfer order for inbound transfer requirement ${r.trNumber} material ${r.material} in warehouse ${wh}`)}
                      />
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}

      {grArea.stock.length === 0 && inbound.requirements.length === 0 && (
        <p className="text-[11px] text-emerald-600">{t('tool.empty.grClear')}</p>
      )}
    </div>
  );
}

// ── Generic fallback ──────────────────────────────────────────────────────────

function GenericTable({ rows }: { rows: Record<string, unknown>[] }) {
  const { t } = useTranslation();
  if (!rows.length) return <p className="text-[11px] text-wm-muted">{t('tool.empty.generic')}</p>;
  const keys = Object.keys(rows[0]).slice(0, 8);
  return (
    <TableWrap>
      <thead>
        <tr className="border-b border-wm-border bg-wm-surface-2">
          {keys.map(k => <Th key={k}>{k}</Th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
            {keys.map(k => (
              <Td key={k}>
                {row[k] == null ? '—'
                  : typeof row[k] === 'object' ? JSON.stringify(row[k])
                  : String(row[k])}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ToolResultCard({ toolName, result, warehouse, onAction }: Props) {
  if (result == null) return null;
  if (typeof result !== 'object') {
    return <pre className="text-[11px] text-wm-muted whitespace-pre-wrap">{String(result)}</pre>;
  }

  const r = result as Record<string, unknown>;
  // Prefer warehouse from result payload, fall back to prop
  const wh = (r.warehouse as string | undefined) ?? warehouse ?? null;

  // Action tools — `success` key is the discriminator
  if ('success' in r) return <ActionResult data={r} />;

  // Shape-based dispatch — more robust than tool-name matching
  if (r.grArea && r.inboundTRs)        return <GoodsReceiptCard   data={r} warehouse={wh} onAction={onAction} />;
  if (Array.isArray(r.orders))         return <TransferOrderTable data={r} warehouse={wh} onAction={onAction} />;
  if (Array.isArray(r.anomalies))      return <AnomalyList        data={r} onAction={onAction} />;
  if (Array.isArray(r.negativeQuants)) return <NegativeStockTable data={r} onAction={onAction} />;
  if (Array.isArray(r.candidates))     return <CycleCountTable    data={r} onAction={onAction} />;
  if (Array.isArray(r.variances))      return <VarianceTable      data={r} onAction={onAction} />;

  // `bins` is shared between bin-status and replenishment — disambiguate
  if (Array.isArray(r.bins)) {
    const first = (r.bins as Record<string, unknown>[])[0];
    if (first && 'replenishmentQty' in first) return <ReplenishmentTable data={r} warehouse={wh} onAction={onAction} />;
    return <BinTable data={r} />;
  }

  // `stock` is shared between stock-query and aging — disambiguate
  if (Array.isArray(r.stock)) {
    const first = (r.stock as Record<string, unknown>[])[0];
    if (first && 'ageBand' in first) return <AgingTable data={r} />;
    return <StockTable data={r} />;
  }

  // Utilization — byStorageType is an object for neg-stock and cycle count,
  // an array only for bin utilization
  if (Array.isArray(r.byStorageType)) return <UtilizationPanel data={r} />;

  // Generic: find first array, render as table
  const firstArr = Object.values(r).find(
    v => Array.isArray(v) && v.length > 0 && typeof (v as unknown[])[0] === 'object',
  ) as Record<string, unknown>[] | undefined;
  if (firstArr) return <GenericTable rows={firstArr} />;

  // Last resort: raw JSON
  return (
    <pre className="text-[11px] text-wm-muted whitespace-pre-wrap break-words">
      {JSON.stringify(r, null, 2)}
    </pre>
  );
}
