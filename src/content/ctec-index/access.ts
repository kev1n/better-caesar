// Sticky CTEC-access state machine.
//
// Northwestern revokes CTEC access from any student who didn't complete
// their CTECs in the prior collection period; CAESAR signals that by
// routing every CTEC URL to a `NW_CTEC_MSG_FL` message panel. This module
// caches that verdict in chrome.storage.local so we short-circuit every
// later CTEC code path without re-hitting the network.
//
// Three states:
//   • "denied" — sticky, never auto-expires; cleared from the popup's
//     "Clear CTEC cache" button so a reauthorized student can recover.
//   • "confirmed" — auto-expires after CONFIRMED_TTL_MS; if the student
//     loses access mid-quarter, the next click forces a fresh probe.
//   • "unknown" — default and post-expiry; the access-probe in
//     `access-probe.ts` resolves it on the next CTEC fetch.

import { logDebug, logQuiet } from "../../shared/log";

import {
  CONFIRMED_TTL_MS,
  CTEC_ACCESS_STORAGE_KEY,
  type CtecAccessStatus
} from "./access-shared";

export { CTEC_ACCESS_STORAGE_KEY, type CtecAccessStatus };

type StoredState =
  | { kind: "denied"; deniedAt: number }
  | { kind: "confirmed"; confirmedAt: number };

let memoryState: StoredState | null = null;

void chrome.storage.local
  .get(CTEC_ACCESS_STORAGE_KEY)
  .then((result: Record<string, unknown>) => {
    memoryState = parseStored(result[CTEC_ACCESS_STORAGE_KEY]);
    logDebug("ctec-access:hydrate", "loaded from storage", { state: memoryState });
  })
  .catch((err: unknown) => logQuiet("ctec-access:hydrate", err));

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (!(CTEC_ACCESS_STORAGE_KEY in changes)) return;
  memoryState = parseStored(changes[CTEC_ACCESS_STORAGE_KEY]?.newValue);
});

function parseStored(raw: unknown): StoredState | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<StoredState>;
  if (candidate.kind === "confirmed" && typeof candidate.confirmedAt === "number") {
    return { kind: "confirmed", confirmedAt: candidate.confirmedAt };
  }
  if (candidate.kind === "denied" && typeof candidate.deniedAt === "number") {
    return { kind: "denied", deniedAt: candidate.deniedAt };
  }
  return null;
}

export function getCtecAccessStatus(): CtecAccessStatus {
  if (!memoryState) return "unknown";
  if (memoryState.kind === "denied") return "denied";
  // Auto-expire confirmed without mutating storage; the next mark*
  // call refreshes the timestamp.
  if (Date.now() - memoryState.confirmedAt > CONFIRMED_TTL_MS) return "unknown";
  return "confirmed";
}

export function isCtecAccessDenied(): boolean {
  return memoryState?.kind === "denied";
}

export function markCtecAccessDenied(reason: string): void {
  if (memoryState?.kind === "denied") return;
  logDebug("ctec-access:denied", "marking denied (from)", reason);
  memoryState = { kind: "denied", deniedAt: Date.now() };
  void chrome.storage.local.set({ [CTEC_ACCESS_STORAGE_KEY]: memoryState });
}

export function markCtecAccessConfirmed(reason: string): void {
  if (memoryState?.kind === "denied") return;
  if (
    memoryState?.kind === "confirmed" &&
    Date.now() - memoryState.confirmedAt <= CONFIRMED_TTL_MS
  ) {
    return;
  }
  logDebug("ctec-access:confirmed", "marking confirmed (from)", reason);
  memoryState = { kind: "confirmed", confirmedAt: Date.now() };
  void chrome.storage.local.set({ [CTEC_ACCESS_STORAGE_KEY]: memoryState });
}

// Detects the "You are not authorized to access CTECs" panel. Two
// URL-agnostic signals — either is sufficient: the literal copy in the
// body, or `Page = NW_CTEC_MSG_FL` in pt_pageinfo.
export function isCtecUnauthorizedHtml(html: string): boolean {
  if (html.toLowerCase().includes("not authorized to access ctecs")) return true;
  return extractPeopleSoftPageId(html) === "NW_CTEC_MSG_FL";
}

export function extractPeopleSoftPageId(html: string): string | null {
  const match = html.match(/pt_pageinfo\.setAttribute\(\s*['"]Page['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i);
  return match?.[1] ?? null;
}
