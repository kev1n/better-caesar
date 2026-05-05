import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defineCreditPool } from "./credit-pool";

// jsdom doesn't ship a chrome global. Provide a minimal in-memory shim that
// matches what defineCreditPool actually touches: storage.local.{get,set},
// storage.onChanged.addListener, runtime.sendMessage.
type ChromeShim = {
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
    };
    onChanged: {
      addListener: ReturnType<typeof vi.fn>;
    };
  };
  runtime: {
    sendMessage: ReturnType<typeof vi.fn>;
  };
};

function installChromeShim(): { shim: ChromeShim; storage: Map<string, unknown> } {
  const storage = new Map<string, unknown>();
  const shim: ChromeShim = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => {
          if (storage.has(key)) return { [key]: storage.get(key) };
          return {};
        }),
        set: vi.fn(async (entries: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(entries)) storage.set(k, v);
        })
      },
      onChanged: {
        addListener: vi.fn()
      }
    },
    runtime: {
      sendMessage: vi.fn(async () => undefined)
    }
  };
  vi.stubGlobal("chrome", shim);
  return { shim, storage };
}

describe("defineCreditPool", () => {
  beforeEach(() => {
    installChromeShim();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function makePool(overrides?: Partial<Parameters<typeof defineCreditPool>[0]>) {
    return defineCreditPool({
      key: "bc-test-pool",
      cap: 5,
      windowMs: 60_000,
      name: "Test",
      limitReachedMessage: (waitMs) => `wait ${waitMs}ms`,
      ...overrides
    });
  }

  it("tryConsume decrements remaining when above zero", () => {
    const pool = makePool();
    const t0 = 1_000_000;
    const a = pool.tryConsume(undefined, t0);
    expect(a.allowed).toBe(true);
    expect(a.remaining).toBe(4);

    const b = pool.tryConsume(undefined, t0 + 1);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(3);
  });

  it("tryConsume returns allowed=false when cap is reached", () => {
    const pool = makePool();
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i++) {
      expect(pool.tryConsume(undefined, t0 + i).allowed).toBe(true);
    }
    const blocked = pool.tryConsume(undefined, t0 + 5);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // First credit was at t0; next slot frees at t0 + windowMs.
    expect(blocked.waitMs).toBe(60_000 - 5);
  });

  it("peek returns state without mutating", () => {
    const pool = makePool();
    const t0 = 3_000_000;
    pool.tryConsume(undefined, t0);
    pool.tryConsume(undefined, t0 + 1);

    const before = pool.peek(t0 + 2);
    expect(before.remaining).toBe(3);

    const after = pool.peek(t0 + 3);
    expect(after.remaining).toBe(3); // unchanged
  });

  it("rolls over: when windowMs passes, expired credits are pruned", () => {
    const pool = makePool();
    const t0 = 4_000_000;
    pool.tryConsume(undefined, t0);
    pool.tryConsume(undefined, t0 + 1);
    expect(pool.peek(t0 + 2).remaining).toBe(3);

    // Advance past the window — both credits should age out.
    const later = t0 + 60_001;
    expect(pool.peek(later).remaining).toBe(5);
  });

  it("format returns null when above the threshold", () => {
    const pool = makePool();
    const t0 = 5_000_000;
    // Only one credit consumed (cap=5, threshold=floor(5*0.3)=1) — 4 remaining,
    // which is above 1, so silent.
    pool.tryConsume(undefined, t0);
    expect(pool.format(t0 + 1)).toBe(null);
  });

  it("format returns warning text once at/below threshold", () => {
    const pool = makePool();
    const t0 = 6_000_000;
    // Burn 4 of 5: remaining=1, threshold=floor(5*0.3)=1, 1 is NOT > 1 → warn.
    for (let i = 0; i < 4; i++) pool.tryConsume(undefined, t0 + i);
    const msg = pool.format(t0 + 5);
    expect(msg).not.toBeNull();
    expect(msg).toContain("1 of 5 left");
    expect(msg).toContain("limit resets in");
  });

  it("format reports refresh time in minutes (rounded up, min 1)", () => {
    const pool = makePool({ cap: 2, windowMs: 30 * 60_000 });
    const t0 = 7_000_000;
    pool.tryConsume(undefined, t0);
    pool.tryConsume(undefined, t0 + 1_000);
    // remaining=0, oldest at t0; refresh in 30 min from t0.
    const msg = pool.format(t0 + 60_000);
    expect(msg).toContain("0 of 2 left");
    expect(msg).toContain("limit resets in 29 min");
  });

  it("formatLimitReached delegates to the configured template", () => {
    const pool = makePool({
      limitReachedMessage: (waitMs) => `Wait ${Math.ceil(waitMs / 1000)}s.`
    });
    expect(pool.formatLimitReached(5_500)).toBe("Wait 6s.");
  });

  it("clear resets state to a full window", () => {
    const pool = makePool();
    const t0 = 8_000_000;
    for (let i = 0; i < 3; i++) pool.tryConsume(undefined, t0 + i);
    expect(pool.peek(t0 + 4).remaining).toBe(2);

    pool.clear();
    expect(pool.peek(t0 + 5).remaining).toBe(5);
  });

  it("cap and windowMs are exposed for callers that need them", () => {
    const pool = makePool({ cap: 7, windowMs: 12_345 });
    expect(pool.cap).toBe(7);
    expect(pool.windowMs).toBe(12_345);
  });

  it("notifies background on consume with cap and remaining", () => {
    const pool = makePool();
    const t0 = 9_000_000;
    pool.tryConsume("test-owner", t0);
    const send = (chrome as unknown as ChromeShim).runtime.sendMessage;
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "credit-used",
        pool: "test",
        remaining: 4,
        cap: 5,
        owner: "test-owner"
      })
    );
  });

  it("uses the threshold ratio from config", () => {
    const pool = makePool({ thresholdRatio: 0.5 });
    const t0 = 10_000_000;
    // cap=5, threshold=floor(5*0.5)=2. After 2 consumes, remaining=3 > 2 → silent.
    pool.tryConsume(undefined, t0);
    pool.tryConsume(undefined, t0 + 1);
    expect(pool.format(t0 + 2)).toBe(null);
    // After 3 consumes, remaining=2 ≤ 2 → warn.
    pool.tryConsume(undefined, t0 + 2);
    expect(pool.format(t0 + 3)).toContain("2 of 5 left");
  });
});
