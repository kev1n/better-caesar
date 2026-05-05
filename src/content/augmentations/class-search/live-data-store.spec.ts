import { describe, expect, it, vi } from "vitest";

import type { CaesarCourseGroup, CaesarSearchResult } from "./caesar-search";
import { createLiveDataStore, type LiveDataDeps } from "./live-data-store";
import type { CourseLiveCache } from "./types";

function makeGroup(catalog: string, sections: { classNumber: string; status?: string }[] = []): CaesarCourseGroup {
  return {
    courseId: `T 1000 - ${catalog}`,
    catalog,
    title: catalog,
    sections: sections.map((s) => ({
      classNumber: s.classNumber,
      sectionLabel: "1-LEC",
      sectionNumber: "1",
      component: "LEC",
      daysTime: "",
      room: "",
      instructor: "",
      meetingDates: "",
      grading: "",
      status: (s.status ?? "Open") as "Open" | "Closed" | "Wait List" | "Unknown",
      selectActionId: "SSR_PB_SELECT$0",
      selectAvailable: true
    }))
  };
}

function makeResult(...groups: CaesarCourseGroup[]): CaesarSearchResult {
  return { groups };
}

function makeDeps(overrides: Partial<LiveDataDeps> = {}): LiveDataDeps {
  return {
    diskRead: vi.fn().mockReturnValue(null),
    diskWrite: vi.fn(),
    fetch: vi.fn().mockResolvedValue(null),
    ...overrides
  };
}

describe("createLiveDataStore — memory hit", () => {
  it("returns the cached result without touching disk or fetch on a memory hit", async () => {
    const result = makeResult(makeGroup("111-0", [{ classNumber: "11111" }]));
    const deps = makeDeps({
      fetch: vi.fn().mockResolvedValue(result)
    });
    const store = createLiveDataStore(deps);

    // Prime memory by running one full fetch.
    const first = await store.ensureLiveData("4750");
    expect(first.status).toBe("ready");
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    expect(deps.diskRead).toHaveBeenCalledTimes(1);

    const second = await store.ensureLiveData("4750");
    expect(second.status).toBe("ready");
    expect(second.result).toBe(result);
    // memory short-circuits — neither disk nor fetch ran a second time.
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    expect(deps.diskRead).toHaveBeenCalledTimes(1);
  });
});

describe("createLiveDataStore — disk hit on memory miss", () => {
  it("hydrates memory from disk without fetching", async () => {
    const diskCache: CourseLiveCache = {
      status: "ready",
      result: makeResult(makeGroup("111-0", [{ classNumber: "11111" }]))
    };
    const deps = makeDeps({
      diskRead: vi.fn().mockReturnValue(diskCache),
      fetch: vi.fn().mockResolvedValue(null)
    });
    const store = createLiveDataStore(deps);

    const cache = await store.ensureLiveData("4750");
    expect(cache.status).toBe("ready");
    expect(cache.result).toBe(diskCache.result);
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(store.get("4750")).not.toBeNull();
  });
});

describe("createLiveDataStore — fetch on miss", () => {
  it("fetches and persists when both memory and disk miss", async () => {
    const result = makeResult(makeGroup("111-0", [{ classNumber: "11111" }]));
    const deps = makeDeps({
      fetch: vi.fn().mockResolvedValue(result)
    });
    const store = createLiveDataStore(deps);

    const cache = await store.ensureLiveData("4750");
    expect(cache.status).toBe("ready");
    expect(cache.result).toBe(result);
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    expect(deps.diskWrite).toHaveBeenCalledTimes(1);
    expect(deps.diskWrite).toHaveBeenCalledWith("4750", cache);
  });

  it("returns an error cache when fetch resolves null", async () => {
    const deps = makeDeps({
      fetch: vi.fn().mockResolvedValue(null)
    });
    const store = createLiveDataStore(deps);

    const cache = await store.ensureLiveData("4750");
    expect(cache.status).toBe("error");
    expect(store.get("4750")).toBeNull();
  });
});

