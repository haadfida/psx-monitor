// News Intelligence Module
// Fetches news via web search API and analyzes impact using Claude API
// For production: set VITE_ANTHROPIC_API_KEY in .env

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

// RSS/News sources for Pakistan market
const NEWS_SOURCES = [
  { name: "Business Recorder", url: "https://www.brecorder.com" },
  { name: "Dawn Business", url: "https://www.dawn.com/business" },
  { name: "The News Intl", url: "https://www.thenews.com.pk/latest/category/business" },
  { name: "Reuters Pakistan", url: "https://www.reuters.com" },
];

// Fallback news data (when API is unavailable)
export const FALLBACK_NEWS = [
  {
    id: "n1",
    headline: "Iran conflict pushes Brent crude above $85, Hormuz transit disrupted",
    source: "Reuters",
    timestamp: "2026-03-19T08:30:00Z",
    category: "geopolitics",
    sentiment: "negative",
    impactScore: 85,
    affectedTickers: ["PSO", "PPL"],
    analysis: "Oil price surge directly impacts Pakistan's import bill and energy sector. PSO faces margin pressure from govt price caps despite volume gains. PPL may benefit from higher wellhead gas prices but circular debt delays realizations.",
    tags: ["oil", "iran", "energy", "hormuz"],
  },
  {
    id: "n2",
    headline: "SBP holds policy rate at 10.5% amid Middle East uncertainty",
    source: "Business Recorder",
    timestamp: "2026-03-18T14:00:00Z",
    category: "monetary_policy",
    sentiment: "neutral",
    impactScore: 70,
    affectedTickers: ["UBL", "HBL", "MCB", "MEBL"],
    analysis: "Rate pause preserves bank NIMs in the short term but signals SBP caution on further easing. Banking sector benefits from prolonged higher rates but equity market re-rating may slow. MEBL's Islamic banking model is relatively rate-insensitive.",
    tags: ["interest rates", "SBP", "banking", "monetary policy"],
  },
  {
    id: "n3",
    headline: "Pakistan IT exports surge 23% YoY in Feb 2026, SYS leads listed players",
    source: "Dawn Business",
    timestamp: "2026-03-17T10:00:00Z",
    category: "sector",
    sentiment: "positive",
    impactScore: 65,
    affectedTickers: ["SYS"],
    analysis: "IT export momentum continues. Systems Limited as the largest listed IT exporter is the primary beneficiary. USD revenue stream strengthens as PKR faces pressure. AI/digital transformation demand from global clients remains robust.",
    tags: ["IT exports", "technology", "SYS", "USD revenue"],
  },
  {
    id: "n4",
    headline: "KSE-100 drops 10% from January ATH amid global risk-off sentiment",
    source: "The News International",
    timestamp: "2026-03-18T16:00:00Z",
    category: "market",
    sentiment: "negative",
    impactScore: 60,
    affectedTickers: ["UBL", "HBL", "MCB", "MEBL", "PSO", "PPL", "SYS", "LUCK"],
    analysis: "Broad market correction from 189,556 ATH creates potential buying opportunities in fundamentally strong names. High-beta stocks (UBL, PPL) hit harder than defensive names (MEBL, MCB). Correction is healthy after 65% 12-month rally.",
    tags: ["KSE-100", "correction", "market sentiment"],
  },
  {
    id: "n5",
    headline: "PKR weakens to 282/USD as oil import bill pressure mounts",
    source: "Business Recorder",
    timestamp: "2026-03-19T09:00:00Z",
    category: "forex",
    sentiment: "mixed",
    impactScore: 55,
    affectedTickers: ["SYS", "PSO", "LUCK"],
    analysis: "Weaker rupee is a double-edged sword. SYS benefits directly (USD revenues translate to higher PKR earnings). PSO and importers face higher input costs. LUCK's cement exports to Afghanistan/Iraq get a small competitiveness boost.",
    tags: ["PKR", "exchange rate", "currency", "imports"],
  },
  {
    id: "n6",
    headline: "CPEC Phase II: Pakistan approves $2.3B infrastructure projects for 2026",
    source: "Dawn Business",
    timestamp: "2026-03-16T11:00:00Z",
    category: "infrastructure",
    sentiment: "positive",
    impactScore: 60,
    affectedTickers: ["LUCK"],
    analysis: "New CPEC infrastructure approvals directly benefit cement demand. Lucky Cement's northern region exposure and export capabilities position it well. Construction activity expected to accelerate in H2 2026.",
    tags: ["CPEC", "infrastructure", "cement", "construction"],
  },
  {
    id: "n7",
    headline: "IMF review: Pakistan on track with fiscal targets, circular debt resolution progressing",
    source: "Reuters",
    timestamp: "2026-03-15T08:00:00Z",
    category: "macro",
    sentiment: "positive",
    impactScore: 75,
    affectedTickers: ["PSO", "PPL", "UBL", "HBL"],
    analysis: "IMF program compliance is critical for market confidence. Circular debt resolution directly benefits PSO and PPL — any acceleration in government payments would unlock significant free cash flow. Banking sector benefits from overall macro stability.",
    tags: ["IMF", "fiscal", "circular debt", "macro stability"],
  },
  {
    id: "n8",
    headline: "NDMA warns of severe 2026 monsoon: up to 26% above average rainfall expected",
    source: "The News International",
    timestamp: "2026-03-14T12:00:00Z",
    category: "climate",
    sentiment: "negative",
    impactScore: 45,
    affectedTickers: ["LUCK", "PPL"],
    analysis: "Monsoon risk is a medium-term concern. Heavy flooding could disrupt construction activity (negative for LUCK) and damage energy infrastructure (negative for PPL). Insurance and preparedness costs may rise.",
    tags: ["monsoon", "climate", "flood risk", "infrastructure"],
  },
  {
    id: "n9",
    headline: "Remittances hit $3.29B in February, 8M FY26 total reaches $26.49B",
    source: "Business Recorder",
    timestamp: "2026-03-17T14:00:00Z",
    category: "macro",
    sentiment: "positive",
    impactScore: 50,
    affectedTickers: ["MEBL", "UBL", "HBL"],
    analysis: "Strong remittance inflows support PKR stability and banking sector deposits. UBL's Middle East franchise is a direct beneficiary. Meezan Bank captures Islamic banking share of remittance flows. Positive for overall consumer sentiment.",
    tags: ["remittances", "forex", "banking", "consumer"],
  },
  {
    id: "n10",
    headline: "AWS Middle East data centers hit by Iranian drone strikes — cloud disruption spreads",
    source: "Reuters",
    timestamp: "2026-03-19T06:00:00Z",
    category: "geopolitics",
    sentiment: "negative",
    impactScore: 40,
    affectedTickers: ["SYS"],
    analysis: "Cloud infrastructure disruption in Middle East could affect SYS clients indirectly. However, SYS primarily serves North American/European clients. Risk is limited but highlights geopolitical fragility of tech supply chains.",
    tags: ["AWS", "cloud", "iran", "technology infrastructure"],
  },
];

