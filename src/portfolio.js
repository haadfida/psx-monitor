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
// demo → seeded snapshot. byok/server → /api/claude, cached 30 days in the
// portfolio store (localStorage, or Supabase when signed in).
// ============================================================

import { getKeyMode } from "./config/keyMode.js";
import { activeStore } from "./store/portfolioStore.js";
import { callClaude } from "./ai/client.js";
import { buildAdvicePrompt, extractJson } from "./ai/prompts.js";
import { loadSnapshot, formatSnapshotDate } from "./ai/snapshot.js";

async function snapshotAdvice(note) {
  const snap = await loadSnapshot();
  if (!snap?.advice) return null;
  return {
    ...snap.advice,
    _demo: true,
    _fromCache: true,
    _cacheAge: `${snap.source || "seeded demo"} · ${formatSnapshotDate(snap.generatedAt)}`,
    _demoNote: note || null,
  };
}

/**
 * Get monthly advice.
 * @param {{ allowLive?: boolean }} opts  allowLive=false forces the snapshot
 */
export async function getMonthlyAdvice(positions, budget = 50000, { allowLive = true } = {}) {
  if (getKeyMode() === "demo" || !allowLive) return snapshotAdvice();

  const store = await activeStore();
  const cached = await store.getAdviceCache();
  if (cached && !cached.isStale) {
    return { ...cached.advice, _fromCache: true, _cacheAge: `${Math.round(cached.ageDays)}d ago` };
  }

  const fresh = extractJson(await callClaude(buildAdvicePrompt(positions, budget), 16000));
  if (fresh) {
    await store.saveAdviceCache(fresh);
    return { ...fresh, _fromCache: false, _cacheAge: "just now" };
  }

  if (cached) {
    return { ...cached.advice, _fromCache: true, _cacheAge: `${Math.round(cached.ageDays)}d ago (stale)` };
  }

  return snapshotAdvice("Live advice is unavailable right now — showing the demo snapshot.");
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
// SAMPLE PORTFOLIO — fictional demo holdings (not real positions)
// ============================================================

export const SAMPLE_PORTFOLIO = [
  { ticker: "PSO", shares: 110, avgCost: 421.4, targetSell: null, stopLoss: null, highSinceBuy: 480, notes: "Circular debt play", buyDate: "2026-01-14" },
  { ticker: "MCB", shares: 20, avgCost: 455, targetSell: null, stopLoss: 440, highSinceBuy: 470, notes: "Bank, stop set", buyDate: "2026-02-03" },
  { ticker: "PPL", shares: 60, avgCost: 301.2, targetSell: null, stopLoss: null, highSinceBuy: 310, notes: "Energy value", buyDate: "2026-01-27" },
  { ticker: "SYS", shares: 12, avgCost: 610, targetSell: null, stopLoss: null, highSinceBuy: 640, notes: "USD hedge", buyDate: "2026-02-10" },
  { ticker: "OGDC", shares: 30, avgCost: 241.5, targetSell: null, stopLoss: null, highSinceBuy: 275, notes: "E&P value", buyDate: "2026-02-17" },
  { ticker: "HBL", shares: 40, avgCost: 301.5, targetSell: null, stopLoss: null, highSinceBuy: 340, notes: "Dividend yield", buyDate: "2026-01-20" },
  { ticker: "MEBL", shares: 25, avgCost: 421, targetSell: null, stopLoss: null, highSinceBuy: 495, notes: "Shariah core", buyDate: "2026-02-24" },
  { ticker: "UBL", shares: 10, avgCost: 438.8, targetSell: null, stopLoss: null, highSinceBuy: 472, notes: "Bank value", buyDate: "2026-02-03" },
  { ticker: "LUCK", shares: 20, avgCost: 452, targetSell: null, stopLoss: null, highSinceBuy: 505, notes: "Cement", buyDate: "2026-03-03" },
  { ticker: "SNGP", shares: 80, avgCost: 101.3, targetSell: null, stopLoss: null, highSinceBuy: 104, notes: "Gas utility", buyDate: "2026-01-14" },
  { ticker: "PAEL", shares: 150, avgCost: 33.8, targetSell: null, stopLoss: null, highSinceBuy: 37, notes: "Recovery bet", buyDate: "2026-03-03" },
  { ticker: "MZNPETF", shares: 1000, avgCost: 17.4, targetSell: null, stopLoss: null, highSinceBuy: 18.6, notes: "Index exposure", buyDate: "2026-01-27" },
];
