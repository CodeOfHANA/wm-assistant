import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, Trash2, PanelLeftClose } from 'lucide-react';
import { clsx } from 'clsx';
import type { ConversationSummary, Provider } from '../types';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  providers: Provider[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

const itemVariants = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] } },
  exit:    { opacity: 0, x: -8,  transition: { duration: 0.15 } },
};

function ProviderDot({ provider }: { provider: Provider }) {
  const colors: Record<string, string> = {
    anthropic: '#c97b3a',
    openai:    '#19c37d',
    google:    '#4285F4',
  };
  return (
    <div
      title={`${provider.name} — ${provider.connected ? 'Connected' : 'Not connected'}`}
      className={clsx(
        'w-2 h-2 rounded-full transition-opacity duration-300',
        provider.connected ? 'opacity-100' : 'opacity-25 grayscale',
      )}
      style={{ backgroundColor: provider.connected ? colors[provider.id] ?? '#82c0c7' : '#82c0c7' }}
    />
  );
}

export function Sidebar({
  conversations, activeId, providers, collapsed,
  onToggleCollapse, onSelect, onNew, onDelete,
}: Props) {
  return (
    <motion.div
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex-shrink-0 flex flex-col bg-wm-surface border-r border-wm-border h-full overflow-hidden"
    >

      {/* ── Header — h-14 matches main header ─────────────────────────────── */}
      {collapsed ? (
        /* Collapsed: whole header is the expand target — logo stays centred, no stacking */
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleCollapse}
          onKeyDown={e => e.key === 'Enter' && onToggleCollapse()}
          title="Expand sidebar"
          className="h-14 flex items-center justify-center border-b border-wm-border flex-shrink-0 cursor-pointer hover:bg-wm-surface-2 transition-colors"
        >
          <img
            src="/relacon-logo.png"
            alt="RELACON"
            className="h-6 w-auto"
            style={{ filter: 'invert(1) brightness(0.85)' }}
          />
        </div>
      ) : (
        /* Expanded: logo + text on left, collapse toggle on right */
        <div className="h-14 flex items-center border-b border-wm-border flex-shrink-0 px-3 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <img
                src="/relacon-logo.png"
                alt="RELACON"
                className="h-6 w-auto"
                style={{ filter: 'invert(1) brightness(0.85)' }}
              />
            </div>
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap border-l border-wm-border pl-2.5"
            >
              <p className="text-wm-text text-xs font-semibold leading-tight">WM Assistant</p>
              <p className="text-wm-muted text-[10px]">Warehouse AI</p>
            </motion.div>
          </div>
          <button
            onClick={onToggleCollapse}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
            title="Collapse sidebar"
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
          title="New conversation"
          className={clsx(
            'flex items-center gap-2 bg-wm-primary hover:bg-wm-primary-hover text-wm-text text-sm font-medium transition-colors rounded-lg',
            collapsed ? 'w-10 h-10 justify-center' : 'w-full px-3 py-2',
          )}
        >
          <Plus size={15} className="flex-shrink-0" />
          {!collapsed && 'New conversation'}
        </motion.button>
      </div>

      {/* ── Conversation list ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <AnimatePresence initial={false}>
          {conversations.length === 0 && !collapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-wm-muted text-xs text-center py-8 px-3"
            >
              No conversations yet.
              <br />Start a new one above.
            </motion.p>
          )}
          {conversations.map((conv, i) => (
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
              <MessageSquare size={13} className="flex-shrink-0 opacity-60" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Provider status ───────────────────────────────────────────────── */}
      <div className={clsx(
        'border-t border-wm-border flex items-center',
        collapsed ? 'px-2 py-3 justify-center' : 'px-4 py-3 justify-between',
      )}>
        {!collapsed && <span className="text-wm-muted text-[11px]">Providers</span>}
        <div className="flex items-center gap-2">
          {providers.map(p => <ProviderDot key={p.id} provider={p} />)}
        </div>
      </div>

    </motion.div>
  );
}
