import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Trash2, PanelLeftClose, Pencil, Search, X, Pin, PinOff, LayoutDashboard, Grid3X3 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ConversationSummary, Provider } from '../types';
import { useTranslation } from '../i18n';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  providers: Provider[];
  collapsed: boolean;
  dashboardActive: boolean;
  slottingActive: boolean;
  onToggleCollapse: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDashboard: () => void;
  onSlotting: () => void;
}

const PINNED_KEY = 'wma_pinned_ids';

function loadPinned(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) ?? '[]')); }
  catch { return new Set(); }
}

function savePinned(ids: Set<string>) {
  localStorage.setItem(PINNED_KEY, JSON.stringify([...ids]));
}

const itemVariants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] } },
  exit:    { opacity: 0, x: -8,  transition: { duration: 0.15 } },
};

function ProviderDot({ provider }: { provider: Provider }) {
  const { t } = useTranslation();
  const colors: Record<string, string> = {
    anthropic: '#c97b3a',
    openai:    '#19c37d',
    google:    '#4285F4',
  };
  return (
    <div
      title={provider.connected ? t('sidebar.provConn', { name: provider.name }) : t('sidebar.provDisconn', { name: provider.name })}
      className={clsx(
        'w-2 h-2 rounded-full transition-opacity duration-300',
        provider.connected ? 'opacity-100' : 'opacity-25 grayscale',
      )}
      style={{ backgroundColor: provider.connected ? colors[provider.id] ?? '#82c0c7' : '#82c0c7' }}
    />
  );
}

