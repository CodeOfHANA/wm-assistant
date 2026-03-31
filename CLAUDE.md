# CLAUDE.md — WM Assistant

## Who I Am
- **Name:** Noman Mohamed Hanif
- **Role:** Senior SAP Technology Consultant @ RELACON IT Consulting GmbH, Hamburg
- **GitHub:** CodeOfHANA
- **Repo:** https://github.com/CodeOfHANA/wm-assistant.git

---

## What This Project Is

**`wm-assistant`** is a browser-based AI chat UI for SAP Classic Warehouse Management.
It wraps `../sap-wm-mcp` (23 WM tools via MCP) as a client, streams responses from Claude / GPT-4o / Gemini,
and gives warehouse staff a Claude Desktop-style experience (project instructions, memory, conversation history) at a browser URL.

**Commercial angle:** RELACON-hosted SaaS — warehouse managers open a URL, connect their AI key (or RELACON holds it), and chat with their live WM data.

**Companion project:** `../sap-wm-mcp` — the MCP server with all WM tools. This project is purely the UI layer.

---

## Architecture

```
Browser (React — localhost:5173 in dev)
    ↓ HTTP + SSE
server/app.js (Express — localhost:3001)
    ├── server/aiRouter.js      ← agentic streaming loop: Claude / OpenAI / Gemini / custom
    ├── server/mcpClient.js     ← MCP stdio client → spawns ../sap-wm-mcp/index.js as subprocess
    ├── server/providerStore.js ← API key management (data/providers.json, gitignored)
    └── server/store/
            ├── index.js        ← storage interface (swap via STORAGE_BACKEND env)
            └── localStore.js   ← project, memory, conversations as JSON files in data/
```

**Key principle:** MCP tools are never imported directly — `mcpClient.js` uses the stdio MCP protocol.
This keeps `sap-wm-mcp` independent (Claude Code and Claude Desktop still work on it unchanged).

---

## Sibling Projects

| Path | Purpose |
|---|---|
| `../sap-wm-mcp` | MCP server — 23 WM tools over custom RAP OData V4 |
| `../sap-ewm-mcp` | EWM MCP server (standard SAP APIs) — parallel comparison demo |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript, Vite 5 |
| Styling | Tailwind CSS **v3** (NOT v4) + custom RELACON tokens |
| Animation | Framer Motion v11 |
| Icons | lucide-react |
| Backend | Node.js ESM, Express |
| AI SDKs | `@anthropic-ai/sdk`, `openai`, `@google/generative-ai` |
| MCP | `@modelcontextprotocol/sdk` |
| Storage | Local JSON files in `data/` (Supabase-ready abstraction) |

> **Tailwind is v3** — uses `tailwind.config.js` + `postcss.config.js`, NOT the v4 Vite plugin.
> `@tailwindcss/vite` is not installed. Do not add it.

---

## RELACON Design Tokens

Defined in `ui/tailwind.config.js`:

| Token | Hex | Usage |
|---|---|---|
| `wm-bg` | `#0a1214` | Page background |
| `wm-surface` | `#0f1f22` | Cards, panels |
| `wm-surface-2` | `#152a2e` | Hover states, table rows |
| `wm-border` | `#1a3339` | Borders, dividers |
| `wm-border-hover` | `#2a4a52` | Focus borders |
| `wm-primary` | `#015c61` | Buttons, active states |
| `wm-primary-hover` | `#004e54` | Button hover |
| `wm-accent` | `#2ea3f2` | Links, streaming cursor |
| `wm-accent-mid` | `#15779b` | Secondary accents |
| `wm-muted` | `#82c0c7` | Muted text, labels |
| `wm-text` | `#f0f9fa` | Primary text |
| `wm-text-dim` | `#a8d4d8` | Secondary text |

Animation constants:
- Entry easing: `[0.21, 0.47, 0.32, 0.98]`
- Button spring: `{ type: 'spring', stiffness: 400, damping: 25 }`
- Panel spring: `{ type: 'spring', stiffness: 320, damping: 32 }`
- Always wrap in `<MotionConfig reducedMotion="user">`

---

## Project Structure (current state)

