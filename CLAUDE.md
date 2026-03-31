# CLAUDE.md — WM Assistant

## Who I Am
- **Name:** Noman Mohamed Hanif
- **Role:** Senior SAP Technology Consultant @ RELACON IT Consulting GmbH, Hamburg
- **GitHub:** CodeOfHANA

---

## What This Project Is

**`wm-assistant`** is a browser-based AI chat UI for SAP Classic Warehouse Management.
It wraps the MCP server at `../sap-wm-mcp` as an MCP client, exposes a streaming HTTP API,
and provides a Claude Desktop-style project experience (instructions, memory, conversation history)
accessible to any warehouse staff via a browser — no Claude Desktop, no technical setup.

**Commercial angle:** RELACON-hosted SaaS product. Warehouse managers open a URL, pick a model, chat with their WM data.

**Companion project:** `../sap-wm-mcp` — the MCP server with 24 WM tools. This project is the UI layer on top of it.

---

## Architecture

```
Browser (React UI — localhost:5173 dev)
    ↓ HTTP/SSE
server/app.js (Express — localhost:3001)
    ├── server/aiRouter.js      ← streams Claude / GPT-4o / Gemini
    ├── server/mcpClient.js     ← MCP client → spawns ../sap-wm-mcp/index.js via stdio
    ├── server/providerStore.js ← stores API keys server-side (data/providers.json)
    └── server/store/           ← JSON file storage (local) / Supabase (Phase 2)
            ├── index.js        ← storage interface (swap via STORAGE_BACKEND env)
            └── localStore.js   ← project, memory, conversations as JSON files
```

**Key principle:** Tools are NOT imported directly. `mcpClient.js` connects to `sap-wm-mcp/index.js`
via MCP stdio protocol. This keeps `sap-wm-mcp` clean and reusable (Claude Desktop still works unchanged).

---

## Sibling Projects

| Path | Purpose |
|---|---|
| `../sap-wm-mcp` | MCP server — 24 WM tools, RAP OData V4 service, ABAP objects |
| `../sap-ewm-mcp` | EWM MCP server (standard SAP APIs) — comparison demo target |
| `../Claude Code CLI/UI_UX` | UI/UX design reference — motion patterns, component library |

---

## Design System

### RELACON Brand Colors (from www.relacon.de)
| Token | Hex | Usage |
|---|---|---|
| Primary teal | `#015c61` | Buttons, active states, accents |
| Secondary blue | `#2ea3f2` | Links, highlights, streaming cursor |
| Medium blue | `#15779b` | Secondary actions |
| Dark teal | `#004e54` | Hover states |
| Light teal | `#82c0c7` | Muted text, labels |
| Background | `#0a1214` | Page background (dark teal-black) |
| Surface | `#0f1f22` | Cards, sidebar, panels |
| Border | `#1a3339` | Dividers, card borders |
| Text primary | `#f0f9fa` | Headlines |
| Text muted | `#82c0c7` | Body, descriptions |

### Animation System (from `../Claude Code CLI/UI_UX`)
- **Easing:** `[0.21, 0.47, 0.32, 0.98]` for entry animations
- **Button spring:** `{ type: "spring", stiffness: 400, damping: 25 }`
- **Card spring:** `{ type: "spring", stiffness: 260, damping: 20 }`
- **Stagger:** `staggerChildren: 0.12, delayChildren: 0.1`
- **Scroll reveal:** `viewport={{ once: true, margin: "-80px" }}`
- **Always wrap app in** `<MotionConfig reducedMotion="user">`
- Animate only `transform` and `opacity` — GPU-composited only

### Stack
- React 18 + TypeScript
- Vite (dev server)
- Tailwind CSS v4
- shadcn/ui
- Framer Motion v11+
- Inter font (Google Fonts)

---

## Project Structure (target state)

