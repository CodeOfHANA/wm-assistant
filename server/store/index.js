/**
 * Storage interface — swap backend via STORAGE_BACKEND env var.
 * local  → JSON files in data/  (default, demo)
 * supabase → Phase 2
 */

const backend = process.env.STORAGE_BACKEND ?? 'local';

let store;

if (backend === 'supabase') {
  // Phase 2: import supabaseStore
  throw new Error('Supabase storage backend not yet implemented. Set STORAGE_BACKEND=local');
} else {
  store = await import('./localStore.js');
}

export const {
  getProject,
  saveProject,
  getMemory,
  addMemoryFact,
  deleteMemoryFact,
  listConversations,
  getConversation,
  createConversation,
  saveConversation,
  deleteConversation,
} = store;
