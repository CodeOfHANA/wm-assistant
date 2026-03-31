/**
 * Stores AI provider API keys and custom provider configurations server-side.
 * data/providers.json schema:
 * {
 *   "anthropic": "sk-ant-...",
 *   "openai": "sk-...",
 *   "google": "AIza...",
 *   "custom": [
 *     { "id": "custom-abc", "name": "Mistral", "baseUrl": "https://api.mistral.ai/v1",
 *       "model": "mistral-large-latest", "key": "sk-..." }
 *   ]
 * }
 */
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '../data/providers.json');

// ── Well-known provider definitions ──────────────────────────────────────────

export const BUILTIN_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Claude',
    vendor: 'Anthropic',
    models: [
      { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6',   tier: 'premium'  },
      { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6', tier: 'standard' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',  tier: 'fast'     },
    ],
    keyHint: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    isCustom: false,
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    vendor: 'OpenAI',
    models: [
      { id: 'gpt-4o',      label: 'GPT-4o',      tier: 'standard' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'fast'     },
    ],
    keyHint: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    isCustom: false,
  },
  {
    id: 'google',
    name: 'Gemini',
    vendor: 'Google',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', tier: 'fast'     },
      { id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro',   tier: 'standard' },
    ],
    keyHint: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    isCustom: false,
  },
];

// ── File helpers ──────────────────────────────────────────────────────────────

function readFile() {
  if (!fs.existsSync(FILE)) return { custom: [] };
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!data.custom) data.custom = [];
  return data;
}

function writeFile(data) {
  const dir = join(FILE, '..');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// ── Built-in provider keys ────────────────────────────────────────────────────

/** Returns API key for a built-in provider. Env vars take priority over stored keys. */
export function getKey(providerId) {
  const envKey = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai:    process.env.OPENAI_API_KEY,
    google:    process.env.GOOGLE_API_KEY,
  }[providerId];
  if (envKey) return envKey;
  const data = readFile();
  return data[providerId] ?? null;
}

export function setKey(providerId, key) {
  const data = readFile();
  data[providerId] = key;
  writeFile(data);
}

export function removeKey(providerId) {
  const data = readFile();
  delete data[providerId];
  writeFile(data);
}

// ── Custom providers ──────────────────────────────────────────────────────────

/** Returns all custom providers WITHOUT keys (safe to send to browser). */
export function listCustomProviders() {
  return readFile().custom.map(({ key: _key, ...safe }) => safe);
}

/** Returns a custom provider WITH key (server-side only). */
export function getCustomProvider(id) {
  return readFile().custom.find(p => p.id === id) ?? null;
}

/** Adds a new custom provider. Returns the new entry (without key). */
export function addCustomProvider({ name, baseUrl, model, key }) {
  const data = readFile();
  const id   = `custom-${randomBytes(4).toString('hex')}`;
  const entry = { id, name, baseUrl, model, key };
  data.custom.push(entry);
  writeFile(data);
  const { key: _k, ...safe } = entry;
  return safe;
}

/** Removes a custom provider by id. */
export function removeCustomProvider(id) {
  const data = readFile();
  data.custom = data.custom.filter(p => p.id !== id);
  writeFile(data);
}

// ── Combined status (built-in + custom) ──────────────────────────────────────

/** Public-safe provider list for the browser — no keys. */
export function getProviderStatus() {
  const builtin = BUILTIN_PROVIDERS.map(p => ({
    ...p,
    connected: !!getKey(p.id),
  }));

  const custom = listCustomProviders().map(p => ({
    id:        p.id,
    name:      p.name,
    vendor:    p.baseUrl,                    // show base URL as vendor hint
    models:    [{ id: p.model, label: p.model, tier: 'standard' }],
    keyHint:   '',
    docsUrl:   '',
    connected: true,                         // custom providers are always "connected" if they exist
    isCustom:  true,
    baseUrl:   p.baseUrl,
    customModel: p.model,
  }));

  return [...builtin, ...custom];
}

/** IDs of all currently connected providers (built-in + custom). */
export function getConnectedIds() {
  const builtinIds = BUILTIN_PROVIDERS.map(p => p.id).filter(id => !!getKey(id));
  const customIds  = listCustomProviders().map(p => p.id);
  return [...builtinIds, ...customIds];
}
