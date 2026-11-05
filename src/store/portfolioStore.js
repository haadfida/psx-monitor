// Portfolio store — one interface, two adapters.
//
//   localStorage adapter (default): positions + AI caches live in this browser.
//   Supabase adapter: used only when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
//   set AND the visitor is signed in. supabase.js is imported lazily, so a keyless
//   build never loads the Supabase client.

const LS = {
  positions: "psx.positions",
  newsCache: "psx.cache.news",
  adviceCache: "psx.cache.advice",
};

const NEWS_TTL_HOURS = 24;
const ADVICE_TTL_DAYS = 30;

export function isSupabaseConfigured() {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch { return undefined; }
}

function writeJson(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// ------------------------------------------------------------
// localStorage adapter
// ------------------------------------------------------------

export const localAdapter = {
  name: "local",
  /** true once anything (even an empty list) was saved in this browser */
  hasSavedPositions() { return readJson(LS.positions) !== undefined; },
  async loadPositions() {
    const v = readJson(LS.positions);
    return Array.isArray(v) ? v : [];
  },
  async savePositions(positions) {
    return { success: writeJson(LS.positions, positions) };
  },
  async deletePosition(ticker) {
    const v = await this.loadPositions();
    return this.savePositions(v.filter(p => p.ticker !== ticker));
  },
  async saveTransactions() { return { success: true }; },
  async saveImportLog() {},
  async getNewsCache() {
    const v = readJson(LS.newsCache);
    if (!v?.analysis || !v.fetchedAt) return null;
    const ageHours = (Date.now() - new Date(v.fetchedAt).getTime()) / 3600000;
    return { analysis: v.analysis, fetchedAt: v.fetchedAt, ageHours, isStale: ageHours > NEWS_TTL_HOURS };
  },
  async saveNewsCache(analysis) {
    writeJson(LS.newsCache, { analysis, fetchedAt: new Date().toISOString() });
  },
  async getAdviceCache() {
    const v = readJson(LS.adviceCache);
    if (!v?.advice || !v.fetchedAt) return null;
    const ageDays = (Date.now() - new Date(v.fetchedAt).getTime()) / 86400000;
    return { advice: v.advice, fetchedAt: v.fetchedAt, ageDays, isStale: ageDays > ADVICE_TTL_DAYS };
  },
  async saveAdviceCache(advice) {
    writeJson(LS.adviceCache, { advice, fetchedAt: new Date().toISOString() });
  },
};

// ------------------------------------------------------------
// Supabase adapter (lazy)
// ------------------------------------------------------------

let supabaseModule = null;
export async function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseModule) supabaseModule = await import("../supabase.js");
  return supabaseModule;
}

export const supabaseAdapter = {
  name: "supabase",
  hasSavedPositions() { return true; },
  async loadPositions() { return (await getSupabase()).loadPositions(); },
  async savePositions(p) { return (await getSupabase()).savePositions(p); },
  async deletePosition(t) { return (await getSupabase()).deletePosition(t); },
  async saveTransactions(t) { return (await getSupabase()).saveTransactions(t); },
  async saveImportLog(m, a, b) { return (await getSupabase()).saveImportLog(m, a, b); },
  async getNewsCache() { return (await getSupabase()).getNewsCache(); },
  async saveNewsCache(a, t) { return (await getSupabase()).saveNewsCache(a, t); },
  async getAdviceCache() { return (await getSupabase()).getAdviceCache(); },
  async saveAdviceCache(a) { return (await getSupabase()).saveAdviceCache(a); },
};

/** Adapter for a given auth state: Supabase only when configured and signed in. */
export function storeFor(user) {
  return isSupabaseConfigured() && user ? supabaseAdapter : localAdapter;
}

/** Adapter for the current session (checks Supabase auth if configured). */
export async function activeStore() {
  const sb = await getSupabase();
  if (!sb) return localAdapter;
  const user = await sb.getUser().catch(() => null);
  return storeFor(user);
}
