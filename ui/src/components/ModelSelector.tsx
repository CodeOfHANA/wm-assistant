import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Zap, Cpu } from 'lucide-react';
import { clsx } from 'clsx';
import type { Provider } from '../types';
import { useTranslation } from '../i18n';

interface Props {
  providers: Provider[];
  selectedProvider: string;
  selectedModel: string | null;
  onChange: (provider: string, model: string | null) => void;
}

const tierIcon = {
  premium:  <Cpu size={11} className="text-amber-500" />,
  standard: <Cpu size={11} className="text-wm-accent" />,
  fast:     <Zap size={11} className="text-green-600" />,
};

export function ModelSelector({ providers, selectedProvider, selectedModel, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const connectedProviders = providers.filter(p => p.connected);

  // Build display label
  let label = t('model.auto');
  let sublabel = t('model.autoSub');
  if (selectedProvider !== 'auto') {
    const prov = providers.find(p => p.id === selectedProvider);
    if (prov) {
      label = prov.name;
      const m = prov.models.find(m => m.id === selectedModel);
      sublabel = m?.label ?? prov.models[0]?.label ?? '';
    }
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-wm-surface-2 border border-wm-border hover:border-wm-border-hover text-sm text-wm-text transition-colors"
      >
        <span className="font-medium">{label}</span>
        <span className="text-wm-muted text-xs hidden sm:block">{sublabel}</span>
        <ChevronDown
          size={13}
          className={clsx('text-wm-muted transition-transform', open && 'rotate-180')}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{    opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="absolute right-0 top-full mt-1 w-64 bg-wm-surface border border-wm-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Auto option */}
            <div className="p-1">
              <button
                onClick={() => { onChange('auto', null); setOpen(false); }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                  selectedProvider === 'auto'
                    ? 'bg-wm-primary text-white'
                    : 'text-wm-text hover:bg-wm-surface-2',
                )}
              >
                <Zap size={13} className="flex-shrink-0" />
                <div>
                  <p className="font-medium">{t('model.auto')}</p>
                  <p className={clsx(
                    'text-[11px]',
                    selectedProvider === 'auto' ? 'text-white/70' : 'text-wm-muted',
                  )}>
                    {t('model.autoBest')}
                  </p>
                </div>
              </button>
            </div>

            {/* Per-provider model lists */}
            {connectedProviders.length > 0 && (
              <div className="border-t border-wm-border p-1">
                {connectedProviders.map(prov => (
                  <div key={prov.id}>
                    <p className="px-3 py-1 text-[10px] text-wm-muted uppercase tracking-widest">
                      {prov.vendor}
                    </p>
                    {prov.models.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { onChange(prov.id, m.id); setOpen(false); }}
                        className={clsx(
                          'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors text-left',
                          selectedProvider === prov.id && selectedModel === m.id
                            ? 'bg-wm-primary text-white'
                            : 'text-wm-text-dim hover:bg-wm-surface-2 hover:text-wm-text',
                        )}
                      >
                        {tierIcon[m.tier]}
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {connectedProviders.length === 0 && (
              <p className="px-4 py-3 text-xs text-wm-muted">
                {t('model.noProviders')}
                <br />{t('model.noProvidersHint')}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
