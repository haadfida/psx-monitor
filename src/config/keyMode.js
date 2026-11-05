// Key mode — decides where AI analysis comes from.
//
//   'byok'   — the visitor saved their own Anthropic key (localStorage `psx.byok`);
//              it is sent per request as the `x-anthropic-key` header to /api/claude.
//   'server' — the deployment owner opted in with VITE_AI_MODE=server, meaning the
//              serverless function has ANTHROPIC_API_KEY configured.
//   'demo'   — default. No key anywhere: read the seeded snapshot at
//              /data/ai-snapshot.json and never call /api/claude.
//
// Note: the client never reads VITE_ANTHROPIC_API_KEY. Any VITE_* value referenced
// in client code is inlined into the public bundle, so a secret must not be one.

export const BYOK_STORAGE_KEY = "psx.byok";
const CHANGE_EVENT = "psx:keymode-change";

function safeGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function getByokKey() {
  const v = safeGet(BYOK_STORAGE_KEY);
  return v && v.trim() ? v.trim() : null;
}

export function setByokKey(key) {
  try {
    if (key && key.trim()) window.localStorage.setItem(BYOK_STORAGE_KEY, key.trim());
    else window.localStorage.removeItem(BYOK_STORAGE_KEY);
  } catch { /* storage blocked — key just won't persist */ }
  try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* non-browser */ }
}

export function clearByokKey() { setByokKey(null); }

/** @returns {'demo' | 'byok' | 'server'} */
export function getKeyMode() {
  if (getByokKey()) return "byok";
  if (import.meta.env.VITE_AI_MODE === "server") return "server";
  return "demo";
}

export function isLiveMode() { return getKeyMode() !== "demo"; }

/** Headers for a call to /api/claude in the current mode. */
export function aiRequestHeaders() {
  const headers = { "Content-Type": "application/json" };
  const key = getByokKey();
  if (key) headers["x-anthropic-key"] = key;
  return headers;
}

/** Subscribe to key changes (same tab via event, other tabs via `storage`). */
export function onKeyModeChange(cb) {
  const handler = () => cb(getKeyMode());
  const storageHandler = (e) => { if (e.key === BYOK_STORAGE_KEY) handler(); };
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}
