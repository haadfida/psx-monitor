// Portfolio Intelligence Module
// Designed for: monthly investor, holds weeks-to-years, 50K PKR monthly budget
// NOT for day trading — signals are thesis-based, not price-target based

import { WATCHLIST_STOCKS, computeScore } from "./data.js";
import { getNewsForStock } from "./news.js";

// ============================================================
// SIGNAL TYPES — tuned for long-term holders
// ============================================================

export const SIGNAL_TYPES = {
  THESIS_BREAK: { label: "Thesis Breaking", color: "#ef4444", icon: "🚨", priority: 0 },
  MACRO_RISK: { label: "Macro Risk", color: "#f59e0b", icon: "⚠️", priority: 1 },
  ROTATE: { label: "Rotation Opportunity", color: "#22d3ee", icon: "🔄", priority: 2 },
  OVERWEIGHT: { label: "Rebalance Needed", color: "#a78bfa", icon: "⚖️", priority: 3 },
  TARGET_REACHED: { label: "Analyst Target Reached", color: "#10b981", icon: "🎯", priority: 2 },
  ADD_MORE: { label: "Good Entry to Add", color: "#10b981", icon: "📈", priority: 4 },
};

// ============================================================
// SELL SIGNAL ENGINE — thesis-based, not daily noise
// ============================================================

export function generateSellSignals(position, stock, portfolioValue) {
  const signals = [];
  const currentPrice = stock.price;
  const gainPct = ((currentPrice - position.avgCost) / position.avgCost) * 100;
  const positionValue = position.shares * currentPrice;
  const positionWeight = (positionValue / portfolioValue) * 100;
  const score = computeScore(stock);

  // Stop loss — only if user explicitly set one (respects their thesis)
  if (position.stopLoss && currentPrice <= position.stopLoss) {
    signals.push({
      type: "THESIS_BREAK",
      message: `Price ₨${currentPrice} hit your stop loss at ₨${position.stopLoss}`,
      action: "Review your thesis — if fundamentals still hold, consider removing stop loss. If not, exit.",
      urgency: "immediate",
    });
  }

  // Analyst target reached — not "sell now" but "review and decide"
  if (currentPrice >= stock.targetPrice * 0.95) {
    signals.push({
      type: "TARGET_REACHED",
      message: `Within 5% of analyst target ₨${stock.targetPrice} — thesis may be fully priced in`,
      action: `Consider taking partial profit or holding if you see further upside. You're up ${gainPct.toFixed(0)}%.`,
      urgency: "review",
    });
  }

  // Heavy news risk — only high-impact negative
  const stockNews = getNewsForStock(position.ticker);
  const criticalNegative = stockNews.filter(n => n.sentiment === "negative" && n.impactScore >= 75);
  if (criticalNegative.length > 0) {
    signals.push({
      type: "MACRO_RISK",
      message: `${criticalNegative.length} critical negative development(s) affecting ${position.ticker}`,
      action: "Read the news analysis — if it breaks your original buy thesis, consider reducing. If temporary, hold.",
      urgency: "review",
    });
  }

  // Score deterioration — fundamentals weakening
  if (score < 50) {
    signals.push({
      type: "THESIS_BREAK",
      message: `Stock score dropped to ${score}/100 — fundamentals may be weakening`,
      action: "Re-evaluate why you bought this. If the original thesis no longer holds, consider rotating out.",
      urgency: "review",
    });
  }

  // Overweight — but with higher threshold for long-term holders (30% not 25%)
  if (positionWeight > 30) {
    signals.push({
      type: "OVERWEIGHT",
      message: `${positionWeight.toFixed(1)}% of portfolio — concentrated risk`,
      action: `Consider trimming to ~20% and diversifying the proceeds into underweight sectors.`,
      urgency: "consider",
    });
  }

  // Good entry to add more — stock pulled back but fundamentals strong
  if (gainPct < -10 && score >= 65) {
    signals.push({
      type: "ADD_MORE",
      message: `Down ${Math.abs(gainPct).toFixed(1)}% from your entry but score is ${score}/100`,
      action: "Fundamentals still strong — consider averaging down with this month's allocation.",
      urgency: "consider",
    });
  }

  return signals.sort((a, b) => SIGNAL_TYPES[a.type].priority - SIGNAL_TYPES[b.type].priority);
}

// ============================================================
// MONTHLY ALLOCATION ADVISOR
// Cached 30 days in Supabase. No localStorage.
// ============================================================

import { getAdviceCache, saveAdviceCache } from "./supabase.js";

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

/**
 * Get monthly advice — Supabase cache first, Claude API if >30 days
 */
export async function getMonthlyAdvice(positions, budget = 50000) {
  if (!ANTHROPIC_API_KEY) {
    return { summary: "Add your Anthropic API key for personalized allocation advice.", allocations: [], rotations: [], _noKey: true };
  }

  // Check Supabase cache
  const cached = await getAdviceCache();
  if (cached && !cached.isStale) {
    return { ...cached.advice, _fromCache: true, _cacheAge: `${Math.round(cached.ageDays)}d ago` };
  }

  // Fetch fresh
  const fresh = await fetchMonthlyAdviceFromAPI(positions, budget);
  if (fresh) {
    await saveAdviceCache(fresh);
    return { ...fresh, _fromCache: false, _cacheAge: "just now" };
  }

  // API failed — stale cache
  if (cached) {
    return { ...cached.advice, _fromCache: true, _cacheAge: `${Math.round(cached.ageDays)}d ago (stale)` };
  }

  return null;
}

