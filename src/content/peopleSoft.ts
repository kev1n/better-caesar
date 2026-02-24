import type {
  LookupClassMessage,
  LookupClassResponse,
  LookupClassSuccess
} from "../shared/messages";

const SEARCH_ENDPOINT = "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.CLASS_SEARCH.GBL";
const SEARCH_ENTRY_URL = `${SEARCH_ENDPOINT}?Page=SSR_CLSRCH_ENTRY&Action=U`;
const SEARCH_ACTION_ID = "CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH";
const DEFAULT_CLASS_FIELD = "SSR_CLSRCH_WRK_CLASS_NBR$8";
const DEFAULT_TERM_FIELD = "CLASS_SRCH_WRK2_STRM$35$";
const DEFAULT_CAREER_FIELD = "SSR_CLSRCH_WRK_ACAD_CAREER$2";
const DEFAULT_INSTITUTION_FIELD = "CLASS_SRCH_WRK2_INSTITUTION$31$";

type SearchContext = {
  actionUrl: string;
  baseParams: URLSearchParams;
  classFieldName: string;
  termFieldName: string;
  careerFieldName: string;
  institutionFieldName: string;
};

export async function lookupClass(message: LookupClassMessage): Promise<LookupClassResponse> {
  const classNumber = sanitizeClassNumber(message.classNumber);
  if (!classNumber) {
    return { ok: false, error: "Enter a numeric class number." };
  }

  const contextCodes = readContextCodes();
  const careers = buildCareerCandidates(contextCodes.career, message.careerHint);
  let lastSummary: LookupClassSuccess | null = null;

  let attempts = 0;
  while (attempts < 2) {
    attempts += 1;
    try {
      const context = await initializeSearchContext();
      for (const career of careers) {
        const params = buildSearchParams(context, classNumber, career);
        const searchResponseText = await fetchPeopleSoft(context.actionUrl, params);
        const summary = buildLookupSummary(classNumber, searchResponseText);
        lastSummary = summary;

        if (!isMatchingClass(summary, classNumber)) continue;
        if (!summary.nextActionForDetails) return summary;

        const detailParams = buildDetailParams(searchResponseText, summary.nextActionForDetails);
        const detailResponseText = await fetchPeopleSoft(context.actionUrl, detailParams);
        return mergeDetailData(summary, detailResponseText);
      }

      if (lastSummary) return lastSummary;
    } catch (error) {
      if (attempts >= 2) {
        const text = error instanceof Error ? error.message : "Unknown error.";
        return { ok: false, error: text };
      }
    }
  }

  return { ok: false, error: "Unable to fetch class metadata." };
}

function buildSearchParams(
  context: SearchContext,
  classNumber: string,
  career: string
): URLSearchParams {
  const params = new URLSearchParams(context.baseParams.toString());

  params.set("ICAJAX", "1");
  params.set("ICAction", SEARCH_ACTION_ID);
  params.set("ICResubmit", "0");
  params.set("ICChanged", "-1");
  params.set("ICActionPrompt", "false");
  params.set("ICBcDomData", "UnknownValue");
  params.set("ICPanelHelpUrl", "");
  params.set("ICPanelName", "");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_CLASS_NBR", classNumber);
  params.set(context.classFieldName, classNumber);
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_CATALOG_NBR", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_DESCR", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_LAST_NAME", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_SUBJECT_SRCH", "");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$", "N");
  setAllFieldsWithPrefix(params, "SSR_CLSRCH_WRK_ACAD_CAREER", career);
  params.set(context.careerFieldName, career);

  return params;
}

async function initializeSearchContext(): Promise<SearchContext> {
  const res = await fetch(resolveActionUrl(SEARCH_ENTRY_URL), {
    method: "GET",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error(`Failed to initialize class search context (${res.status}).`);
  }

  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const form = doc.forms.namedItem("win0");
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Class search form not found while initializing context.");
  }

  const classFieldName = findFieldName(form, "SSR_CLSRCH_WRK_CLASS_NBR") ?? DEFAULT_CLASS_FIELD;
  const termFieldName = findFieldName(form, "CLASS_SRCH_WRK2_STRM") ?? DEFAULT_TERM_FIELD;
  const careerFieldName = findFieldName(form, "SSR_CLSRCH_WRK_ACAD_CAREER") ?? DEFAULT_CAREER_FIELD;
  const institutionFieldName =
    findFieldName(form, "CLASS_SRCH_WRK2_INSTITUTION") ?? DEFAULT_INSTITUTION_FIELD;

  const baseParams = serializeForm(form);
  const contextCodes = readContextCodes();
  if (contextCodes.institution) baseParams.set(institutionFieldName, contextCodes.institution);
  if (contextCodes.term) baseParams.set(termFieldName, contextCodes.term);
  if (contextCodes.career) baseParams.set(careerFieldName, contextCodes.career);

  const openOnlyField =
    findFieldName(form, "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$") ?? "SSR_CLSRCH_WRK_SSR_OPEN_ONLY$chk$3";
  baseParams.set(openOnlyField, "N");

  return {
    actionUrl: resolveActionUrl(SEARCH_ENDPOINT),
    baseParams,
    classFieldName,
    termFieldName,
    careerFieldName,
    institutionFieldName
  };
}

