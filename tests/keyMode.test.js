import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getKeyMode,
  isLiveMode,
  setByokKey,
  clearByokKey,
  getByokKey,
  aiRequestHeaders,
  onKeyModeChange,
  BYOK_STORAGE_KEY,
} from "../src/config/keyMode.js";

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("keyMode", () => {
  it("defaults to demo", () => {
    vi.stubEnv("VITE_AI_MODE", "");
    expect(getKeyMode()).toBe("demo");
    expect(isLiveMode()).toBe(false);
    expect(aiRequestHeaders()["x-anthropic-key"]).toBeUndefined();
  });
  it("is byok when a key is saved, and sends it as a header", () => {
    setByokKey("  sk-test  ");
    expect(getKeyMode()).toBe("byok");
    expect(getByokKey()).toBe("sk-test");
    expect(aiRequestHeaders()["x-anthropic-key"]).toBe("sk-test");
    expect(isLiveMode()).toBe(true);
  });
  it("is server when VITE_AI_MODE=server and no key", () => {
    vi.stubEnv("VITE_AI_MODE", "server");
    expect(getKeyMode()).toBe("server");
    expect(aiRequestHeaders()["x-anthropic-key"]).toBeUndefined();
  });
  it("byok wins over server", () => {
    vi.stubEnv("VITE_AI_MODE", "server");
    setByokKey("sk-x");
    expect(getKeyMode()).toBe("byok");
  });
  it("clearing the key returns to demo", () => {
    vi.stubEnv("VITE_AI_MODE", "");
    setByokKey("sk-x");
    clearByokKey();
    expect(window.localStorage.getItem(BYOK_STORAGE_KEY)).toBeNull();
    expect(getKeyMode()).toBe("demo");
  });
  it("notifies subscribers on change and stops after unsubscribe", () => {
    vi.stubEnv("VITE_AI_MODE", "");
    const cb = vi.fn();
    const off = onKeyModeChange(cb);
    setByokKey("sk-y");
    expect(cb).toHaveBeenCalledWith("byok");
    off();
    clearByokKey();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
