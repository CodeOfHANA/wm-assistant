import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, ChevronDown, Wrench, AlertCircle, User, Sunrise, PackageCheck, Boxes, RefreshCw, ShieldAlert, Copy, Check, Download, FileText, ClipboardList, SearchCheck, Wrench as WrenchIcon, Keyboard, X, Printer, Brain, Play, AlertTriangle, PackageX, ClipboardCheck, Repeat2, Mic, MicOff, RotateCcw } from 'lucide-react';
import { Relacottchen, WorkingRelacottchen } from './Relacottchen';
import { clsx } from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, ToolEvent, StreamEvent } from '../types';
import { ToolResultCard } from './ToolResultCard';
import type { ActionMeta } from './ToolResultCard';
import { generateConversationTitle, addMemoryFact, extractConversationMemory } from '../api/client';
import { useToast } from './Toaster';
import { useTranslation } from '../i18n';

// Markdown component overrides — styled to match RELACON design tokens
const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p:          ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1:         ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1">{children}</h1>,
  h2:         ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1">{children}</h2>,
  h3:         ({ children }) => <h3 className="text-sm font-medium mt-2 mb-1">{children}</h3>,
  ul:         ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol:         ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>,
  li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong:     ({ children }) => <strong className="font-semibold">{children}</strong>,
  em:         ({ children }) => <em className="italic text-wm-text-dim">{children}</em>,
  hr:         () => <hr className="border-wm-border my-3" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-wm-accent pl-3 my-2 text-wm-text-dim italic">{children}</blockquote>
  ),
  pre:        ({ children }) => (
    <pre className="bg-wm-bg border border-wm-border rounded p-3 my-2 overflow-x-auto text-xs font-mono">{children}</pre>
  ),
  code:       ({ children, className }) => {
    // className present means fenced code block (language-*), rendered inside <pre>
    if (className) return <code className={clsx('font-mono text-wm-text-dim', className)}>{children}</code>;
    return <code className="font-mono text-xs bg-wm-bg border border-wm-border rounded px-1 py-0.5">{children}</code>;
  },
  a:          ({ children, href }) => (
    <a href={href} className="text-wm-accent underline underline-offset-2 hover:opacity-80"
       target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  table:  ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead:  ({ children }) => <thead className="border-b border-wm-border">{children}</thead>,
  tbody:  ({ children }) => <tbody>{children}</tbody>,
  tr:     ({ children }) => <tr className="border-b border-wm-border last:border-0 hover:bg-wm-surface-2 transition-colors">{children}</tr>,
  th:     ({ children }) => <th className="px-3 py-1.5 text-left font-semibold text-wm-muted whitespace-nowrap">{children}</th>,
  td:     ({ children }) => <td className="px-3 py-1.5 text-wm-text-dim">{children}</td>,
};

// ── Timestamp formatter ────────────────────────────────────────────────────────

function fmtTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

// ── Tool result summary (shown in ToolCard header when collapsed) ──────────────

function getResultSummary(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const r = result as Record<string, unknown>;
  if ('success' in r) return r.success ? '✓ done' : '✗ failed';
  if (Array.isArray(r.orders))         return `${r.orders.length} order${r.orders.length !== 1 ? 's' : ''}`;
  if (Array.isArray(r.negativeQuants)) return `${r.negativeQuants.length} quant${r.negativeQuants.length !== 1 ? 's' : ''}`;
  if (Array.isArray(r.candidates))     return `${r.candidates.length} candidate${r.candidates.length !== 1 ? 's' : ''}`;
  if (Array.isArray(r.variances))      return `${r.variances.length} variance${r.variances.length !== 1 ? 's' : ''}`;
  if (Array.isArray(r.anomalies))      return `${r.anomalies.length} anomal${r.anomalies.length !== 1 ? 'ies' : 'y'}`;
  if (Array.isArray(r.bins)) {
    const first = (r.bins as Record<string, unknown>[])[0];
    const label = first && 'replenishmentQty' in first ? ' need replen.' : '';
    return `${r.bins.length} bin${r.bins.length !== 1 ? 's' : ''}${label}`;
  }
  if (Array.isArray(r.stock))          return `${r.stock.length} record${r.stock.length !== 1 ? 's' : ''}`;
  if (Array.isArray(r.byStorageType))  return `${(r.byStorageType as unknown[]).length} storage type${(r.byStorageType as unknown[]).length !== 1 ? 's' : ''}`;
  if (r.grArea !== undefined)          return 'goods receipt zone';
  return '';
}

// ── Tool Call Card ─────────────────────────────────────────────────────────────

