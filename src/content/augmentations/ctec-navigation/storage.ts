import { LAST_SUBJECT_STORAGE_KEY, STORAGE_KEY } from "./constants";
import { normalizeSubjectCode } from "./helpers";
import type { CtecIndexStore, CtecSubjectIndex } from "./types";

// In-memory cache loaded once from chrome.storage.local on script startup.
// All reads are synchronous against this cache; writes update it immediately
// and persist to extension storage asynchronously.
let memoryStore: CtecIndexStore = { version: 1, subjects: {} };
let memoryLastSubject: string | null = null;

void chrome.storage.local
  .get([STORAGE_KEY, LAST_SUBJECT_STORAGE_KEY])
  .then((result: Record<string, unknown>) => {
    const raw = result[STORAGE_KEY];
    if (raw && typeof raw === "object") {
      const candidate = raw as Partial<CtecIndexStore>;
      if (
        candidate.version === 1 &&
        candidate.subjects &&
        typeof candidate.subjects === "object"
      ) {
        memoryStore = candidate as CtecIndexStore;
      }
    }
    const rawSubject = result[LAST_SUBJECT_STORAGE_KEY];
    if (typeof rawSubject === "string") {
      memoryLastSubject = normalizeSubjectCode(rawSubject);
    }
  });

export function readStore(): CtecIndexStore {
  return memoryStore;
}

export function writeStore(store: CtecIndexStore): void {
  memoryStore = store;
  void chrome.storage.local.set({ [STORAGE_KEY]: store });
}

export function readSubjectIndex(subjectCode: string): CtecSubjectIndex | null {
  return memoryStore.subjects[subjectCode] ?? null;
}

export function writeSubjectIndex(subjectCode: string, index: CtecSubjectIndex): void {
  memoryStore.subjects[subjectCode] = index;
  void chrome.storage.local.set({ [STORAGE_KEY]: memoryStore });
}

export function clearSubjectIndex(subjectCode: string): void {
  delete memoryStore.subjects[subjectCode];
  void chrome.storage.local.set({ [STORAGE_KEY]: memoryStore });
}

export function readLastSubject(): string | null {
  return memoryLastSubject;
}

export function rememberLastSubject(subjectCode: string): void {
  memoryLastSubject = subjectCode;
  void chrome.storage.local.set({ [LAST_SUBJECT_STORAGE_KEY]: subjectCode });
}
