/**
 * Local JSON file storage — for demo/development.
 * All data lives in <project-root>/data/ which is gitignored.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuid } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const convDir = join(DATA_DIR, 'conversations');
  if (!fs.existsSync(convDir)) fs.mkdirSync(convDir, { recursive: true });
}

function readJSON(file, fallback) {
  ensureDir();
  const path = join(DATA_DIR, file);
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeJSON(file, data) {
  ensureDir();
  fs.writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// ── Project (instructions + name) ──────────────────────────────────────────

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

export function getProject() {
  return readJSON('project.json', {
    name: 'WM Assistant',
    instructions: DEFAULT_INSTRUCTIONS,
  });
}

export function saveProject(data) {
  const current = getProject();
  writeJSON('project.json', { ...current, ...data });
}

// ── Memory facts ────────────────────────────────────────────────────────────

export function getMemory() {
  return readJSON('memory.json', { facts: [] });
}

export function addMemoryFact(text) {
  const store = getMemory();
  const fact = { id: uuid(), text, createdAt: new Date().toISOString() };
  store.facts.push(fact);
  writeJSON('memory.json', store);
  return fact;
}

export function deleteMemoryFact(id) {
  const store = getMemory();
  store.facts = store.facts.filter(f => f.id !== id);
  writeJSON('memory.json', store);
}

// ── Conversations ───────────────────────────────────────────────────────────

export function listConversations() {
  return readJSON('conversations-index.json', []);
}

export function getConversation(id) {
  ensureDir();
  const path = join(DATA_DIR, 'conversations', `${id}.json`);
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

export function createConversation(title = 'New conversation') {
  const id = uuid();
  const conv = {
    id,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  ensureDir();
  fs.writeFileSync(join(DATA_DIR, 'conversations', `${id}.json`), JSON.stringify(conv, null, 2));
  const index = listConversations();
  index.unshift({ id, title, createdAt: conv.createdAt, updatedAt: conv.updatedAt });
  writeJSON('conversations-index.json', index);
  return conv;
}

export function saveConversation(conv) {
  ensureDir();
  const updated = { ...conv, updatedAt: new Date().toISOString() };
  fs.writeFileSync(join(DATA_DIR, 'conversations', `${conv.id}.json`), JSON.stringify(updated, null, 2));
  // update index entry
  const index = listConversations();
  const idx = index.findIndex(c => c.id === conv.id);
  const summary = { id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: updated.updatedAt };
  if (idx >= 0) index[idx] = summary;
  else index.unshift(summary);
  writeJSON('conversations-index.json', index);
  return updated;
}

export function deleteConversation(id) {
  ensureDir();
  const path = join(DATA_DIR, 'conversations', `${id}.json`);
  if (fs.existsSync(path)) fs.unlinkSync(path);
  const index = listConversations().filter(c => c.id !== id);
  writeJSON('conversations-index.json', index);
}
