import { describe, it, expect } from "vitest";
import { computeScore, WATCHLIST_STOCKS } from "../src/data.js";

const base = { pe: 20, price: 100, targetPrice: 100, analystRating: "Hold", dividendYield: 0, roe: 0, beta: 1.1 };

describe("computeScore", () => {
  it("starts at 50 and penalises high P/E", () => {
    expect(computeScore(base)).toBe(45);
  });
  it("rewards low P/E in tiers", () => {
    expect(computeScore({ ...base, pe: 6 })).toBe(65);
    expect(computeScore({ ...base, pe: 9 })).toBe(60);
    expect(computeScore({ ...base, pe: 12 })).toBe(55);
  });
  it("rewards upside to target in tiers", () => {
    expect(computeScore({ ...base, targetPrice: 135 })).toBe(60);
    expect(computeScore({ ...base, targetPrice: 125 })).toBe(55);
    expect(computeScore({ ...base, targetPrice: 115 })).toBe(50);
  });
  it("rewards analyst rating, yield, roe and low beta", () => {
    expect(computeScore({ ...base, analystRating: "Strong Buy" })).toBe(55);
    expect(computeScore({ ...base, analystRating: "Buy" })).toBe(50);
    expect(computeScore({ ...base, dividendYield: 6 })).toBe(55);
    expect(computeScore({ ...base, dividendYield: 4 })).toBe(50);
    expect(computeScore({ ...base, roe: 25 })).toBe(50);
    expect(computeScore({ ...base, beta: 0.8 })).toBe(50);
    expect(computeScore({ ...base, beta: 1.5 })).toBe(40);
  });
  it("clamps to 0..100", () => {
    const best = {
      pe: 5,
      price: 100,
      targetPrice: 200,
      analystRating: "Strong Buy",
      dividendYield: 9,
      roe: 30,
      beta: 0.5,
    };
    expect(computeScore(best)).toBe(100);
    expect(
      computeScore({ ...best, pe: 50, targetPrice: 1, analystRating: "Sell", dividendYield: 0, roe: 0, beta: 2 }),
    ).toBeGreaterThanOrEqual(0);
  });
  it("scores every watchlist stock within bounds", () => {
    for (const s of Object.values(WATCHLIST_STOCKS)) {
      const v = computeScore(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
