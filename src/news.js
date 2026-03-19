// News Intelligence Module
// - Checks Supabase for cached analysis first
// - Only calls Claude API if cache is >24h old (or manual refresh)
// - Result stored in Supabase so phone/laptop/tablet all share one call
// - Falls back to localStorage if Supabase isn't configured
// - Falls back to static news if no API key at all

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const CACHE_HOURS = 24;

// ============================================================
// CACHE LAYER (Supabase → localStorage → nothing)
// ============================================================

async function getSupabase() {
  try {
    const { supabase, getUser } = await import("./supabase.js");
    if (!supabase) return null;
    const user = await getUser();
    if (!user) return null;
    return { supabase, userId: user.id };
  } catch { return null; }
}

async function getCachedAnalysis() {
  // Try Supabase first
  const sb = await getSupabase();
  if (sb) {
    const { data } = await sb.supabase
      .from("news_cache")
      .select("*")
      .eq("user_id", sb.userId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const age = (Date.now() - new Date(data.fetched_at).getTime()) / 3600000;
      return {
        analysis: data.analysis,
        fetchedAt: data.fetched_at,
        ageHours: age,
        isStale: age > CACHE_HOURS,
        source: "supabase",
      };
    }
  }

  // Fall back to localStorage
  try {
    const cached = JSON.parse(localStorage.getItem("psx_news_cache") || "null");
    if (cached) {
      const age = (Date.now() - new Date(cached.fetchedAt).getTime()) / 3600000;
      return {
        analysis: cached.analysis,
        fetchedAt: cached.fetchedAt,
        ageHours: age,
        isStale: age > CACHE_HOURS,
        source: "localStorage",
      };
    }
  } catch {}

  return null;
}

async function saveCachedAnalysis(analysis, tickers) {
  const now = new Date().toISOString();

  // Save to Supabase
  const sb = await getSupabase();
  if (sb) {
    // Delete old cache entries (keep only latest)
    await sb.supabase
      .from("news_cache")
      .delete()
      .eq("user_id", sb.userId);

    await sb.supabase
      .from("news_cache")
      .insert({
        user_id: sb.userId,
        analysis,
        tickers,
        fetched_at: now,
      });
  }

  // Also save to localStorage as backup
  try {
    localStorage.setItem("psx_news_cache", JSON.stringify({
      analysis,
      fetchedAt: now,
    }));
  } catch {}
}

// ============================================================
// MAIN API — what the UI calls
// ============================================================

/**
 * Get news analysis — uses cache if fresh, fetches if stale
 * @param {string[]} tickers - portfolio tickers
 * @param {boolean} forceRefresh - bypass cache (manual refresh button)
 * @returns {{ articles, overallSentiment, marketSummary, topAction, cachedAt, fromCache }}
 */
export async function getNewsAnalysis(tickers, forceRefresh = false) {
  if (!ANTHROPIC_API_KEY) {
    return {
      articles: FALLBACK_NEWS,
      overallSentiment: "mixed",
      marketSummary: "Add your Anthropic API key in .env to enable live news analysis.",
      topAction: "Configure VITE_ANTHROPIC_API_KEY for real-time insights.",
      cachedAt: null,
      fromCache: false,
      isLive: false,
    };
  }

  // Check cache unless force refresh
  if (!forceRefresh) {
    const cached = await getCachedAnalysis();
    if (cached && !cached.isStale) {
      return {
        ...cached.analysis,
        cachedAt: cached.fetchedAt,
        fromCache: true,
        isLive: true,
        cacheAge: `${Math.round(cached.ageHours)}h ago`,
      };
    }
  }

  // Fetch fresh analysis
  const fresh = await fetchLiveNewsAnalysis(tickers);
  if (fresh) {
    await saveCachedAnalysis(fresh, tickers);
    return {
      ...fresh,
      cachedAt: new Date().toISOString(),
      fromCache: false,
      isLive: true,
      cacheAge: "just now",
    };
  }

  // If API call failed, try returning stale cache
  const staleCache = await getCachedAnalysis();
  if (staleCache) {
    return {
      ...staleCache.analysis,
      cachedAt: staleCache.fetchedAt,
      fromCache: true,
      isLive: true,
      cacheAge: `${Math.round(staleCache.ageHours)}h ago (stale)`,
    };
  }

  // Last resort: fallback
  return {
    articles: FALLBACK_NEWS,
    overallSentiment: "mixed",
    marketSummary: "Failed to fetch live analysis. Showing fallback data.",
    topAction: "Check your API key and try refreshing.",
    cachedAt: null,
    fromCache: false,
    isLive: false,
  };
}

/**
 * Check configuration status
 */
export function getNewsStatus() {
  return {
    hasApiKey: !!ANTHROPIC_API_KEY,
    cacheHours: CACHE_HOURS,
  };
}

