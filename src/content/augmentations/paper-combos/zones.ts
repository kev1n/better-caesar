import { logQuiet } from "../../../shared/log";
import {
  DEFAULT_MAX_CREDITS,
  DEFAULT_MIN_CREDITS
} from "./constants";
import { DEFAULT_SORT_MODE, isSortMode, type SortMode } from "./scoring";
import type { ComboSection } from "./types";

const ZONES_STORAGE_KEY = "better-caesar:paper-combos-zones:v1";
const SORT_STORAGE_KEY = "better-caesar:paper-combos-sort:v1";
const CREDITS_STORAGE_KEY = "better-caesar:paper-combos-credits:v1";

export type ProhibitedZone = {
  id: string;
  // Inclusive day range. A single-day zone has startDay === endDay.
  startDay: number;
  endDay: number;
  startMin: number; // minutes from midnight
  endMin: number;
};

// Persisted shape on disk — accepts both the legacy single-`day` schema
// and the current `startDay`/`endDay` schema. Older zones get migrated
// in `normalizeZone` so the in-memory cache is always the new shape.
type StoredZone = {
  id: unknown;
  day?: unknown;
  startDay?: unknown;
  endDay?: unknown;
  startMin: unknown;
  endMin: unknown;
};

let zonesCache: ProhibitedZone[] | null = null;

function normalizeZone(value: unknown): ProhibitedZone | null {
  if (!value || typeof value !== "object") return null;
  const z = value as StoredZone;
  if (typeof z.id !== "string") return null;
  if (typeof z.startMin !== "number" || typeof z.endMin !== "number") return null;
  if (!(z.endMin > z.startMin) || z.startMin < 0) return null;

  // Pull start/end day from the new schema, or fall back to the legacy
  // single-day schema. Either way we end up with a [startDay, endDay]
  // pair that we clamp to the visible Mon–Fri (0–4) range.
  let startDay: number;
  let endDay: number;
  if (typeof z.startDay === "number" && typeof z.endDay === "number") {
    startDay = z.startDay;
    endDay = z.endDay;
  } else if (typeof z.day === "number") {
    startDay = z.day;
    endDay = z.day;
  } else {
    return null;
  }
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) return null;
  startDay = Math.max(0, Math.min(4, Math.floor(startDay)));
  endDay = Math.max(0, Math.min(4, Math.floor(endDay)));
  if (endDay < startDay) [startDay, endDay] = [endDay, startDay];

  return {
    id: z.id,
    startDay,
    endDay,
    startMin: z.startMin,
    endMin: z.endMin
  };
}


export async function loadZones(): Promise<ProhibitedZone[]> {
  if (zonesCache) return zonesCache;
  try {
    const result = (await chrome.storage.local.get(ZONES_STORAGE_KEY)) as Record<
      string,
      unknown
    >;
    const raw = result[ZONES_STORAGE_KEY];
    if (!Array.isArray(raw)) {
      zonesCache = [];
      return zonesCache;
    }
    zonesCache = raw
      .map(normalizeZone)
      .filter((z): z is ProhibitedZone => z !== null);
    return zonesCache;
  } catch (err) {
    logQuiet("paper-combos.zones.load", err);
    zonesCache = [];
    return zonesCache;
  }
}

export async function saveZones(zones: ProhibitedZone[]): Promise<void> {
  zonesCache = [...zones];
  try {
    await chrome.storage.local.set({ [ZONES_STORAGE_KEY]: zonesCache });
  } catch (err) {
    logQuiet("paper-combos.zones.save", err);
  }
}

