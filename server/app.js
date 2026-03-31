import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { streamChat, autoSelectModel, generateTitle } from './aiRouter.js';
import { getKey, setKey, removeKey, getProviderStatus, addCustomProvider, removeCustomProvider } from './providerStore.js';
import { getMcpTools, callMcpTool } from './mcpClient.js';
import {
  getProject, saveProject,
  getMemory, addMemoryFact, deleteMemoryFact,
  listConversations, getConversation, createConversation, saveConversation, deleteConversation,
} from './store/index.js';

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ── Fixed base system context (always sent, not user-editable) ────────────────
// Covers role, tool catalog, and behaviour rules.
// SAP system specifics (warehouse, plant, etc.) belong in user project instructions.

const BASE_SYSTEM_PROMPT = `You are WM Assistant — an AI assistant for SAP Classic Warehouse Management (LE-WM), developed by RELACON IT Consulting GmbH.

## Identity
When asked who you are, what you are, or who made/built/developed you, always respond along these lines:
"I'm WM Assistant, an AI assistant for SAP Classic Warehouse Management, developed by RELACON IT Consulting GmbH."
You may then describe your capabilities. Never claim to be Claude, GPT, Gemini, or any other underlying model — you are WM Assistant by RELACON.

You have tools that connect directly to a live S/4HANA system. They are organised as follows:

**Bins & capacity**
get_bin_status · find_empty_bins · get_bin_utilization

**Stock**
get_stock_for_material · get_stock_by_type · get_stock_aging · get_negative_stock_report · get_quant_fragmentation

**Transfer orders & requirements**
get_open_transfer_orders · get_transfer_order_history · get_transfer_requirements
create_transfer_order · confirm_transfer_order · confirm_transfer_order_su · cancel_transfer_order

**Goods movements**
get_goods_receipt_monitor · get_goods_issue_monitor · get_unresolved_su_negatives · get_interim_zone_anomalies

**Analytics & reconciliation**
get_wm_im_variance · get_replenishment_needs · get_inventory_anomalies

**Cycle counting**
get_cycle_count_candidates · create_cycle_count_document

## Behaviour
- Always use tools to answer warehouse questions — never guess or fabricate SAP data.
- Required parameters (warehouse number, plant, material) must come from the user's configuration below or from what the user states in the conversation. If they are missing, ask for them before calling the tool.
- After a tool call, lead with the key insight — do not list every row verbatim.
- Chain multiple tools without pausing when a question requires it (e.g. check open TOs then check stock for the same material).
- For write operations (create / confirm / cancel TO, create inventory document): confirm with the user before executing unless they have explicitly requested it in the same message.
- If a tool returns an empty result, say so clearly and suggest what to check next.`;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001'] }));
app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

// ── MCP Tools (read-only, for UI to display available tools) ──────────────────

app.get('/api/tools', async (_req, res) => {
  try {
    const tools = await getMcpTools();
    res.json(tools.map(t => ({ name: t.name, description: t.description })));
  } catch (err) {
    res.status(503).json({ error: 'MCP server unavailable', detail: err.message });
  }
});

// ── Providers ─────────────────────────────────────────────────────────────────

app.get('/api/providers', (_req, res) => {
  res.json(getProviderStatus());
});

app.post('/api/providers/:id/connect', (req, res) => {
  const { id } = req.params;
  const { apiKey } = req.body;
  if (!apiKey?.trim()) return res.status(400).json({ error: 'apiKey required' });
  setKey(id, apiKey.trim());
  res.json({ ok: true, connected: true });
});

app.delete('/api/providers/:id', (req, res) => {
  removeKey(req.params.id);
  res.json({ ok: true, connected: false });
});

// ── Custom (OpenAI-compatible) providers ──────────────────────────────────────

app.post('/api/providers/custom', (req, res) => {
  const { name, baseUrl, model, apiKey } = req.body;
  if (!name?.trim())    return res.status(400).json({ error: 'name required' });
  if (!baseUrl?.trim()) return res.status(400).json({ error: 'baseUrl required' });
  if (!model?.trim())   return res.status(400).json({ error: 'model required' });
  if (!apiKey?.trim())  return res.status(400).json({ error: 'apiKey required' });
  const entry = addCustomProvider({
    name: name.trim(), baseUrl: baseUrl.trim(), model: model.trim(), key: apiKey.trim(),
  });
  res.json(entry);
});

app.delete('/api/providers/custom/:id', (req, res) => {
  removeCustomProvider(req.params.id);
  res.json({ ok: true });
});