```
wm-assistant/
├── CLAUDE.md
├── package.json
├── .env                        ← gitignored — copy from .env.example and fill in
├── .env.example
├── .gitignore
│
├── server/
│   ├── app.js                  ← Express routes + BASE_SYSTEM_PROMPT constant
│   ├── aiRouter.js             ← streamChat() + generateTitle() (non-streaming)
│   ├── mcpClient.js            ← MCP client singleton (lazy connect on first call)
│   ├── providerStore.js        ← builtin + custom provider management
│   └── store/
│       ├── index.js            ← re-exports localStore (swap to supabase via env)
│       └── localStore.js       ← JSON file backend, DEFAULT_INSTRUCTIONS template
│
├── ui/
│   ├── index.html
│   ├── vite.config.ts          ← proxy: /api → localhost:3001
│   ├── tailwind.config.js      ← wm-* color tokens
│   ├── postcss.config.js
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx             ← root: sidebar + chat + settings, provider polling
│       ├── index.css           ← Tailwind directives + streaming-cursor animation
│       ├── types.ts            ← Message, ToolEvent, StreamEvent, Provider, etc.
│       ├── api/
│       │   └── client.ts       ← typed fetch wrappers for all /api/* routes
│       └── components/
│           ├── Sidebar.tsx         ← collapsible (64/256px spring), logo always visible
│           ├── Chat.tsx            ← streaming thread, tool cards, suggestion chips
│           ├── ModelSelector.tsx   ← provider/model dropdown, tier icons
│           ├── SettingsPanel.tsx   ← slide-in: provider connect, custom providers,
│           │                          project instructions, memory panel
│           └── ToolResultCard.tsx  ← structured WM data rendering (shape-based dispatch)
│
├── data/                       ← gitignored, created at runtime by localStore.js
│   ├── project.json
│   ├── memory.json
│   ├── providers.json
│   └── conversations/
│
└── .claude/
    └── skills/
        ├── wma-add-component.md
        └── wma-doc-sync.md
```

---

## Running Locally

**Prerequisites:** `sap-wm-mcp/.env` must have valid SAP credentials.

```bash
# 1 — Create wm-assistant/.env (once)
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY (at least one)

# 2 — Start API server (auto-spawns sap-wm-mcp as MCP subprocess)
node server/app.js          # → http://localhost:3001

# 3 — Start React dev server (separate terminal)
cd ui && npm run dev        # → http://localhost:5173
```

Open http://localhost:5173 — go to Settings, paste an API key, ask a warehouse question.

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/tools` | List MCP tools (name + description) |
| GET | `/api/providers` | Provider list + connected status |
| POST | `/api/providers/:id/connect` | Store API key `{ apiKey }` |
| DELETE | `/api/providers/:id` | Disconnect built-in provider |
| POST | `/api/providers/custom` | Add custom OpenAI-compatible provider |
| DELETE | `/api/providers/custom/:id` | Remove custom provider |
| GET | `/api/project` | Get `{ name, instructions }` |
| PUT | `/api/project` | Update project |
| GET | `/api/memory` | Get memory facts |
| POST | `/api/memory` | Add fact `{ text }` |
| DELETE | `/api/memory/:id` | Delete fact |
| GET | `/api/conversations` | List conversation index |
| POST | `/api/conversations` | Create `{ title? }` |
| GET | `/api/conversations/:id` | Full conversation with messages |
| DELETE | `/api/conversations/:id` | Delete |
| **POST** | **`/api/chat`** | **Streaming SSE chat** |
| POST | `/api/conversations/:id/generate-title` | AI-generate title from `{ message }` |
| POST | `/api/auto-select` | Preview auto-model selection |

### SSE Chat Protocol

**Request:** `{ conversationId?, message, provider?, model? }`

**Event stream:**
```
data: {"type":"model_used","provider":"anthropic","model":"claude-sonnet-4-6"}
data: {"type":"text","delta":"Here are the open TOs:"}
data: {"type":"tool_start","name":"get_open_transfer_orders","id":"toolu_01","input":{...}}
data: {"type":"tool_result","id":"toolu_01","result":{...}}
data: {"type":"done"}
```

---

## System Prompt Architecture

Two layers, assembled in `server/app.js`:

```
BASE_SYSTEM_PROMPT  (hardcoded constant in app.js — always sent, not user-editable)
  → Role definition, full tool catalog by category, behaviour rules
  → "Ask the user for warehouse/plant if not in config below"

## Your configuration  (project.instructions from Settings — user-editable)
  → Fill-in template: warehouse number, plant, storage types, notes
  → Default template ships in localStore.js DEFAULT_INSTRUCTIONS

## Memory  (memory facts added via memory panel)
  → Persisted facts from previous sessions