// Subscribe to live zone updates from chrome.storage (e.g. another tab
// or the popup wrote to the key). The augmentation re-runs combos when
// the cache changes.
export function subscribeZoneChanges(callback: () => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void => {
    if (areaName !== "local") return;
    const change = changes[ZONES_STORAGE_KEY];
    if (!change) return;
    const next = change.newValue;
    zonesCache = Array.isArray(next)
      ? next
          .map(normalizeZone)
          .filter((z): z is ProhibitedZone => z !== null)
      : [];
    callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// Half-open interval overlap on time, inclusive day range. A class ending
// exactly at the zone start (or starting exactly at the zone end) is NOT
// a conflict — the class is fully outside the prohibited window.
export function sectionConflictsWithZones(
  section: ComboSection,
  zones: readonly ProhibitedZone[]
): boolean {
  if (zones.length === 0) return false;
  for (const block of section.blocks) {
    const blockStart = block.start.h * 60 + block.start.m;
    const blockEnd = block.end.h * 60 + block.end.m;
    for (const zone of zones) {
      if (block.day < zone.startDay || block.day > zone.endDay) continue;
      if (blockStart < zone.endMin && zone.startMin < blockEnd) return true;
    }
  }
  return false;
}

// Round to the nearest 15-minute increment so zones snap visually and
// the conflict math is forgiving (a 9:43 click rounds to 9:45 and won't
// surprise the user with weird minute offsets).
export function snapMinutes(minutes: number, snap = 15): number {
  if (minutes < 0) return 0;
  return Math.round(minutes / snap) * snap;
}

export function makeZoneId(): string {
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────
// Sort-mode persistence (also lives in zones.ts since both are
// chrome.storage.local-backed paper-combos prefs and share the same
// onChanged subscription pattern.)

let sortCache: SortMode | null = null;

export async function loadSortMode(): Promise<SortMode> {
  if (sortCache) return sortCache;
  try {
    const result = (await chrome.storage.local.get(SORT_STORAGE_KEY)) as Record<
      string,
      unknown
    >;
    const raw = result[SORT_STORAGE_KEY];
    if (typeof raw === "string" && isSortMode(raw)) {
      sortCache = raw;
      return sortCache;
    }
  } catch (err) {
    logQuiet("paper-combos.sort.load", err);
  }
  sortCache = DEFAULT_SORT_MODE;
  return sortCache;
}

export async function saveSortMode(mode: SortMode): Promise<void> {
  sortCache = mode;
  try {
    await chrome.storage.local.set({ [SORT_STORAGE_KEY]: mode });
  } catch (err) {
    logQuiet("paper-combos.sort.save", err);
  }
}

export function subscribeSortChanges(callback: (mode: SortMode) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void => {
    if (areaName !== "local") return;
    const change = changes[SORT_STORAGE_KEY];
    if (!change) return;
    const next = change.newValue;
    const mode =
      typeof next === "string" && isSortMode(next) ? next : DEFAULT_SORT_MODE;
    sortCache = mode;
    callback(mode);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// ─────────────────────────────────────────────────────────────────────
// Credit-budget persistence (min + max). Stored together so a single
// storage round-trip captures both — they're a paired control on the
// bar, no reason to split keys.

export type CreditsPrefs = {
  minCredits: number;
  maxCredits: number;
};

let creditsCache: CreditsPrefs | null = null;

function normalizeCredits(value: unknown): CreditsPrefs {
  const fallback: CreditsPrefs = {
    minCredits: DEFAULT_MIN_CREDITS,
    maxCredits: DEFAULT_MAX_CREDITS
  };
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  const min =
    typeof v.minCredits === "number" && Number.isFinite(v.minCredits) && v.minCredits >= 0
      ? v.minCredits
      : DEFAULT_MIN_CREDITS;
  const max =
    typeof v.maxCredits === "number" && Number.isFinite(v.maxCredits) && v.maxCredits >= 0.5
      ? v.maxCredits
      : DEFAULT_MAX_CREDITS;
  // Floor never above ceiling — silently clamp on read.
  return { minCredits: Math.min(min, max), maxCredits: max };
}

export async function loadCredits(): Promise<CreditsPrefs> {
  if (creditsCache) return creditsCache;
  try {
    const result = (await chrome.storage.local.get(CREDITS_STORAGE_KEY)) as Record<
      string,
      unknown
    >;
    creditsCache = normalizeCredits(result[CREDITS_STORAGE_KEY]);
    return creditsCache;
  } catch (err) {
    logQuiet("paper-combos.credits.load", err);
    creditsCache = normalizeCredits(null);
    return creditsCache;
  }
}

export async function saveCredits(prefs: CreditsPrefs): Promise<void> {
  creditsCache = { ...prefs };
  try {
    await chrome.storage.local.set({ [CREDITS_STORAGE_KEY]: creditsCache });
  } catch (err) {
    logQuiet("paper-combos.credits.save", err);
  }
}

export function subscribeCreditsChanges(
  callback: (prefs: CreditsPrefs) => void
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void => {
    if (areaName !== "local") return;
    const change = changes[CREDITS_STORAGE_KEY];
    if (!change) return;
    creditsCache = normalizeCredits(change.newValue);
    callback(creditsCache);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
