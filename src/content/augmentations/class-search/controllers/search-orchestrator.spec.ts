import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSearchOrchestrator, type LoadStatus } from "./search-orchestrator";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type Courses = string[];

function setup(opts: {
  initialTerm?: string;
  fetcher?: (termId: string) => Promise<Courses>;
  formatTermName?: (termId: string) => string;
} = {}) {
  let activeTerm = opts.initialTerm ?? "4750";
  const ready: Array<{ termId: string; courses: Courses }> = [];
  const status: Array<{ status: LoadStatus; message: string }> = [];
  const orchestrator = createSearchOrchestrator<Courses>({
    getActiveTerm: () => activeTerm,
    fetchTermCourses:
      opts.fetcher ??
      ((termId) => Promise.resolve([`${termId}-CS101`, `${termId}-MATH220`])),
    formatTermName: opts.formatTermName ?? ((termId) => `Term ${termId}`),
    onSearchReady: (termId, courses) => ready.push({ termId, courses }),
    onStatus: (s, message) => status.push({ status: s, message })
  });
  return {
    orchestrator,
    ready,
    status,
    setActiveTerm(termId: string) {
      activeTerm = termId;
    }
  };
}

describe("createSearchOrchestrator — scheduleSearch (debounce)", () => {
  it("debounces multiple synchronous calls into one fire", async () => {
    const env = setup();
    // Prime the cache so the first fire actually has data.
    await env.orchestrator.loadTermData("4750");
    env.ready.length = 0;

    env.orchestrator.scheduleSearch();
    env.orchestrator.scheduleSearch();
    env.orchestrator.scheduleSearch();

    // Before the timer elapses: no fire yet.
    expect(env.ready.length).toBe(0);
    vi.advanceTimersByTime(120);
    expect(env.ready.length).toBe(1);
    expect(env.ready[0]!.termId).toBe("4750");
  });

  it("respects the configured debounceMs", async () => {
    let activeTerm = "4750";
    const ready: string[] = [];
    const orchestrator = createSearchOrchestrator<Courses>({
      getActiveTerm: () => activeTerm,
      fetchTermCourses: () => Promise.resolve(["x"]),
      formatTermName: (t) => t,
      onSearchReady: (termId) => ready.push(termId),
      onStatus: () => {
        // intentionally noop for this debounce-timing test
      },
      debounceMs: 500
    });
    await orchestrator.loadTermData("4750");
    ready.length = 0;
    orchestrator.scheduleSearch();
    vi.advanceTimersByTime(400);
    expect(ready.length).toBe(0);
    vi.advanceTimersByTime(100);
    expect(ready.length).toBe(1);
    // Coverage tweak: prevent the unused-var warning on the captured term.
    activeTerm = "4750";
  });

  it("cancelPending suppresses a queued search", async () => {
    const env = setup();
    await env.orchestrator.loadTermData("4750");
    env.ready.length = 0;

    env.orchestrator.scheduleSearch();
    env.orchestrator.cancelPending();
    vi.advanceTimersByTime(500);
    expect(env.ready.length).toBe(0);
  });

  it("cancelPending is idempotent and safe with no pending timer", () => {
    const env = setup();
    expect(() => env.orchestrator.cancelPending()).not.toThrow();
    expect(() => env.orchestrator.cancelPending()).not.toThrow();
  });

  it("scheduleSearch with no cached courses for the active term is a no-op", () => {
    const env = setup({ initialTerm: "4760" });
    env.orchestrator.scheduleSearch();
    vi.advanceTimersByTime(120);
    expect(env.ready.length).toBe(0);
  });
});

describe("createSearchOrchestrator — loadTermData", () => {
  it("fetches once and caches: second call hits the cache without onStatus loading", async () => {
    let calls = 0;
    const env = setup({
      fetcher: (termId) => {
        calls += 1;
        return Promise.resolve([`${termId}-X`]);
      }
    });

    await env.orchestrator.loadTermData("4750");
    expect(calls).toBe(1);
    expect(env.ready.length).toBe(1);
    expect(env.ready[0]!.termId).toBe("4750");
    expect(env.status[0]?.status).toBe("loading");
    expect(env.status[0]?.message).toContain("Term 4750");
    expect(env.status[1]?.status).toBe("ok");

    env.status.length = 0;
    await env.orchestrator.loadTermData("4750");
    expect(calls).toBe(1);
    expect(env.status.length).toBe(0);
    expect(env.ready.length).toBe(2);
  });

  it("populates the cache so getTerm returns the loaded courses", async () => {
    const env = setup();
    await env.orchestrator.loadTermData("4750");
    expect(env.orchestrator.getTerm("4750")).toEqual(["4750-CS101", "4750-MATH220"]);
    expect(env.orchestrator.getTerm("9999")).toBeNull();
  });

  it("surfaces fetch errors via onStatus and does NOT cache or fire onSearchReady", async () => {
    const env = setup({
      fetcher: () => Promise.reject(new Error("boom"))
    });
    await env.orchestrator.loadTermData("4750");
    expect(env.ready.length).toBe(0);
    expect(env.status.at(-1)?.status).toBe("error");
    expect(env.status.at(-1)?.message).toContain("boom");
    expect(env.orchestrator.getTerm("4750")).toBeNull();
  });

  it("suppresses ready / status when the active term changed mid-flight", async () => {
    let resolveFetch: (courses: Courses) => void = () => {
      // overwritten in fetcher
    };
    const env = setup({
      fetcher: () =>
        new Promise<Courses>((res) => {
          resolveFetch = res;
        })
    });

    const promise = env.orchestrator.loadTermData("4750");
    // User flips term while fetch is in flight.
    env.setActiveTerm("4760");
    resolveFetch(["4750-X"]);
    await promise;

    expect(env.ready.length).toBe(0);
    // Status went loading then... nothing more (the late-resolve path bails).
    expect(env.status.map((s) => s.status)).toEqual(["loading"]);
  });
});
