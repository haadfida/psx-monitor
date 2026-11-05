import { describe, it, expect } from "vitest";
import { generateSellSignals, SIGNAL_TYPES, SAMPLE_PORTFOLIO } from "../src/portfolio.js";
import { WATCHLIST_STOCKS, computeScore } from "../src/data.js";

// HBL has no critical negative news in the bundled fallback set; PSO has one (n1).
const calm = { ...WATCHLIST_STOCKS.HBL };
const pos = (over = {}) => ({ ticker: "HBL", shares: 10, avgCost: calm.price, stopLoss: null, ...over });
const types = (sigs) => sigs.map((s) => s.type);
const BIG = 1e9; // large portfolio so weight never trips OVERWEIGHT

describe("generateSellSignals", () => {
  it("emits nothing for a calm, flat position", () => {
    expect(generateSellSignals(pos(), calm, BIG)).toEqual([]);
  });
  it("THESIS_BREAK when the stop loss is hit", () => {
    const s = generateSellSignals(pos({ stopLoss: calm.price + 1 }), calm, BIG);
    expect(types(s)).toEqual(["THESIS_BREAK"]);
    expect(s[0].urgency).toBe("immediate");
  });
  it("ignores stop loss when price is above it", () => {
    expect(generateSellSignals(pos({ stopLoss: calm.price - 1 }), calm, BIG)).toEqual([]);
  });
  it("TARGET_REACHED within 5% of analyst target", () => {
    const stock = { ...calm, price: 100, targetPrice: 104 };
    const s = generateSellSignals(pos({ avgCost: 100 }), stock, BIG);
    expect(types(s)).toContain("TARGET_REACHED");
  });
  it("MACRO_RISK for critical negative news on the ticker", () => {
    const stock = WATCHLIST_STOCKS.PSO;
    const s = generateSellSignals({ ticker: "PSO", shares: 1, avgCost: stock.price, stopLoss: null }, stock, BIG);
    expect(types(s)).toContain("MACRO_RISK");
  });
  it("THESIS_BREAK when the composite score drops below 50", () => {
    const weakNoUpside = {
      price: 100,
      targetPrice: 100,
      pe: 30,
      beta: 1.6,
      analystRating: "Hold",
      dividendYield: 0,
      roe: 0,
    };
    expect(computeScore(weakNoUpside)).toBeLessThan(50);
    const s = generateSellSignals(pos({ avgCost: 100 }), weakNoUpside, BIG);
    expect(types(s)).toContain("THESIS_BREAK");
    expect(s[0].message).toMatch(/score dropped/);
  });
  it("OVERWEIGHT above 30% of the portfolio", () => {
    const s = generateSellSignals(pos({ shares: 100 }), calm, calm.price * 100 * 2);
    expect(types(s)).toEqual(["OVERWEIGHT"]);
  });
  it("ADD_MORE when down more than 10% with a strong score", () => {
    const s = generateSellSignals(pos({ avgCost: calm.price * 1.2 }), calm, BIG);
    expect(types(s)).toEqual(["ADD_MORE"]);
  });
  it("does not emit ADD_MORE when the drop is under 10%", () => {
    expect(generateSellSignals(pos({ avgCost: calm.price * 1.05 }), calm, BIG)).toEqual([]);
  });
  it("sorts signals by priority", () => {
    const s = generateSellSignals(
      pos({ stopLoss: calm.price + 1, avgCost: calm.price * 1.3, shares: 100 }),
      calm,
      calm.price * 100 * 2,
    );
    const prios = s.map((x) => SIGNAL_TYPES[x.type].priority);
    expect([...prios].sort((a, b) => a - b)).toEqual(prios);
    expect(s[0].type).toBe("THESIS_BREAK");
  });
  it("only emits known signal types", () => {
    for (const p of SAMPLE_PORTFOLIO) {
      for (const sig of generateSellSignals(p, WATCHLIST_STOCKS[p.ticker], 160000)) {
        expect(SIGNAL_TYPES).toHaveProperty(sig.type);
      }
    }
  });
  it("sample portfolio demo produces several signals", () => {
    const total = SAMPLE_PORTFOLIO.reduce((a, p) => a + p.shares * WATCHLIST_STOCKS[p.ticker].price, 0);
    const all = SAMPLE_PORTFOLIO.flatMap((p) => generateSellSignals(p, WATCHLIST_STOCKS[p.ticker], total));
    expect(new Set(types(all)).size).toBeGreaterThanOrEqual(4);
  });
});
