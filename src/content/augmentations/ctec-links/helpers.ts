import type { CtecIndexedEntry } from "../../ctec-index/types";
import { INSTRUCTOR_SELECTOR, NOT_FOUND_ACTION_ID } from "./constants";
import type { CtecAnalyticsStrategy, CtecLinkParams } from "./types";

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

// Extract the last-name token from each comma-separated name in an instructor string.
// "John Hartman,Stacey Wolcott" → ["hartman", "wolcott"]
export function extractLastNameTokens(instructor: string): string[] {
  return instructor
    .split(",")
    .map((n) => {
      const parts = normalizeInstructor(n.trim()).split(" ").filter((t) => t.length > 0);
      return parts[parts.length - 1] ?? "";
    })
    .filter((t) => t.length > 1);
}

// Sentinel-only fallback. Real entries match via descriptionMatchesCatalog;
// sentinels carry "<subject> <catalog>" in description with no section ID.
// catalogNumber may include a sequence suffix ("205-3"); searchText is
// normalized (non-alphanumerics → space), so collapse the hyphen to match.
function catalogTokenRegex(catalogNumber: string): RegExp {
  const normalized = catalogNumber.replace(/-/g, " ");
  return new RegExp(`(?:^|\\s)${normalized}(?:\\s|$)`);
}

// Parses the leading catalog identifier from a CTEC description into its
// digit group and optional single-digit sequence suffix. Examples:
//   "GEN_ENG 205-3 Engineering Analysis III"    → digits "205", seq "3"
//   "GEN_ENG 205-3-22 Engineering Analysis III" → digits "205", seq "3"
//   "COMP_SCI 325-0 Fundamentals"               → digits "325", seq "0"
//   "COMP_SCI 325-0-22 Fundamentals"            → digits "325", seq "0"
//   "COMP_SCI 211-22 Fundamentals"              → digits "211", seq undef
//   "COMP_SCI 211 Fundamentals"                 → digits "211", seq undef
// The sequence digit's `(?!\d)` lookahead keeps a 2+-digit section ID like
// `-22` from being mis-captured as a single sequence `-2`.
const CATALOG_ID_PATTERN = /(?:^|[^0-9])(\d+)(?:-(\d)(?!\d))?/;

export function descriptionMatchesCatalog(
  description: string,
  catalogNumber: string
): boolean {
  const match = description.match(CATALOG_ID_PATTERN);
  if (!match) return false;
  const descDigits = match[1];
  const descSeq = match[2];

  const dashIdx = catalogNumber.indexOf("-");
  if (dashIdx === -1) {
    // Bare catalog like "325" / "211" — a non-sequence course. CAESAR
    // descriptions may encode "no sequence" either by omitting it entirely
    // ("211 Fundamentals", "211-22") or with a literal "-0" placeholder
    // ("325-0", "325-0-22"); both must match the bare argument.
    return descDigits === catalogNumber && (descSeq === undefined || descSeq === "0");
  }
  // Sequence-suffixed catalog like "205-3" / "220-1" — require exact match
  // on both the digit group and the sequence digit.
  return (
    descDigits === catalogNumber.slice(0, dashIdx) &&
    descSeq === catalogNumber.slice(dashIdx + 1)
  );
}

// Any-overlap match across all comma-separated last names in either
// string. CTEC lists co-instructors in unstable order, so trailing-token-
// only would miss legitimate matches and admit wrong-course collisions.
export function instructorMatches(
  rowInstructor: string,
  requestedInstructor: string
): boolean {
  const requested = extractLastNameTokens(requestedInstructor);
  if (requested.length === 0) return true;
  const rowLast = extractLastNameTokens(rowInstructor);
  if (rowLast.length === 0) return false;
  return requested.some((ln) => rowLast.includes(ln));
}

// Predicate for the "combo" lens — entry must match this exact
// (course, instructor) pair. Used by the fetcher's discovery short-circuits
// (it's locked to combo regardless of the user's analytics lens because
// those checks key cache keys on this specific identity) and by the
// strategy dispatcher below for combo-strategy reads.
export function entryMatchesCourse(
  entry: CtecIndexedEntry,
  subject: string,
  catalogNumber: string,
  instructor: string
): boolean {
  // Subject is implicit in readSubjectIndex(subject); descriptions often
  // omit the prefix, so checking it here would produce false negatives.
  void subject;

  if (entry.actionId === NOT_FOUND_ACTION_ID) {
    if (!catalogTokenRegex(catalogNumber).test(entry.searchText)) return false;
  } else if (!descriptionMatchesCatalog(entry.description, catalogNumber)) {
    return false;
  }

  return instructorMatches(entry.instructor, instructor);
}

