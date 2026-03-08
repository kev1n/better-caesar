import {
  applyResponseState,
  buildActionParams,
  buildSubjectResultsUrl,
  collectClassRowsFromText,
  collectCourseRows,
  dedupeEntries,
  extractBlueraUrl,
  extractPostUrl,
  normalizeSearch,
  resolveActionUrl,
  serializeForm
} from "../ctec-navigation/helpers";
import { readSubjectIndex, writeSubjectIndex } from "../ctec-navigation/storage";
import type { CtecIndexedEntry } from "../ctec-navigation/types";
import { fetchPeopleSoft, fetchPeopleSoftGet } from "../../peoplesoft/http";
import { CTEC_AUTH_URL, REQUEST_OWNER } from "./constants";
import { courseDescMatchesCatalog, entryMatchesCourse, isAuthResponse, normalizeInstructor, termToSortKey } from "./helpers";
import type { CtecLinkData, CtecLinkEntry, CtecLinkParams } from "./types";

export async function fetchCtecLinks(params: CtecLinkParams): Promise<CtecLinkData> {
  const { subject, catalogNumber, instructor, career } = params;

  // 1. Check cache — use it if it already has matching entries for this course.
  const cachedIndex = readSubjectIndex(subject);
  if (cachedIndex) {
    const cached = cachedIndex.entries.filter((e) =>
      entryMatchesCourse(e, subject, catalogNumber, instructor)
    );
    if (cached.length > 0) {
      return buildFoundResult(cached);
    }
    // Cache exists but doesn't have this course — fall through to fetch.
  }

  // 2. Fetch the course's class entries from PeopleSoft.
  const fetchResult = await fetchCourseEntries(subject, catalogNumber, career, instructor);

  if (fetchResult.type === "auth") {
    return { state: "auth-required", loginUrl: CTEC_AUTH_URL };
  }
  if (fetchResult.type === "error") {
    return { state: "error", message: fetchResult.message };
  }
  if (fetchResult.type === "not-found") {
    return { state: "not-found" };
  }

  // 3. Merge new entries into existing subject index to avoid stomping ctec-navigation's data.
  const existingEntries = cachedIndex?.entries ?? [];
  const merged = dedupeEntries([...existingEntries, ...fetchResult.entries]);
  writeSubjectIndex(subject, {
    subjectCode: subject,
    subjectLabel: cachedIndex?.subjectLabel ?? subject,
    builtAt: cachedIndex?.builtAt ?? Date.now(),
    sourceUrl: cachedIndex?.sourceUrl ?? window.location.href,
    entries: merged
  });

  // 4. Filter merged entries for this course+instructor.
  const matches = fetchResult.entries.filter((e) =>
    entryMatchesCourse(e, subject, catalogNumber, instructor)
  );
  if (matches.length === 0) return { state: "not-found" };
  return buildFoundResult(matches);
}

// Synchronous cache-only lookup. Returns data if the subject index exists and
// has matching entries for this course; null if a fetch is required.
export function getCtecLinksFromCache(params: CtecLinkParams): CtecLinkData | null {
  const { subject, catalogNumber, instructor } = params;
  const cachedIndex = readSubjectIndex(subject);
  if (!cachedIndex) return null;
  const matches = cachedIndex.entries.filter((e) =>
    entryMatchesCourse(e, subject, catalogNumber, instructor)
  );
  if (matches.length === 0) return null;
  return buildFoundResult(matches);
}

function buildFoundResult(entries: CtecIndexedEntry[]): CtecLinkData {
  const sorted = [...entries].sort((a, b) => termToSortKey(b.term) - termToSortKey(a.term));

  const withUrls: CtecLinkEntry[] = sorted
    .filter((e): e is CtecIndexedEntry & { blueraUrl: string } => e.blueraUrl !== null)
    .map((e) => ({ term: e.term, url: e.blueraUrl }));

  if (withUrls.length === 0) return { state: "not-found" };

  return { state: "found", entries: withUrls, totalCount: entries.length };
}

type FetchCourseResult =
  | { type: "entries"; entries: CtecIndexedEntry[] }
  | { type: "auth" }
  | { type: "not-found" }
  | { type: "error"; message: string };

async function fetchCourseEntries(
  subject: string,
  catalogNumber: string,
  career: string,
  instructor: string
): Promise<FetchCourseResult> {
  // Load subject results page.
  const resultsUrl = buildSubjectResultsUrl(subject, career);
  let html: string;
  try {
    html = await fetchPeopleSoftGet(resultsUrl, { owner: REQUEST_OWNER });
  } catch (e) {
    return { type: "error", message: e instanceof Error ? e.message : "Failed to load CTEC page." };
  }

  if (isAuthResponse(html)) return { type: "auth" };

  const doc = new DOMParser().parseFromString(html, "text/html");
  const form = doc.forms.namedItem("win0");
  if (!(form instanceof HTMLFormElement)) {
    return { type: "error", message: "Could not parse CTEC form." };
  }

  const actionUrl = resolveActionUrl(form.action);
  const baseParams = serializeForm(form);

  // Find the course matching subject + catalog number.
  const courseRows = collectCourseRows(doc);
  const targetCourse = courseRows.find((c) =>
    courseDescMatchesCatalog(c.description, catalogNumber)
  );
  if (!targetCourse) return { type: "not-found" };

  // Load that course's class list.
  let courseResponse: string;
  try {
    courseResponse = await fetchPeopleSoft(
      actionUrl,
      buildActionParams(baseParams, targetCourse.actionId),
      { owner: REQUEST_OWNER }
    );
  } catch (e) {
    return { type: "error", message: e instanceof Error ? e.message : "Failed to load course." };
  }

  if (isAuthResponse(courseResponse)) return { type: "auth" };

  const allClassRows = collectClassRowsFromText(courseResponse);
  if (allClassRows.length === 0) return { type: "not-found" };

  // Filter to rows matching the instructor before fetching Bluera URLs,
  // to avoid N×100 requests when an instructor param is available.
  const normInstructor = normalizeInstructor(instructor);
  const instrTokens = normInstructor.split(" ").filter((t) => t.length > 2);
  const classRows =
    instrTokens.length > 0
      ? allClassRows.filter((r) => {
          const normRow = normalizeInstructor(r.instructor);
          return instrTokens.some((tok) => normRow.includes(tok));
        })
      : allClassRows;

  const classParams = applyResponseState(baseParams, courseResponse);
  const classActionUrl = extractPostUrl(courseResponse) ?? actionUrl;

  // Fetch Bluera URL for each class row sequentially.
  const resultEntries: CtecIndexedEntry[] = [];
  for (const row of classRows) {
    let classResponse: string;
    try {
      classResponse = await fetchPeopleSoft(
        classActionUrl,
        buildActionParams(classParams, row.actionId),
        { owner: REQUEST_OWNER }
      );
    } catch {
      resultEntries.push({
        actionId: row.actionId,
        term: row.term,
        description: row.description,
        instructor: row.instructor,
        blueraUrl: null,
        error: "Fetch failed",
        searchText: normalizeSearch([row.term, row.description, row.instructor].join(" "))
      });
      continue;
    }

    if (isAuthResponse(classResponse)) return { type: "auth" };

    const blueraUrl = extractBlueraUrl(classResponse);
    resultEntries.push({
      actionId: row.actionId,
      term: row.term,
      description: row.description,
      instructor: row.instructor,
      blueraUrl,
      error: blueraUrl ? null : "No Bluera URL found",
      searchText: normalizeSearch([row.term, row.description, row.instructor].join(" "))
    });
  }

  return { type: "entries", entries: resultEntries };
}
