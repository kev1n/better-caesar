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

export type CtecSubjectContext = {
  code: string;
  label: string;
};

export type CtecIndexedEntry = {
  actionId: string;
  term: string;
  description: string;
  instructor: string;
  blueraUrl: string | null;
  error: string | null;
  searchText: string;
};

export type CtecSubjectIndex = {
  subjectCode: string;
  subjectLabel: string;
  builtAt: number;
  sourceUrl: string;
  entries: CtecIndexedEntry[];
};

export type CtecIndexStore = {
  version: 1;
  subjects: Record<string, CtecSubjectIndex>;
};

export type CourseStatus = "queued" | "loading" | "indexing" | "done" | "error";

export type CourseProgress = {
  index: number;
  description: string;
  status: CourseStatus;
  classesTotal: number;
  classesCompleted: number;
};

export type PanelRefs = {
  root: HTMLElement;
  title: HTMLElement;
  meta: HTMLElement;
  status: HTMLElement;
  progressSummary: HTMLElement;
  courseProgressFill: HTMLElement;
  classProgressFill: HTMLElement;
  progressStats: HTMLElement;
  courseGrid: HTMLElement;
  subjectInput: HTMLInputElement;
  careerSelect: HTMLSelectElement;
  indexButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  searchInput: HTMLInputElement;
  results: HTMLElement;
};

export type IndexVisualState = {
  subjectCode: string | null;
  startedAtMs: number;
  coursesTotal: number;
  coursesStarted: number;
  coursesCompleted: number;
  classesTotal: number;
  classesStarted: number;
  classesCompleted: number;
  inFlightCourses: number;
  inFlightClasses: number;
  linksFound: number;
  linksMissing: number;
  courses: CourseProgress[];
};

export type ClassTask = {
  row: CtecRowSeed;
  actionUrl: string;
  params: URLSearchParams;
  courseIndex: number;
};
