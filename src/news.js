// News Intelligence Module
// Source depends on key mode (src/config/keyMode.js):
//   demo         → seeded snapshot (public/data/ai-snapshot.json), no network to Claude
//   byok/server  → /api/claude serverless proxy, cached 24h via the portfolio store;
//                  any failure falls back to the snapshot rather than an error state.

import { getKeyMode } from "./config/keyMode.js";
import { activeStore } from "./store/portfolioStore.js";
import { callClaude } from "./ai/client.js";
import { buildNewsPrompt, extractJson, normalizeNews } from "./ai/prompts.js";
import { loadSnapshot, formatSnapshotDate } from "./ai/snapshot.js";

export function isLiveNewsEnabled() { return getKeyMode() !== "demo"; }
export function getNewsStatus() {
  const mode = getKeyMode();
  return { mode, hasApiKey: mode !== "demo" };
}

async function snapshotNews(note) {
  const snap = await loadSnapshot();
  const news = snap?.news || { articles: FALLBACK_NEWS, overallSentiment: "mixed", marketSummary: null, topAction: null };
  return {
    ...news,
    isLive: false, isDemo: true, fromCache: true,
    cacheAge: `${snap?.source || "seeded demo"} · ${formatSnapshotDate(snap?.generatedAt) || "March 2026"}`,
    generatedAt: snap?.generatedAt || null,
    demoNote: note || null,
  };
}

/**
 * Get news analysis.
 * @param {string[]} tickers
 * @param {{ allowLive?: boolean }} opts  allowLive=false forces the snapshot
 *        (e.g. server mode for signed-out visitors, to protect the owner's key)
 */
export async function getNewsAnalysis(tickers, { allowLive = true } = {}) {
  if (getKeyMode() === "demo" || !allowLive) return snapshotNews();

  const store = await activeStore();
  const cached = await store.getNewsCache();
  if (cached && !cached.isStale) {
    return { ...cached.analysis, isLive: true, fromCache: true, cacheAge: `${Math.round(cached.ageHours)}h ago` };
  }

  const fresh = await fetchFromClaude(tickers);
  if (fresh) {
    await store.saveNewsCache(fresh, tickers);
    return { ...fresh, isLive: true, fromCache: false, cacheAge: "just now" };
  }

  if (cached) {
    return { ...cached.analysis, isLive: true, fromCache: true, cacheAge: `${Math.round(cached.ageHours)}h ago (stale)` };
  }

  return snapshotNews("Live analysis is unavailable right now — showing the demo snapshot.");
}

async function fetchFromClaude(tickers) {
  const text = await callClaude(buildNewsPrompt(tickers), 16000);
  return normalizeNews(extractJson(text), `live-${Date.now()}`);
}

// ============================================================
// FALLBACK + HELPERS
// ============================================================

