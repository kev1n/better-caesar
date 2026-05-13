export type CtecLinkParams = {
  subject: string;
  catalogNumber: string;
  instructor: string;
};

// Aggregation lens for the analytics modal + chip rating:
//   combo      = this exact (course, instructor) pair (default — original behavior)
//   course     = any instructor of this course, within the same subject
//   instructor = any course taught by this instructor, within the same subject
// All three scope to a single subject (the entry being viewed) so the
// existing per-subject CTEC index keeps working as the cache substrate.
export type CtecAnalyticsStrategy = "combo" | "course" | "instructor";

export type CtecLinkEntry = {
  term: string;
  url: string;
  instructor: string;
  description: string;
};

export type CtecLinkData =
  | { state: "found"; entries: CtecLinkEntry[]; totalCount: number; incomplete: boolean; hasMore: boolean }
  | { state: "auth-required"; loginUrl: string }
  | { state: "no-access" }
  | { state: "not-found" }
  | { state: "error"; message: string };

export type CtecLinkTarget = {
  row: HTMLTableRowElement;
  params: CtecLinkParams;
  container: HTMLElement;
};