// Analyze news impact on a specific stock using Claude API
export async function analyzeNewsImpact(news, stockTicker, stockData) {
  if (!ANTHROPIC_API_KEY) {
    // Return pre-computed analysis from fallback data
    return news
      .filter(n => n.affectedTickers.includes(stockTicker))
      .map(n => ({
        ...n,
        stockSpecificImpact: n.analysis,
      }));
  }

  try {
    const relevantNews = news.filter(n =>
      n.affectedTickers.includes(stockTicker) ||
      n.tags.some(tag =>
        stockData.newsKeywords?.some(kw => kw.toLowerCase().includes(tag.toLowerCase()))
      )
    );

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Analyze these news items and their specific impact on ${stockTicker} (${stockData.name}, ${stockData.sector} sector, P/E: ${stockData.pe}, Beta: ${stockData.beta}).

News items:
${relevantNews.map(n => `- ${n.headline} (${n.source})`).join("\n")}

Respond ONLY in JSON format with no preamble:
{
  "overallSentiment": "positive" | "negative" | "neutral" | "mixed",
  "impactScore": 0-100,
  "summary": "2-3 sentence analysis of combined news impact on this stock",
  "actionableInsight": "1 sentence — what should an investor consider",
  "riskLevel": "low" | "medium" | "high"
}`
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return { ...JSON.parse(clean), newsItems: relevantNews };
  } catch (err) {
    console.error("Claude API analysis failed:", err);
    return null;
  }
}

// Fetch live news via web search (requires API key)
export async function fetchLiveNews(query) {
  if (!ANTHROPIC_API_KEY) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Search for the latest news about: ${query}. Focus on Pakistan Stock Exchange, economy, and market-moving events from the last 48 hours. Respond ONLY in JSON with no preamble:
{
  "articles": [
    {
      "headline": "...",
      "source": "...",
      "sentiment": "positive|negative|neutral|mixed",
      "impactScore": 0-100,
      "affectedSectors": ["Banking", "Energy", etc],
      "summary": "1-2 sentences"
    }
  ]
}`
        }],
      }),
    });

    const data = await response.json();
    const textBlocks = data.content?.filter(b => b.type === "text") || [];
    const text = textBlocks.map(b => b.text).join("");
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error("Live news fetch failed:", err);
    return null;
  }
}

export function getNewsForStock(ticker) {
  return FALLBACK_NEWS.filter(n => n.affectedTickers.includes(ticker));
}

export function getLatestNews(count = 10) {
  return FALLBACK_NEWS
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, count);
}

export function getNewsSentimentSummary() {
  const total = FALLBACK_NEWS.length;
  const positive = FALLBACK_NEWS.filter(n => n.sentiment === "positive").length;
  const negative = FALLBACK_NEWS.filter(n => n.sentiment === "negative").length;
  const neutral = FALLBACK_NEWS.filter(n => n.sentiment === "neutral" || n.sentiment === "mixed").length;
  return { total, positive, negative, neutral, ratio: ((positive - negative) / total * 100).toFixed(0) };
}
