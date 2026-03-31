import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronDown, Wrench, AlertCircle, User, Bot } from 'lucide-react';
import { clsx } from 'clsx';
import type { Message, ToolEvent, StreamEvent } from '../types';
import { ToolResultCard } from './ToolResultCard';

// ── Tool Call Card ─────────────────────────────────────────────────────────────

function ToolCard({ tool }: { tool: ToolEvent }) {
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
          <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="w-3 h-3 border border-wm-accent border-t-transparent rounded-full flex-shrink-0"
          />
        )}
        <span className="font-mono text-wm-muted">{tool.name}</span>
        {tool.input && (
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
        {isError && <span className="ml-auto text-red-400">{tool.error}</span>}
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
            <div className="px-3 pb-3 max-h-80 overflow-y-auto">
              <ToolResultCard toolName={tool.name} result={tool.result} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  msg, toolEvents, isStreaming,
}: {
  msg: Message;
  toolEvents?: ToolEvent[];
  isStreaming?: boolean;
}) {
  const isUser = msg.role === 'user';
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
          ? <User size={13} className="text-white" />
          : <Bot  size={13} className="text-white" />}
      </div>

      {/* Content */}
      <div className={clsx('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        {/* Tool calls (assistant only) */}
        {!isUser && toolEvents && toolEvents.length > 0 && (
          <div className="w-full">
            {toolEvents.map(t => <ToolCard key={t.id} tool={t} />)}
          </div>
        )}

        {/* Text bubble */}
        {(msg.content || isStreaming) && (
          <div className={clsx(
            'px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words max-w-xl',
            isUser
              ? 'bg-wm-primary text-wm-text rounded-tr-sm'
              : 'bg-wm-surface border border-wm-border text-wm-text rounded-tl-sm',
            isStreaming && !msg.content && 'min-h-[36px]',
          )}>
            <span className={clsx(isStreaming && 'streaming-cursor')}>
              {msg.content || ' '}
            </span>
          </div>
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
  onTitleChange?: (title: string) => void;
}

export function Chat({
  conversationId,
  initialMessages,
  selectedProvider,
  selectedModel,
  onTitleChange,
}: Props) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    initialMessages.map(msg => ({ msg })),
  );
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingTools, setStreamingTools] = useState<ToolEvent[]>([]);
  const [currentModel, setCurrentModel] = useState<{ provider: string; model: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external messages (when conversation switches)
  useEffect(() => {
    setChatMessages(initialMessages.map(msg => ({ msg })));
    setStreamingText('');
    setStreamingTools([]);
    setCurrentModel(null);
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText, streamingTools]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput('');
    setIsStreaming(true);
    setStreamingText('');
    setStreamingTools([]);
    setCurrentModel(null);

    // Append user message immediately
    const userMsg: ChatMessage = { msg: { role: 'user', content: text } };
    setChatMessages(prev => [...prev, userMsg]);

    // Abort controller for cancellation
    abortRef.current = new AbortController();

    // Accumulate streaming state
    let accText = '';
    const accTools: ToolEvent[] = [];
    let usedModel: { provider: string; model: string } | null = null;

    const { streamChat } = await import('../api/client');

    try {
      await streamChat(
        {
          conversationId: conversationId ?? undefined,
          message: text,
          provider: selectedProvider,
          model: selectedModel ?? undefined,
        },
        (event: StreamEvent) => {
          switch (event.type) {
            case 'model_used':
              usedModel = { provider: event.provider!, model: event.model! };
              setCurrentModel(usedModel);
              break;

            case 'text':
              accText += event.delta ?? '';
              setStreamingText(accText);
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

            case 'done':
              // Finalise — move streaming state into messages
              setChatMessages(prev => [
                ...prev,
                {
                  msg: { role: 'assistant', content: accText },
                  toolEvents: [...accTools],
                  modelUsed: usedModel ?? undefined,
                },
              ]);
              setStreamingText('');
              setStreamingTools([]);

              // Auto-title first message
              if (onTitleChange && chatMessages.length === 0) {
                onTitleChange(text.slice(0, 60));
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
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = chatMessages.length === 0 && !isStreaming;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="flex flex-col items-center justify-center h-full text-center gap-3 pb-20"
          >
            <div className="w-14 h-14 rounded-2xl bg-wm-primary/20 border border-wm-primary/30 flex items-center justify-center">
              <Bot size={24} className="text-wm-primary" />
            </div>
            <p className="text-wm-text font-semibold text-lg">What's happening in the warehouse?</p>
            <p className="text-wm-muted text-sm max-w-sm">
              Ask about bins, stock, transfer orders, anomalies, or anything in your SAP WM system.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                'Show open transfer orders',
                'Any inventory anomalies?',
                'Which bins need replenishment?',
                'Find empty bins in type 003',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="text-xs px-3 py-1.5 rounded-full bg-wm-surface border border-wm-border text-wm-muted hover:text-wm-text hover:border-wm-border-hover transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Rendered messages */}
        {chatMessages.map((cm, i) => (
          <div key={i} className="space-y-1">
            {cm.modelUsed && cm.msg.role === 'assistant' && (
              <ModelBadge provider={cm.modelUsed.provider} model={cm.modelUsed.model} />
            )}
            <MessageBubble msg={cm.msg} toolEvents={cm.toolEvents} />
          </div>
        ))}

        {/* Streaming assistant response */}
        {isStreaming && (
          <div className="space-y-1">
            {currentModel && (
              <ModelBadge provider={currentModel.provider} model={currentModel.model} />
            )}
            <MessageBubble
              msg={{ role: 'assistant', content: streamingText }}
              toolEvents={streamingTools}
              isStreaming
            />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 py-4 border-t border-wm-border bg-wm-surface">
        <div className="flex items-end gap-2 bg-wm-surface-2 border border-wm-border rounded-2xl px-4 py-2 focus-within:border-wm-border-hover transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your warehouse..."
            rows={1}
            className="flex-1 bg-transparent text-wm-text text-sm placeholder-wm-muted resize-none outline-none leading-relaxed max-h-40 py-1"
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            whileHover={input.trim() && !isStreaming ? { scale: 1.08 } : {}}
            whileTap={input.trim() && !isStreaming ? { scale: 0.93 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={clsx(
              'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-colors',
              input.trim() && !isStreaming
                ? 'bg-wm-primary hover:bg-wm-primary-hover text-white'
                : 'bg-wm-border text-wm-muted cursor-not-allowed',
            )}
          >
            <Send size={14} />
          </motion.button>
        </div>
        <p className="text-[10px] text-wm-muted mt-1.5 px-1">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
