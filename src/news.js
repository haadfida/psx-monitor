// News Intelligence Module
// Calls /api/claude serverless proxy (API key stays server-side)
// Cache: Supabase only. No localStorage.

import { getNewsCache, saveNewsCache } from "./supabase.js";

// We assume the proxy is available if we're deployed on Vercel
// For local dev, set VITE_ANTHROPIC_API_KEY in .env
const HAS_API = !!(import.meta.env.VITE_ANTHROPIC_API_KEY || import.meta.env.PROD);

export function isLiveNewsEnabled() { return HAS_API; }
export function getNewsStatus() { return { hasApiKey: HAS_API }; }

/**
 * Get news analysis — Supabase cache first, Claude API if stale
 */
export async function getNewsAnalysis(tickers) {
  if (!HAS_API) {
    return { articles: [], overallSentiment: null, marketSummary: null, topAction: null, isLive: false, fromCache: false, noApiKey: true };
  }

  // Check Supabase cache
  const cached = await getNewsCache();
  if (cached && !cached.isStale) {
    return {
      ...cached.analysis,
      isLive: true, fromCache: true,
      cacheAge: `${Math.round(cached.ageHours)}h ago`,
    };
  }

  // Cache stale or empty — fetch fresh
  const fresh = await fetchFromClaude(tickers);
  if (fresh) {
    await saveNewsCache(fresh, tickers);
    return { ...fresh, isLive: true, fromCache: false, cacheAge: "just now" };
  }

  // API failed — return stale cache if available
  if (cached) {
    return { ...cached.analysis, isLive: true, fromCache: true, cacheAge: `${Math.round(cached.ageHours)}h ago (stale)` };
  }

  // Nothing works — fallback
  return { articles: [], overallSentiment: null, marketSummary: "Could not fetch live analysis. Will retry automatically.", topAction: null, isLive: false, fromCache: false };
}

async function fetchFromClaude(tickers) {
  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `You are a PSX (Pakistan Stock Exchange) portfolio analyst. Search for major news from the last 24 hours that could affect these stocks: ${tickers.join(", ")}

Search broadly:
- Oil/energy prices, Middle East geopolitics, Iran situation
- Pakistan monetary policy, SBP rate decisions
- PKR/USD exchange rate moves
- IMF program updates
- Global trade policy, US tariffs, sanctions
- Climate/weather events affecting Pakistan
- Infrastructure/CPEC developments
- Regional conflicts (India-Pakistan, Afghanistan)
- Sector-specific news (banking, tech, cement, energy, utilities, consumer)

For each item, explain the SPECIFIC transmission mechanism to the affected stocks.

Respond ONLY in valid JSON with no markdown:
{
  "articles": [
    { "headline": "concise headline", "source": "source name", "sentiment": "positive|negative|neutral|mixed", "impactScore": 0-100, "affectedTickers": ["PSO","PPL"], "analysis": "2-3 sentences with specific impact mechanism", "category": "geopolitics|monetary_policy|sector|market|forex|infrastructure|climate|macro", "urgency": "immediate|soon|watch" }
  ],
  "overallSentiment": "positive|negative|neutral|mixed",
  "marketSummary": "2-3 sentence PSX outlook today",
  "topAction": "single most important action for this portfolio"
}`
        }],
      }),
    });

    if (!response.ok) { console.error("Claude API:", response.status); return null; }

    const data = await response.json();
    const text = (data.content?.filter(b => b.type === "text") || []).map(b => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    parsed.articles = (parsed.articles || []).map((a, i) => ({
      ...a, id: `live-${Date.now()}-${i}`, timestamp: new Date().toISOString(), tags: [a.category],
    }));
    return parsed;
  } catch (err) { console.error("Claude fetch failed:", err); return null; }
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