async function fetchMonthlyAdviceFromAPI(positions, budget) {
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
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `You are a PSX portfolio advisor for a long-term investor in Pakistan. 

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
}`
        }],
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const textBlocks = data.content?.filter(b => b.type === "text") || [];
    const fullText = textBlocks.map(b => b.text).join("");
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Monthly advice failed:", err);
    return null;
  }
}

// ============================================================
// PORTFOLIO CALCULATIONS
// ============================================================

export function calculatePositionPnL(position, stock) {
  const currentPrice = stock.price;
  const costBasis = position.shares * position.avgCost;
  const currentValue = position.shares * currentPrice;
  const unrealizedPnL = currentValue - costBasis;
  const unrealizedPnLPct = ((currentPrice - position.avgCost) / position.avgCost) * 100;
  const dayChange = (currentPrice - stock.prevClose) * position.shares;

  return {
    ticker: position.ticker,
    shares: position.shares,
    avgCost: position.avgCost,
    costBasis,
    currentPrice,
    currentValue,
    unrealizedPnL,
    unrealizedPnLPct,
    dayChange,
    targetSell: position.targetSell,
    stopLoss: position.stopLoss,
    upsideToTarget: ((stock.targetPrice - currentPrice) / currentPrice * 100),
  };
}

export function calculatePortfolioSummary(positions) {
  let totalCost = 0, totalValue = 0, totalDayChange = 0;

  const positionDetails = positions.map(pos => {
    const stock = WATCHLIST_STOCKS[pos.ticker];
    if (!stock) return null;
    const pnl = calculatePositionPnL(pos, stock);
    totalCost += pnl.costBasis;
    totalValue += pnl.currentValue;
    totalDayChange += pnl.dayChange;
    return pnl;
  }).filter(Boolean);

  return {
    positions: positionDetails,
    totalCost,
    totalValue,
    totalPnL: totalValue - totalCost,
    totalPnLPct: totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0,
    totalDayChange,
    totalDayChangePct: totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange) * 100) : 0,
  };
}

// ============================================================
// SAMPLE PORTFOLIO (Haad's actual Finqalab positions)
// ============================================================

export const SAMPLE_PORTFOLIO = [
  { ticker: "ENGROH", shares: 10, avgCost: 263.39, targetSell: null, stopLoss: null, highSinceBuy: 268, notes: "Conglomerate play", buyDate: "2026-03-17" },
  { ticker: "HBL", shares: 5, avgCost: 259.95, targetSell: null, stopLoss: null, highSinceBuy: 335, notes: "Dividend yield", buyDate: "2026-03-19" },
  { ticker: "LUCK", shares: 15, avgCost: 349.36, targetSell: null, stopLoss: null, highSinceBuy: 490, notes: "Cement + CPEC", buyDate: "2026-03-17" },
  { ticker: "MARI", shares: 3, avgCost: 598.99, targetSell: null, stopLoss: null, highSinceBuy: 605, notes: "Gas E&P value", buyDate: "2026-03-17" },
  { ticker: "MEBL", shares: 5, avgCost: 440, targetSell: null, stopLoss: null, highSinceBuy: 488, notes: "Shariah core", buyDate: "2026-03-19" },
  { ticker: "MZNPETF", shares: 500, avgCost: 18.22, targetSell: null, stopLoss: null, highSinceBuy: 18.50, notes: "Index exposure", buyDate: "2026-03-17" },
  { ticker: "OGDC", shares: 25, avgCost: 263.54, targetSell: null, stopLoss: null, highSinceBuy: 268, notes: "E&P deep value", buyDate: "2026-03-17" },
  { ticker: "PAEL", shares: 100, avgCost: 35.52, targetSell: null, stopLoss: null, highSinceBuy: 36, notes: "Consumer recovery", buyDate: "2026-03-17" },
  { ticker: "PPL", shares: 4, avgCost: 214, targetSell: null, stopLoss: null, highSinceBuy: 262, notes: "Energy value", buyDate: "2026-03-19" },
  { ticker: "PSO", shares: 13, avgCost: 357.27, targetSell: null, stopLoss: null, highSinceBuy: 467, notes: "Circular debt play", buyDate: "2026-03-17" },
  { ticker: "SNGP", shares: 10, avgCost: 90.60, targetSell: null, stopLoss: null, highSinceBuy: 92, notes: "Gas utility", buyDate: "2026-03-17" },
  { ticker: "SYS", shares: 4, avgCost: 127, targetSell: null, stopLoss: null, highSinceBuy: 520, notes: "USD hedge", buyDate: "2026-03-19" },
  { ticker: "UBL", shares: 3, avgCost: 372.69, targetSell: null, stopLoss: null, highSinceBuy: 460, notes: "Deep value bank", buyDate: "2026-03-19" },
];