describe("createLiveDataStore — in-flight dedupe", () => {
  it("shares a single Promise across concurrent calls", async () => {
    let resolve!: (r: CaesarSearchResult) => void;
    const fetchSpy = vi.fn().mockImplementation(
      () =>
        new Promise<CaesarSearchResult>((r) => {
          resolve = r;
        })
    );
    const store = createLiveDataStore(makeDeps({ fetch: fetchSpy }));

    const a = store.ensureLiveData("4750");
    const b = store.ensureLiveData("4750");
    expect(a).toBe(b);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolve(makeResult(makeGroup("111-0")));
    await Promise.all([a, b]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("force=true bypasses caches and runs a fresh fetch", async () => {
    const a = makeResult(makeGroup("111-0", [{ classNumber: "1" }]));
    const b = makeResult(makeGroup("111-0", [{ classNumber: "2" }]));
    const fetchSpy = vi.fn().mockResolvedValueOnce(a).mockResolvedValueOnce(b);
    const store = createLiveDataStore(makeDeps({ fetch: fetchSpy }));

    const first = await store.ensureLiveData("4750");
    expect(first.result).toBe(a);
    const second = await store.ensureLiveData("4750", { force: true });
    expect(second.result).toBe(b);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("createLiveDataStore — mergeLiveCache", () => {
  it("seeds the cache when nothing is loaded yet", () => {
    const store = createLiveDataStore(makeDeps());
    const incoming = makeGroup("111-0", [{ classNumber: "11111" }]);

    store.mergeLiveCache("4750", [incoming]);

    const cache = store.get("4750");
    expect(cache?.status).toBe("ready");
    expect(cache?.result?.groups[0]?.sections[0]?.classNumber).toBe("11111");
  });

  it("replaces a section in an existing group when classNumber matches", async () => {
    const original = makeGroup("111-0", [
      { classNumber: "11111", status: "Closed" },
      { classNumber: "22222", status: "Open" }
    ]);
    const deps = makeDeps({ fetch: vi.fn().mockResolvedValue(makeResult(original)) });
    const store = createLiveDataStore(deps);
    await store.ensureLiveData("4750");

    const updated = makeGroup("111-0", [{ classNumber: "11111", status: "Open" }]);
    store.mergeLiveCache("4750", [updated]);

    const cache = store.get("4750");
    const sections = cache?.result?.groups[0]?.sections ?? [];
    expect(sections).toHaveLength(2);
    expect(sections.find((s) => s.classNumber === "11111")?.status).toBe("Open");
    expect(sections.find((s) => s.classNumber === "22222")?.status).toBe("Open");
  });

  it("appends a new section when classNumber doesn't exist", async () => {
    const original = makeGroup("111-0", [{ classNumber: "11111" }]);
    const deps = makeDeps({ fetch: vi.fn().mockResolvedValue(makeResult(original)) });
    const store = createLiveDataStore(deps);
    await store.ensureLiveData("4750");

    const updated = makeGroup("111-0", [{ classNumber: "33333" }]);
    store.mergeLiveCache("4750", [updated]);

    const sections = store.get("4750")?.result?.groups[0]?.sections ?? [];
    expect(sections.map((s) => s.classNumber).sort()).toEqual(["11111", "33333"]);
  });

  it("is a no-op when incomingGroups is empty", async () => {
    const original = makeGroup("111-0", [{ classNumber: "11111" }]);
    const deps = makeDeps({ fetch: vi.fn().mockResolvedValue(makeResult(original)) });
    const store = createLiveDataStore(deps);
    await store.ensureLiveData("4750");

    const before = store.get("4750");
    store.mergeLiveCache("4750", []);
    expect(store.get("4750")).toBe(before);
  });
});

describe("createLiveDataStore — subscribe / unsubscribe / clear", () => {
  it("notifies subscribers on writes and stops after unsubscribe", async () => {
    const result = makeResult(makeGroup("111-0", [{ classNumber: "11111" }]));
    const deps = makeDeps({ fetch: vi.fn().mockResolvedValue(result) });
    const store = createLiveDataStore(deps);

    const events: Array<{ strm: string; status: string }> = [];
    const unsub = store.subscribe((strm, cache) => {
      events.push({ strm, status: cache.status });
    });

    await store.ensureLiveData("4750");
    expect(events.map((e) => e.status)).toEqual(["loading", "ready"]);

    unsub();
    store.mergeLiveCache("4750", [makeGroup("111-0", [{ classNumber: "22222" }])]);
    // Length unchanged after unsubscribe.
    expect(events).toHaveLength(2);
  });

  it("clear() drops the in-memory mirror", async () => {
    const result = makeResult(makeGroup("111-0"));
    const deps = makeDeps({ fetch: vi.fn().mockResolvedValue(result) });
    const store = createLiveDataStore(deps);

    await store.ensureLiveData("4750");
    expect(store.get("4750")).not.toBeNull();
    store.clear();
    expect(store.get("4750")).toBeNull();
  });
});

describe("createLiveDataStore — fetch errors", () => {
  it("propagates the rejection and writes an error cache", async () => {
    const deps = makeDeps({
      fetch: vi.fn().mockRejectedValue(new Error("boom"))
    });
    const store = createLiveDataStore(deps);

    await expect(store.ensureLiveData("4750")).rejects.toThrow("boom");
    const cache = store.get("4750");
    expect(cache?.status).toBe("error");
    expect(cache?.error).toBe("boom");
  });
});
