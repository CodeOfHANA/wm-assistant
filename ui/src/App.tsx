import { useEffect, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Chat } from './components/Chat';
import { ModelSelector } from './components/ModelSelector';
import { SettingsPanel } from './components/SettingsPanel';
import {
  listConversations, getConversation, createConversation,
  deleteConversation, getProviders,
} from './api/client';
import type { ConversationSummary, Conversation, Provider } from './types';

export default function App() {
  const [conversations, setConversations]       = useState<ConversationSummary[]>([]);
  const [activeConv, setActiveConv]             = useState<Conversation | null>(null);
  const [providers, setProviders]               = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [selectedModel, setSelectedModel]       = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen]         = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const refreshProviders = () => getProviders().then(setProviders).catch(() => {});

  // Bootstrap
  useEffect(() => {
    listConversations().then(setConversations).catch(console.error);
    refreshProviders();
  }, []);

  // Refresh providers every 5s to reflect connect/disconnect
  useEffect(() => {
    const id = setInterval(refreshProviders, 5000);
    return () => clearInterval(id);
  }, []);

  const handleSelectConversation = async (id: string) => {
    try {
      const conv = await getConversation(id);
      setActiveConv(conv);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewConversation = async () => {
    try {
      const conv = await createConversation('New conversation');
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
    } catch (err) {
      console.error(err);
    }
  };

  const handleModelChange = (provider: string, model: string | null) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
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
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
        />

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header — h-14 matches sidebar header exactly */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-wm-border bg-wm-surface flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-wm-text font-semibold text-sm truncate">
                {activeConv?.title ?? 'WM Assistant'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ModelSelector
                providers={providers}
                selectedProvider={selectedProvider}
                selectedModel={selectedModel}
                onChange={handleModelChange}
              />

              {/* Settings button — with unread dot if no providers connected */}
              <div className="relative">
                <motion.button
                  onClick={() => setSettingsOpen(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
                  title="Settings"
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

          {/* No provider banner */}
          {connectedCount === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-amber-900/20 border border-amber-700/30 flex items-center justify-between"
            >
              <p className="text-amber-300 text-xs">
                No AI provider connected — add an API key to start chatting.
              </p>
              <button
                onClick={() => setSettingsOpen(true)}
                className="text-xs text-amber-300 font-medium hover:underline ml-3 flex-shrink-0"
              >
                Connect →
              </button>
            </motion.div>
          )}

          {/* Chat */}
          {activeConv ? (
            <Chat
              key={activeConv.id}
              conversationId={activeConv.id}
              initialMessages={activeConv.messages}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              onTitleChange={handleTitleChange}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-wm-muted text-sm">Select a conversation or start a new one.</p>
                <button
                  onClick={handleNewConversation}
                  className="px-4 py-2 rounded-lg bg-wm-primary hover:bg-wm-primary-hover text-wm-text text-sm font-medium transition-colors"
                >
                  Start chatting
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings panel */}
        <SettingsPanel
          open={settingsOpen}
          providers={providers}
          onClose={() => setSettingsOpen(false)}
          onProvidersChange={refreshProviders}
        />

      </div>
    </MotionConfig>
  );
}
