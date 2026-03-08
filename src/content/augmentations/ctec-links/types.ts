export type CtecLinkParams = {
  classNumber: string;
  subject: string;
  catalogNumber: string;
  instructor: string;
  career: "UGRD" | "TGS";
};

export type CtecLinkEntry = {
  term: string;
  url: string;
};

export type CtecLinkData =
  | { state: "found"; entries: CtecLinkEntry[]; totalCount: number }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export type CtecLinkTarget = {
  row: HTMLTableRowElement;
  params: CtecLinkParams;
  container: HTMLElement;
};