```
wm-assistant/
├── CLAUDE.md
├── package.json
├── .env                        ← gitignored (copy from .env.example)
├── .env.example
├── .gitignore
│
├── server/                     ← Day 1 COMPLETE ✅
│   ├── app.js                  ← Express: all routes + SSE /api/chat
│   ├── aiRouter.js             ← streaming: Claude + OpenAI + Gemini + auto-select
│   ├── mcpClient.js            ← MCP client singleton
│   ├── providerStore.js        ← API key management
│   └── store/
│       ├── index.js            ← storage interface
│       └── localStore.js       ← JSON file backend
│
├── ui/                         ← Days 2–5 (not yet built)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts           ← typed fetch wrappers for all /api/* routes
│       └── components/
│           ├── Sidebar.tsx             ← Day 2: conversation list + provider status dots
│           ├── Chat.tsx                ← Day 2: streaming message thread
│           ├── ModelSelector.tsx       ← Day 2: provider/model dropdown
│           ├── ProviderModal.tsx       ← Day 3: "Connect" API key flow
│           ├── AutoSelectBadge.tsx     ← Day 3: shows which model auto-selected + why
│           ├── ProjectInstructions.tsx ← Day 5: editable system prompt panel
│           ├── MemoryPanel.tsx         ← Day 5: persistent facts sidebar
│           └── ToolResultCard.tsx      ← Day 4: structured WM data rendering (TOs as tables, bins as cards)
│
└── data/                       ← gitignored, created at runtime
    ├── project.json
    ├── memory.json
    ├── providers.json          ← encrypted API keys (server-side only)
    └── conversations/
        └── {id}.json
```

---

## API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/tools` | List 24 MCP tools (name + description) |
| GET | `/api/providers` | Provider list + connected status (no keys) |
| POST | `/api/providers/:id/connect` | Store API key `{ apiKey }` |
| DELETE | `/api/providers/:id` | Disconnect provider |
| GET | `/api/project` | Get project name + instructions |
| PUT | `/api/project` | Update `{ name?, instructions? }` |
| GET | `/api/memory` | Get memory facts |
| POST | `/api/memory` | Add fact `{ text }` |
| DELETE | `/api/memory/:id` | Delete fact |
| GET | `/api/conversations` | List conversation index |
| POST | `/api/conversations` | Create `{ title? }` |
| GET | `/api/conversations/:id` | Get full conversation with messages |
| PATCH | `/api/conversations/:id` | Update title/messages |
| DELETE | `/api/conversations/:id` | Delete |
| **POST** | **`/api/chat`** | **Streaming SSE chat** |
| POST | `/api/auto-select` | Preview which model will be auto-selected |

### SSE Chat Protocol (`POST /api/chat`)

**Request body:**
```json
{
  "conversationId": "uuid (optional — if provided, history is loaded and saved)",
  "message": "Show me all open transfer orders",
  "provider": "auto | anthropic | openai | google",
  "model": "claude-sonnet-4-6 (optional)"
}
```

**SSE event stream:**
```
data: {"type":"model_used","provider":"anthropic","model":"claude-sonnet-4-6"}
data: {"type":"text","delta":"Here are the open transfer orders:"}
data: {"type":"tool_start","name":"get_open_transfer_orders","id":"toolu_01","input":{...}}
data: {"type":"tool_result","name":"get_open_transfer_orders","id":"toolu_01","result":{...}}
data: {"type":"text","delta":" I found 3 open TOs..."}
data: {"type":"done","usage":{"input_tokens":1240,"output_tokens":87}}
```

---

## Dev Commands

```bash
# Backend (from wm-assistant/)
node server/app.js          → http://localhost:3001

# Frontend (from wm-assistant/ui/ — once scaffolded Day 2)
npm run dev                 → http://localhost:5173

# Test backend health
curl http://localhost:3001/api/health
curl http://localhost:3001/api/tools
curl http://localhost:3001/api/providers
```

---