function sanitizeClassNumber(value: string): string {
  const digits = value.replace(/\D+/g, "");
  return digits.slice(0, 10);
}

function findFieldName(form: HTMLFormElement, fieldPrefix: string): string | null {
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
    if (element.name.startsWith(fieldPrefix)) return element.name;
  }
  return null;
}

function resolveActionUrl(pathOrUrl: string): string {
  if (pathOrUrl) return new URL(pathOrUrl, window.location.origin).toString();
  return window.location.href;
}

function readContextCodes(): {
  term: string | null;
  career: string | null;
  institution: string | null;
} {
  const candidates = [window.location.href, ...extractUrlsFromInlineScripts()];

  for (const rawUrl of candidates) {
    try {
      const url = new URL(rawUrl, window.location.origin);
      const term = url.searchParams.get("STRM");
      const career = url.searchParams.get("ACAD_CAREER");
      const institution = url.searchParams.get("INSTITUTION");
      if (term || career || institution) {
        return { term, career, institution };
      }
    } catch {
      continue;
    }
  }

  return { term: null, career: null, institution: null };
}

function buildCareerCandidates(
  contextCareer: string | null,
  hintCareer: "UGRD" | "TGS" | undefined
): string[] {
  const normalizedContext = normalizeCareer(contextCareer);
  const normalizedHint = normalizeCareer(hintCareer ?? null);
  const candidates: string[] = [];

  const push = (value: string | null) => {
    if (!value) return;
    if (!candidates.includes(value)) candidates.push(value);
  };

  push(normalizedHint);
  push(normalizedContext);
  push("UGRD");
  push("TGS");

  return candidates;
}

function normalizeCareer(value: string | null): "UGRD" | "TGS" | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper === "UGRD" || upper === "TGS") return upper;
  return null;
}

function extractUrlsFromInlineScripts(): string[] {
  const urls = new Set<string>();
  const scriptEls = document.querySelectorAll("script:not([src])");
  const pattern = /(?:strCurrUrl|sHistURL)\s*=\s*'([^']+)'/g;

  for (const script of Array.from(scriptEls)) {
    const source = script.textContent ?? "";
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const value = match[1]?.trim();
      if (!value) continue;
      urls.add(value);
    }
  }

  return Array.from(urls);
}

function serializeForm(form: HTMLFormElement): URLSearchParams {
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

function setAllFieldsWithPrefix(
  params: URLSearchParams,
  fieldPrefix: string,
  value: string
): void {
  const keys = new Set<string>();
  params.forEach((_v, key) => {
    keys.add(key);
  });
  let matched = false;
  for (const key of Array.from(keys)) {
    if (!key.startsWith(fieldPrefix)) continue;
    params.set(key, value);
    matched = true;
  }
  if (!matched) return;
}

async function fetchPeopleSoft(actionUrl: string, params: URLSearchParams): Promise<string> {
  const res = await fetch(actionUrl, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body: params.toString()
  });

  if (!res.ok) {
    throw new Error(`Search request failed (${res.status}).`);
  }

  return res.text();
}

