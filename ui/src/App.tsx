import { useEffect, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ToastProvider, useToast } from './components/Toaster';
import { I18nProvider, useTranslation } from './i18n';
import { Settings, Sun, Moon } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Chat } from './components/Chat';
import { Dashboard } from './components/Dashboard';
import { ModelSelector } from './components/ModelSelector';
import { SettingsPanel } from './components/SettingsPanel';
import {
  listConversations, getConversation, createConversation,
  deleteConversation, renameConversation, getProviders,
  getProject, getShiftStats,
} from './api/client';
import type { ShiftStats } from './api/client';
import type { ConversationSummary, Conversation, Provider } from './types';

function StatPill({ label, value, alertColor }: {
  label: string;
  value: number | null;
  alertColor?: 'red' | 'amber' | 'yellow';
}) {
  const colorCls = alertColor === 'red'    ? 'text-red-600'
                 : alertColor === 'amber'  ? 'text-amber-600'
                 : alertColor === 'yellow' ? 'text-yellow-600'
                 : 'text-emerald-600';
  return (
    <span className="flex items-center gap-1">
      <span>{label}:</span>
      <span className={colorCls + ' font-medium tabular-nums'}>
        {value ?? '—'}
      </span>
    </span>
  );
}

function AppInner({ language, onLanguageChange }: { language: string; onLanguageChange: (l: string) => void }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [conversations, setConversations]       = useState<ConversationSummary[]>([]);
  const [activeConv, setActiveConv]             = useState<Conversation | null>(null);
  const [providers, setProviders]               = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [isLight, setIsLight] = useState(() => localStorage.getItem('wma_theme') === 'light');
  const [serverOnline, setServerOnline] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight);
    localStorage.setItem('wma_theme', isLight ? 'light' : 'dark');
  }, [isLight]);


  useEffect(() => {
    const check = () =>
      fetch('/api/health', { signal: AbortSignal.timeout(4000) })
        .then(() => setServerOnline(true))
        .catch(() => setServerOnline(false));
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
  const [selectedModel, setSelectedModel]       = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen]         = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats]                       = useState<ShiftStats | null>(null);
  const [statsWarehouse, setStatsWarehouse]     = useState<string | null>(null);
  const [view, setView]                         = useState<'chat' | 'dashboard'>('chat');
  const [pendingQuery, setPendingQuery]         = useState('');
  const [showStats, setShowStats]               = useState(() => localStorage.getItem('wma_show_stats') !== 'false');
  const [autoBrief, setAutoBrief]               = useState(() => localStorage.getItem('wma_auto_brief') === 'true');

  useEffect(() => {
    localStorage.setItem('wma_show_stats', String(showStats));
  }, [showStats]);

  useEffect(() => {
    localStorage.setItem('wma_auto_brief', String(autoBrief));
  }, [autoBrief]);

  const refreshProviders = () => getProviders().then(setProviders).catch(() => {});

  const refreshStats = (warehouse: string) =>
    getShiftStats(warehouse).then(setStats).catch(() => {});

  // Bootstrap
  useEffect(() => {
    listConversations().then(setConversations).catch(console.error);
    refreshProviders();
    // Extract warehouse number from project instructions
    getProject().then(p => {
      const m = p.instructions.match(/warehouse\s+number\s*:\s*(\w+)/i);
      if (m) { setStatsWarehouse(m[1]); refreshStats(m[1]); }
    }).catch(() => {});
  }, []);

  // Refresh providers every 5s to reflect connect/disconnect
  useEffect(() => {
    const id = setInterval(refreshProviders, 5000);
    return () => clearInterval(id);
  }, []);

  const handleSelectConversation = async (id: string) => {
    setView('chat');
    try {
      const conv = await getConversation(id);
      setActiveConv(conv);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewConversation = async () => {
    setView('chat');
    try {
      const conv = await createConversation(t('sidebar.new'));
      setConversations(prev => [
        { id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt },
        ...prev,
      ]);
      setActiveConv(conv);
      if (autoBrief && statsWarehouse) {
        setPendingQuery(`Give me a quick shift overview for warehouse ${statsWarehouse}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAskFromDashboard = async (query: string) => {
    setPendingQuery(query);
    setView('chat');
    try {
      const conv = await createConversation(t('sidebar.new'));
      setConversations(prev => [
        { id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt },
        ...prev,
      ]);
      setActiveConv(conv);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConv?.id === id) setActiveConv(null);
      toast(t('toast.convDeleted'));
    } catch (err) {
      console.error(err);
      toast(t('toast.convDeleteFail'), 'error');
    }
  };

  const handleModelChange = (provider: string, model: string | null) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
  };

  const handleRenameConversation = async (id: string, title: string) => {
    try {
      await renameConversation(id, title);
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
      if (activeConv?.id === id) setActiveConv(prev => prev ? { ...prev, title } : prev);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTitleChange = (title: string) => {
    if (!activeConv) return;
    setConversations(prev =>
      prev.map(c => c.id === activeConv.id ? { ...c, title } : c),
    );
    setActiveConv(prev => prev ? { ...prev, title } : prev);
  };

  const connectedCount = providers.filter(p => p.connected).length;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-screen bg-wm-bg overflow-hidden">

        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeId={activeConv?.id ?? null}
          providers={providers}
          collapsed={sidebarCollapsed}
          dashboardActive={view === 'dashboard'}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
          onRename={handleRenameConversation}
          onDashboard={() => setView('dashboard')}
        />

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header — h-14 matches sidebar header exactly */}
          <div className="no-print h-14 flex items-center justify-between px-4 border-b border-wm-border bg-wm-surface flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                title={serverOnline ? t('app.serverConnected') : t('app.serverUnreachable')}
                className="flex-shrink-0 relative"
              >
                <div className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {serverOnline && (
                  <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-50" />
                )}
              </div>
              <h1 className="text-wm-text font-semibold text-sm truncate">
                {activeConv?.title ?? t('app.wmAssistant')}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ModelSelector
                providers={providers}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onChange={handleModelChange}
              />

              {/* Theme toggle */}
              <motion.button
                onClick={() => setIsLight(v => !v)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
                title={isLight ? t('app.switchDark') : t('app.switchLight')}
              >
                {isLight ? <Moon size={15} /> : <Sun size={15} />}
              </motion.button>

              {/* Settings button — with unread dot if no providers connected */}
              <div className="relative">
                <motion.button
                  onClick={() => setSettingsOpen(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
                  title={t('app.settings')}
                >
                  <Settings size={15} />
                </motion.button>
                {/* Attention dot — pulsing when no providers connected */}
                {connectedCount === 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* Shift stats bar */}
          {showStats && statsWarehouse && (
            <div className="no-print flex items-center gap-4 px-4 py-1.5 border-b border-wm-border bg-wm-surface text-[11px] text-wm-muted">
              <span className="text-wm-border-hover">WH {statsWarehouse}</span>
              {stats ? (
                <>
                  <StatPill
                    label={t('stats.openTOs')}
                    value={stats.openTOs}
                    alertColor={stats.openTOs != null && stats.openTOs > 0 ? 'amber' : undefined}
                  />
                  <StatPill
                    label={t('stats.negativeStock')}
                    value={stats.negativeQuants}
                    alertColor={stats.negativeQuants != null && stats.negativeQuants > 0 ? 'red' : undefined}
                  />
                  <StatPill
                    label={t('stats.replenishment')}
                    value={stats.replenishmentNeeds}
                    alertColor={stats.replenishmentNeeds != null && stats.replenishmentNeeds > 0 ? 'yellow' : undefined}
                  />
                </>
              ) : (
                <span className="animate-pulse text-wm-muted">{t('app.loadingStats')}</span>
              )}
              <button
                onClick={() => statsWarehouse && refreshStats(statsWarehouse)}
                className="ml-auto text-wm-muted hover:text-wm-text transition-colors"
                title={t('app.refreshStats')}
              >
                ↻
              </button>
            </div>
          )}

          {/* No provider banner */}
          {connectedCount === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between"
            >
              <p className="text-amber-700 text-xs">{t('app.noProvider')}</p>
              <button
                onClick={() => setSettingsOpen(true)}
                className="text-xs text-amber-700 font-medium hover:underline ml-3 flex-shrink-0"
              >
                {t('app.noProviderCta')}
              </button>
            </motion.div>
          )}

          {/* Dashboard / Chat */}
          {view === 'dashboard' && statsWarehouse ? (
            <Dashboard
              warehouse={statsWarehouse}
              onAskAI={handleAskFromDashboard}
            />
          ) : view === 'dashboard' && !statsWarehouse ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-wm-muted text-sm text-center max-w-xs">{t('app.noDashboard')}</p>
            </div>
          ) : activeConv ? (
            <Chat
              key={activeConv.id}
              conversationId={activeConv.id}
              initialMessages={activeConv.messages}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              warehouse={statsWarehouse}
              conversationTitle={activeConv?.title}
              autoQuery={pendingQuery}
              language={language}
              onNew={handleNewConversation}
              onTitleChange={handleTitleChange}
              onResponseDone={statsWarehouse ? () => refreshStats(statsWarehouse) : undefined}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-wm-muted text-sm">{t('app.noConversation')}</p>
                <button
                  onClick={handleNewConversation}
                  className="px-4 py-2 rounded-lg bg-wm-primary hover:bg-wm-primary-hover text-white text-sm font-medium transition-colors"
                >
                  {t('app.startChatting')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings panel */}
        <SettingsPanel
          open={settingsOpen}
          providers={providers}
          showStats={showStats}
          autoBrief={autoBrief}
          language={language}
          onClose={() => setSettingsOpen(false)}
          onProvidersChange={refreshProviders}
          onShowStatsChange={(v) => {
            setShowStats(v);
            if (v && statsWarehouse) refreshStats(statsWarehouse);
          }}
          onAutoBriefChange={setAutoBrief}
          onLanguageChange={onLanguageChange}
        />

      </div>
    </MotionConfig>
  );
}

export default function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('wma_language') ?? 'en');

  useEffect(() => {
    localStorage.setItem('wma_language', language);
  }, [language]);

  return (
    <ToastProvider>
      <I18nProvider language={language}>
        <AppInner language={language} onLanguageChange={setLanguage} />
      </I18nProvider>
    </ToastProvider>
  );
}
