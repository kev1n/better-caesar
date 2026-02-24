export const SEARCH_ENDPOINT = "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.CLASS_SEARCH.GBL";
export const SEARCH_ENTRY_URL = `${SEARCH_ENDPOINT}?Page=SSR_CLSRCH_ENTRY&Action=U`;
export const SEARCH_ACTION_ID = "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH";
export const DEFAULT_CLASS_FIELD = "SSR_CLSRCH_WRK_CLASS_NBR$8";
export const DEFAULT_TERM_FIELD = "CLASS_SRCH_WRK2_STRM$35$";
export const DEFAULT_CAREER_FIELD = "SSR_CLSRCH_WRK_ACAD_CAREER$2";
export const DEFAULT_INSTITUTION_FIELD = "CLASS_SRCH_WRK2_INSTITUTION$31$";

export type CareerCode = "UGRD" | "TGS";

export type SearchContext = {
  actionUrl: string;
  baseParams: URLSearchParams;
  classFieldName: string;
  termFieldName: string;
  careerFieldName: string;
  institutionFieldName: string;
};

export function resolveActionUrl(pathOrUrl: string): string {
  if (pathOrUrl) return new URL(pathOrUrl, window.location.origin).toString();
  return window.location.href;
}

export function decodeEntities(value: string): string {
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value.replace(/\s+/g, " ").trim();
}

export function sanitizeClassNumber(value: string): string {
  const digits = value.replace(/\D+/g, "");
  return digits.slice(0, 10);
}

export function normalizeCareer(value: string | null): CareerCode | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === "UGRD" || upper === "TGS") return upper;
  return null;
}
