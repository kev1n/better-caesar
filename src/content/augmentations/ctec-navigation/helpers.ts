import { decodeEntities } from "../../peoplesoft/shared";
import { DEFAULT_CAREER_CODE, DEFAULT_SUBJECT_CODE, PAGE_ID } from "./constants";
import type {
  CtecCourseSeed,
  CtecIndexedEntry,
  CtecRowSeed,
  CtecSubjectContext,
  IndexVisualState
} from "./types";

export function normalizeSubjectCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return normalized;
}

export function normalizeCareerCode(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "TGS") return "TGS";
  return DEFAULT_CAREER_CODE;
}

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

export function readCareerFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, window.location.origin);
    const career = url.searchParams.get("ACAD_CAREER");
    if (!career) return null;
    return normalizeCareerCode(career);
  } catch {
    return null;
  }
}

export function readSubjectCodeFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, window.location.origin);
    const subject = url.searchParams.get("SUBJECT");
    return normalizeSubjectCode(subject);
  } catch {
    return null;
  }
}

export function readSubjectContext(doc: Document, sourceUrl: string): CtecSubjectContext {
  const urlCode = readSubjectCodeFromUrl(sourceUrl);

  const subjectText = cleanText(doc.querySelector<HTMLElement>("#NW_CT_SUBJECT_V_DESCR50")?.textContent);
  if (subjectText) {
    const [left, right] = subjectText.split(/\s+-\s+/, 2);
    const code = normalizeSubjectCode(left) || urlCode || DEFAULT_SUBJECT_CODE;
    const label = right?.trim() || left.trim() || code;
    return { code, label };
  }

  return {
    code: urlCode || DEFAULT_SUBJECT_CODE,
    label: urlCode || DEFAULT_SUBJECT_CODE
  };
}

export function buildSubjectResultsUrl(subjectCode: string, careerCode: string): string {
  const url = new URL(
    "/psc/csnu/EMPLOYEE/SA/c/NWCT.NW_CT_PUB_RSLT_FL.GBL",
    window.location.origin
  );
  url.searchParams.set("Page", PAGE_ID);
  url.searchParams.set("NW_CTEC_SRCH_CHOIC", "C");
  url.searchParams.set("ACAD_CAREER", normalizeCareerCode(careerCode));
  url.searchParams.set("SUBJECT", subjectCode);
  url.searchParams.set("NoCrumbs", "yes");
  url.searchParams.set("PortalKeyStruct", "yes");
  return url.toString();
}

export function resolveActionUrl(action: string): string {
  try {
    return new URL(action || window.location.href, window.location.origin).toString();
  } catch {
    return window.location.href;
  }
}

export function buildActionParams(baseParams: URLSearchParams, actionId: string): URLSearchParams {
  const params = new URLSearchParams(baseParams.toString());
  params.set("ICAJAX", "1");
  params.set("ICNAVTYPEDROPDOWN", "0");
  params.set("ICType", "Panel");
  params.set("ICElementNum", "0");
  params.set("ICAction", actionId);
  params.set("ICModelCancel", "0");
  params.set("ICXPos", "0");
  params.set("ICYPos", "0");
  params.set("ResponsetoDiffFrame", "-1");
  params.set("TargetFrameName", "None");
  params.set("FacetPath", "None");
  params.set("PrmtTbl", "");
  params.set("PrmtTbl_fn", "");
  params.set("PrmtTbl_fv", "");
  params.set("TA_SkipFldNms", "");
  params.set("ICFocus", "");
  params.set("ICSaveWarningFilter", "0");
  params.set("ICChanged", "0");
  params.set("ICSkipPending", "0");
  params.set("ICAutoSave", "0");
  params.set("ICResubmit", "0");
  params.set("ICActionPrompt", "false");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");
  return params;
}

export function applyResponseState(baseParams: URLSearchParams, responseText: string): URLSearchParams {
  const params = new URLSearchParams(baseParams.toString());

  const parsedStateNum = responseText.match(/ICStateNum\.value\s*=\s*'?(\d+)'?/i)?.[1] ?? null;
  if (parsedStateNum) {
    params.set("ICStateNum", parsedStateNum);
  }

  const hiddenValues = extractHiddenInputs(responseText);
  hiddenValues.forEach((value, key) => {
    params.set(key, value);
  });

  return params;
}

export function extractHiddenInputs(responseText: string): URLSearchParams {
  const params = new URLSearchParams();
  const hiddenInputRegex =
    /<input[^>]*type=['"]hidden['"][^>]*name=['"]([^'"]+)['"][^>]*value=['"]([^'"]*)['"][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = hiddenInputRegex.exec(responseText)) !== null) {
    const name = decodeEntities(match[1] ?? "");
    const value = decodeEntities(match[2] ?? "");
    if (!name) continue;
    params.set(name, value);
  }

  return params;
}

export function extractPostUrl(responseText: string): string | null {
  const postUrl = responseText.match(/postUrl_win0\s*=\s*'([^']+)'/i)?.[1] ?? null;
  if (!postUrl) return null;
  return resolveActionUrl(postUrl);
}

export function extractActionIds(responseText: string, prefix: "MYLINK" | "MYLINK1"): string[] {
  const pattern = new RegExp(
    `submitAction_win0\\(document\\.win0,'(${prefix}\\$\\d+)\\s*'\\)`,
    "gi"
  );
  const unique = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(responseText)) !== null) {
    const actionId = (match[1] ?? "").trim();
    if (!actionId) continue;
    unique.add(actionId);
  }

  return Array.from(unique);
}

export function extractFieldValue(responseText: string, id: string): string {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}\\s*['"][\\s\\S]*?>\\s*([^<]+?)\\s*<`, "i");
  const value = pattern.exec(responseText)?.[1] ?? "";
  return cleanText(value);
}