// "course" lens — drops the instructor filter. Any professor who taught
// this subject + catalog qualifies. Used to show course-wide ratings even
// when the user's specific professor never taught this course (or has no
// CTECs yet) — falls back on the broader cohort.
export function entryMatchesByCourse(
  entry: CtecIndexedEntry,
  catalogNumber: string
): boolean {
  if (entry.actionId === NOT_FOUND_ACTION_ID) {
    return catalogTokenRegex(catalogNumber).test(entry.searchText);
  }
  return descriptionMatchesCatalog(entry.description, catalogNumber);
}

// "instructor" lens — drops the catalog filter. Any course this instructor
// taught within the current subject qualifies. Lets users gauge a
// professor's track record when there's no overlap between their teaching
// history and the specific course being viewed.
export function entryMatchesByInstructor(
  entry: CtecIndexedEntry,
  instructor: string
): boolean {
  // Sentinels (NOT_FOUND_ACTION_ID) only carry course+instructor identity,
  // not class-level data. They're a "we asked CAESAR and it had nothing"
  // marker for combo strategy; they don't contribute to instructor-wide
  // aggregation and would just dilute the signal if we let them through.
  if (entry.actionId === NOT_FOUND_ACTION_ID) return false;
  return instructorMatches(entry.instructor, instructor);
}

// Strategy dispatcher — picks the right predicate for the active analytics
// lens. Subject scoping is enforced upstream by `readSubjectIndex(subject)`,
// so all three lenses operate within the same subject's cached entries.
export function entryMatchesStrategy(
  entry: CtecIndexedEntry,
  params: CtecLinkParams,
  strategy: CtecAnalyticsStrategy
): boolean {
  if (strategy === "course") {
    return entryMatchesByCourse(entry, params.catalogNumber);
  }
  if (strategy === "instructor") {
    return entryMatchesByInstructor(entry, params.instructor);
  }
  return entryMatchesCourse(
    entry,
    params.subject,
    params.catalogNumber,
    params.instructor
  );
}

export function extractSubjectAndCatalog(
  linkText: string
): { subject: string; catalogNumber: string } | null {
  // Captures the 3-digit catalog with an optional single-digit sequence
  // suffix (e.g. "205-3" for GEN_ENG 205-3). The `(?!\d)` lookahead keeps
  // a section ID like "-22" out of the capture. Paper.nu's `-0` default
  // suffix is stripped so downstream callers compare against the bare
  // form ("439" rather than "439-0").
  // Matches: "COMP_SCI 439-0 (12345)" → "439"
  //          "GEN_ENG 205-3 (12345)"  → "205-3"
  //          "COMP_SCI 211-22"        → "211"   (sequence not consumed)
  const match = linkText.trim().match(/^([A-Z][A-Z_ ]*?)\s+(\d{3}(?:-\d(?!\d))?)/i);
  if (!match) return null;
  const subject = (match[1] ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  const catalogNumber = (match[2] ?? "").trim().replace(/-0$/, "");
  if (!subject || !catalogNumber) return null;
  return { subject, catalogNumber };
}

// Discussion / lab sub-rows render the class label inside a
// <span class="PSHYPERLINKDISABLED"> instead of an <a>. Their CTEC is
// shared with the parent lecture, so we inject the cell (so the row's
// border / alternating background stays continuous) but suppress the
// Load CTEC button + cache short-circuit on these rows.
export function isDisabledClassRow(row: Element): boolean {
  return (
    row.querySelector(
      "span.PSHYPERLINKDISABLED[id^='P_CLASS_NAME$span$'], span.PSHYPERLINKDISABLED[id^='E_CLASS_NAME$span$']"
    ) !== null
  );
}

export function extractInstructorFromRow(row: HTMLTableRowElement): string {
  const el = row.querySelector<HTMLElement>(INSTRUCTOR_SELECTOR);
  return el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function isAuthResponse(html: string): boolean {
  const normalized = html.toLowerCase();
  return (
    normalized.includes("northwestern sso") ||
    normalized.includes("northwestern online passport") ||
    normalized.includes("ads-fed.northwestern.edu") ||
    normalized.includes("/adfs/ls") ||
    normalized.includes("fed.it.northwestern.edu") ||
    normalized.includes("shibboleth") ||
    normalized.includes("netid or email address") ||
    normalized.includes("trouble logging in?") ||
    (normalized.includes("sign in") && normalized.includes("password"))
  );
}
