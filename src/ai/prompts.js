// Prompt builders shared by the browser (live mode) and scripts/build-ai-snapshot.mjs.
// Pure functions: no browser or Vite APIs, so Node can import this file.

import { WATCHLIST_STOCKS, computeScore } from "../data.js";

export function buildNewsPrompt(tickers) {
  return `You are a PSX (Pakistan Stock Exchange) portfolio analyst. Search for major news from the last 24 hours that could affect these stocks: ${tickers.join(", ")}

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
}`;
}

export function buildAdvicePrompt(positions, budget) {
  const portfolioContext = positions.map(pos => {
    const stock = WATCHLIST_STOCKS[pos.ticker];
    if (!stock) return null;
    const gainPct = ((stock.price - pos.avgCost) / pos.avgCost * 100).toFixed(1);
    return `${pos.ticker}: ${pos.shares} shares @ ₨${pos.avgCost} avg → ₨${stock.price} now (${gainPct}%), P/E ${stock.pe}, Score ${computeScore(stock)}/100, ${stock.sector}`;
  }).filter(Boolean).join("\n");

  const totalValue = positions.reduce((sum, pos) => {
    const stock = WATCHLIST_STOCKS[pos.ticker];
    return sum + (stock ? pos.shares * stock.price : 0);
  }, 0);

  return `You are a PSX portfolio advisor for a long-term investor in Pakistan.

PORTFOLIO (total value: ₨${totalValue.toLocaleString()}):
${portfolioContext}

BUDGET: ₨${budget.toLocaleString()} to invest this month.
STYLE: Holds weeks to years. Not a day trader. Prefers value + growth. Shariah-compliant stocks preferred but not required.

Search for current PSX market conditions, then advise:
1. How to allocate the ₨${budget.toLocaleString()} this month
2. Whether to rotate any existing positions
3. Whether to hold cash and wait for better entries

Respond ONLY in valid JSON with no markdown:
{
  "summary": "2-3 sentence overall advice for this month",
  "marketCondition": "bullish|bearish|neutral|volatile",
  "allocations": [
    { "ticker": "OGDC", "amount": 15000, "reason": "1 sentence why" }
  ],
  "rotations": [
    { "sell": "SNGP", "buy": "PPL", "reason": "1 sentence why" }
  ],
  "holdCash": { "amount": 0, "reason": "why hold cash or not" },
  "keyRisk": "biggest risk to watch this month"
}`;
}

/** Pull the first JSON object out of model text. Returns null if none parses. */
export function extractJson(text) {
  const match = (text || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/** Normalize parsed news so the UI can render it (ids, timestamps, tags). */
export function normalizeNews(parsed, idPrefix = "live", timestamp = new Date().toISOString()) {
  if (!parsed) return null;
  return {
    ...parsed,
    articles: (parsed.articles || []).map((a, i) => ({
      ...a,
      id: a.id || `${idPrefix}-${i}`,
      timestamp: a.timestamp || timestamp,
      tags: a.tags || [a.category],
    })),
  };
}
