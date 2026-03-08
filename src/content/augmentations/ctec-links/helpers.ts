import { normalizeSearch } from "../ctec-navigation/helpers";
import type { CtecIndexedEntry } from "../ctec-navigation/types";
import { INSTRUCTOR_SELECTOR } from "./constants";

export function termToSortKey(term: string): number {
  // Handles both "Fall 2023" and "2023 Fall" (CTEC uses year-first format).
  const seasonMap: Record<string, number> = { Fall: 0, Winter: 1, Spring: 2, Summer: 3 };
  let year = 0;
  let s = 0;
  for (const part of term.trim().split(/\s+/)) {
    const n = parseInt(part, 10);
    if (!isNaN(n) && n > 1000) {
      year = n;
    } else if (part in seasonMap) {
      s = seasonMap[part] ?? 0;
    }
  }
  if (!year) return 0;
  // Fall Y → Y*4+0; Winter/Spring/Summer Y → (Y-1)*4+s  (so Winter 2024 > Fall 2023)
  const adjustedYear = s === 0 ? year : year - 1;
  return adjustedYear * 4 + s;
}

export function normalizeInstructor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Regex matching catalog number as a standalone token in normalized text.
// e.g. catalog "395" matches "comm st 395 0 21" but NOT "comm st 3950".
function catalogTokenRegex(catalogNumber: string): RegExp {
  return new RegExp(`(?:^|\\s)${catalogNumber}(?:\\s|$)`);
}

export function entryMatchesCourse(
  entry: CtecIndexedEntry,
  subject: string,
  catalogNumber: string,
  instructor: string
): boolean {
  // The subject check is intentionally omitted: entries come from readSubjectIndex(subject)
  // which already scopes to the correct subject. CTEC descriptions often omit the subject
  // prefix (e.g. "395-0-21 Topics in..." rather than "COMM_ST 395-0-21 Topics in..."),
  // so a subject check against searchText would produce false negatives.
  void subject;

  // Catalog number must appear as a standalone token in the pre-normalized searchText.
  // e.g. "395" matches "fall 2023 395 0 21 topics..." but not "fall 2023 3950 ..."
  if (!catalogTokenRegex(catalogNumber).test(entry.searchText)) return false;

  if (!instructor) return true;
  const normEntry = normalizeInstructor(entry.instructor);
  const normQuery = normalizeInstructor(instructor);

  const tokens = normQuery.split(" ").filter((t) => t.length > 2);
  if (tokens.length === 0) return true;
  return tokens.some((token) => normEntry.includes(token));
}

// Used by fetcher to find the matching course row in the CTEC subject page.
// The page is already filtered by subject (subject is in the URL), so descriptions
// appear as "395-0: Title" without a subject prefix — catalog match only.
export function courseDescMatchesCatalog(description: string, catalogNumber: string): boolean {
  return catalogTokenRegex(catalogNumber).test(normalizeSearch(description));
}

export function extractSubjectAndCatalog(
  linkText: string
): { subject: string; catalogNumber: string } | null {
  // Match "COMP_SCI 439-0 (12345)" or "ECON 201-6 (22345)"
  const match = linkText.trim().match(/^([A-Z][A-Z_ ]*?)\s+(\d{3})/i);
  if (!match) return null;
  const subject = (match[1] ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  const catalogNumber = (match[2] ?? "").trim();
  if (!subject || !catalogNumber) return null;
  return { subject, catalogNumber };
}

export function extractInstructorFromRow(row: HTMLTableRowElement): string {
  const el = row.querySelector<HTMLElement>(INSTRUCTOR_SELECTOR);
  return el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function isAuthResponse(html: string): boolean {
  return (
    html.includes("Northwestern SSO") ||
    html.includes("fed.it.northwestern.edu") ||
    html.includes("shibboleth") ||
    (html.includes("Sign In") && html.includes("password"))
  );
}