## .env Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
MCP_SERVER_PATH=../sap-wm-mcp/index.js   # relative to project root
PORT=3001
STORAGE_BACKEND=local
```

API keys in `.env` take priority over keys stored via `/api/providers/:id/connect`.
For demo: put keys in `.env`. For production SaaS: use the connect flow (RELACON holds the keys).

---

## Auto-Model Selection Logic

When `provider: "auto"` (default), the last user message is matched against these rules (first match wins):

| Pattern | Model chosen | Reason |
|---|---|---|
| `analys\|trend\|compar\|varianc\|aging\|anomal` | Claude Sonnet / GPT-4o | Complex reasoning |
| `create\|confirm\|cancel\|move stock` | Claude Haiku / GPT-4o mini | Write ops — reliable, cheap |
| `show\|list\|get\|how many\|find` | Gemini Flash / GPT-4o mini | Simple lookups — cheapest |
| (default) | Haiku → GPT-4o mini → Gemini Flash | Best available |

---

## Current Progress

### Day 1 — Server Layer ✅ COMPLETE
- `server/app.js` — all routes
- `server/aiRouter.js` — streaming agentic loop (Claude + OpenAI + Gemini)
- `server/mcpClient.js` — MCP client singleton
- `server/providerStore.js` — API key management
- `server/store/` — local JSON storage

**Verified:** Server starts, MCP connects, 24 tools loaded.

### Day 2 — React UI Shell 🔜 NEXT
- `ui/` Vite + React + TypeScript + shadcn/ui + Framer Motion
- Sidebar: conversation list, new chat button, provider status dots
- Header: model selector + auto-select toggle
- Chat: streaming message thread with RELACON design theme

### Day 3 — Provider Modals + Auto-Select
- `ProviderModal.tsx` — "Connect" API key flow per provider
- `AutoSelectBadge.tsx` — shows which model was chosen + why
- Model selector with connected/disconnected states

### Day 4 — Tool Result Cards
- `ToolResultCard.tsx` — TOs as tables, bins as cards, stock as lists
- Tool call progress indicator (expanding panel while executing)
- Collapsible tool result sections

### Day 5 — Project Instructions + Memory + Polish
- `ProjectInstructions.tsx` — editable system prompt (like Claude Desktop "Instructions")
- `MemoryPanel.tsx` — persistent facts, add/delete
- Full RELACON animation polish (Framer Motion stagger, spring buttons)
- Conversation auto-title + rename

---

## Key Design Decisions

1. **MCP client, not direct import** — `server/mcpClient.js` spawns `sap-wm-mcp/index.js` as a subprocess via stdio. Tools are never imported directly into this repo. This keeps `sap-wm-mcp` clean and allows connecting to `sap-ewm-mcp` later (comparison demo).

2. **Storage abstraction** — `server/store/index.js` selects backend via `STORAGE_BACKEND` env. Local JSON for demo, swap to Supabase for Phase 2 with one env var change.

3. **API keys server-side only** — keys stored in `data/providers.json` (gitignored). Browser never sees keys — it only sees `{ connected: true/false }`.

4. **SSE not WebSocket** — simpler, browser-native, no connection management. Works through proxies and load balancers (important for BTP CF Phase 2).

5. **Conversation persistence after stream** — `app.js` intercepts SSE writes to capture assistant text, then saves to store after `res.end()`. No partial saves.

6. **No BTP for demo** — Phase 2 (BTP CF) is a deployment target, not a prerequisite. Local MCP + local server is fully functional for demos.

---

## Phase 2 Path (after UI is complete)

`docs/phase2-implementation-plan.md` in `../sap-wm-mcp` has the full BTP CF plan.
Phase 2A adds:
- `server/auth.js` — XSUAA JWT validation
- HTTP transport to MCP server (instead of stdio subprocess)
- `mta.yaml` — BTP CF deployment descriptor
- RELACON holds all API keys — users just authenticate via SAP credentials

---

## Custom Skills

| Skill | Command | Use When |
|---|---|---|
| Add UI component | `/wma-add-component` | Scaffold a new React component following RELACON design system |
| Sync docs | `/wma-doc-sync` | Update CLAUDE.md progress after completing a day |