// ============================================================
// CLAUDE API CALL (internal — only called when cache is stale)
// ============================================================

async function fetchLiveNewsAnalysis(tickers) {
  const tickerList = tickers.join(", ");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `You are a PSX (Pakistan Stock Exchange) portfolio analyst. Search for major news from the last 24 hours that could affect these stocks: ${tickerList}

Search broadly — not just stock-specific news but also:
- Oil/energy prices and Middle East geopolitics  
- Pakistan monetary policy, SBP rate decisions
- PKR/USD exchange rate moves
- IMF program updates
- Global trade policy, US tariffs, sanctions
- Climate/weather events affecting Pakistan
- Infrastructure/CPEC developments  
- Regional conflicts (India-Pakistan, Afghanistan)
- Any sector-specific news (banking, tech, cement, energy, utilities, consumer)

For each news item, explain the SPECIFIC transmission mechanism to the affected stocks.
Not just "this is bad for energy" but "PSO margins compress because govt caps retail prices while crude input costs rise."

Respond ONLY in valid JSON with no markdown fences or preamble:
{
  "articles": [
    {
      "headline": "concise headline",
      "source": "source name",
      "sentiment": "positive|negative|neutral|mixed",
      "impactScore": 0-100,
      "affectedTickers": ["PSO", "PPL"],
      "analysis": "2-3 sentences with specific transmission mechanism to the stocks",
      "category": "geopolitics|monetary_policy|sector|market|forex|infrastructure|climate|macro",
      "urgency": "immediate|soon|watch"
    }
  ],
  "overallSentiment": "positive|negative|neutral|mixed",
  "marketSummary": "2-3 sentence overall PSX outlook today",
  "topAction": "single most important action for this portfolio right now"
}`
        }],
      }),
    });

    if (!response.ok) {
      console.error("Claude API error:", response.status);
      return null;
    }

    const data = await response.json();
    const textBlocks = data.content?.filter(b => b.type === "text") || [];
    const fullText = textBlocks.map(b => b.text).join("");

    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON in Claude response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const now = new Date().toISOString();
    parsed.articles = (parsed.articles || []).map((a, i) => ({
      ...a,
      id: `live-${Date.now()}-${i}`,
      timestamp: now,
      tags: [a.category],
    }));

    return parsed;
  } catch (err) {
    console.error("Live news fetch failed:", err);
    return null;
  }
}

// ============================================================
// FALLBACK NEWS + HELPERS
// ============================================================