// ── Project settings ──────────────────────────────────────────────────────────

app.get('/api/project', (_req, res) => res.json(getProject()));

app.put('/api/project', (req, res) => {
  const { name, instructions } = req.body;
  saveProject({ ...(name !== undefined && { name }), ...(instructions !== undefined && { instructions }) });
  res.json(getProject());
});

// ── Memory ────────────────────────────────────────────────────────────────────

app.get('/api/memory', (_req, res) => res.json(getMemory()));

app.post('/api/memory', (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  res.json(addMemoryFact(text.trim()));
});

app.delete('/api/memory/:id', (req, res) => {
  deleteMemoryFact(req.params.id);
  res.json({ ok: true });
});

// ── Conversations ─────────────────────────────────────────────────────────────

app.get('/api/conversations', (_req, res) => res.json(listConversations()));

app.post('/api/conversations', (req, res) => {
  const { title } = req.body;
  res.json(createConversation(title));
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json(conv);
});

app.patch('/api/conversations/:id', (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json(saveConversation({ ...conv, ...req.body }));
});

app.delete('/api/conversations/:id', (req, res) => {
  deleteConversation(req.params.id);
  res.json({ ok: true });
});

// ── Chat (streaming SSE) ──────────────────────────────────────────────────────
//
// Body: { conversationId?, message, provider?, model? }
//   conversationId  — if provided, loads + saves history. If omitted, stateless.
//   message         — the new user message text
//   provider        — 'anthropic' | 'openai' | 'google' | 'auto' (default: auto)
//   model           — model ID (optional; auto-selected if omitted)

app.post('/api/chat', async (req, res) => {
  const { conversationId, message, provider = 'auto', model, language } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'message required' });
  }

  // Load conversation history (or start fresh)
  let conv = null;
  let messages = [];

  if (conversationId) {
    conv = getConversation(conversationId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    messages = conv.messages ?? [];
  }

  // Append the new user message
  const userCreatedAt = new Date().toISOString();
  messages = [...messages, { role: 'user', content: message.trim(), createdAt: userCreatedAt }];

  // Build system prompt: fixed base + user project instructions + memory facts
  const project  = getProject();
  const memory   = getMemory();
  const memBlock = memory.facts.length
    ? `\n\n## Memory\nThese facts have been remembered from previous sessions:\n${memory.facts.map(f => `- ${f.text}`).join('\n')}`
    : '';
  const userConfig = project.instructions?.trim()
    ? `\n\n## Your configuration\n${project.instructions.trim()}`
    : '';
  const langMap = { de: 'German (Deutsch)', en: 'English' };
  const langLabel = langMap[language] ?? null;
  const langPrefix = langLabel && language !== 'en'
    ? `IMPORTANT: Always respond in ${langLabel}. All your answers, explanations, and summaries must be written in ${langLabel}. Only SAP field names, transaction codes, and system identifiers may remain in English.\n\n`
    : '';
  const systemPrompt = langPrefix + BASE_SYSTEM_PROMPT + userConfig + memBlock;
  console.log(`[chat] language=${language ?? 'unset'} langPrefix=${langPrefix ? 'yes' : 'no'}`);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Collect assistant response for persistence
  let assistantText = '';
  const origWrite = res.write.bind(res);
  res.write = (chunk, ...args) => {
    // Intercept SSE events to capture assistant text
    try {
      const str = Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
      if (str.startsWith('data: ')) {
        const event = JSON.parse(str.slice(6));
        if (event.type === 'text') assistantText += event.delta ?? '';
      }
    } catch {}
    return origWrite(chunk, ...args);
  };

  // Stream
  await streamChat({ provider, model, messages, systemPrompt }, res);

  // Persist conversation after streaming completes
  if (conv && assistantText) {
    const updatedMessages = [
      ...messages,
      { role: 'assistant', content: assistantText, createdAt: new Date().toISOString() },
    ];
    // Auto-title from first user message if still at default placeholder (any language, ≤25 chars)
    const isDefaultTitle = conv.title.trim().length <= 25 && conv.messages.length <= 1;
    const title = isDefaultTitle ? message.trim().slice(0, 60) : conv.title;
    saveConversation({ ...conv, title, messages: updatedMessages });
  }
});

// ── Conversation title generation ─────────────────────────────────────────────

