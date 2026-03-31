import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, ExternalLink, Eye, EyeOff,
  Trash2, Plus, ChevronDown, ChevronUp,
  Brain, BookOpen, Plug, BarChart2, Languages, RotateCcw,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  connectProvider, disconnectProvider,
  addCustomProvider, removeCustomProvider,
  getProject, updateProject,
  getMemory, addMemoryFact, deleteMemoryFact,
} from '../api/client';
import type { Provider, MemoryFact, Project } from '../types';
import { useToast } from './Toaster';
import { useTranslation } from '../i18n';

// ── Provider logos as styled badges ──────────────────────────────────────────

const PROVIDER_STYLES: Record<string, { bg: string; label: string; icon: string }> = {
  anthropic: { bg: 'bg-amber-500/15 border-amber-500/30',  label: 'text-amber-700', icon: '✦' },
  openai:    { bg: 'bg-emerald-900/40 border-emerald-700/40', label: 'text-emerald-300', icon: '⬡' },
  google:    { bg: 'bg-blue-900/40 border-blue-700/40',    label: 'text-blue-300',   icon: '◈' },
};

// ── Single provider card ──────────────────────────────────────────────────────

function ProviderCard({
  provider,
  onConnected,
  onDisconnected,
}: {
  provider: Provider;
  onConnected: () => void;
  onDisconnected: () => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [expanded, setExpanded]   = useState(false);
  const [apiKey, setApiKey]       = useState('');
  const [showKey, setShowKey]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const style = PROVIDER_STYLES[provider.id] ?? PROVIDER_STYLES.openai;

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 120);
  }, [expanded]);

  const handleConnect = async () => {
    if (!apiKey.trim()) { setError(t('settings.apiKeyEmpty')); return; }
    setSaving(true);
    setError(null);
    try {
      await connectProvider(provider.id, apiKey.trim());
      setSuccess(true);
      setApiKey('');
      setExpanded(false);
      setTimeout(() => setSuccess(false), 2000);
      toast(`${provider.name} — ${t('settings.connected')}`);
      onConnected();
    } catch (err: unknown) {
      setError((err as Error).message ?? t('settings.failedSaveKey'));
      toast(t('settings.failedSaveKey'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectProvider(provider.id);
      toast(`${provider.name} — ${t('settings.disconnect').toLowerCase()}`);
      onDisconnected();
    } catch {
      toast(t('settings.failedDisconn'), 'error');
    }
  };

  return (
    <div className={clsx(
      'rounded-xl border overflow-hidden transition-colors',
      provider.connected ? 'border-wm-border-hover bg-wm-surface-2' : 'border-wm-border bg-wm-surface',
    )}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div className={clsx('w-9 h-9 rounded-lg border flex items-center justify-center text-lg flex-shrink-0', style.bg)}>
          <span className={style.label}>{style.icon}</span>
        </div>

        {/* Name + model list */}
        <div className="flex-1 min-w-0">
          <p className="text-wm-text text-sm font-semibold">{provider.name}</p>
          <p className="text-wm-muted text-[11px]">{provider.vendor} · {provider.models.map(m => m.label).join(', ')}</p>
        </div>

        {/* Status + action */}
        {provider.connected ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <Check size={11} /> {t('settings.connected')}
            </span>
            <button
              onClick={handleDisconnect}
              className="text-[11px] text-wm-muted hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
            >
              {t('settings.disconnect')}
            </button>
          </div>
        ) : success ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <Check size={11} /> {t('settings.saved')}
          </span>
        ) : (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-wm-primary hover:bg-wm-primary-hover text-white font-medium transition-colors"
          >
            {t('settings.connect')}
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {/* Expand — API key input */}
      <AnimatePresence>
        {expanded && !provider.connected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-wm-border">
              {/* Key input */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setError(null); }}
                  onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  placeholder={provider.keyHint}
                  className={clsx(
                    'w-full bg-wm-bg border rounded-lg px-3 py-2 pr-10 text-sm text-wm-text placeholder-wm-muted outline-none transition-colors font-mono',
                    error ? 'border-red-500/60 focus:border-red-400' : 'border-wm-border focus:border-wm-accent',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-wm-muted hover:text-wm-text transition-colors"
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-wm-accent hover:underline"
                >
                  {t('settings.getApiKey')} <ExternalLink size={10} />
                </a>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setExpanded(false); setApiKey(''); setError(null); }}
                    className="text-xs px-3 py-1.5 rounded-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
                  >
                    {t('settings.cancel')}
                  </button>
                  <motion.button
                    onClick={handleConnect}
                    disabled={saving || !apiKey.trim()}
                    whileHover={!saving && apiKey.trim() ? { scale: 1.03 } : {}}
                    whileTap={!saving && apiKey.trim() ? { scale: 0.97 } : {}}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                      saving || !apiKey.trim()
                        ? 'bg-wm-border text-wm-muted cursor-not-allowed'
                        : 'bg-wm-primary hover:bg-wm-primary-hover text-white',
                    )}
                  >
                    {saving ? t('settings.saving') : t('settings.saveKey')}
                  </motion.button>
                </div>
              </div>

              <p className="text-[10px] text-wm-muted">{t('settings.keyHint')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Custom provider form ──────────────────────────────────────────────────────

const POPULAR_PROVIDERS = [
  { name: 'Mistral',     baseUrl: 'https://api.mistral.ai/v1',          model: 'mistral-large-latest' },
  { name: 'Groq',        baseUrl: 'https://api.groq.com/openai/v1',     model: 'llama-3.3-70b-versatile' },
  { name: 'DeepSeek',    baseUrl: 'https://api.deepseek.com/v1',        model: 'deepseek-chat' },
  { name: 'Perplexity',  baseUrl: 'https://api.perplexity.ai',          model: 'llama-3.1-sonar-large-128k-online' },
  { name: 'Together AI', baseUrl: 'https://api.together.xyz/v1',        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { name: 'Ollama',      baseUrl: 'http://localhost:11434/v1',           model: 'llama3.2' },
];

function CustomProviderForm({ onAdded }: { onAdded: () => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState('');
  const [baseUrl, setBaseUrl]   = useState('');
  const [model, setModel]       = useState('');
  const [apiKey, setApiKey]     = useState('');
  const [showKey, setShowKey]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fill = (preset: typeof POPULAR_PROVIDERS[0]) => {
    setName(preset.name);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  };

  const handleAdd = async () => {
    if (!name.trim() || !baseUrl.trim() || !model.trim() || !apiKey.trim()) {
      setError(t('settings.allFieldsReq')); return;
    }
    setSaving(true); setError(null);
    try {
      await addCustomProvider({ name: name.trim(), baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() });
      setName(''); setBaseUrl(''); setModel(''); setApiKey('');
      setOpen(false);
      toast(`${name.trim()} — ${t('settings.addProvider').toLowerCase()}`);
      onAdded();
    } catch (err: unknown) {
      setError((err as Error).message);
      toast(t('settings.failedAddProv'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-wm-border overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-wm-surface-2 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg border border-wm-border bg-wm-bg flex items-center justify-center flex-shrink-0">
          <Plus size={14} className="text-wm-muted" />
        </div>
        <div className="flex-1">
          <p className="text-wm-text-dim text-sm font-medium">{t('settings.addCustom')}</p>
          <p className="text-wm-muted text-[11px]">{t('settings.addCustomDesc')}</p>
        </div>
        {open ? <ChevronUp size={13} className="text-wm-muted" /> : <ChevronDown size={13} className="text-wm-muted" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-wm-border space-y-3">

              {/* Quick-fill presets */}
              <div>
                <p className="text-[10px] text-wm-muted mb-1.5 uppercase tracking-widest">{t('settings.quickFill')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_PROVIDERS.map(p => (
                    <button
                      key={p.name}
                      onClick={() => fill(p)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-wm-surface-2 border border-wm-border text-wm-muted hover:text-wm-text hover:border-wm-border-hover transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-wm-muted mb-1 block">{t('settings.displayName')}</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Mistral"
                    className="w-full bg-wm-bg border border-wm-border focus:border-wm-accent rounded-lg px-3 py-2 text-sm text-wm-text placeholder-wm-muted outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-wm-muted mb-1 block">{t('settings.modelName')}</label>
                  <input
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="mistral-large-latest"
                    className="w-full bg-wm-bg border border-wm-border focus:border-wm-accent rounded-lg px-3 py-2 text-sm text-wm-text placeholder-wm-muted outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-wm-muted mb-1 block">{t('settings.baseUrl')}</label>
                <input
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://api.mistral.ai/v1"
                  className="w-full bg-wm-bg border border-wm-border focus:border-wm-accent rounded-lg px-3 py-2 text-sm text-wm-text placeholder-wm-muted outline-none transition-colors font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-wm-muted mb-1 block">{t('settings.apiKey')}</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => { setApiKey(e.target.value); setError(null); }}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder="sk-..."
                    className="w-full bg-wm-bg border border-wm-border focus:border-wm-accent rounded-lg px-3 py-2 pr-10 text-sm text-wm-text placeholder-wm-muted outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-wm-muted hover:text-wm-text transition-colors"
                  >
                    {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setOpen(false); setError(null); }}
                  className="text-xs px-3 py-1.5 rounded-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
                >
                  {t('settings.cancel')}
                </button>
                <motion.button
                  onClick={handleAdd}
                  disabled={saving}
                  whileHover={!saving ? { scale: 1.03 } : {}}
                  whileTap={!saving ? { scale: 0.97 } : {}}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                    saving ? 'bg-wm-border text-wm-muted cursor-not-allowed' : 'bg-wm-primary hover:bg-wm-primary-hover text-white',
                  )}
                >
                  {saving ? t('settings.adding') : t('settings.addProvider')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-wm-text text-sm">{label}</p>
        {description && (
          <p className="text-wm-muted text-[11px] leading-snug mt-0.5">{description}</p>
        )}
      </div>
      {/* pill: 40×22 px — knob: 16×16 px, 3 px inset on each side */}
      <button
        onClick={() => onChange(!checked)}
        title={checked ? t('settings.toggleHide') : t('settings.toggleShow')}
        style={{ width: 40, height: 22 }}
        className={clsx(
          'relative flex-shrink-0 mt-0.5 rounded-full transition-colors duration-200 focus:outline-none',
          checked ? 'bg-wm-primary' : 'bg-wm-border',
        )}
      >
        <span
          style={{ width: 16, height: 16, top: 3, left: 3 }}
          className={clsx(
            'absolute rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[18px]' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon, title, children }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-wm-accent">{icon}</span>
        <h3 className="text-wm-text text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Main Settings Panel ───────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
];

interface Props {
  open: boolean;
  providers: Provider[];
  showStats: boolean;
  autoBrief: boolean;
  language: string;
  onClose: () => void;
  onProvidersChange: () => void;
  onShowStatsChange: (v: boolean) => void;
  onAutoBriefChange: (v: boolean) => void;
  onLanguageChange: (lang: string) => void;
}

const DEFAULT_INSTRUCTIONS = `## My SAP system
Warehouse number:
Plant:
Storage location (LGORT, for WM/IM variance):

## Storage types in use
<!-- List your storage types and what they represent, e.g.:
001 — Fixed bin (blocks negative stock — avoid as source/dest for ad-hoc moves)
003 — Fixed bin (allows negative stock — safe for test moves)
P01 — Picking zone (primary replenishment target)
999 — Storage unit zone (negative quants here are expected)
-->

## Operational notes
<!-- Any site-specific rules, e.g.:
- Negative stock in SU/interim zones is expected (GI posted before TO confirmed)
- Open TOs older than X days should be flagged
-->`;

export function SettingsPanel({ open, providers, showStats, autoBrief, language, onClose, onProvidersChange, onShowStatsChange, onAutoBriefChange, onLanguageChange }: Props) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [project, setProject]           = useState<Project | null>(null);
  const [instructions, setInstructions] = useState('');
  const [instrSaved, setInstrSaved]     = useState(false);
  const [facts, setFacts]               = useState<MemoryFact[]>([]);
  const [newFact, setNewFact]           = useState('');
  const instrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data when panel opens
  useEffect(() => {
    if (!open) return;
    getProject().then(p => { setProject(p); setInstructions(p.instructions); }).catch(console.error);
    getMemory().then(m => setFacts(m.facts)).catch(console.error);
  }, [open]);

  // Auto-save instructions 800ms after last keystroke
  const handleInstructionsChange = (val: string) => {
    setInstructions(val);
    setInstrSaved(false);
    if (instrTimerRef.current) clearTimeout(instrTimerRef.current);
    instrTimerRef.current = setTimeout(async () => {
      try {
        await updateProject({ instructions: val });
        setInstrSaved(true);
        setTimeout(() => setInstrSaved(false), 2000);
      } catch {}
    }, 800);
  };

  const handleAddFact = async () => {
    const text = newFact.trim();
    if (!text) return;
    try {
      const fact = await addMemoryFact(text);
      setFacts(prev => [...prev, fact]);
      setNewFact('');
      toast(t('toast.savedMemory'));
    } catch {
      toast(t('toast.failedMemory'), 'error');
    }
  };

  const handleDeleteFact = async (id: string) => {
    try {
      await deleteMemoryFact(id);
      setFacts(prev => prev.filter(f => f.id !== id));
      toast(t('toast.removedMemory'));
    } catch {
      toast(t('toast.failedRemMemory'), 'error');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 h-full w-[420px] max-w-full bg-wm-surface border-l border-wm-border z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-5 border-b border-wm-border flex-shrink-0">
              <p className="text-wm-text font-semibold text-sm">{t('settings.title')}</p>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-8">

              {/* ── Providers ── */}
              <Section icon={<Plug size={15} />} title={t('settings.providers')}>
                <p className="text-wm-muted text-xs leading-relaxed">{t('settings.providersDesc')}</p>
                <div className="space-y-2">
                  {/* Built-in providers */}
                  {providers.filter(p => !p.isCustom).map(p => (
                    <ProviderCard
                      key={p.id}
                      provider={p}
                      onConnected={onProvidersChange}
                      onDisconnected={onProvidersChange}
                    />
                  ))}

                  {/* Custom providers already added */}
                  {providers.filter(p => p.isCustom).map(p => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-wm-border-hover bg-wm-surface-2"
                    >
                      <div className="w-9 h-9 rounded-lg border border-wm-border bg-wm-bg flex items-center justify-center flex-shrink-0">
                        <span className="text-wm-muted text-base">⚙</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-wm-text text-sm font-semibold">{p.name}</p>
                        <p className="text-wm-muted text-[11px] truncate font-mono">{p.vendor} · {p.customModel}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                          <Check size={11} /> Connected
                        </span>
                        <button
                          onClick={async () => {
                            try {
                              await removeCustomProvider(p.id);
                              toast(`${p.name} — ${t('settings.remove').toLowerCase()}`);
                              onProvidersChange();
                            } catch {
                              toast(t('settings.failedRemProv'), 'error');
                            }
                          }}
                          className="text-[11px] text-wm-muted hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                        >
                          {t('settings.remove')}
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {/* Add custom provider */}
                  <CustomProviderForm onAdded={onProvidersChange} />
                </div>
              </Section>

              {/* ── Project Instructions ── */}
              <Section icon={<BookOpen size={15} />} title={t('settings.instructions')}>
                <p className="text-wm-muted text-xs leading-relaxed">{t('settings.instructionsDesc')}</p>
                <div className="relative">
                  <textarea
                    value={instructions}
                    onChange={e => handleInstructionsChange(e.target.value)}
                    rows={8}
                    className="w-full bg-wm-bg border border-wm-border focus:border-wm-accent rounded-xl px-3 py-2.5 text-sm text-wm-text placeholder-wm-muted outline-none resize-none leading-relaxed transition-colors"
                    placeholder={t('settings.instructPlaceholder')}
                  />
                  <AnimatePresence>
                    {instrSaved && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-emerald-600"
                      >
                        <Check size={10} /> {t('settings.saved')}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-wm-muted">{t('settings.autoSaved', { n: instructions.length })}</p>
                  <button
                    onClick={() => handleInstructionsChange(DEFAULT_INSTRUCTIONS)}
                    className="flex items-center gap-1 text-[10px] text-wm-muted hover:text-wm-accent transition-colors"
                    title={t('settings.resetDefaults')}
                  >
                    <RotateCcw size={10} />
                    {t('settings.resetDefaults')}
                  </button>
                </div>
              </Section>

              {/* ── Memory ── */}
              <Section icon={<Brain size={15} />} title={t('settings.memory')}>
                <p className="text-wm-muted text-xs leading-relaxed">{t('settings.memoryDesc')}</p>

                {/* Existing facts */}
                <div className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {facts.length === 0 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-wm-muted text-xs py-2 text-center"
                      >
                        {t('settings.noFacts')}
                      </motion.p>
                    )}
                    {facts.map(fact => (
                      <motion.div
                        key={fact.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start gap-2 px-3 py-2 rounded-lg bg-wm-surface-2 border border-wm-border group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-wm-text-dim leading-relaxed">{fact.text}</p>
                          {fact.createdAt && (
                            <p className="text-[10px] text-wm-border-hover mt-0.5">
                              {new Date(fact.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteFact(fact.id)}
                          className="text-wm-border group-hover:text-red-600 transition-colors flex-shrink-0 mt-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Add new fact */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFact}
                    onChange={e => setNewFact(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddFact()}
                    placeholder={t('settings.factPlaceholder')}
                    className="flex-1 bg-wm-bg border border-wm-border focus:border-wm-accent rounded-lg px-3 py-2 text-xs text-wm-text placeholder-wm-muted outline-none transition-colors"
                  />
                  <motion.button
                    onClick={handleAddFact}
                    disabled={!newFact.trim()}
                    whileHover={newFact.trim() ? { scale: 1.05 } : {}}
                    whileTap={newFact.trim() ? { scale: 0.95 } : {}}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={clsx(
                      'w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-colors',
                      newFact.trim()
                        ? 'bg-wm-primary hover:bg-wm-primary-hover text-white'
                        : 'bg-wm-border text-wm-muted cursor-not-allowed',
                    )}
                  >
                    <Plus size={14} />
                  </motion.button>
                </div>
              </Section>

              {/* ── Display ── */}
              <Section icon={<BarChart2 size={15} />} title={t('settings.display')}>
                <Toggle
                  checked={showStats}
                  onChange={onShowStatsChange}
                  label={t('settings.statsBar')}
                  description={t('settings.statsBarDesc')}
                />
                <Toggle
                  checked={autoBrief}
                  onChange={onAutoBriefChange}
                  label={t('settings.autoBrief')}
                  description={t('settings.autoBriefDesc')}
                />
              </Section>

              {/* ── Language ── */}
              <Section icon={<Languages size={15} />} title={t('settings.language')}>
                <p className="text-wm-muted text-xs leading-relaxed">{t('settings.languageDesc')}</p>
                <div className="flex gap-2">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => { onLanguageChange(lang.code); toast(t('toast.languageSet', { lang: lang.label })); }}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors flex-1 justify-center',
                        language === lang.code
                          ? 'bg-wm-primary border-wm-primary text-white'
                          : 'bg-wm-surface border-wm-border text-wm-text-dim hover:border-wm-border-hover hover:bg-wm-surface-2',
                      )}
                    >
                      <span className="text-base leading-none">{lang.flag}</span>
                      {lang.label}
                      {language === lang.code && <Check size={13} className="ml-auto opacity-80" />}
                    </button>
                  ))}
                </div>
              </Section>

            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-wm-border flex-shrink-0">
              <p className="text-[10px] text-wm-muted text-center">
                {t('settings.footer', {
                  n: providers.filter(p => p.connected).length,
                  s: providers.filter(p => p.connected).length !== 1 ? 's' : '',
                })}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