function buildLookupSummary(
  requestedClassNumber: string,
  responseText: string
): LookupClassSuccess {
  if (/<PAGE id='NW_TERM_STA1_FL'>/i.test(responseText)) {
    throw new Error(
      "Class search context is missing (term/career/institution). Open Shopping Cart and retry."
    );
  }

  if (/<PAGE id='SSR_SSENRL_CART'>/i.test(responseText) && !/MTG_CLASS_NBR\$0/i.test(responseText)) {
    const msg = extractErrorMessage(responseText);
    if (msg) throw new Error(msg);
    throw new Error("Request returned shopping cart page instead of class search results.");
  }

  const criteriaClassNumber =
    responseText.match(/Class Nbr:\s*'?\s*<strong>(\d+)<\/strong>/i)?.[1] ?? null;

  const firstResultClassNumber =
    responseText.match(/id='MTG_CLASS_NBR\$0'[\s\S]*?>\s*(\d+)\s*<\/a>/i)?.[1] ?? null;

  const firstResultCourseTitle =
    responseText.match(
      /SSR_CLSRSLT_WRK_GROUPBOX2GP\$0'[^>]*>[\s\S]*?&nbsp;([^<]+?)&nbsp;<\/DIV>/i
    )?.[1] ?? null;

  const firstResultSection =
    responseText.match(/id='MTG_CLASSNAME\$0'[\s\S]*?>\s*([^<]+?)\s*<br/i)?.[1] ?? null;
  const firstResultInstructor = extractTextById(responseText, "MTG_INSTR$0");
  const firstResultDaysTimes = extractTextById(responseText, "MTG_DAYTIME$0");
  const firstResultRoom = extractTextById(responseText, "MTG_ROOM$0");
  const firstResultMeetingDates = extractTextById(responseText, "MTG_TOPIC$0");
  const firstResultGrading = extractTextById(responseText, "NW_DERIVED_SS3_DESCR$0");
  const firstResultStatus = extractStatusText(responseText);

  const nextActionForDetails =
    responseText.match(/submitAction_win0\(document\.win0,'(MTG_CLASSNAME\$0)'\)/i)?.[1] ?? null;

  return {
    ok: true,
    requestedClassNumber,
    criteriaClassNumber,
    firstResultClassNumber,
    firstResultCourseTitle,
    firstResultSection,
    firstResultInstructor,
    firstResultDaysTimes,
    firstResultRoom,
    firstResultMeetingDates,
    firstResultGrading,
    firstResultStatus,
    classCapacity: null,
    enrollmentTotal: null,
    availableSeats: null,
    waitListCapacity: null,
    waitListTotal: null,
    enrollmentInfoNotes: null,
    classNotes: null,
    nextActionForDetails
  };
}

function buildDetailParams(searchResponseText: string, actionId: string): URLSearchParams {
  const params = extractHiddenInputs(searchResponseText);
  if (!params.has("ICSID")) {
    throw new Error("Unable to prepare class detail request (missing hidden state).");
  }

  params.set("ICAJAX", "1");
  params.set("ICNAVTYPEDROPDOWN", "0");
  params.set("ICAction", actionId);
  params.set("ICResubmit", "0");
  params.set("ICActionPrompt", "false");
  params.set("ICBcDomData", "UnknownValue");
  params.set("ICPanelHelpUrl", "");
  params.set("ICPanelName", "");
  params.set("ICFind", "");
  params.set("ICAddCount", "");
  params.set("ICAppClsData", "");
  if (!params.has("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$")) {
    params.set("DERIVED_SSTSNAV_SSTS_MAIN_GOTO$27$", "");
  }

  return params;
}

function extractHiddenInputs(responseText: string): URLSearchParams {
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

function mergeDetailData(summary: LookupClassSuccess, detailResponseText: string): LookupClassSuccess {
  if (!/<PAGE id='SSR_CLSRCH_DTL'>/i.test(detailResponseText)) {
    return summary;
  }

  return {
    ...summary,
    classCapacity: extractTextById(detailResponseText, "SSR_CLS_DTL_WRK_ENRL_CAP"),
    enrollmentTotal: extractTextById(detailResponseText, "SSR_CLS_DTL_WRK_ENRL_TOT"),
    availableSeats: extractTextById(detailResponseText, "SSR_CLS_DTL_WRK_AVAILABLE_SEATS"),
    waitListCapacity: extractTextById(detailResponseText, "SSR_CLS_DTL_WRK_WAIT_CAP"),
    waitListTotal: extractTextById(detailResponseText, "SSR_CLS_DTL_WRK_WAIT_TOT"),
    enrollmentInfoNotes: extractLongTextById(detailResponseText, "SSR_CLS_DTL_WRK_SSR_CRSE_ATTR_LONG"),
    classNotes: extractLongTextById(detailResponseText, "DERIVED_CLSRCH_SSR_CLASSNOTE_LONG")
  };
}

function isMatchingClass(summary: LookupClassSuccess, requestedClassNumber: string): boolean {
  if (summary.firstResultClassNumber && summary.firstResultClassNumber === requestedClassNumber) {
    return true;
  }
  if (summary.criteriaClassNumber && summary.criteriaClassNumber === requestedClassNumber) {
    return true;
  }
  return false;
}

function extractErrorMessage(responseText: string): string | null {
  const raw = responseText.match(/<GENMSG[^>]*><!\[CDATA\[(.*?)\]\]><\/GENMSG>/is)?.[1];
  if (!raw) return null;
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return decodeEntities(text);
}

function extractTextById(responseText: string, id: string): string | null {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}['"][\\s\\S]*?>\\s*([^<]+?)\\s*<`, "i");
  const value = pattern.exec(responseText)?.[1];
  if (!value) return null;
  return decodeEntities(value);
}

function extractLongTextById(responseText: string, id: string): string | null {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}['"][^>]*>([\\s\\S]*?)<\\/span>`, "i");
  const raw = pattern.exec(responseText)?.[1];
  if (!raw) return null;
  const normalized = raw
    .replace(/<br\s*\/?>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? decodeEntities(normalized) : null;
}

function extractStatusText(responseText: string): string | null {
  const match = responseText.match(
    /id=['"]DERIVED_CLSRCH_SSR_STATUS_LONG\$0['"][\s\S]*?alt=["']([^"']+)["']/i
  )?.[1];

  if (!match) return null;
  return decodeEntities(match);
}

function decodeEntities(value: string): string {
  const element = document.createElement("textarea");
  element.innerHTML = value;
  return element.value.replace(/\s+/g, " ").trim();
}
