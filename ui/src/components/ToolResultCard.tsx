import { CheckCircle, XCircle } from 'lucide-react';

interface Props {
  toolName: string;
  result: unknown;
}

// ── Shared table primitives ────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-1.5 text-left text-[10px] font-medium text-wm-muted uppercase tracking-wide whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-2 py-1.5 text-[11px] text-wm-text whitespace-nowrap ${className ?? ''}`}>
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
    green:   'bg-emerald-900/40 text-emerald-400 border-emerald-700/30',
    amber:   'bg-amber-900/40 text-amber-400 border-amber-700/30',
    red:     'bg-red-900/40 text-red-400 border-red-700/30',
    blue:    'bg-blue-900/40 text-blue-400 border-blue-700/30',
    default: 'bg-wm-surface text-wm-muted border-wm-border',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${palette[color]}`}>
      {children}
    </span>
  );
}

function Truncated() {
  return (
    <p className="text-[10px] text-amber-400 mt-2 px-0.5">
      ⚠ Results truncated — refine your query or reduce the limit
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

function TransferOrderTable({ data }: { data: Record<string, unknown> }) {
  const orders = data.orders as ToRow[];
  if (!orders.length) return <p className="text-[11px] text-wm-muted">No open transfer orders.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {data.count as number} open TO{(data.count as number) !== 1 ? 's' : ''} · WH {data.warehouse as string}
      </p>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>TO#</Th><Th>Material</Th><Th>From</Th><Th>To</Th>
            <Th>Open Qty</Th><Th>Age</Th><Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td><span className="font-mono text-wm-accent">{o.toNumber}</span></Td>
              <Td>{o.material || '—'}</Td>
              <Td>
                <span className="text-wm-muted">{o.sourceType}/</span>{o.sourceBin}
              </Td>
              <Td>
                <span className="text-wm-muted">{o.destType}/</span>{o.destBin}
              </Td>
              <Td>{fmtNum(o.openQty)} {o.uom}</Td>
              <Td>{o.daysSinceCreation != null ? `${o.daysSinceCreation}d` : '—'}</Td>
              <Td>
                <Badge color={o.ageFlag?.includes('OVERDUE') ? 'amber' : 'green'}>
                  {o.status}
                </Badge>
              </Td>
            </tr>
          ))}
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
  const bins = data.bins as BinRow[];
  if (!bins.length) return <p className="text-[11px] text-wm-muted">No bins found.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {data.count as number} bin{(data.count as number) !== 1 ? 's' : ''} · WH {data.warehouse as string}
      </p>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>Bin</Th><Th>Type</Th><Th>Status</Th>
            <Th>Quants</Th><Th>Capacity Rem.</Th><Th>Last Move</Th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td><span className="font-mono">{b.bin}</span></Td>
              <Td>{b.storageType}</Td>
              <Td>
                <div className="flex gap-1 flex-wrap">
                  {b.empty         && <Badge color="green">Empty</Badge>}
                  {b.full          && <Badge color="amber">Full</Badge>}
                  {b.blockedPutaway && <Badge color="red">Blk↑</Badge>}
                  {b.blockedRemoval && <Badge color="red">Blk↓</Badge>}
                  {!b.empty && !b.full && !b.blockedPutaway && !b.blockedRemoval
                    && <Badge>Active</Badge>}
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
  const stock = data.stock as StockRow[];
  if (!stock.length) return <p className="text-[11px] text-wm-muted">No stock found.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {data.count as number} quant{(data.count as number) !== 1 ? 's' : ''} · WH {data.warehouse as string}
        {data.material && data.material !== 'all' ? ` · ${data.material}` : ''}
      </p>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>Bin</Th><Th>Type</Th><Th>Material</Th>
            <Th>Total</Th><Th>Available</Th><Th>UOM</Th><Th>Last Move</Th>
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
  const stock = data.stock as AgedRow[];
  if (!stock.length) return <p className="text-[11px] text-emerald-400">No aged stock found.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {data.count as number} aged quant{(data.count as number) !== 1 ? 's' : ''} · WH {data.warehouse as string}
      </p>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>Type</Th><Th>Bin</Th><Th>Material</Th>
            <Th>Stock</Th><Th>UOM</Th><Th>Last Move</Th><Th>Age</Th>
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
  const s = data.summary as UtilSummary;
  const byType = data.byStorageType as UtilByType[];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatCard label="Total Bins"   value={s.totalBins} />
        <StatCard label="Empty"        value={s.emptyBins} />
        <StatCard label="Occupied"     value={s.occupiedBins} />
        <StatCard label="Utilization"  value={`${s.utilizationPct}%`} />
        {s.blockedForPutaway > 0 && <StatCard label="Blk Putaway" value={s.blockedForPutaway} />}
        {s.blockedForRemoval > 0 && <StatCard label="Blk Removal" value={s.blockedForRemoval} />}
      </div>
      {byType && byType.length > 0 && (
        <TableWrap>
          <thead>
            <tr className="border-b border-wm-border bg-wm-surface-2">
              <Th>Type</Th><Th>Total</Th><Th>Empty</Th><Th>Occupied</Th><Th>Utilization</Th>
            </tr>
          </thead>
          <tbody>
            {byType.map((t, i) => (
              <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
                <Td>{t.storageType}</Td>
                <Td>{t.total}</Td>
                <Td>{t.empty}</Td>
                <Td>{t.occupied}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-wm-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-wm-primary"
                        style={{ width: `${t.utilizationPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-wm-muted">{t.utilizationPct}%</span>
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

function AnomalyList({ data }: { data: Record<string, unknown> }) {
  const anomalies = data.anomalies as AnomalyRow[];
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {data.count as number} anomal{(data.count as number) !== 1 ? 'ies' : 'y'} · WH {data.warehouse as string}
      </p>
      {!anomalies.length ? (
        <p className="text-[11px] text-emerald-400">No anomalies detected.</p>
      ) : anomalies.map((a, i) => (
        <div key={i} className="bg-wm-surface border border-wm-border rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={severityColor(a.severity)}>{a.severity}</Badge>
            <span className="font-mono text-[11px] text-wm-muted">{a.storageType}/{a.bin}</span>
            <span className="text-[10px] text-wm-muted/70">{a.type}</span>
            {a.inventoryDoc && (
              <span className="text-[10px] text-wm-muted">Doc {a.inventoryDoc}</span>
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

function VarianceTable({ data }: { data: Record<string, unknown> }) {
  const variances = data.variances as VarianceRow[];
  if (!variances.length) return <p className="text-[11px] text-emerald-400">WM and IM stocks are in sync.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {variances.length} material{variances.length !== 1 ? 's' : ''} with variance · WH {data.warehouse as string}
        {data.note ? <span className="text-amber-400"> · {data.note as string}</span> : ''}
      </p>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>Material</Th><Th>Plant</Th><Th>WM Stock</Th><Th>IM Stock</Th><Th>Variance</Th><Th>UOM</Th>
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
                <Td className={neg ? 'text-red-400' : 'text-amber-400'}>
                  {neg ? '' : '+'}{fmtNum(v.variance)}
                </Td>
                <Td>{v.uom}</Td>
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

function CycleCountTable({ data }: { data: Record<string, unknown> }) {
  const candidates = data.candidates as CandidateRow[];
  if (!candidates.length) return <p className="text-[11px] text-emerald-400">No bins overdue for cycle count.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {data.count as number} bin{(data.count as number) !== 1 ? 's' : ''} due for count · WH {data.warehouse as string}
      </p>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>Bin</Th><Th>Type</Th><Th>Quants</Th><Th>Last Count</Th><Th>Days Since</Th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td><span className="font-mono">{c.bin}</span></Td>
              <Td>{c.storageType}</Td>
              <Td>{c.quantCount}</Td>
              <Td>{c.lastCountDate === 'never' ? <Badge color="red">Never</Badge> : fmtDate(c.lastCountDate)}</Td>
              <Td>
                {c.daysSinceCount != null
                  ? <Badge color={c.daysSinceCount > 365 ? 'red' : c.daysSinceCount > 180 ? 'amber' : 'default'}>{c.daysSinceCount}d</Badge>
                  : <Badge color="red">Never</Badge>}
              </Td>
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

function NegativeStockTable({ data }: { data: Record<string, unknown> }) {
  const rows = data.negativeQuants as NegativeRow[];
  if (!rows.length) return <p className="text-[11px] text-emerald-400">No negative stock found.</p>;
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-wm-muted">
        {data.count as number} negative quant{(data.count as number) !== 1 ? 's' : ''} · WH {data.warehouse as string}
      </p>
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>Type</Th><Th>Bin</Th><Th>Material</Th><Th>Qty</Th><Th>UOM</Th><Th>Likely Cause</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td>{n.storageType}</Td>
              <Td><span className="font-mono">{n.bin}</span></Td>
              <Td>{n.material}</Td>
              <Td className="text-red-400 font-medium">{fmtNum(n.totalStock)}</Td>
              <Td>{n.uom}</Td>
              <Td className="max-w-[200px] whitespace-normal text-wm-muted">{n.likely_cause}</Td>
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

function ReplenishmentTable({ data }: { data: Record<string, unknown> }) {
  const bins = data.bins as ReplenRow[];
  if (!bins.length) return <p className="text-[11px] text-emerald-400">No replenishment needed.</p>;
  const summary = data.summary as { critical: number; low: number } | undefined;
  return (
    <div className="space-y-2">
      {summary && (
        <div className="flex gap-2">
          {summary.critical > 0 && <StatCard label="Critical" value={summary.critical} />}
          {summary.low > 0      && <StatCard label="Low"      value={summary.low} />}
        </div>
      )}
      <TableWrap>
        <thead>
          <tr className="border-b border-wm-border bg-wm-surface-2">
            <Th>Bin</Th><Th>Material</Th><Th>Current Stock</Th>
            <Th>Replenish Qty</Th><Th>UOM</Th><Th>Urgency</Th><Th>Open TO</Th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b, i) => (
            <tr key={i} className="border-b border-wm-border/40 hover:bg-wm-surface-2/40 transition-colors">
              <Td><span className="font-mono">{b.bin}</span></Td>
              <Td>{b.material}</Td>
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
  const ok = data.success === true;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      ok ? 'border-emerald-700/30 bg-emerald-900/20' : 'border-red-700/30 bg-red-900/20'
    }`}>
      {ok
        ? <CheckCircle size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
        : <XCircle    size={16} className="text-red-400 flex-shrink-0 mt-0.5" />}
      <div className="space-y-0.5 min-w-0">
        <p className={`text-xs font-semibold ${ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {ok ? 'Success' : 'Failed'}
          {data.transferOrderNumber  ? ` — TO ${data.transferOrderNumber}` : ''}
          {data.inventoryDocument    ? ` — Inv Doc ${data.inventoryDocument}` : ''}
        </p>
        {data.warning && (
          <p className="text-[11px] text-amber-400">{data.warning as string}</p>
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

// ── Generic fallback ──────────────────────────────────────────────────────────

function GenericTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-[11px] text-wm-muted">No results.</p>;
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

export function ToolResultCard({ toolName, result }: Props) {
  if (result == null) return null;
  if (typeof result !== 'object') {
    return <pre className="text-[11px] text-wm-muted whitespace-pre-wrap">{String(result)}</pre>;
  }

  const r = result as Record<string, unknown>;

  // Action tools — `success` key is the discriminator
  if ('success' in r) return <ActionResult data={r} />;

  // Shape-based dispatch — more robust than tool-name matching
  if (Array.isArray(r.orders))         return <TransferOrderTable data={r} />;
  if (Array.isArray(r.anomalies))      return <AnomalyList        data={r} />;
  if (Array.isArray(r.negativeQuants)) return <NegativeStockTable data={r} />;
  if (Array.isArray(r.candidates))     return <CycleCountTable    data={r} />;
  if (Array.isArray(r.variances))      return <VarianceTable      data={r} />;

  // `bins` is shared between bin-status and replenishment — disambiguate
  if (Array.isArray(r.bins)) {
    const first = (r.bins as Record<string, unknown>[])[0];
    if (first && 'replenishmentQty' in first) return <ReplenishmentTable data={r} />;
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
