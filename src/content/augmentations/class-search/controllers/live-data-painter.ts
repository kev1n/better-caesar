// Live-data painter: bridges the LiveDataStore (memory → disk → fetch) to
// the rendered course-card DOM. Handles two flows:
//
//   • `ensureLiveData` — read-through resolver. The store does the heavy
//     lifting; this thin wrapper paints results onto the card and toasts
//     on hard errors so callers can stay focused on their action.
//   • `applyLiveDataToCard` — direct paint helper used during initial card
//     render when a memory-cache hit is available, plus from inside the
//     cart-add flow.
//
// Extracted from augmentation.ts (Wave 5g). The painter is a thin façade
// that owns no mount-scoped state — every dependency (store, recovery,
// painters, toaster) is injected.

import {
  createLiveDataStore,
  type LiveDataStore
} from "../live-data-store";
import { showToast } from "../../../../shared/toast";

import {
  isCaesarAuthRequiredError,
  searchCaesarCatalog,
  type CaesarSearchResult
} from "../caesar-search";
import {
  readCatalogCache,
  writeCatalogCache
} from "../catalog-cache";
import { bareCatalogNumber } from "../catalog-format";
import { withAuthRecovery, type AuthRecovery } from "../auth-recovery";
import type { ResultRow } from "../types";
import { applyLiveDataToCard as applyLiveDataDom } from "../views/course-card";

export interface LiveDataPainter {
  /**
   * Resolve CAESAR search data for `row` via the store (memory → disk →
   * fetch). Paints the card on success and toasts on hard errors. Returns
   * null when the data couldn't be resolved.
   */
  ensureLiveData(
    row: ResultRow,
    card: HTMLElement | null,
    options?: { force?: boolean }
  ): Promise<CaesarSearchResult | null>;
  /**
   * Synchronous read-through of the live-data store's in-memory mirror.
   * Returns null when nothing is cached. The results-renderer pre-warms
   * the mirror from disk during card render, so this hits on first click
   * after a page refresh as long as the catalog disk cache is fresh.
   */
  peekLiveData(row: ResultRow): CaesarSearchResult | null;
  /**
   * Paint live CAESAR data onto an already-mounted card. Re-evaluates
   * cart-cache state for every section row whose status pill changed,
   * since live data resolves the canonical class number.
   */
  applyLiveDataToCard(
    row: ResultRow,
    card: HTMLElement,
    result: CaesarSearchResult
  ): void;
}

export type LiveDataPainterDeps = {
  liveData: LiveDataStore;
  /** Build the live-cache key the store uses. */
  liveCacheKey(row: ResultRow): string;
  /**
   * Re-evaluate cart-cache state for an Add button using its `data-sigKey`
   * attribute. Called per-section after live data resolved a new class
   * number so badges reflect any cache hits the signature-only match
   * missed. */
  applyCartStateBySigKey(button: HTMLButtonElement): void;
};

export function createLiveDataPainter(deps: LiveDataPainterDeps): LiveDataPainter {
  function applyLiveDataToCard(
    row: ResultRow,
    card: HTMLElement,
    result: CaesarSearchResult
  ): void {
    const touched = applyLiveDataDom(card, result, row.course.catalog);
    for (const li of touched) {
      const addBtn = li.querySelector<HTMLButtonElement>(".bc-cs-add");
      if (addBtn) deps.applyCartStateBySigKey(addBtn);
    }
  }

  async function ensureLiveData(
    row: ResultRow,
    card: HTMLElement | null,
    options: { force?: boolean } = {}
  ): Promise<CaesarSearchResult | null> {
    const key = deps.liveCacheKey(row);
    try {
      const cache = await deps.liveData.ensureLiveData(key, options);
      if (cache.status !== "ready" || !cache.result) return null;
      if (card) applyLiveDataToCard(row, card, cache.result);
      return cache.result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showToast(`Couldn't load CAESAR data: ${msg}`, { tone: "error", durationMs: 5000 });
      return null;
    }
  }

  function peekLiveData(row: ResultRow): CaesarSearchResult | null {
    const key = deps.liveCacheKey(row);
    const cache = deps.liveData.get(key);
    if (!cache || cache.status !== "ready" || !cache.result) return null;
    return cache.result;
  }

  return { ensureLiveData, peekLiveData, applyLiveDataToCard };
}

/** Build the live-cache key the store uses for a `(termId, row)` pair. */
export function makeLiveCacheKey(termId: string, row: ResultRow): string {
  return `${termId}|${row.course.subject}|${bareCatalogNumber(row.course.catalog)}`;
}

/**
 * Decodes a `${termId}|${subject}|${bareCatalog}` live-cache key — the
 * inverse of `makeLiveCacheKey`. Used by the LiveDataStore deps so the
 * store itself can stay generic.
 */
export function parseLiveCacheKey(
  key: string
): { termId: string; subject: string; bareCatalog: string } | null {
  const parts = key.split("|");
  if (parts.length !== 3) return null;
  return {
    termId: parts[0]!,
    subject: parts[1]!,
    bareCatalog: parts[2]!
  };
}

/**
 * Build a `LiveDataStore` wired to:
 *   • the catalog disk cache (memory→disk read-through, write on success),
 *   • the CAESAR catalog-search fetch path (auth-recovery wrapped),
 *
 * keyed on `${termId}|${subject}|${bareCatalog}`. The fetch dep splits
 * the key back into search params so the store itself stays generic.
 */
export function createCatalogLiveDataStore(deps: {
  institution: string;
  authRecovery: AuthRecovery;
}): LiveDataStore {
  return createLiveDataStore({
    diskRead: (key) => {
      const parts = parseLiveCacheKey(key);
      if (!parts) return null;
      const hit = readCatalogCache(parts.termId, parts.subject, parts.bareCatalog);
      return hit ? { status: "ready", result: hit.result } : null;
    },
    diskWrite: (key, cache) => {
      if (cache.status !== "ready" || !cache.result) return;
      const parts = parseLiveCacheKey(key);
      if (!parts) return;
      writeCatalogCache(parts.termId, parts.subject, parts.bareCatalog, cache.result);
    },
    fetch: async (key) => {
      const parts = parseLiveCacheKey(key);
      if (!parts) return null;
      return await withAuthRecovery(deps.authRecovery, isCaesarAuthRequiredError, () =>
        searchCaesarCatalog({
          termId: parts.termId,
          institution: deps.institution,
          subject: parts.subject,
          bareCatalog: parts.bareCatalog
        })
      );
    }
  });
}
