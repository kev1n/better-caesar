import { readSubjectIndex } from "../../ctec-index/storage";
import type { CtecIndexedEntry } from "../../ctec-index/types";
import { NOT_FOUND_ACTION_ID } from "./constants";
import {
  descriptionMatchesCatalog,
  entryMatchesByCourse,
  entryMatchesByInstructor,
  instructorMatches
} from "./helpers";
import { hasStrategyBeenExplored } from "./reports";
import type { CtecLinkParams } from "./types";

function realEntries(params: CtecLinkParams): CtecIndexedEntry[] {
  const index = readSubjectIndex(params.subject);
  if (!index) return [];
  return index.entries.filter(
    (entry) =>
      entry.actionId !== NOT_FOUND_ACTION_ID && !!entry.blueraUrl
  );
}

function hasComboRow(
  entries: CtecIndexedEntry[],
  params: CtecLinkParams
): boolean {
  return entries.some(
    (entry) =>
      descriptionMatchesCatalog(entry.description, params.catalogNumber) &&
      instructorMatches(entry.instructor, params.instructor)
  );
}

// "Redundant" means we've actively explored the broader lens AND it
// returned nothing the user couldn't already see in combo. Until that
// exploration has run, we can't claim the lens would be a no-op — the
// user might want to discover other professors / other courses. So
// the tab + dry-run card stay visible whenever the broader lens
// hasn't been probed yet, regardless of what entries happen to be
// cached locally.
export function isCourseLensRedundant(params: CtecLinkParams): boolean {
  if (!hasStrategyBeenExplored(params, "course")) return false;
  const entries = realEntries(params);
  if (!hasComboRow(entries, params)) return false;
  const matchingCourse = entries.filter((entry) =>
    entryMatchesByCourse(entry, params.catalogNumber)
  );
  if (matchingCourse.length === 0) return false;
  return matchingCourse.every((entry) =>
    instructorMatches(entry.instructor, params.instructor)
  );
}

export function isInstructorLensRedundant(params: CtecLinkParams): boolean {
  if (!hasStrategyBeenExplored(params, "instructor")) return false;
  const entries = realEntries(params);
  if (!hasComboRow(entries, params)) return false;
  const matchingInstructor = entries.filter((entry) =>
    entryMatchesByInstructor(entry, params.instructor)
  );
  if (matchingInstructor.length === 0) return false;
  return matchingInstructor.every((entry) =>
    descriptionMatchesCatalog(entry.description, params.catalogNumber)
  );
}
