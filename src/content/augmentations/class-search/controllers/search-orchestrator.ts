// Search orchestrator: debounce + term-data load. The class-search
// augmentation has two entry points to its search pipeline —
//   • free-text input (debounced 120ms before re-rendering),
//   • term <select> change (kicks paper.nu term data load, then re-renders).
//
// Extracted from augmentation.ts (Wave 5e). The orchestrator owns the
// debounce timer and the per-term cache (`loadedTerms`). On a hit it
// fires `onSearchReady` synchronously; on a miss it loads via the
// injected `fetchTermCourses` dep, populates the cache, and only then
// fires the callback. Stale-load guard: if the active term changes
// while a fetch is in-flight, the callback is suppressed for the older
// term (mirrors the prior `state.filters.termId !== termId` checks).

export type LoadStatus = "loading" | "ok" | "error";

export interface SearchOrchestrator<TCourses> {
  /** Debounce timer scheduling: re-runs the search after `debounceMs`. */
  scheduleSearch(): void;
  /** Cancels any pending debounced search. Idempotent. */
  cancelPending(): void;
  /**
   * Returns courses for `termId` from the in-memory cache, or `null`
   * when not yet loaded.
   */
  getTerm(termId: string): TCourses | null;
  /**
   * Ensures paper-data term courses are cached for `termId`, then fires
   * `onSearchReady`. On cache hit this is synchronous-effectful; on a
   * miss it calls the status callback (`loading` → `ok`/`error`) around
   * the fetch.
   */
  loadTermData(termId: string): Promise<void>;
}

export type SearchOrchestratorDeps<TCourses> = {
  /** Returns the current active term id at call time. */
  getActiveTerm(): string;
  /** Paper-data fetcher. Throws on failure (orchestrator surfaces it). */
  fetchTermCourses(termId: string): Promise<TCourses>;
  /** Human-readable term name resolver (for the loading status). */
  formatTermName(termId: string): string;
  /** Fires when search results are ready to be re-rendered. */
  onSearchReady(termId: string, courses: TCourses): void;
  /**
   * Status callback. `loading` is fired before fetch; `ok` after success;
   * `error` after a fetch error (with `message`).
   */
  onStatus(status: LoadStatus, message: string): void;
  /** Debounce window in ms. Defaults to 120 (matches the original). */
  debounceMs?: number;
  /**
   * Setter / clearer for the debounce timer. Defaults to `window.setTimeout`
   * / `window.clearTimeout`. Tests inject fake timers.
   */
  setTimer?(handler: () => void, ms: number): number;
  clearTimer?(id: number): void;
};

export function createSearchOrchestrator<TCourses>(
  deps: SearchOrchestratorDeps<TCourses>
): SearchOrchestrator<TCourses> {
  const debounceMs = deps.debounceMs ?? 120;
  const setTimer =
    deps.setTimer ?? ((h: () => void, ms: number) => window.setTimeout(h, ms));
  const clearTimer =
    deps.clearTimer ?? ((id: number) => window.clearTimeout(id));

  const cache = new Map<string, TCourses>();
  let debounceHandle: number | null = null;

  function fireSearch(): void {
    const termId = deps.getActiveTerm();
    const courses = cache.get(termId);
    if (!courses) return;
    deps.onSearchReady(termId, courses);
  }

  return {
    scheduleSearch() {
      if (debounceHandle !== null) {
        clearTimer(debounceHandle);
      }
      debounceHandle = setTimer(() => {
        debounceHandle = null;
        fireSearch();
      }, debounceMs);
    },
    cancelPending() {
      if (debounceHandle !== null) {
        clearTimer(debounceHandle);
        debounceHandle = null;
      }
    },
    getTerm(termId) {
      return cache.get(termId) ?? null;
    },
    async loadTermData(termId) {
      const cached = cache.get(termId);
      if (cached) {
        fireSearch();
        return;
      }

      deps.onStatus("loading", `Loading ${deps.formatTermName(termId)} sections…`);
      try {
        const courses = await deps.fetchTermCourses(termId);
        // User may have switched terms while the fetch was in flight.
        if (deps.getActiveTerm() !== termId) return;
        cache.set(termId, courses);
        deps.onStatus("ok", "");
        fireSearch();
      } catch (error) {
        if (deps.getActiveTerm() !== termId) return;
        const msg = error instanceof Error ? error.message : String(error);
        deps.onStatus("error", `Couldn't load term data: ${msg}`);
      }
    }
  };
}