function ToolCard({ tool, warehouse, onAction }: { tool: ToolEvent; warehouse?: string | null; onAction?: (msg: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isDone  = tool.status === 'done';
  const isError = tool.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="my-2 rounded-lg border border-wm-border bg-wm-surface-2 overflow-hidden text-xs"
    >
      <button
        onClick={() => isDone && setExpanded(e => !e)}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
          isDone ? 'hover:bg-wm-surface cursor-pointer' : 'cursor-default',
        )}
      >
        {isDone ? (
          <Wrench size={12} className="text-wm-accent flex-shrink-0" />
        ) : isError ? (
          <AlertCircle size={12} className="text-red-600 flex-shrink-0" />
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="w-3 h-3 border border-wm-accent border-t-transparent rounded-full flex-shrink-0"
          />
        )}
        <span className="font-mono text-wm-muted">{tool.name}</span>
        {isDone && tool.result ? (
          <span className="text-wm-text-dim ml-1 text-[11px] truncate">
            — {getResultSummary(tool.result)}
          </span>
        ) : tool.input && (
          <span className="text-wm-border ml-1 truncate max-w-[200px]">
            {JSON.stringify(tool.input).slice(0, 60)}
          </span>
        )}
        {isDone && (
          <ChevronDown
            size={11}
            className={clsx('ml-auto text-wm-muted transition-transform', expanded && 'rotate-180')}
          />
        )}
        {isError && <span className="ml-auto text-red-600">{tool.error}</span>}
      </button>

      <AnimatePresence>
        {expanded && tool.result && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 max-h-80 overflow-y-auto tool-result-body">
              <ToolResultCard toolName={tool.name} result={tool.result} warehouse={warehouse} onAction={onAction} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg, toolEvents, isStreaming, warehouse, onAction,
}: {
  msg: Message;
  toolEvents?: ToolEvent[];
  isStreaming?: boolean;
  warehouse?: string | null;
  onAction?: (msg: string) => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [savedMem, setSavedMem] = useState(false);
  const timestamp = fmtTime(msg.createdAt);

  const handleCopy = () => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast(t('toast.copied'));
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={clsx('flex gap-3 max-w-3xl', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}
    >
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-wm-accent-mid' : 'bg-wm-primary',
      )}>
        {isUser
          ? <User         size={13} className="text-white" />
          : <Relacottchen size={16} className="text-white" />}
      </div>

      {/* Content */}
      <div className={clsx('flex flex-col gap-1 group/msg', isUser ? 'items-end' : 'items-start')}>
        {/* Tool calls (assistant only) */}
        {!isUser && toolEvents && toolEvents.length > 0 && (
          <div className="w-full">
            {toolEvents.map(t => <ToolCard key={t.id} tool={t} warehouse={warehouse} onAction={onAction} />)}
          </div>
        )}

        {/* Text bubble */}
        {(msg.content || isStreaming) && (
          <div className={clsx(
            'relative group/bubble px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words max-w-xl',
            isUser
              ? 'bg-wm-primary text-white rounded-tr-sm whitespace-pre-wrap'
              : 'bg-wm-surface border border-wm-border text-wm-text rounded-tl-sm',
            isStreaming && !msg.content && 'min-h-[36px]',
          )}>
            {isUser ? (
              msg.content || ' '
            ) : (
              <>
                <div className={clsx(isStreaming && 'streaming-cursor')}>
                  <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>
                    {msg.content || ' '}
                  </ReactMarkdown>
                </div>
                {/* Action buttons — visible on hover, hidden while streaming and when printing */}
                {!isStreaming && msg.content && (
                  <div className="no-print absolute top-2 right-2 flex gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        if (!msg.content || savedMem) return;
                        addMemoryFact(msg.content)
                          .then(() => {
                            setSavedMem(true);
                            toast(t('toast.memorySaved'));
                            setTimeout(() => setSavedMem(false), 2000);
                          })
                          .catch(() => {});
                      }}
                      title={savedMem ? t('chat.memorySaved') : t('chat.saveMemory')}
                      className="p-1 rounded-md bg-wm-surface-2 border border-wm-border hover:border-wm-border-hover text-wm-muted hover:text-wm-accent"
                    >
                      {savedMem ? <Check size={11} className="text-wm-accent" /> : <Brain size={11} />}
                    </button>
                    <button
                      onClick={handleCopy}
                      title={copied ? t('chat.copied') : t('chat.copyResponse')}
                      className="p-1 rounded-md bg-wm-surface-2 border border-wm-border hover:border-wm-border-hover text-wm-muted hover:text-wm-text"
                    >
                      {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {/* Timestamp — on hover */}
        {timestamp && (
          <span className="text-[10px] text-wm-muted opacity-0 group-hover/msg:opacity-100 transition-opacity px-1">
            {timestamp}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Model Used Badge ───────────────────────────────────────────────────────────

function ModelBadge({ provider, model }: { provider: string; model: string }) {
  const label: Record<string, string> = {
    anthropic: 'Claude',
    openai: 'GPT',
    google: 'Gemini',
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex justify-center"
    >
      <span className="text-[10px] text-wm-muted bg-wm-surface border border-wm-border rounded-full px-3 py-0.5">
        {label[provider] ?? provider} · {model}
      </span>
    </motion.div>
  );
}

// ── Follow-up suggestion chips ────────────────────────────────────────────────

function getFollowUpSuggestions(tools: ToolEvent[], warehouse: string | null | undefined): string[] {
  const wh = warehouse ?? '';
  const suggestions: string[] = [];

  for (const tool of tools) {
    if (!tool.result || typeof tool.result !== 'object') continue;
    const r = tool.result as Record<string, unknown>;

    switch (tool.name) {
      case 'get_open_transfer_orders': {
        const orders = r.orders as Record<string, unknown>[] | undefined;
        if (orders?.length) {
          const mat = orders[0]?.material as string | undefined;
          if (mat && wh) suggestions.push(`Show stock for material ${mat} in warehouse ${wh}`);
          if (wh)        suggestions.push(`Confirm all open transfer orders in warehouse ${wh}`);
        } else {
          if (wh) suggestions.push(`Check replenishment needs for warehouse ${wh}`);
          if (wh) suggestions.push(`Show negative stock report for warehouse ${wh}`);
        }
        break;
      }
      case 'get_stock_for_material':
      case 'get_stock_by_type':
      case 'get_stock_aging': {
        const stock = r.stock as Record<string, unknown>[] | undefined;
        const mat = (stock?.[0]?.material ?? (tool.input as Record<string, unknown> | null)?.material) as string | undefined;
        if (mat && wh) suggestions.push(`Show open transfer orders for material ${mat} in warehouse ${wh}`);
        if (wh)        suggestions.push(`Check replenishment needs for warehouse ${wh}`);
        break;
      }
      case 'get_negative_stock_report': {
        const negs = r.negativeQuants as unknown[] | undefined;
        if (negs?.length) {
          if (wh) suggestions.push(`Show open transfer orders in warehouse ${wh}`);
          if (wh) suggestions.push(`Check WM/IM variance for warehouse ${wh}`);
        }
        break;
      }
      case 'get_replenishment_needs': {
        const bins = r.bins as unknown[] | undefined;
        if (bins?.length) {
          if (wh) suggestions.push(`Create replenishment transfer orders for warehouse ${wh}`);
          if (wh) suggestions.push(`Show bin utilization for warehouse ${wh}`);
        }
        break;
      }
      case 'get_bin_utilization':
      case 'find_empty_bins':
      case 'get_bin_status': {
        if (wh) suggestions.push(`Show replenishment needs for warehouse ${wh}`);
        if (wh) suggestions.push(`Show open transfer orders in warehouse ${wh}`);
        break;
      }
      case 'get_inventory_anomalies': {
        const anom = r.anomalies as unknown[] | undefined;
        if (anom?.length) {
          if (wh) suggestions.push(`Show WM/IM variance for warehouse ${wh}`);
          if (wh) suggestions.push(`Show negative stock report for warehouse ${wh}`);
        }
        break;
      }
      case 'get_wm_im_variance': {
        const vars = r.variances as unknown[] | undefined;
        if (vars?.length) {
          if (wh) suggestions.push(`Create cycle count documents for the top variance bins in warehouse ${wh}`);
          if (wh) suggestions.push(`Show negative stock report for warehouse ${wh}`);
        }
        break;
      }
      case 'confirm_transfer_order': {
        const mat = (tool.input as Record<string, unknown> | null)?.material as string | undefined;
        if (mat && wh) suggestions.push(`Show stock for material ${mat} in warehouse ${wh}`);
        if (wh)        suggestions.push(`Show remaining open transfer orders in warehouse ${wh}`);
        break;
      }
      case 'create_transfer_order': {
        const toNum = r.toNumber as string | undefined;
        if (toNum && wh) suggestions.push(`Confirm transfer order ${toNum} in warehouse ${wh}`);
        if (wh)          suggestions.push(`Show open transfer orders in warehouse ${wh}`);
        break;
      }
      case 'get_goods_receipt_monitor': {
        if (wh) suggestions.push(`Create putaway transfer orders for pending receipts in warehouse ${wh}`);
        if (wh) suggestions.push(`Show replenishment needs for warehouse ${wh}`);
        break;
      }
      case 'get_goods_issue_monitor': {
        if (wh) suggestions.push(`Show open transfer orders in warehouse ${wh}`);
        if (wh) suggestions.push(`Check negative stock in warehouse ${wh}`);
        break;
      }
      case 'get_cycle_count_candidates': {
        const cands = r.candidates as unknown[] | undefined;
        if (cands?.length && wh) {
          suggestions.push(`Create cycle count documents for the top candidates in warehouse ${wh}`);
          suggestions.push(`Show WM/IM variance for warehouse ${wh}`);
        }
        break;
      }
      case 'get_transfer_order_history':
      case 'get_transfer_requirements': {
        if (wh) suggestions.push(`Show open transfer orders in warehouse ${wh}`);
        break;
      }
    }
  }

  return [...new Set(suggestions)].slice(0, 3);
}

// ── Main Chat ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  msg: Message;
  toolEvents?: ToolEvent[];
  modelUsed?: { provider: string; model: string };
}

interface Props {
  conversationId: string | null;
  initialMessages: Message[];
  selectedProvider: string;
  selectedModel: string | null;
  warehouse?: string | null;
  conversationTitle?: string;
  autoQuery?: string;
  language?: string;
  onNew?: () => void;
  onTitleChange?: (title: string) => void;
  onResponseDone?: () => void;
}

export function Chat({
  conversationId,
  initialMessages,
  selectedProvider,
  selectedModel,
  warehouse,
  conversationTitle,
  autoQuery,
  language,
  onNew,
  onTitleChange,
  onResponseDone,
}: Props) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    initialMessages.map(msg => ({ msg })),
  );
  const [input, setInput] = useState('');

  // Auto-send when navigating from Dashboard "Ask AI" button
  useEffect(() => {
    if (autoQuery) handleSend(autoQuery);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingTools, setStreamingTools] = useState<ToolEvent[]>([]);
  const [currentModel, setCurrentModel] = useState<{ provider: string; model: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<{ message: string; meta?: ActionMeta } | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Smooth streaming render buffer — prevents burst "hit" effect
  const incomingBufRef = useRef('');          // text queued but not yet displayed
  const rafIdRef       = useRef<number | null>(null);
  const streamDoneRef  = useRef(false);
  const finalizeRef    = useRef<(() => void) | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<InstanceType<typeof window.SpeechRecognition> | null>(null);

  const voiceSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Stop recognition if the component unmounts mid-recording
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const toggleVoice = () => {
    if (!voiceSupported) return;
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    const SR = (window.SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition);
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'de' ? 'de-DE' : 'en-US';
    recognition.onstart  = () => setIsRecording(true);
    recognition.onend    = () => { setIsRecording(false); recognitionRef.current = null; };
    recognition.onerror  = () => { setIsRecording(false); recognitionRef.current = null; };
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript?.trim();
      if (transcript) setInput(prev => (prev ? prev + ' ' : '') + transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // Cancel RAF on unmount
  useEffect(() => {
    return () => { if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current); };
  }, []);

  // Sync external messages (when conversation switches)
  useEffect(() => {
    setChatMessages(initialMessages.map(msg => ({ msg })));
    setStreamingText('');
    setStreamingTools([]);
    setCurrentModel(null);
    incomingBufRef.current = '';
    streamDoneRef.current  = true;
    finalizeRef.current    = null;
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
  }, [conversationId]);

  // Auto-scroll — only when already near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, streamingText, streamingTools]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K — new conversation
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onNew?.();
        return;
      }
      // Escape — close shortcut overlay
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        return;
      }
      // ? — toggle shortcut overlay (only when not typing in an input/textarea)
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '?' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        setShowShortcuts(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNew]);

  const [lastQuery, setLastQuery] = useState('');

  /** Expand #TO_NUM and @MATERIAL shortcuts before sending. */
  const expandShortcuts = (raw: string): string => {
    const wh = warehouse ?? '';
    // #814 or #0000000814 → investigate that TO
    const toMatch = raw.match(/^#(\d+)\s*$/);
    if (toMatch) return `Show details for transfer order ${toMatch[1]} in warehouse ${wh}`;
    // @TG0001 → stock lookup
    const matMatch = raw.match(/^@(\S+)\s*$/);
    if (matMatch) return `Show stock for material ${matMatch[1]} in warehouse ${wh}`;
    return raw;
  };

  const handleSend = async (override?: string) => {
    const raw  = (override ?? input).trim();
    const text = expandShortcuts(raw);
    if (!text || isStreaming) return;

    setInput('');
    setLastQuery(raw);   // store the original (not expanded) for repeat
    setIsStreaming(true);
    setStreamingText('');
    setStreamingTools([]);
    setCurrentModel(null);

    // Reset streaming render buffer
    incomingBufRef.current = '';
    streamDoneRef.current  = false;
    finalizeRef.current    = null;
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }

    // Append user message immediately, then scroll to bottom unconditionally
    const userMsg: ChatMessage = { msg: { role: 'user', content: text, createdAt: new Date().toISOString() } };
    setChatMessages(prev => [...prev, userMsg]);
    setTimeout(() => scrollToBottom(), 0);

    // Abort controller for cancellation
    abortRef.current = new AbortController();

    // Accumulate streaming state
    let accText = '';
    const accTools: ToolEvent[] = [];
    let usedModel: { provider: string; model: string } | null = null;

    // Drain loop — runs each animation frame, emits chars at a steady rate
    const drainBuffer = () => {
      const remaining = incomingBufRef.current.length;
      if (remaining > 0) {
        // Catch up fast if buffer is large; smooth when nearly caught up
        const take = remaining > 120 ? Math.min(remaining, 12) : 3;
        const chunk = incomingBufRef.current.slice(0, take);
        incomingBufRef.current = incomingBufRef.current.slice(take);
        setStreamingText(cur => cur + chunk);
      }
      if (incomingBufRef.current.length > 0 || !streamDoneRef.current) {
        rafIdRef.current = requestAnimationFrame(drainBuffer);
      } else {
        // Buffer empty and stream complete — finalise
        rafIdRef.current = null;
        finalizeRef.current?.();
        finalizeRef.current = null;
      }
    };

    const startDrain = () => {
      if (!rafIdRef.current) rafIdRef.current = requestAnimationFrame(drainBuffer);
    };

    const { streamChat } = await import('../api/client');

    try {
      await streamChat(
        {
          conversationId: conversationId ?? undefined,
          message: text,
          provider: selectedProvider,
          model: selectedModel ?? undefined,
          language: language ?? undefined,
        },
        (event: StreamEvent) => {
          switch (event.type) {
            case 'model_used':
              usedModel = { provider: event.provider!, model: event.model! };
              setCurrentModel(usedModel);
              break;

            case 'text':
              accText += event.delta ?? '';
              incomingBufRef.current += event.delta ?? '';
              startDrain();
              break;

            case 'tool_start': {
              const existing = accTools.find(t => t.id === event.id);
              if (existing) {
                existing.input = event.input ?? null;
                existing.status = 'running';
              } else {
                accTools.push({
                  id:     event.id!,
                  name:   event.name!,
                  input:  event.input ?? null,
                  status: event.input ? 'running' : 'pending',
                });
              }
              setStreamingTools([...accTools]);
              break;
            }

            case 'tool_result': {
              const t = accTools.find(t => t.id === event.id);
              if (t) { t.result = event.result; t.status = 'done'; }
              setStreamingTools([...accTools]);
              break;
            }

            case 'tool_error': {
              const t = accTools.find(t => t.id === event.id);
              if (t) { t.error = event.error; t.status = 'error'; }
              setStreamingTools([...accTools]);
              break;
            }

            case 'error':
              toast(event.message ?? event.error ?? 'An error occurred', 'error');
              break;

            case 'done':
              // Mark stream complete; drain loop will call finalizeRef when buffer empties
              streamDoneRef.current = true;
              finalizeRef.current = () => {
                setChatMessages(prev => [
                  ...prev,
                  {
                    msg: { role: 'assistant', content: accText, createdAt: new Date().toISOString() },
                    toolEvents: [...accTools],
                    modelUsed: usedModel ?? undefined,
                  },
                ]);
                setStreamingText('');
                setStreamingTools([]);
                setIsStreaming(false); // keep streaming=true until drain finishes

                onResponseDone?.();

                // AI-generated title after first exchange
                if (conversationId && chatMessages.length === 0 && onTitleChange) {
                  generateConversationTitle(conversationId, text)
                    .then(({ title }) => onTitleChange(title))
                    .catch(() => {
                      const words = text.trim().split(/\s+/);
                      onTitleChange(words.slice(0, 7).join(' '));
                    });

                  // Auto-memory extraction — only when tools were called (real WM data)
                  if (accTools.length > 0) {
                    extractConversationMemory(conversationId)
                      .then(({ facts }) => {
                        if (facts.length > 0) {
                          toast(t('toast.memoryExtracted', { n: String(facts.length), s: facts.length !== 1 ? 's' : '' }));
                        }
                      })
                      .catch(() => {});
                  }
                }
              };
              // If no text came through (tool-only response), drain loop is not running
              if (!rafIdRef.current) {
                finalizeRef.current();
                finalizeRef.current = null;
              }
              break;
          }
        },
        abortRef.current.signal,
      );
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setChatMessages(prev => [
          ...prev,
          { msg: { role: 'assistant', content: `Error: ${(err as Error).message}` } },
        ]);
      }
    } finally {
      if (!streamDoneRef.current) {
        // Abort / error path: flush remaining buffer immediately so partial content shows,
        // then stop the drain loop — finalize will NOT be called.
        if (incomingBufRef.current.length > 0) {
          setStreamingText(cur => cur + incomingBufRef.current);
          incomingBufRef.current = '';
        }
        if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
        finalizeRef.current = null;
        setIsStreaming(false);
      }
      // Normal completion path: streamDoneRef.current is true, drain loop is still
      // running and will call finalizeRef (which calls setIsStreaming(false)) — do nothing here.
    }
  };

  const DESTRUCTIVE = /^(confirm|create|cancel|replenish)\b/i;

  const handleAction = (message: string, meta?: ActionMeta) => {
    if (isStreaming) return;
    if (DESTRUCTIVE.test(message.trim())) {
      setPendingAction({ message, meta });
    } else {
      handleSend(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // ↑ in empty input — recall last user message for editing
    if (e.key === 'ArrowUp' && !input.trim() && !isStreaming) {
      const lastUser = [...chatMessages].reverse().find(cm => cm.msg.role === 'user');
      if (lastUser) {
        e.preventDefault();
        setInput(lastUser.msg.content);
        // Move cursor to end after React renders
        setTimeout(() => {
          const el = textareaRef.current;
          if (el) { el.selectionStart = el.selectionEnd = el.value.length; }
        }, 0);
      }
    }
  };

  const isEmpty = chatMessages.length === 0 && !isStreaming;
  const [showTemplates, setShowTemplates] = useState(false);

  const handlePrint = () => {
    document.title = conversationTitle ?? 'WM Assistant — Conversation';
    window.print();
  };

  const TEMPLATES = [
    {
      icon: ClipboardList,
      label: t('tpl.shiftReports'),
      items: [
        { title: t('tpl.eosHandover'),   prompt: t('tpl.eosHandoverPrompt') },
        { title: t('tpl.dailyUtil'),     prompt: t('tpl.dailyUtilPrompt') },
        { title: t('tpl.grPutaway'),     prompt: t('tpl.grPutawayPrompt') },
      ],
    },
    {
      icon: SearchCheck,
      label: t('tpl.investigations'),
      items: [
        { title: t('tpl.traceMat'),       prompt: t('tpl.traceMatPrompt') },
        { title: t('tpl.explainNeg'),     prompt: t('tpl.explainNegPrompt') },
        { title: t('tpl.wmImDiff'),       prompt: t('tpl.wmImDiffPrompt') },
        { title: t('tpl.stuckTOs'),       prompt: t('tpl.stuckTOsPrompt') },
      ],
    },
    {
      icon: WrenchIcon,
      label: t('tpl.maintenance'),
      items: [
        { title: t('tpl.cycleCandidates'),  prompt: t('tpl.cycleCandidatesPrompt') },
        { title: t('tpl.replenPlan'),       prompt: t('tpl.replenPlanPrompt') },
        { title: t('tpl.capacityCheck'),    prompt: t('tpl.capacityCheckPrompt') },
      ],
    },
  ];

  const handleExport = async () => {
    const lines: string[] = [`# WM Assistant — Conversation export\n`];
    chatMessages.forEach(({ msg, toolEvents, modelUsed }) => {
      if (msg.role === 'user') {
        lines.push(`## You\n\n${msg.content}\n`);
      } else {
        const modelNote = modelUsed ? ` _(${modelUsed.provider} · ${modelUsed.model})_` : '';
        lines.push(`## Assistant${modelNote}\n`);
        if (toolEvents && toolEvents.length > 0) {
          toolEvents.forEach(t => {
            lines.push(`> 🔧 \`${t.name}\`\n`);
            if (t.result) {
              lines.push(`\`\`\`json\n${JSON.stringify(t.result, null, 2)}\n\`\`\`\n`);
            }
          });
        }
        if (msg.content) lines.push(`\n${msg.content}\n`);
      }
    });
    const content = lines.join('\n');
    const filename = `wm-conversation-${new Date().toISOString().slice(0, 10)}.md`;

    // Use File System Access API (Save As dialog) when available — Chrome/Edge
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Markdown file', accept: { 'text/markdown': ['.md'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        toast(t('toast.exportedMd'));
        return;
      } catch {
        // User cancelled the dialog — do nothing
        return;
      }
    }

    // Fallback — direct download to browser's Downloads folder
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported as Markdown');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative chat-outer">

      {/* Message area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-5 relative chat-scroll"
      >
        {/* Print header — only visible when printing */}
        <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-300">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">RELACON WM Assistant</p>
          <h1 className="text-xl font-semibold text-gray-900">{conversationTitle ?? 'Conversation'}</h1>
          <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Export + Print buttons — top-right, only when there are messages */}
        {!isEmpty && (
          <div className="flex justify-end gap-1 mb-1 no-print">
            <button
              onClick={handlePrint}
              title={t('chat.printTitle')}
              className="flex items-center gap-1.5 text-[11px] text-wm-muted hover:text-wm-text transition-colors px-2 py-1 rounded-lg hover:bg-wm-surface-2"
            >
              <Printer size={11} />
              {t('chat.print')}
            </button>
            <button
              onClick={handleExport}
              title={t('chat.exportTitle')}
              className="flex items-center gap-1.5 text-[11px] text-wm-muted hover:text-wm-text transition-colors px-2 py-1 rounded-lg hover:bg-wm-surface-2"
            >
              <Download size={11} />
              {t('chat.export')}
            </button>
          </div>
        )}

        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="flex flex-col items-center text-center gap-4 pt-10 pb-12"
          >
            <div className="w-14 h-14 rounded-2xl bg-wm-primary/20 border border-wm-primary/30 flex items-center justify-center overflow-visible">
              <Relacottchen size={38} className="text-wm-accent" interactive />
            </div>
            <div>
              <p className="text-wm-text font-semibold text-lg">{t('chat.welcomeTitle')}</p>
              <p className="text-wm-muted text-sm mt-1">
                {t('chat.welcomeSub')}
              </p>
            </div>

            {/* Morning Shift Check — primary CTA */}
            <motion.button
              onClick={() => handleSend(t('chat.morningShiftQuery'))}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-wm-primary/20 border border-wm-primary/50 hover:bg-wm-primary/30 hover:border-wm-primary transition-colors group"
            >
              <Sunrise size={18} className="text-wm-accent flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-wm-text group-hover:text-white transition-colors">{t('chat.morningShift')}</p>
                <p className="text-[11px] text-wm-muted">{t('chat.morningShiftSub')}</p>
              </div>
            </motion.button>

            {/* Quick action groups */}
            <div className="w-full max-w-lg grid grid-cols-3 gap-3 mt-1">
              {[
                {
                  icon: PackageCheck,
                  label: t('chat.group.orders'),
                  actions: [
                    t('chat.action.openTOs'),
                    t('chat.action.oldTOs'),
                    t('chat.action.grPending'),
                  ],
                },
                {
                  icon: Boxes,
                  label: t('chat.group.stock'),
                  actions: [
                    t('chat.action.anomalies'),
                    t('chat.action.negStock'),
                    t('chat.action.aging'),
                  ],
                },
                {
                  icon: RefreshCw,
                  label: t('chat.group.bins'),
                  actions: [
                    t('chat.action.replenish'),
                    t('chat.action.emptyBins'),
                    t('chat.action.util'),
                  ],
                },
              ].map(({ icon: Icon, label, actions }) => (
                <div key={label} className="flex flex-col gap-1.5 bg-wm-surface border border-wm-border rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon size={12} className="text-wm-accent flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-wm-muted uppercase tracking-wide">{label}</span>
                  </div>
                  {actions.map(q => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-left text-xs text-wm-text-dim hover:text-wm-text hover:bg-wm-surface-2 rounded-lg px-2 py-1.5 transition-colors leading-snug [overflow-wrap:anywhere]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Templates toggle */}
            <button
              onClick={() => setShowTemplates(v => !v)}
              className="flex items-center gap-1.5 text-xs text-wm-muted hover:text-wm-accent transition-colors mt-1"
            >
              <FileText size={12} />
              {showTemplates ? t('chat.hideTemplates') : t('chat.browseTemplates')}
              <ChevronDown size={11} className={clsx('transition-transform', showTemplates && 'rotate-180')} />
            </button>

            {/* Templates panel */}
            <AnimatePresence>
              {showTemplates && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="w-full max-w-lg overflow-hidden"
                >
                  <div className="flex flex-col gap-3 pt-1">
                    {TEMPLATES.map(({ icon: Icon, label, items }) => (
                      <div key={label} className="bg-wm-surface border border-wm-border rounded-xl p-3 text-left">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Icon size={12} className="text-wm-accent flex-shrink-0" />
                          <span className="text-[10px] font-semibold text-wm-muted uppercase tracking-wide">{label}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {items.map(t => (
                            <button
                              key={t.title}
                              onClick={() => {
                                setInput(t.prompt);
                                setShowTemplates(false);
                                setTimeout(() => textareaRef.current?.focus(), 50);
                              }}
                              className="text-left rounded-lg px-2 py-2 hover:bg-wm-surface-2 transition-colors group/tpl"
                            >
                              <p className="text-xs font-medium text-wm-text group-hover/tpl:text-wm-accent transition-colors">{t.title}</p>
                              <p className="text-[11px] text-wm-muted mt-0.5 leading-snug line-clamp-2">{t.prompt}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Rendered messages */}
        {chatMessages.map((cm, i) => (
          <div key={i} className="space-y-1">
            {cm.modelUsed && cm.msg.role === 'assistant' && (
              <ModelBadge provider={cm.modelUsed.provider} model={cm.modelUsed.model} />
            )}
            <MessageBubble msg={cm.msg} toolEvents={cm.toolEvents} warehouse={warehouse} onAction={handleAction} />
          </div>
        ))}

        {/* Follow-up suggestion chips — shown after the last assistant tool response */}
        {(() => {
          if (isStreaming) return null;
          const last = chatMessages[chatMessages.length - 1];
          if (!last || last.msg.role !== 'assistant' || !last.toolEvents?.length) return null;
          const chips = getFollowUpSuggestions(last.toolEvents, warehouse);
          if (!chips.length) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="flex flex-col gap-2 no-print"
            >
              <span className="text-[10px] text-wm-muted pl-10">{t('chat.followUpLabel')}</span>
              <div className="flex flex-wrap gap-2 pl-10">
                {chips.map(chip => (
                  <button
                    key={chip}
                    onClick={() => handleSend(chip)}
                    className="text-[11px] text-wm-text-dim border border-wm-border rounded-lg px-3 py-1.5 hover:bg-wm-surface-2 hover:border-wm-border-hover hover:text-wm-text transition-colors text-left"
                  >
                    {chip} →
                  </button>
                ))}
              </div>
            </motion.div>
          );
        })()}

        {/* Streaming assistant response */}
        {isStreaming && (
          <div className="space-y-1">
            {currentModel && (
              <ModelBadge provider={currentModel.provider} model={currentModel.model} />
            )}

            {/* Working animation — visible only before any content arrives */}
            <AnimatePresence>
              {!streamingText && streamingTools.length === 0 && (
                <WorkingRelacottchen />
              )}
            </AnimatePresence>

            {/* Actual streamed content */}
            {(streamingText || streamingTools.length > 0) && (
              <MessageBubble
                msg={{ role: 'assistant', content: streamingText }}
                toolEvents={streamingTools}
                warehouse={warehouse}
                isStreaming
                onAction={handleAction}
              />
            )}
          </div>
        )}

        <div ref={bottomRef} />

        {/* Scroll-to-bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={scrollToBottom}
              title={t('chat.scrollToBottom')}
              className="no-print sticky bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-wm-surface border border-wm-border-hover shadow-lg text-wm-muted hover:text-wm-text hover:bg-wm-surface-2 transition-colors"
            >
              <ChevronDown size={15} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Pre-flight confirmation — structured action card */}
      <AnimatePresence>
        {pendingAction && (() => {
          const { message, meta } = pendingAction;
          const GI_TYPES = new Set(['916', '999', '998']);
          const isGiRisk = meta?.sourceType && GI_TYPES.has(String(meta.sourceType));
          const isCancelOp = /^cancel\b/i.test(message.trim());

          // Derive a human-readable action label + icon from the message
          const actionInfo: { label: string; icon: React.ReactNode; danger: boolean } = (() => {
            const m = message.trim().toLowerCase();
            if (/^confirm\b/.test(m))    return { label: t('chat.actionConfirmTO'),   icon: <ClipboardCheck size={14} />, danger: false };
            if (/^create replenish/i.test(m)) return { label: t('chat.actionReplenish'),   icon: <Repeat2 size={14} />,       danger: false };
            if (/^create.*transfer/i.test(m)) return { label: t('chat.actionCreateTO'),    icon: <PackageCheck size={14} />,  danger: false };
            if (/^create.*cycle|count/i.test(m)) return { label: t('chat.actionCreateCount'), icon: <ClipboardList size={14} />, danger: false };
            if (/^cancel\b/.test(m))     return { label: t('chat.actionCancelTO'),    icon: <PackageX size={14} />,      danger: true  };
            return                              { label: t('chat.actionGeneric'),      icon: <Play size={14} />,          danger: false };
          })();

          const isDanger = isGiRisk || isCancelOp || actionInfo.danger;

          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
              className={clsx(
                'mx-4 mb-2 rounded-xl border overflow-hidden',
                isDanger ? 'border-red-500/40' : 'border-wm-border-hover',
              )}
            >
              {/* Card header — action type */}
              <div className={clsx(
                'flex items-center gap-2 px-4 py-2.5',
                isDanger ? 'bg-red-500/10' : 'bg-wm-surface-2',
              )}>
                <span className={clsx('flex-shrink-0', isDanger ? 'text-red-500' : 'text-yellow-500')}>
                  {actionInfo.icon}
                </span>
                <span className="text-xs font-semibold text-wm-text">{actionInfo.label}</span>
                {isDanger && (
                  <AlertTriangle size={12} className="ml-auto text-red-500 flex-shrink-0" />
                )}
              </div>

              {/* Meta table — structured details */}
              {meta && (meta.material || meta.sourceBin || meta.qty != null) && (
                <div className="px-4 py-2.5 bg-wm-surface border-t border-wm-border/60">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {meta.material && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-wm-muted uppercase tracking-wide w-14 flex-shrink-0">{t('chat.metaMaterial')}</span>
                        <span className="text-[11px] font-mono text-wm-text">{meta.material}</span>
                      </div>
                    )}
                    {meta.qty != null && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-wm-muted uppercase tracking-wide w-14 flex-shrink-0">{t('chat.metaQty')}</span>
                        <span className="text-[11px] font-mono text-wm-text">{meta.qty} {meta.uom}</span>
                      </div>
                    )}
                    {meta.sourceBin && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-wm-muted uppercase tracking-wide w-14 flex-shrink-0">{t('chat.metaFrom')}</span>
                        <span className="text-[11px] font-mono text-wm-text">{meta.sourceType} / {meta.sourceBin}</span>
                      </div>
                    )}
                    {meta.destBin && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-wm-muted uppercase tracking-wide w-14 flex-shrink-0">{t('chat.metaTo')}</span>
                        <span className="text-[11px] font-mono text-wm-text">{meta.destType} / {meta.destBin}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* GI risk / cancel warning */}
              {(isGiRisk || isCancelOp) && (
                <div className="px-4 py-2 bg-red-500/5 border-t border-red-500/20">
                  <p className="text-[11px] text-red-500">
                    {isGiRisk
                      ? t('chat.giRiskWarning', { type: String(meta!.sourceType) })
                      : t('chat.cancelWarning')}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className={clsx(
                'flex items-center justify-end gap-2 px-4 py-2.5 border-t',
                isDanger ? 'border-red-500/20 bg-red-500/5' : 'border-wm-border/60 bg-wm-surface',
              )}>
                <p className="text-[10px] text-wm-muted flex-1 truncate">{message}</p>
                <button
                  onClick={() => setPendingAction(null)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-wm-surface-2 border border-wm-border text-wm-muted hover:text-wm-text transition-colors flex-shrink-0"
                >
                  {t('chat.cancel')}
                </button>
                <button
                  onClick={() => { const msg = message; setPendingAction(null); handleSend(msg); }}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-lg text-white transition-colors flex items-center gap-1.5 flex-shrink-0',
                    isDanger ? 'bg-red-700 hover:bg-red-600' : 'bg-wm-primary hover:bg-wm-primary-hover',
                  )}
                >
                  <Play size={10} />
                  {isDanger ? t('chat.confirmAnyway') : t('chat.confirmOk')}
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Input bar */}
      <div className="px-4 py-4 border-t border-wm-border bg-wm-surface no-print">
        <div className="flex items-end gap-2 bg-wm-surface-2 border border-wm-border rounded-2xl px-4 py-2 focus-within:border-wm-border-hover transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 bg-transparent text-wm-text text-sm placeholder-wm-muted resize-none outline-none leading-relaxed max-h-40 py-1"
          />
          {lastQuery && !isStreaming && (
            <motion.button
              onClick={() => handleSend(lastQuery)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              title={t('chat.repeatQuery')}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 text-wm-muted hover:text-wm-text hover:bg-wm-surface transition-colors"
            >
              <RotateCcw size={14} />
            </motion.button>
          )}
          {voiceSupported && !isStreaming && (
            <motion.button
              onClick={toggleVoice}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              title={isRecording ? t('chat.voiceStop') : t('chat.voiceStart')}
              className={clsx(
                'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-colors',
                isRecording
                  ? 'bg-red-500/20 border border-red-500/50 text-red-500 animate-pulse'
                  : 'text-wm-muted hover:text-wm-text hover:bg-wm-surface',
              )}
            >
              {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
            </motion.button>
          )}
          {isStreaming ? (
            <motion.button
              onClick={() => abortRef.current?.abort()}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 bg-red-500/20 border border-red-500/50 hover:bg-red-500/40 text-red-600 transition-colors"
            >
              <Square size={12} fill="currentColor" />
            </motion.button>
          ) : (
            <motion.button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              whileHover={input.trim() ? { scale: 1.08 } : {}}
              whileTap={input.trim() ? { scale: 0.93 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={clsx(
                'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-colors',
                input.trim()
                  ? 'bg-wm-primary hover:bg-wm-primary-hover text-white'
                  : 'bg-wm-border text-wm-muted cursor-not-allowed',
              )}
            >
              <Send size={14} />
            </motion.button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <p className="text-[10px] text-wm-muted">
            {input.startsWith('#') || input.startsWith('@')
              ? <span className="text-wm-accent">{t('chat.shortcutHint')}</span>
              : t('chat.inputHint')}
          </p>
          <button
            onClick={() => setShowShortcuts(v => !v)}
            title={t('chat.shortcutsTitle')}
            className="flex items-center gap-1 text-[10px] text-wm-muted hover:text-wm-accent transition-colors"
          >
            <Keyboard size={11} />
            <span>?</span>
          </button>
        </div>
      </div>
      {/* Keyboard shortcut overlay */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
              onClick={e => e.stopPropagation()}
              className="bg-wm-surface border border-wm-border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Keyboard size={15} className="text-wm-accent" />
                  <h2 className="text-sm font-semibold text-wm-text">{t('shortcut.title')}</h2>
                </div>
                <button onClick={() => setShowShortcuts(false)} className="text-wm-muted hover:text-wm-text transition-colors">
                  <X size={14} />
                </button>
              </div>

              {[
                {
                  group: t('shortcut.group.conv'),
                  items: [
                    { keys: ['Ctrl', 'K'], desc: t('shortcut.newConv') },
                    { keys: ['↑'], desc: t('shortcut.recallLast') },
                  ],
                },
                {
                  group: t('shortcut.group.input'),
                  items: [
                    { keys: ['Enter'], desc: t('shortcut.send') },
                    { keys: ['Shift', 'Enter'], desc: t('shortcut.newLine') },
                  ],
                },
                {
                  group: t('shortcut.group.general'),
                  items: [
                    { keys: ['d'], desc: t('shortcut.dashboard') },
                    { keys: ['?'], desc: t('shortcut.toggleCheat') },
                    { keys: ['Esc'], desc: t('shortcut.closeOverlay') },
                  ],
                },
              ].map(({ group, items }) => (
                <div key={group} className="mb-4 last:mb-0">
                  <p className="text-[10px] font-semibold text-wm-muted uppercase tracking-wide mb-2">{group}</p>
                  <div className="flex flex-col gap-1.5">
                    {items.map(({ keys, desc }) => (
                      <div key={desc} className="flex items-center justify-between">
                        <span className="text-xs text-wm-text-dim">{desc}</span>
                        <div className="flex items-center gap-1">
                          {keys.map((k, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <kbd className="px-1.5 py-0.5 rounded bg-wm-surface-2 border border-wm-border text-[11px] font-mono text-wm-text">{k}</kbd>
                              {i < keys.length - 1 && <span className="text-[10px] text-wm-muted">+</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
