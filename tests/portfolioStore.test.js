import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { localAdapter, storeFor, supabaseAdapter, isSupabaseConfigured } from "../src/store/portfolioStore.js";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("localAdapter", () => {
  it("returns [] and reports nothing saved on a fresh browser", async () => {
    expect(localAdapter.hasSavedPositions()).toBe(false);
    expect(await localAdapter.loadPositions()).toEqual([]);
  });
  it("round-trips positions", async () => {
    const p = [{ ticker: "AAA", shares: 1, avgCost: 10 }];
    expect(await localAdapter.savePositions(p)).toEqual({ success: true });
    expect(localAdapter.hasSavedPositions()).toBe(true);
    expect(await localAdapter.loadPositions()).toEqual(p);
  });
  it("treats an empty saved list as saved", async () => {
    await localAdapter.savePositions([]);
    expect(localAdapter.hasSavedPositions()).toBe(true);
  });
  it("deletes a position by ticker", async () => {
    await localAdapter.savePositions([{ ticker: "A" }, { ticker: "B" }]);
    await localAdapter.deletePosition("A");
    expect(await localAdapter.loadPositions()).toEqual([{ ticker: "B" }]);
  });
  it("survives corrupt JSON", async () => {
    window.localStorage.setItem("psx.positions", "{not json");
    expect(await localAdapter.loadPositions()).toEqual([]);
  });
  it("caches news with a fresh/stale flag", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    await localAdapter.saveNewsCache({ articles: [] });
    expect((await localAdapter.getNewsCache()).isStale).toBe(false);
    vi.setSystemTime(new Date("2026-03-02T01:00:00Z"));
    expect((await localAdapter.getNewsCache()).isStale).toBe(true);
  });
  it("caches advice with a 30-day staleness window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    await localAdapter.saveAdviceCache({ summary: "x" });
    vi.setSystemTime(new Date("2026-03-20T00:00:00Z"));
    expect((await localAdapter.getAdviceCache()).isStale).toBe(false);
    vi.setSystemTime(new Date("2026-04-05T00:00:00Z"));
    expect((await localAdapter.getAdviceCache()).isStale).toBe(true);
  });
  it("returns null caches when empty", async () => {
    expect(await localAdapter.getNewsCache()).toBeNull();
    expect(await localAdapter.getAdviceCache()).toBeNull();
  });
});

describe("storeFor", () => {
  it("uses local when Supabase is not configured", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
    expect(storeFor({ id: 1 })).toBe(localAdapter);
  });
  it("uses Supabase only when configured and signed in", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.invalid");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "k");
    expect(storeFor({ id: 1 })).toBe(supabaseAdapter);
    expect(storeFor(null)).toBe(localAdapter);
  });
});