export function extractBlueraUrl(responseText: string): string | null {
  const doPortalMatch =
    responseText.match(/DoPortalUrl\('((?:\\'|[^'])+)'\)/i)?.[1] ??
    responseText.match(/DoPortalUrl\("((?:\\"|[^"])+)"\)/i)?.[1] ??
    null;

  const rawValue = doPortalMatch
    ? doPortalMatch
    : responseText.match(/window\.open\('((?:\\'|[^'])+)'/i)?.[1] ?? null;
  if (!rawValue) return null;

  const unescaped = rawValue.replace(/\\'/g, "'").replace(/\\"/g, '"');
  const decoded = decodeEntities(unescaped);
  const trimmed = decoded.trim();
  if (!trimmed) return null;

  // Extract SelectedIDforPrint and build a direct Bluera URL,
  // bypassing the PeopleSoft portal redirect from DoPortalUrl.
  const selectedId = trimmed.match(/[?&]SelectedIDforPrint=([^&]+)/i)?.[1] ?? null;
  if (selectedId) {
    return `https://northwestern.bluera.com/northwestern/rpvf-eng.aspx?lang=eng&redi=1&SelectedIDforPrint=${selectedId}&ReportType=2&regl=en-US`;
  }

  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return trimmed;
  }
}

export function extractActionId(link: HTMLAnchorElement): string | null {
  if (link.id.startsWith("MYLINK1$")) return link.id.trim();

  const href = link.getAttribute("href") ?? "";
  const match = href.match(/submitAction_win0\(document\.win0,'([^']+)'\)/i)?.[1] ?? null;
  return match?.trim() ?? null;
}

export function serializeForm(form: HTMLFormElement): URLSearchParams {
  const params = new URLSearchParams();

  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
    ) {
      continue;
    }

    if (!element.name || element.disabled) continue;

    if (element instanceof HTMLInputElement) {
      const type = element.type.toLowerCase();
      if (type === "button" || type === "submit" || type === "reset" || type === "image") continue;

      if (type === "radio") {
        if (element.checked) params.set(element.name, element.value);
        continue;
      }

      if (type === "checkbox") {
        if (element.checked) {
          params.set(element.name, element.value || "Y");
        } else if (element.name.includes("$chk")) {
          params.set(element.name, "");
        }
        continue;
      }
    }

    params.set(element.name, element.value ?? "");
  }

  return params;
}

export function collectClassRows(doc: Document): CtecRowSeed[] {
  const rows = doc.querySelectorAll<HTMLTableRowElement>("tr.ps_grid-row[id^='NW_CT_PV4_DRV$0_row_']");
  const seeds: CtecRowSeed[] = [];

  for (const row of Array.from(rows)) {
    const link = row.querySelector<HTMLAnchorElement>("a[id^='MYLINK1$']");
    if (!link) continue;

    const actionId = extractActionId(link);
    if (!actionId) continue;

    const term = cleanText(row.querySelector<HTMLElement>("[id^='MYDESCR2$']")?.textContent);
    const description = cleanText(row.querySelector<HTMLElement>("[id^='MYDESCR$']")?.textContent);
    const instructor = cleanText(row.querySelector<HTMLElement>("[id^='CTEC_INSTRUCTOR$']")?.textContent);

    seeds.push({ actionId, term, description, instructor });
  }

  return seeds;
}

export function collectClassRowsFromText(responseText: string): CtecRowSeed[] {
  const actionIds = extractActionIds(responseText, "MYLINK1");
  const rows: CtecRowSeed[] = [];

  for (const actionId of actionIds) {
    const index = actionId.match(/\$(\d+)$/)?.[1] ?? null;
    if (!index) continue;

    rows.push({
      actionId,
      term: extractFieldValue(responseText, `MYDESCR2$${index}`),
      description: extractFieldValue(responseText, `MYDESCR$${index}`),
      instructor: extractFieldValue(responseText, `CTEC_INSTRUCTOR$${index}`)
    });
  }

  return rows;
}

export function collectCourseRows(doc: Document): CtecCourseSeed[] {
  const rows = doc.querySelectorAll<HTMLTableRowElement>("tr.ps_grid-row[id^='NW_CT_PV_DRV$0_row_']");
  const seeds: CtecCourseSeed[] = [];

  for (const row of Array.from(rows)) {
    const link = row.querySelector<HTMLAnchorElement>("a[id^='MYLINK$']");
    if (!link) continue;

    const actionId = extractActionId(link);
    if (!actionId) continue;

    const description = cleanText(row.querySelector<HTMLElement>("[id^='MYLABEL$']")?.textContent);
    seeds.push({ actionId, description });
  }

  return seeds;
}

export function dedupeEntries(entries: CtecIndexedEntry[]): CtecIndexedEntry[] {
  const byKey = new Map<string, CtecIndexedEntry>();

  for (const entry of entries) {
    const key = [
      entry.actionId,
      normalizeSearch(entry.term),
      normalizeSearch(entry.description),
      normalizeSearch(entry.instructor)
    ].join("|");

    if (!byKey.has(key)) {
      byKey.set(key, entry);
    }
  }

  return Array.from(byKey.values());
}

export function createInitialVisualState(subjectCode: string | null = null): IndexVisualState {
  return {
    subjectCode,
    startedAtMs: Date.now(),
    coursesTotal: 0,
    coursesStarted: 0,
    coursesCompleted: 0,
    classesTotal: 0,
    classesStarted: 0,
    classesCompleted: 0,
    inFlightCourses: 0,
    inFlightClasses: 0,
    linksFound: 0,
    linksMissing: 0,
    courses: []
  };
}

export async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  if (items.length === 0) return [];

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const results: U[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}
