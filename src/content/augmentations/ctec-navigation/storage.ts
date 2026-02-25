import { LAST_SUBJECT_STORAGE_KEY, STORAGE_KEY } from "./constants";
import { normalizeSubjectCode } from "./helpers";
import type { CtecIndexStore, CtecSubjectIndex } from "./types";

export function readStore(): CtecIndexStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: 1, subjects: {} };
    }

    const parsed = JSON.parse(raw) as Partial<CtecIndexStore>;
    if (parsed.version !== 1 || !parsed.subjects || typeof parsed.subjects !== "object") {
      return { version: 1, subjects: {} };
    }

    return {
      version: 1,
      subjects: parsed.subjects as Record<string, CtecSubjectIndex>
    };
  } catch {
    return { version: 1, subjects: {} };
  }
}

export function writeStore(store: CtecIndexStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors.
  }
}

export function readSubjectIndex(subjectCode: string): CtecSubjectIndex | null {
  const store = readStore();
  const index = store.subjects[subjectCode];
  return index ?? null;
}

export function writeSubjectIndex(subjectCode: string, index: CtecSubjectIndex): void {
  const store = readStore();
  store.subjects[subjectCode] = index;
  writeStore(store);
}

export function clearSubjectIndex(subjectCode: string): void {
  const store = readStore();
  delete store.subjects[subjectCode];
  writeStore(store);
}

export function readLastSubject(): string | null {
  try {
    const value = window.localStorage.getItem(LAST_SUBJECT_STORAGE_KEY);
    return normalizeSubjectCode(value);
  } catch {
    return null;
  }
}

export function rememberLastSubject(subjectCode: string): void {
  try {
    window.localStorage.setItem(LAST_SUBJECT_STORAGE_KEY, subjectCode);
  } catch {
    // Ignore storage errors.
  }
}
