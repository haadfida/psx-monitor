// Portfolio Intelligence Module
// Private position tracking with buy/sell signal engine
// Data persists in browser storage — never sent to any server

import { WATCHLIST_STOCKS, computeScore } from "./data.js";
import { getNewsForStock } from "./news.js";

// ============================================================
// SELL SIGNAL ENGINE
// ============================================================

// Signal types with severity levels
export const SIGNAL_TYPES = {
  TARGET_HIT: { label: "Target Hit", color: "#10b981", icon: "🎯", priority: 1 },
  STOP_LOSS: { label: "Stop Loss", color: "#ef4444", icon: "🛑", priority: 0 },
  TRAILING_STOP: { label: "Trailing Stop", color: "#f59e0b", icon: "📉", priority: 0 },
  TAKE_PROFIT: { label: "Take Partial Profit", color: "#22d3ee", icon: "💰", priority: 2 },
  NEWS_RISK: { label: "News Risk Alert", color: "#f59e0b", icon: "⚠️", priority: 1 },
  SCORE_DROP: { label: "Score Deteriorated", color: "#f59e0b", icon: "📊", priority: 2 },
  OVERWEIGHT: { label: "Overweight Position", color: "#a78bfa", icon: "⚖️", priority: 3 },
  HIGH_GAIN: { label: "Lock In Gains", color: "#10b981", icon: "🔒", priority: 2 },
};

export function generateSellSignals(position, stock, portfolioValue) {
  const signals = [];
  const currentPrice = stock.price;
  const gainPct = ((currentPrice - position.avgCost) / position.avgCost) * 100;
  const positionValue = position.shares * currentPrice;
  const positionWeight = (positionValue / portfolioValue) * 100;

  // Stop loss check
  if (position.stopLoss && currentPrice <= position.stopLoss) {
    signals.push({
      type: "STOP_LOSS",
      message: `Price ₨${currentPrice} hit stop loss at ₨${position.stopLoss}`,
      action: "SELL ALL",
      urgency: "immediate",
    });
  }

  // Trailing stop (if price dropped >10% from position high)
  if (position.highSinceBuy) {
    const dropFromHigh = ((position.highSinceBuy - currentPrice) / position.highSinceBuy) * 100;
    if (dropFromHigh > 10 && gainPct > 0) {
      signals.push({
        type: "TRAILING_STOP",
        message: `Down ${dropFromHigh.toFixed(1)}% from peak of ₨${position.highSinceBuy}`,
        action: "Consider selling to protect gains",
        urgency: "soon",
      });
    }
  }

  // Target hit
  if (position.targetSell && currentPrice >= position.targetSell) {
    signals.push({
      type: "TARGET_HIT",
      message: `Price ₨${currentPrice} reached your target of ₨${position.targetSell}`,
      action: "SELL — target achieved",
      urgency: "immediate",
    });
  }

  // Take partial profit at analyst target
  if (currentPrice >= stock.targetPrice * 0.95) {
    signals.push({
      type: "TAKE_PROFIT",
      message: `Within 5% of analyst target ₨${stock.targetPrice}`,
      action: "Consider taking partial profit (sell 30-50%)",
      urgency: "soon",
    });
  }

  // High unrealized gains (>30%)
  if (gainPct > 30) {
    signals.push({
      type: "HIGH_GAIN",
      message: `${gainPct.toFixed(1)}% unrealized gain — consider locking in`,
      action: `Sell enough to recover your cost basis (${Math.ceil(position.shares * position.avgCost / currentPrice)} shares)`,
      urgency: "consider",
    });
  }

  // News risk
  const stockNews = getNewsForStock(position.ticker);
  const highImpactNegative = stockNews.filter(n => n.sentiment === "negative" && n.impactScore >= 70);
  if (highImpactNegative.length > 0) {
    signals.push({
      type: "NEWS_RISK",
      message: `${highImpactNegative.length} high-impact negative news item(s)`,
      action: "Review news and consider reducing exposure",
      urgency: "soon",
    });
  }

  // Score deterioration
  const score = computeScore(stock);
  if (score < 55 && gainPct > 10) {
    signals.push({
      type: "SCORE_DROP",
      message: `Stock score dropped to ${score}/100 — fundamentals weakening`,
      action: "Re-evaluate thesis, consider trimming",
      urgency: "consider",
    });
  }

  // Overweight
  if (positionWeight > 25) {
    signals.push({
      type: "OVERWEIGHT",
      message: `${positionWeight.toFixed(1)}% of portfolio — too concentrated`,
      action: `Trim to <20% (sell ~${Math.ceil((positionWeight - 20) / 100 * portfolioValue / currentPrice)} shares)`,
      urgency: "consider",
    });
  }

  return signals.sort((a, b) => SIGNAL_TYPES[a.type].priority - SIGNAL_TYPES[b.type].priority);
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
  const dayChangePct = ((currentPrice - stock.prevClose) / stock.prevClose) * 100;

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
    dayChangePct,
    targetSell: position.targetSell,
    stopLoss: position.stopLoss,
    upsideToTarget: position.targetSell
      ? ((position.targetSell - currentPrice) / currentPrice * 100)
      : ((stock.targetPrice - currentPrice) / currentPrice * 100),
  };
}

export function calculatePortfolioSummary(positions) {
  let totalCost = 0;
  let totalValue = 0;
  let totalDayChange = 0;

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
    cashRemaining: 0, // Can be extended
  };
}

// ============================================================
// SAMPLE PORTFOLIO (for first-time users)
// ============================================================

export const SAMPLE_PORTFOLIO = [
  { ticker: "PSO", shares: 50, avgCost: 430, targetSell: 600, stopLoss: 400, highSinceBuy: 506, notes: "Circular debt play", buyDate: "2025-12-15" },
  { ticker: "MEBL", shares: 40, avgCost: 420, targetSell: 650, stopLoss: 380, highSinceBuy: 505, notes: "Shariah compliant core", buyDate: "2025-11-20" },
  { ticker: "SYS", shares: 30, avgCost: 460, targetSell: 650, stopLoss: 420, highSinceBuy: 580, notes: "USD hedge", buyDate: "2025-10-10" },
  { ticker: "PPL", shares: 80, avgCost: 220, targetSell: 350, stopLoss: 200, highSinceBuy: 284, notes: "Energy value play", buyDate: "2025-09-05" },
];
