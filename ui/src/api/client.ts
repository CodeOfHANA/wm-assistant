import type {
  Provider, Project, MemoryFact, ConversationSummary,
  Conversation, StreamEvent, ModelSelection,
} from '../types';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function del(path: string): Promise<void> {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
}

// ── Providers ─────────────────────────────────────────────────────────────────

export const getProviders = () => get<Provider[]>('/providers');

export const connectProvider = (id: string, apiKey: string) =>
  post(`/providers/${id}/connect`, { apiKey });

export const disconnectProvider = (id: string) =>
  del(`/providers/${id}`);

export interface CustomProviderInput {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const addCustomProvider = (data: CustomProviderInput) =>
  post<{ id: string; name: string; baseUrl: string; model: string }>('/providers/custom', data);

export const removeCustomProvider = (id: string) =>
  del(`/providers/custom/${id}`);

// ── Project ───────────────────────────────────────────────────────────────────

export const getProject = () => get<Project>('/project');

export const updateProject = (data: Partial<Project>) =>
  put<Project>('/project', data);

// ── Memory ────────────────────────────────────────────────────────────────────

export const getMemory = () =>
  get<{ facts: MemoryFact[] }>('/memory');

export const addMemoryFact = (text: string) =>
  post<MemoryFact>('/memory', { text });

export const deleteMemoryFact = (id: string) =>
  del(`/memory/${id}`);

// ── Conversations ─────────────────────────────────────────────────────────────

export const listConversations = () =>
  get<ConversationSummary[]>('/conversations');

export const createConversation = (title?: string) =>
  post<Conversation>('/conversations', { title });

export const getConversation = (id: string) =>
  get<Conversation>(`/conversations/${id}`);

export const deleteConversation = (id: string) =>
  del(`/conversations/${id}`);

export const renameConversation = (id: string, title: string) =>
  put<ConversationSummary>(`/conversations/${id}`, { title });

export const generateConversationTitle = (id: string, message: string) =>
  post<{ title: string }>(`/conversations/${id}/generate-title`, { message });

// ── Material stock summary ────────────────────────────────────────────────────

export interface MaterialStock {
  material: string;
  total: number;
  available: number;
  bins: number;
  uom: string;
}

export const getMaterialStock = (warehouse: string, material: string) =>
  get<MaterialStock>(`/material-stock?warehouse=${encodeURIComponent(warehouse)}&material=${encodeURIComponent(material)}`);

// ── Shift stats ───────────────────────────────────────────────────────────────

export interface ShiftStats {
  openTOs: number | null;
  negativeQuants: number | null;
  replenishmentNeeds: number | null;
}

export const getShiftStats = (warehouse: string) =>
  get<ShiftStats>(`/stats?warehouse=${encodeURIComponent(warehouse)}`);

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardToRow {
  toNumber: string;
  toItem?: string;
  status?: string;
  ageFlag?: string;
  daysSinceCreation?: number | null;
  material?: string;
  sourceType?: string;
  sourceBin?: string;
  destType?: string;
  destBin?: string;
  openQty?: number;
  uom?: string;
}

export interface DashboardNegQuant {
  material?: string;
  storageType?: string;
  bin?: string;
  qty?: number;
  plant?: string;
}

export interface DashboardReplenBin {
  bin?: string;
  storageType?: string;
  material?: string;
  currentQty?: number;
  replenishmentQty?: number;
  uom?: string;
}

export interface DashboardUtilRow {
  storageType?: string;
  usedBins?: number;
  totalBins?: number;
  emptyBins?: number;
  utilization?: number;
}

export interface DashboardAnomaly {
  type?: string;
  material?: string;
  description?: string;
  severity?: string;
}

export interface DashboardData {
  fetchedAt: string;
  warehouse: string;
  openTOs:       { count: number | null; topOrders: DashboardToRow[] };
  negativeStock: { count: number | null; items: DashboardNegQuant[] };
  replenishment: { count: number | null; bins: DashboardReplenBin[] };
  utilization:   { byStorageType: DashboardUtilRow[] };
  anomalies:     { count: number | null; items: DashboardAnomaly[] };
  grPending:     { count: number | null };
  giPending:     { count: number | null };
}

export const getDashboard = (warehouse: string) =>
  get<DashboardData>(`/dashboard?warehouse=${encodeURIComponent(warehouse)}`);

// ── Auto-select preview ───────────────────────────────────────────────────────

export const getAutoSelect = (message: string) =>
  post<ModelSelection | { error: string }>('/auto-select', { message });

// ── Chat (streaming SSE) ──────────────────────────────────────────────────────

export interface ChatRequest {
  conversationId?: string;
  message: string;
  provider?: string;
  model?: string;
  language?: string;
}

/**
 * Sends a chat request and calls `onEvent` for each SSE event.
 * Returns when the stream ends.
 */
export async function streamChat(
  req: ChatRequest,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event: StreamEvent = JSON.parse(line.slice(6));
        onEvent(event);
        if (event.type === 'done' || event.type === 'error') return;
      } catch {
        // malformed line — skip
      }
    }
  }
}
