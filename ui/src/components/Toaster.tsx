import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { clsx } from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info';

interface ToastMsg {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-3), { id, message, type }]); // cap at 4
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portal-style fixed overlay */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map(t => (
            <Toast key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ── Individual toast bubble ───────────────────────────────────────────────────

const PALETTE: Record<ToastType, string> = {
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700',
  error:   'bg-red-500/15 border-red-500/30 text-red-700',
  info:    'bg-wm-surface-2 border-wm-border text-wm-text',
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <Check size={13} />,
  error:   <AlertTriangle size={13} />,
  info:    <Info size={13} />,
};

function Toast({ item, onDismiss }: { item: ToastMsg; onDismiss: (id: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 48, scale: 0.95 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{ opacity: 0,   x: 48,  scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={clsx(
        'pointer-events-auto flex items-center gap-2.5 pl-3 pr-2.5 py-2.5',
        'rounded-xl border shadow-lg min-w-[180px] max-w-xs',
        PALETTE[item.type],
      )}
    >
      <span className="flex-shrink-0">{ICONS[item.type]}</span>
      <span className="flex-1 text-[12px] font-medium leading-snug">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity ml-1"
      >
        <X size={11} />
      </button>
    </motion.div>
  );
}