export function Sidebar({
  conversations, activeId, providers, collapsed, dashboardActive, slottingActive,
  onToggleCollapse, onSelect, onNew, onDelete, onRename, onDashboard, onSlotting,
}: Props) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [search, setSearch] = useState('');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(loadPinned);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep localStorage in sync
  useEffect(() => { savePinned(pinnedIds); }, [pinnedIds]);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = search.trim()
    ? conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const pinned   = filtered.filter(c => pinnedIds.has(c.id));
  const unpinned = filtered.filter(c => !pinnedIds.has(c.id));

  const startEdit = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditValue(conv.title);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const renderConv = (conv: ConversationSummary, i: number) => {
    const isPinned = pinnedIds.has(conv.id);
    return (
      <motion.div
        key={conv.id}
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ delay: i * 0.03 }}
        title={collapsed ? conv.title : undefined}
        className={clsx(
          'group flex items-center gap-2 rounded-lg cursor-pointer text-sm transition-colors',
          collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2',
          activeId === conv.id
            ? 'bg-wm-surface-2 text-wm-text'
            : 'text-wm-text-dim hover:bg-wm-surface-2 hover:text-wm-text',
        )}
        onClick={() => onSelect(conv.id)}
      >
        {isPinned && !collapsed
          ? <Pin size={12} className="flex-shrink-0 text-wm-accent opacity-70" />
          : <MessageSquare size={13} className="flex-shrink-0 opacity-60" />}
        {!collapsed && (
          <>
            {editingId === conv.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') setEditingId(null);
                  e.stopPropagation();
                }}
                onClick={e => e.stopPropagation()}
                className="flex-1 min-w-0 bg-wm-bg border border-wm-border-hover rounded px-1.5 py-0.5 text-xs text-wm-text outline-none"
              />
            ) : (
              <span className="flex-1 truncate">{conv.title}</span>
            )}
            <button
              onClick={e => togglePin(conv.id, e)}
              title={isPinned ? t('sidebar.unpin') : t('sidebar.pin')}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-wm-accent"
            >
              {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
            </button>
            <button
              onClick={e => startEdit(conv, e)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-wm-accent"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-600"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="no-print flex-shrink-0 flex flex-col bg-wm-surface border-r border-wm-border h-full overflow-hidden"
    >

      {/* ── Header — h-14 matches main header ─────────────────────────────── */}
      {collapsed ? (
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleCollapse}
          onKeyDown={e => e.key === 'Enter' && onToggleCollapse()}
          title={t('sidebar.expandSidebar')}
          className="h-14 flex items-center justify-center border-b border-wm-border flex-shrink-0 cursor-pointer hover:bg-wm-surface-2 transition-colors"
        >
          <img src="/relacon-logo.png" alt="RELACON" className="relacon-logo h-6 w-auto" />
        </div>
      ) : (
        <div className="h-14 flex items-center border-b border-wm-border flex-shrink-0 px-3 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <img src="/relacon-logo.png" alt="RELACON" className="relacon-logo h-6 w-auto" />
            </div>
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap border-l border-wm-border pl-2.5"
            >
              <p className="text-wm-text text-xs font-semibold leading-tight">{t('app.wmAssistant')}</p>
              <p className="text-wm-muted text-[10px]">{t('sidebar.warehouseAi')}</p>
            </motion.div>
          </div>
          <button
            onClick={onToggleCollapse}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
            title={t('sidebar.collapseSidebar')}
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      )}

      {/* ── New chat ──────────────────────────────────────────────────────── */}
      <div className={clsx('px-2 pt-3 pb-2', collapsed && 'flex justify-center')}>
        <motion.button
          onClick={onNew}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          title={t('sidebar.new')}
          className={clsx(
            'flex items-center gap-2 bg-wm-primary hover:bg-wm-primary-hover text-white text-sm font-medium transition-colors rounded-lg',
            collapsed ? 'w-10 h-10 justify-center' : 'w-full px-3 py-2',
          )}
        >
          <Plus size={15} className="flex-shrink-0" />
          {!collapsed && t('sidebar.new')}
        </motion.button>
      </div>

      {/* ── Dashboard ────────────────────────────────────────────────────── */}
      <div className={clsx('px-2 pb-2', collapsed && 'flex justify-center')}>
        <button
          onClick={onDashboard}
          title={t('sidebar.warehouseDash')}
          className={clsx(
            'flex items-center gap-2 text-sm font-medium transition-colors rounded-lg w-full',
            collapsed ? 'w-10 h-10 justify-center px-0 py-0' : 'px-3 py-2',
            dashboardActive
              ? 'bg-wm-surface-2 text-wm-text'
              : 'text-wm-text-dim hover:bg-wm-surface-2 hover:text-wm-text',
          )}
        >
          <LayoutDashboard size={15} className="flex-shrink-0" />
          {!collapsed && t('sidebar.dashboard')}
        </button>
      </div>

      {/* ── Slotting ─────────────────────────────────────────────────────── */}
      <div className={clsx('px-2 pb-2', collapsed && 'flex justify-center')}>
        <button
          onClick={onSlotting}
          title={t('sidebar.warehouseSlotting')}
          className={clsx(
            'flex items-center gap-2 text-sm font-medium transition-colors rounded-lg w-full',
            collapsed ? 'w-10 h-10 justify-center px-0 py-0' : 'px-3 py-2',
            slottingActive
              ? 'bg-wm-surface-2 text-wm-text'
              : 'text-wm-text-dim hover:bg-wm-surface-2 hover:text-wm-text',
          )}
        >
          <Grid3X3 size={15} className="flex-shrink-0" />
          {!collapsed && t('sidebar.slotting')}
        </button>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <div className="flex items-center gap-1.5 bg-wm-surface-2 border border-wm-border rounded-lg px-2.5 py-1.5 focus-within:border-wm-border-hover transition-colors">
            <Search size={11} className="text-wm-muted flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('sidebar.search')}
              className="flex-1 bg-transparent text-xs text-wm-text placeholder-wm-muted outline-none min-w-0"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-wm-muted hover:text-wm-text transition-colors">
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Conversation list ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <AnimatePresence initial={false}>
          {filtered.length === 0 && !collapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-wm-muted text-xs text-center py-8 px-3"
            >
              {search ? t('sidebar.noMatches') : t('sidebar.empty')}
            </motion.p>
          )}

          {/* Pinned section */}
          {pinned.length > 0 && !collapsed && (
            <motion.p
              key="pinned-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] font-semibold text-wm-muted uppercase tracking-wide px-2 pt-1 pb-0.5"
            >
              {t('sidebar.pinned')}
            </motion.p>
          )}
          {pinned.map((conv, i) => renderConv(conv, i))}

          {/* Divider between pinned and rest */}
          {pinned.length > 0 && unpinned.length > 0 && !collapsed && (
            <motion.div key="divider" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="border-t border-wm-border mx-2 my-1"
            />
          )}

          {unpinned.map((conv, i) => renderConv(conv, i))}
        </AnimatePresence>
      </div>

      {/* ── Provider status ───────────────────────────────────────────────── */}
      <div className={clsx(
        'border-t border-wm-border',
        collapsed ? 'px-2 py-3 flex justify-center' : 'px-4 py-3 flex items-center justify-between',
      )}>
        {!collapsed && <span className="text-wm-muted text-[11px]">{t('sidebar.providers')}</span>}
        <div className={clsx(
          'flex flex-wrap gap-2',
          collapsed ? 'justify-center max-w-[48px]' : 'items-center',
        )}>
          {providers.map(p => <ProviderDot key={p.id} provider={p} />)}
        </div>
      </div>

    </motion.div>
  );
}