```

---

## Provider System

**Built-in providers:** `anthropic`, `openai`, `google` — connect by pasting API key in Settings.
**Custom providers:** any OpenAI-compatible endpoint (Mistral, Groq, Ollama, DeepSeek, etc.).
- Quick-fill presets in the UI for popular ones
- Stored as `{ id: 'custom-{uuid}', name, baseUrl, model, key }` in `data/providers.json`

**Auto-model routing** (when `provider: 'auto'`):

| Message pattern | Model |
|---|---|
| analys / trend / varianc / anomal / aging | Claude Sonnet → GPT-4o → Gemini Pro |
| create / confirm / cancel / transfer order | Claude Haiku → GPT-4o mini → Gemini Flash |
| show / list / get / find / where | Gemini Flash → GPT-4o mini → Claude Haiku |
| fallback | Claude Haiku → GPT-4o mini → Gemini Flash |

---

## ToolResultCard — Shape-Based Dispatch

`ui/src/components/ToolResultCard.tsx` renders tool results as structured UI instead of raw JSON.
Dispatch is **shape-based** (checks result object keys), not tool-name-based — more robust:

| Result has key | Renderer |
|---|---|
| `success` | ActionResult (green ✓ / red ✗) |
| `orders[]` | TransferOrderTable |
| `anomalies[]` | AnomalyList (severity badges) |
| `negativeQuants[]` | NegativeStockTable |
| `candidates[]` | CycleCountTable |
| `variances[]` | VarianceTable |
| `bins[]` with `replenishmentQty` | ReplenishmentTable |
| `bins[]` without `replenishmentQty` | BinTable |
| `stock[]` with `ageBand` | AgingTable |
| `stock[]` without `ageBand` | StockTable |
| `byStorageType[]` (array) | UtilizationPanel (stat cards + progress bars) |
| first array found | GenericTable |
| fallback | formatted JSON |

---

## Conversation Auto-Title

After first exchange completes:
1. Client calls `POST /api/conversations/:id/generate-title` with the first user message
2. Server calls fastest available model (Gemini Flash → Claude Haiku → GPT-4o-mini), `max_tokens: 24`
3. Prompt: *"Generate a concise 3-6 word title… reply with only the title"*
4. Server persists title, returns `{ title }`
5. Client updates sidebar via `onTitleChange`
6. Fallback (no provider / error): first 7 words of user message

---

## Sidebar Collapse Behaviour

- **Expanded (256px):** logo + "WM Assistant / Warehouse AI" text on left, collapse button (PanelLeftClose) on right
- **Collapsed (64px):** entire header becomes a click target (expand on click) — logo centred, no stacking
- The logo is always `h-6` (24px) in both states — does not resize on collapse
- Animated with `motion.div animate={{ width: collapsed ? 64 : 256 }}` spring

---

## Key Implementation Notes

- **Vite proxy:** `ui/vite.config.ts` proxies `/api` to `localhost:3001` — dev and prod use same fetch calls
- **SSE in React:** `client.ts` `streamChat()` uses `fetch` + `ReadableStream` reader, no EventSource
- **Tool call loop:** all three providers (Claude, OpenAI, Gemini) implement a `while(true)` agentic loop — tool results are fed back until `end_turn` / no more tool calls
- **CSRF:** `s4hClient.js` in `sap-wm-mcp` fetches a fresh CSRF token before each POST — wm-assistant never touches SAP directly
- **Negative stock in 999/998:** expected behaviour (GI before TO confirm) — the system prompt template tells the AI this
- **Type 001 blocks negative stock:** documented in sap-wm-mcp — never use as source/dest for ad-hoc TOs

---

## What's Done

- ✅ Server: Express, streaming agentic loop, MCP client, multi-provider, local storage
- ✅ UI: Chat, Sidebar (collapsible), ModelSelector, SettingsPanel (providers + custom + instructions + memory)
- ✅ ToolResultCard: structured rendering for all 23 tool result shapes
- ✅ System prompt: 2-layer architecture (base + user config template)
- ✅ Auto-title: AI-generated conversation titles (Gemini Flash / Haiku / GPT-4o-mini)
- ✅ Custom providers: any OpenAI-compatible endpoint, quick-fill presets
- ✅ GitHub: https://github.com/CodeOfHANA/wm-assistant.git (main branch)

## What's Next

- **Markdown rendering** — assistant responses are plain text; `react-markdown` would render headers, lists, bold from AI responses (highest demo value)
- **Stop streaming button** — cancel a running response mid-stream (AbortController wired in, just needs UI button)
- **Conversation rename** — click title in sidebar to edit inline
- **Vite asset cleanup** — `ui/src/assets/react.svg`, `hero.png`, `vite.svg` are unused scaffolding leftovers
- **Phase 2: BTP CF deployment** — full plan in `../sap-wm-mcp/docs/phase2-implementation-plan.md`

---

## Custom Skills

| Command | When to use |
|---|---|
| `/wma-add-component` | Scaffold a new React component following RELACON design system |
| `/wma-doc-sync` | Update this CLAUDE.md after completing a feature |
