import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), "public/data/ai-snapshot.json"), "utf8"));

const schema = z.object({
  generatedAt: z.string().datetime(),
  source: z.string(),
  model: z.string().nullable(),
  note: z.string(),
  tickers: z.array(z.string().min(1)).min(1),
  news: z.object({
    articles: z
      .array(
        z.object({
          id: z.string(),
          headline: z.string(),
          source: z.string(),
          timestamp: z.string(),
          category: z.string(),
          sentiment: z.string(),
          impactScore: z.number().min(0).max(100),
          affectedTickers: z.array(z.string()),
          analysis: z.string(),
          tags: z.array(z.string()),
          urgency: z.string(),
        }),
      )
      .min(1),
    overallSentiment: z.string(),
    marketSummary: z.string(),
    topAction: z.string(),
  }),
  advice: z.object({
    summary: z.string(),
    marketCondition: z.string(),
    allocations: z.array(z.object({ ticker: z.string(), amount: z.number().positive(), reason: z.string() })).min(1),
    rotations: z.array(z.object({ sell: z.string(), buy: z.string(), reason: z.string() })),
    holdCash: z.object({ amount: z.number().min(0), reason: z.string() }),
    keyRisk: z.string(),
  }),
});

describe("ai-snapshot.json", () => {
  it("matches the schema", () => {
    const r = schema.safeParse(snapshot);
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
  });
  it("only references tickers listed in the snapshot", () => {
    const known = new Set(snapshot.tickers);
    for (const a of snapshot.advice.allocations) expect(known.has(a.ticker)).toBe(true);
    for (const r of snapshot.advice.rotations) {
      expect(known.has(r.sell)).toBe(true);
      expect(known.has(r.buy)).toBe(true);
    }
  });
});