export const FALLBACK_NEWS = [
  {
    id: "n1", headline: "Iran conflict pushes Brent crude above $85, Hormuz transit disrupted",
    source: "Reuters", timestamp: "2026-03-19T08:30:00Z", category: "geopolitics",
    sentiment: "negative", impactScore: 85, affectedTickers: ["PSO", "PPL", "OGDC", "MARI"],
    analysis: "Oil price surge inflates Pakistan's import bill. PSO margins compress — govt caps retail fuel prices while crude input costs rise. PPL/OGDC benefit from higher wellhead gas prices but circular debt delays cash realization by 6-12 months.",
    tags: ["oil", "iran", "energy"],
  },
  {
    id: "n2", headline: "SBP holds policy rate at 10.5% amid Middle East uncertainty",
    source: "Business Recorder", timestamp: "2026-03-18T14:00:00Z", category: "monetary_policy",
    sentiment: "neutral", impactScore: 70, affectedTickers: ["UBL", "HBL", "MCB", "MEBL"],
    analysis: "Rate pause preserves bank NIMs — UBL/HBL/MCB earn spread on ~10.5% lending vs 7-8% deposit costs. Delays equity re-rating as money stays parked in fixed income. MEBL less affected — Islamic profit-sharing model adjusts with lag.",
    tags: ["SBP", "banking"],
  },
  {
    id: "n3", headline: "Pakistan IT exports surge 23% YoY in Feb 2026",
    source: "Dawn Business", timestamp: "2026-03-17T10:00:00Z", category: "sector",
    sentiment: "positive", impactScore: 65, affectedTickers: ["SYS"],
    analysis: "SYS captures ~15% of listed IT export revenue. Each 1% PKR depreciation adds ~₨0.4 to SYS EPS through translation gains. Order pipeline from US/EU enterprise clients growing on AI integration demand.",
    tags: ["IT exports", "SYS"],
  },
  {
    id: "n4", headline: "KSE-100 corrects 10% from January ATH amid global risk-off",
    source: "The News Intl", timestamp: "2026-03-18T16:00:00Z", category: "market",
    sentiment: "negative", impactScore: 60, affectedTickers: ["UBL", "HBL", "MCB", "MEBL", "PSO", "PPL", "SYS", "LUCK", "OGDC"],
    analysis: "Broad correction after 65% rally creates value entries. High-beta names (UBL β1.49, PPL β1.45) fell 15-18% vs index. Low-beta MEBL (β0.89) and MCB (β0.95) held better. Technical support at 150K on KSE-100.",
    tags: ["KSE-100", "correction"],
  },
  {
    id: "n5", headline: "PKR weakens to 282/USD as oil import bill pressure mounts",
    source: "Business Recorder", timestamp: "2026-03-19T09:00:00Z", category: "forex",
    sentiment: "mixed", impactScore: 55, affectedTickers: ["SYS", "PSO", "LUCK"],
    analysis: "SYS earns in USD — weaker PKR directly boosts reported revenue/EPS. PSO import bill rises — each ₨1 depreciation adds ~₨2B to annual fuel import cost. LUCK cement exports to Afghanistan priced in PKR become more competitive.",
    tags: ["PKR", "exchange rate"],
  },
  {
    id: "n6", headline: "CPEC Phase II: $2.3B infrastructure projects approved",
    source: "Dawn Business", timestamp: "2026-03-16T11:00:00Z", category: "infrastructure",
    sentiment: "positive", impactScore: 60, affectedTickers: ["LUCK", "PAEL"],
    analysis: "ML-1 railway and motorway projects consume ~2M tons cement annually — LUCK holds 15% market share in northern region where most projects execute. PAEL supplies switchgear and transformers for CPEC power projects.",
    tags: ["CPEC", "infrastructure"],
  },
  {
    id: "n7", headline: "IMF review: Pakistan on track, circular debt resolution progressing",
    source: "Reuters", timestamp: "2026-03-15T08:00:00Z", category: "macro",
    sentiment: "positive", impactScore: 75, affectedTickers: ["PSO", "PPL", "OGDC", "SNGP", "UBL", "HBL"],
    analysis: "Govt owes PSO ~₨300B in receivables — each ₨50B recovery unlocks working capital and reduces finance costs by ~₨3B/yr. PPL/OGDC/SNGP similarly exposed. IMF compliance keeps foreign portfolio flows positive — supports banking sector valuations.",
    tags: ["IMF", "circular debt"],
  },
  {
    id: "n8", headline: "Remittances hit $3.29B in February, FY26 total $26.49B",
    source: "Business Recorder", timestamp: "2026-03-17T14:00:00Z", category: "macro",
    sentiment: "positive", impactScore: 50, affectedTickers: ["MEBL", "UBL", "HBL"],
    analysis: "Higher remittances = more CASA deposits for banks = lower funding costs. UBL's Middle East branches capture remittance flows directly. MEBL gains as Islamic banking share of remittance accounts grows 3% YoY.",
    tags: ["remittances", "banking"],
  },
  {
    id: "n9", headline: "NDMA warns 2026 monsoon up to 26% above average rainfall",
    source: "The News Intl", timestamp: "2026-03-14T12:00:00Z", category: "climate",
    sentiment: "negative", impactScore: 45, affectedTickers: ["LUCK", "PPL", "OGDC"],
    analysis: "2022 floods disrupted cement dispatches for 2 months and damaged wellhead infrastructure. Similar event would delay LUCK northern dispatches and force PPL/OGDC into emergency maintenance shutdowns.",
    tags: ["monsoon", "climate"],
  },
  {
    id: "n10", headline: "Engro Holdings subsidiary reports strong Rabi fertilizer demand",
    source: "Dawn Business", timestamp: "2026-03-18T10:00:00Z", category: "sector",
    sentiment: "positive", impactScore: 45, affectedTickers: ["ENGROH"],
    analysis: "Engro Fertilizer (EFERT) dividend is 60% of ENGROH's income. Strong Rabi urea offtake signals healthy EFERT payout — ENGROH trades at ~30% holding company discount which narrows when subsidiary performance is strong.",
    tags: ["engro", "fertilizer"],
  },
];

export function getNewsForStock(ticker, articles = null) {
  const news = articles || FALLBACK_NEWS;
  return news.filter(n => n.affectedTickers?.includes(ticker));
}

export function getLatestNews(count = 10, articles = null) {
  const news = articles || FALLBACK_NEWS;
  return [...news].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, count);
}

export function getNewsSentimentSummary(articles = null) {
  const news = articles || FALLBACK_NEWS;
  const total = news.length;
  if (total === 0) return { total: 0, positive: 0, negative: 0, neutral: 0, ratio: "0" };
  const positive = news.filter(n => n.sentiment === "positive").length;
  const negative = news.filter(n => n.sentiment === "negative").length;
  const neutral = total - positive - negative;
  return { total, positive, negative, neutral, ratio: ((positive - negative) / total * 100).toFixed(0) };
}
