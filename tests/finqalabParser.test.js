import { describe, it, expect } from "vitest";
import { parseFinqalabText } from "../src/finqalab-parser.js";

// Entirely synthetic report text.
const REPORT = `Periodic Trade Details Report
Client Name: Test Investor
Period: 2026-01-01 to 2026-01-31
Total Records: 4
Security Trade No. Trade Date Settlement Date Type Rate Qty Total
AAAA 1000001 2026-01-05 2026-01-07 BUY 100.00 10 1000.00 0.50 5.00 12
AAAA 1000002 2026-01-10 2026-01-12 BUY 110.00 10 1100.00 0.50 5.00 13
BBBB 1000003 2026-01-11 2026-01-13 BUY 50.00 20 1000.00 0.25 5.00 10
BBBB 1000004 2026-01-20 2026-01-22 SELL 55.00 20 1100.00 0.25 5.00 11
BUY 30 3100.00
SELL 20 1100.00
TOTAL:`;

describe("parseFinqalabText", () => {
  const r = parseFinqalabText(REPORT);
  it("extracts metadata", () => {
    expect(r.meta).toEqual({ clientName: "Test Investor", period: "2026-01-01 to 2026-01-31", totalRecords: 4 });
  });
  it("parses trade rows and skips summary rows", () => {
    expect(r.trades).toHaveLength(4);
    expect(r.trades[0]).toMatchObject({
      ticker: "AAAA",
      tradeNo: "1000001",
      type: "BUY",
      rate: 100,
      qty: 10,
      total: 1000,
      cvt: 12,
    });
  });
  it("aggregates weighted average cost", () => {
    const a = r.positions.find((p) => p.ticker === "AAAA");
    expect(a.shares).toBe(20);
    expect(a.avgCost).toBe(105);
    expect(a.tradeCount).toBe(2);
    expect(a.buyDate).toBe("2026-01-05");
    expect(a.brokerFees).toBe(10);
  });
  it("drops fully sold positions", () => {
    expect(r.positions.find((p) => p.ticker === "BBBB")).toBeUndefined();
  });
  it("returns empty results for garbage text", () => {
    const e = parseFinqalabText("hello\nworld");
    expect(e.trades).toEqual([]);
    expect(e.positions).toEqual([]);
  });
});
