export type CtecRowSeed = {
  actionId: string;
  term: string;
  description: string;
  instructor: string;
};

export type CtecCourseSeed = {
  actionId: string;
  description: string;
};

export type CtecIndexedEntry = {
  actionId: string;
  term: string;
  description: string;
  instructor: string;
  blueraUrl: string | null;
  error: string | null;
  searchText: string;
  reportSummary?: CtecReportSummary | null;
};

export type CtecReportScalarMetric = {
  mean: number;
  responseCount: number;
};

export type CtecReportHoursMetric = {
  mean: number;
  responseCount: number;
  // Per-bucket counts as parsed from the CTEC HTML table. Optional because
  // entries cached before this field was added still fall back to mean/count
  // only — the modal degrades to chart image when buckets are missing.
  buckets?: { label: string; count: number }[];
};

export type CtecReportChart = {
  question: string;
  imageUrl: string;
  alt: string | null;
  // Pixel-extracted bar counts (length 6, top→bottom). Captured at CTEC
  // load time so the modal can render the histogram synchronously without
  // re-fetching the PNG. Absent on entries cached before this field was
  // added or when extraction failed.
  counts?: number[];
};

export type CtecReportCommentGroup = {
  prompt: string;
  comments: string[];
};

export type CtecReportSummary = {
  url: string;
  parsedAt: number;
  metrics: {
    instruction?: CtecReportScalarMetric;
    course?: CtecReportScalarMetric;
    learned?: CtecReportScalarMetric;
    challenging?: CtecReportScalarMetric;
    stimulating?: CtecReportScalarMetric;
    hours?: CtecReportHoursMetric;
  };
  charts: CtecReportChart[];
  commentGroups: CtecReportCommentGroup[];
};

// Per-course discovery state, keyed by `${catalogNumber}|${normalizedInstructor}`
// (see buildCourseStateKey in ctec-links/fetcher.ts). pendingRowCount is the
// number of class rows the most recent PeopleSoft discovery saw that we
// haven't fetched yet. Lets the UI keep "Load N more (M left)" accurate
// across reloads without doing another discovery probe just to find out.
export type CtecCourseDiscoveryState = {
  pendingRowCount: number;
  updatedAt: number;
};

export type CtecSubjectIndex = {
  subjectCode: string;
  subjectLabel: string;
  builtAt: number;
  sourceUrl: string;
  entries: CtecIndexedEntry[];
  courseState?: Record<string, CtecCourseDiscoveryState>;
  // Per-section analytics-lens preference, keyed by the same
  // `${catalogNumber}|${normalizedInstructor}` schema used by
  // courseState. Set when the user explicitly picks a lens via the
  // dry-run wizard or the modal strategy tabs — that overrides the
  // global `getCtecStrategy()` for this specific (catalog, instructor)
  // pair so reopening the modal goes straight to their pick instead
  // of re-running the "Smith hasn't taught CS 213, pick an
  // alternative" wizard every time. Value type is intentionally a
  // string literal (kept independent from the ctec-links
  // CtecAnalyticsStrategy import to avoid a back-dependency from the
  // shared index package).
  sectionLens?: Record<string, "combo" | "course" | "instructor">;
  // Persisted wizard discovery rows. Lets the dry-run alternatives
  // dialog skip the PeopleSoft scrape after a page reload — without
  // this, refreshing the tab evicted the in-memory cache and the
  // wizard re-walked the C-endpoint (catalog grid) and T-endpoint
  // (instructor directory) every time the user opened the modal.
  // Rows carry their fetch-time `actionId` which is response-local
  // and goes stale, but the discovery cache is presentation-only
  // (preview counts + dry-run row list) — the actual report fetch
  // re-discovers fresh actionIds, so stale ones are harmless here.
  courseDiscovery?: Record<string, CtecRowSeed[]>;
  instructorDiscovery?: Record<string, CtecRowSeed[]>;
};

export type CtecIndexStore = {
  version: 1;
  subjects: Record<string, CtecSubjectIndex>;
};
