export interface Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface ToolEvent {
  id: string;
  name: string;
  input: Record<string, unknown> | null;
  result?: unknown;
  error?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface StreamEvent {
  type: 'text' | 'tool_start' | 'tool_result' | 'tool_error' | 'model_used' | 'done' | 'error';
  delta?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  message?: string;
  provider?: string;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}

export interface ProviderModel {
  id: string;
  label: string;
  tier: 'premium' | 'standard' | 'fast';
}

export interface Provider {
  id: string;
  name: string;
  vendor: string;
  models: ProviderModel[];
  keyHint: string;
  docsUrl: string;
  connected: boolean;
  isCustom?: boolean;
  baseUrl?: string;
  customModel?: string;
}

export interface Project {
  name: string;
  instructions: string;
}

export interface MemoryFact {
  id: string;
  text: string;
  createdAt: string;
}

export interface ModelSelection {
  provider: string;
  model: string;
}