export const FALLBACK_NEWS = [
  { id: "n1", headline: "Iran conflict pushes Brent crude above $85, Hormuz transit disrupted", source: "Reuters", timestamp: "2026-03-19T08:30:00Z", category: "geopolitics", sentiment: "negative", impactScore: 85, affectedTickers: ["PSO","PPL","OGDC","MARI"], analysis: "Oil price surge inflates Pakistan's import bill. PSO margins compress — govt caps retail prices while crude input costs rise. PPL/OGDC benefit from higher wellhead gas prices but circular debt delays cash realization.", tags: ["oil","iran"] },
  { id: "n2", headline: "SBP holds policy rate at 10.5%", source: "Business Recorder", timestamp: "2026-03-18T14:00:00Z", category: "monetary_policy", sentiment: "neutral", impactScore: 70, affectedTickers: ["UBL","HBL","MCB","MEBL"], analysis: "Rate pause preserves bank NIMs. UBL/HBL/MCB earn spread on 10.5% lending vs 7-8% deposit costs. MEBL less affected — Islamic profit-sharing adjusts with lag.", tags: ["SBP","banking"] },
  { id: "n3", headline: "Pakistan IT exports surge 23% YoY", source: "Dawn Business", timestamp: "2026-03-17T10:00:00Z", category: "sector", sentiment: "positive", impactScore: 65, affectedTickers: ["SYS"], analysis: "SYS captures ~15% of listed IT export revenue. Each 1% PKR depreciation adds ~₨0.4 to EPS through translation gains.", tags: ["IT","SYS"] },
  { id: "n4", headline: "KSE-100 corrects 10% from ATH", source: "The News Intl", timestamp: "2026-03-18T16:00:00Z", category: "market", sentiment: "negative", impactScore: 60, affectedTickers: ["UBL","HBL","MCB","MEBL","PSO","PPL","SYS","LUCK","OGDC"], analysis: "Broad correction after 65% rally. High-beta stocks (UBL β1.49, PPL β1.45) fell 15-18%. Low-beta MEBL/MCB held better.", tags: ["KSE-100"] },
  { id: "n5", headline: "PKR weakens to 282/USD", source: "Business Recorder", timestamp: "2026-03-19T09:00:00Z", category: "forex", sentiment: "mixed", impactScore: 55, affectedTickers: ["SYS","PSO","LUCK"], analysis: "SYS benefits (USD revenues). PSO import bill rises. LUCK cement exports become more competitive.", tags: ["PKR"] },
  { id: "n6", headline: "CPEC Phase II: $2.3B projects approved", source: "Dawn Business", timestamp: "2026-03-16T11:00:00Z", category: "infrastructure", sentiment: "positive", impactScore: 60, affectedTickers: ["LUCK","PAEL"], analysis: "ML-1 railway and motorways consume ~2M tons cement annually. LUCK holds 15% northern market share. PAEL supplies switchgear.", tags: ["CPEC"] },
  { id: "n7", headline: "IMF review: circular debt resolution progressing", source: "Reuters", timestamp: "2026-03-15T08:00:00Z", category: "macro", sentiment: "positive", impactScore: 75, affectedTickers: ["PSO","PPL","OGDC","SNGP","UBL","HBL"], analysis: "Govt owes PSO ~₨300B — each ₨50B recovery unlocks working capital. PPL/OGDC/SNGP similarly exposed.", tags: ["IMF"] },
  { id: "n8", headline: "Remittances hit $3.29B in February", source: "Business Recorder", timestamp: "2026-03-17T14:00:00Z", category: "macro", sentiment: "positive", impactScore: 50, affectedTickers: ["MEBL","UBL","HBL"], analysis: "Higher remittances = more CASA deposits = lower funding costs for banks. UBL Middle East branches capture flows directly.", tags: ["remittances"] },
  { id: "n9", headline: "NDMA warns monsoon 26% above average", source: "The News Intl", timestamp: "2026-03-14T12:00:00Z", category: "climate", sentiment: "negative", impactScore: 45, affectedTickers: ["LUCK","PPL","OGDC"], analysis: "2022 floods disrupted cement dispatches for 2 months and damaged wellhead infrastructure. Similar risk ahead.", tags: ["monsoon"] },
  { id: "n10", headline: "Engro subsidiary reports strong fertilizer demand", source: "Dawn Business", timestamp: "2026-03-18T10:00:00Z", category: "sector", sentiment: "positive", impactScore: 45, affectedTickers: ["ENGROH"], analysis: "EFERT dividend is 60% of ENGROH income. Strong Rabi urea offtake signals healthy payout.", tags: ["engro"] },
];

export function getNewsForStock(ticker, articles = null) {
  return (articles || FALLBACK_NEWS).filter(n => n.affectedTickers?.includes(ticker));
}

export function getLatestNews(count = 10, articles = null) {
  return [...(articles || FALLBACK_NEWS)].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, count);
}

export function getNewsSentimentSummary(articles = null) {
  const news = articles || FALLBACK_NEWS;
  const total = news.length;
  if (!total) return { total: 0, positive: 0, negative: 0, neutral: 0, ratio: "0" };
  const positive = news.filter(n => n.sentiment === "positive").length;
  const negative = news.filter(n => n.sentiment === "negative").length;
  return { total, positive, negative, neutral: total - positive - negative, ratio: ((positive - negative) / total * 100).toFixed(0) };
}
