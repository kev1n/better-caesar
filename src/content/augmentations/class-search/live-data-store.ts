// Three-tier per-course live-data cache: memory mirror → disk cache → CAESAR
// fetch. Owned by the class-search augmentation but extracted so the cache
// invariants (in-flight Promise dedupe, listener notification on writes,
// and disk hydration on miss) are testable in isolation.
//
// Keys are `${termId}|${subject}|${bareCatalog}` — a single CAESAR catalog
// search response covers every section that shares a bare catalog (so
// "111-0" + "111-SG" share one entry), matching how the parent
// `liveCacheKey()` already partitions state.

import type { CaesarCourseGroup, CaesarSearchResult } from "./caesar-search";
import type { CourseLiveCache } from "./types";

export type LiveDataDeps = {
  diskRead(strm: string): CourseLiveCache | null;
  diskWrite(strm: string, cache: CourseLiveCache): void;
  fetch(strm: string): Promise<CaesarSearchResult | null>;
};

export type LiveDataListener = (strm: string, cache: CourseLiveCache) => void;

export interface LiveDataStore {
  /**
   * Returns the cached `CourseLiveCache` for `strm`, going through memory →
   * disk → fetch in that order. Concurrent calls dedupe onto a single
   * in-flight Promise. `force: true` skips both caches and always issues a
   * fresh fetch.
   */
  ensureLiveData(strm: string, opts?: { force?: boolean }): Promise<CourseLiveCache>;

  /**
   * Folds a partial search response (typically from a class-number search
   * that the cart-add chain runs internally) into the existing entry.
   * Replaces matching sections by classNumber so a prior subject-wide
   * search's data isn't clobbered. No-op when `incomingGroups` is empty.
   */
  mergeLiveCache(strm: string, incomingGroups: CaesarCourseGroup[]): void;

  /** Sync read of the in-memory mirror. `null` when nothing is cached. */
  get(strm: string): CourseLiveCache | null;

  /**
   * Subscribe to writes (any mutation that lands in the memory mirror —
   * loading, ready, error, merged). Returns an unsubscribe function.
   */
  subscribe(listener: LiveDataListener): () => void;

  /** Wipe the memory mirror. Disk cache is the caller's responsibility. */
  clear(): void;
}

/**
 * Pick the group whose catalog matches `wantCatalog` (handles paper.nu's
 * "111" vs CAESAR's "111-0" drift the same way `matchCaesarGroup` does).
 * Local copy so this module doesn't have to depend on caesar-search.
 */
function pickGroup(
  groups: CaesarCourseGroup[],
  wantCatalog: string
): CaesarCourseGroup | null {
  const want = wantCatalog.toLowerCase();
  const wantStripped = want.replace(/-0$/, "");
  for (const g of groups) {
    const have = g.catalog.toLowerCase();
    if (have === want) return g;
    if (have === wantStripped) return g;
    if (have.replace(/-0$/, "") === wantStripped) return g;
  }
  return null;
}

export function createLiveDataStore(deps: LiveDataDeps): LiveDataStore {
  const memory = new Map<string, CourseLiveCache>();
  const inFlight = new Map<string, Promise<CourseLiveCache>>();
  const listeners = new Set<LiveDataListener>();

  function notify(strm: string, cache: CourseLiveCache): void {
    for (const fn of listeners) fn(strm, cache);
  }

  function set(strm: string, cache: CourseLiveCache): void {
    memory.set(strm, cache);
    notify(strm, cache);
  }

  async function load(strm: string, force: boolean): Promise<CourseLiveCache> {
    if (!force) {
      const memHit = memory.get(strm);
      if (memHit && memHit.status === "ready" && memHit.result) {
        return memHit;
      }
      const diskHit = deps.diskRead(strm);
      if (diskHit && diskHit.status === "ready" && diskHit.result) {
        set(strm, diskHit);
        return diskHit;
      }
    }

    set(strm, { status: "loading" });
    try {
      const result = await deps.fetch(strm);
      if (!result) {
        memory.delete(strm);
        const cache: CourseLiveCache = { status: "error", error: "no-result" };
        notify(strm, cache);
        return cache;
      }
      const cache: CourseLiveCache = { status: "ready", result };
      set(strm, cache);
      deps.diskWrite(strm, cache);
      return cache;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const cache: CourseLiveCache = { status: "error", error: msg };
      set(strm, cache);
      throw error;
    }
  }

  return {
    ensureLiveData(strm, opts = {}) {
      const force = opts.force === true;
      const existing = inFlight.get(strm);
      if (existing && !force) return existing;
      const job = load(strm, force).finally(() => {
        if (inFlight.get(strm) === job) inFlight.delete(strm);
      });
      inFlight.set(strm, job);
      return job;
    },

    mergeLiveCache(strm, incomingGroups) {
      if (incomingGroups.length === 0) return;
      const existing = memory.get(strm);
      if (!existing || existing.status !== "ready" || !existing.result) {
        const cache: CourseLiveCache = {
          status: "ready",
          result: { groups: incomingGroups }
        };
        set(strm, cache);
        return;
      }

      // Find the group in incoming that the merge applies to. The store
      // doesn't know the wantCatalog, so it merges every incoming group:
      // each one either replaces (by classNumber match), or appends.
      const mergedGroups: CaesarCourseGroup[] = existing.result.groups.map((g) => g);

      for (const incoming of incomingGroups) {
        const target = pickGroup(mergedGroups, incoming.catalog);
        if (!target) {
          mergedGroups.push(incoming);
          continue;
        }
        const sections = [...target.sections];
        for (const s of incoming.sections) {
          const idx = sections.findIndex((x) => x.classNumber === s.classNumber);
          if (idx >= 0) sections[idx] = s;
          else sections.push(s);
        }
        const merged: CaesarCourseGroup = { ...target, sections };
        const idx = mergedGroups.findIndex((g) => g === target);
        mergedGroups[idx] = merged;
      }

      const cache: CourseLiveCache = {
        status: "ready",
        result: { groups: mergedGroups }
      };
      set(strm, cache);
    },

    get(strm) {
      return memory.get(strm) ?? null;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    clear() {
      memory.clear();
      inFlight.clear();
    }
  };
}