app.post('/api/conversations/:id/generate-title', async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message required' });

  const conv = getConversation(id);
  if (!conv) return res.status(404).json({ error: 'not found' });

  try {
    const title = await generateTitle(message.trim());
    saveConversation({ ...conv, title });
    res.json({ title });
  } catch {
    // Fallback: word-boundary truncation
    const words = message.trim().split(/\s+/);
    const title = words.slice(0, 7).join(' ');
    saveConversation({ ...conv, title });
    res.json({ title });
  }
});

// ── Material stock summary (for hover tooltips) ───────────────────────────────

app.get('/api/material-stock', async (req, res) => {
  const { warehouse, material } = req.query;
  if (!warehouse || !material) return res.status(400).json({ error: 'warehouse and material required' });
  try {
    const result = await callMcpTool('get_stock_for_material', { warehouse, material, top: 50 });
    const stock = result?.stock ?? [];
    const total     = stock.reduce((s, r) => s + (r.totalStock     ?? 0), 0);
    const available = stock.reduce((s, r) => s + (r.availableStock ?? 0), 0);
    const uom       = stock[0]?.uom ?? '';
    res.json({ material, total, available, bins: stock.length, uom });
  } catch {
    res.status(500).json({ error: 'lookup failed' });
  }
});

// ── Shift stats (open TOs / negative stock / replenishment needs) ─────────────

app.get('/api/stats', async (req, res) => {
  const { warehouse } = req.query;
  if (!warehouse) return res.status(400).json({ error: 'warehouse required' });

  const safe = async (name, args) => {
    try { return await callMcpTool(name, args); } catch { return null; }
  };

  const [tos, neg, rep] = await Promise.all([
    safe('get_open_transfer_orders', { warehouse }),
    safe('get_negative_stock_report', { warehouse }),
    safe('get_replenishment_needs',   { warehouse }),
  ]);

  res.json({
    openTOs:           tos?.count  ?? tos?.orders?.length  ?? null,
    negativeQuants:    neg?.count  ?? neg?.negativeQuants?.length ?? null,
    replenishmentNeeds: rep?.count ?? rep?.bins?.length    ?? null,
  });
});

// ── Dashboard (comprehensive shift overview — calls 7 MCP tools in parallel) ──

app.get('/api/dashboard', async (req, res) => {
  const { warehouse } = req.query;
  if (!warehouse) return res.status(400).json({ error: 'warehouse required' });

  const safe = async (name, args) => {
    try { return await callMcpTool(name, args); } catch { return null; }
  };

  const [tos, neg, rep, util, anom, gr, gi] = await Promise.all([
    safe('get_open_transfer_orders', { warehouse }),
    safe('get_negative_stock_report', { warehouse }),
    safe('get_replenishment_needs',   { warehouse }),
    safe('get_bin_utilization',       { warehouse }),
    safe('get_inventory_anomalies',   { warehouse }),
    safe('get_goods_receipt_monitor', { warehouse }),
    safe('get_goods_issue_monitor',   { warehouse }),
  ]);

  res.json({
    fetchedAt: new Date().toISOString(),
    warehouse,
    openTOs: {
      count:     tos?.count  ?? tos?.orders?.length  ?? null,
      topOrders: (tos?.orders ?? []).slice(0, 8),
    },
    negativeStock: {
      count: neg?.count ?? neg?.negativeQuants?.length ?? null,
      items: (neg?.negativeQuants ?? []).slice(0, 8),
    },
    replenishment: {
      count: rep?.count ?? rep?.bins?.length ?? null,
      bins:  (rep?.bins ?? []).slice(0, 8),
    },
    utilization: {
      byStorageType: util?.byStorageType ?? [],
    },
    anomalies: {
      count: anom?.count ?? anom?.anomalies?.length ?? null,
      items: (anom?.anomalies ?? []).slice(0, 8),
    },
    grPending: { count: gr?.count  ?? gr?.items?.length  ?? null },
    giPending: { count: gi?.count  ?? gi?.items?.length  ?? null },
  });
});

// ── Auto-select preview (UI can call this to show which model will be used) ───

app.post('/api/auto-select', (req, res) => {
  const { message } = req.body;
  const selection = autoSelectModel(message ?? '');
  res.json(selection ?? { error: 'No provider connected' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`wm-assistant server running on http://localhost:${PORT}`);
  console.log('Connect AI providers at http://localhost:5173/settings');
  // Pre-connect MCP client in background so first chat is instant
  getMcpTools()
    .then(t => console.log(`MCP ready — ${t.length} tools loaded`))
    .catch(err => console.error('MCP connection failed:', err.message));
});
