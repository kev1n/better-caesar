import type { Augmentation } from "../../framework";
import { fetchPeopleSoft, fetchPeopleSoftGet } from "../../peoplesoft/http";
import { decodeEntities } from "../../peoplesoft/shared";

type CtecRowSeed = {
  actionId: string;
  term: string;
  description: string;
  instructor: string;
};

type CtecCourseSeed = {
  actionId: string;
  description: string;
};

type CtecSubjectContext = {
  code: string;
  label: string;
};

type CtecIndexedEntry = {
  actionId: string;
  term: string;
  description: string;
  instructor: string;
  blueraUrl: string | null;
  error: string | null;
  searchText: string;
};

type CtecSubjectIndex = {
  subjectCode: string;
  subjectLabel: string;
  builtAt: number;
  sourceUrl: string;
  entries: CtecIndexedEntry[];
};

type CtecIndexStore = {
  version: 1;
  subjects: Record<string, CtecSubjectIndex>;
};

type PanelRefs = {
  root: HTMLElement;
  title: HTMLElement;
  meta: HTMLElement;
  status: HTMLElement;
  trace: HTMLElement;
  subjectInput: HTMLInputElement;
  careerSelect: HTMLSelectElement;
  indexButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  searchInput: HTMLInputElement;
  results: HTMLElement;
};

const PAGE_ID = "NW_CTEC_RSLT2_FL";

const STYLE_ID = "better-caeser-ctec-index-style";
const PANEL_ID = "better-caeser-ctec-index-panel";

const STORAGE_KEY = "better-caeser:ctec-index:v1";
const LAST_SUBJECT_STORAGE_KEY = "better-caeser:ctec-index:last-subject";
const REQUEST_OWNER = "ctec-navigation";
const MAX_RESULTS = 75;
const MAX_COURSES_PER_SUBJECT = 200;
const MAX_ACTIVITY_LOG_LINES = 250;

const DEFAULT_SUBJECT_CODE = "UNKNOWN";
const DEFAULT_CAREER_CODE = "UGRD";

export class CtecNavigationAugmentation implements Augmentation {
  readonly id = "ctec-navigation";

  private isIndexing = false;
  private indexingProgress = "";
  private currentContext: CtecSubjectContext | null = null;
  private currentRows: CtecRowSeed[] = [];
  private currentIndex: CtecSubjectIndex | null = null;
  private activityLog: string[] = [];

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;

    injectStyles(doc);
    const panel = ensurePanel(doc);
    if (!panel) return;

    const refs = getPanelRefs(panel);
    if (!refs) return;

    this.currentContext = readSubjectContext(doc, window.location.href);
    this.currentRows = collectClassRows(doc);

    this.bindEvents(refs);
    this.seedInputs(refs);
    this.render(refs);
  }

  private appliesToPage(doc: Document): boolean {
    return hasCtecDisclaimer(doc);
  }

  private bindEvents(refs: PanelRefs): void {
    if (refs.root.dataset.bound === "1") return;

    refs.indexButton.addEventListener("click", () => {
      void this.handleIndexClick(refs);
    });

    refs.clearButton.addEventListener("click", () => {
      this.handleClearClick(refs);
    });

    refs.searchInput.addEventListener("input", () => {
      this.renderResults(refs);
    });

    refs.subjectInput.addEventListener("change", () => {
      const subjectCode = this.getActiveSubjectCode(refs);
      if (subjectCode) {
        rememberLastSubject(subjectCode);
      }
      this.render(refs);
    });

    refs.careerSelect.addEventListener("change", () => {
      this.render(refs);
    });

    refs.root.dataset.bound = "1";
  }

  private seedInputs(refs: PanelRefs): void {
    if (refs.root.dataset.seeded === "1") return;

    const contextSubject =
      this.currentContext?.code && this.currentContext.code !== DEFAULT_SUBJECT_CODE
        ? this.currentContext.code
        : null;
    const rememberedSubject = readLastSubject();
    const subjectValue = contextSubject ?? rememberedSubject ?? "";
    refs.subjectInput.value = subjectValue;

    const contextCareer = readCareerFromUrl(window.location.href) ?? DEFAULT_CAREER_CODE;
    refs.careerSelect.value = contextCareer;

    refs.root.dataset.seeded = "1";
  }

  private getActiveSubjectCode(refs: PanelRefs): string | null {
    return normalizeSubjectCode(refs.subjectInput.value);
  }

  private getActiveCareerCode(refs: PanelRefs): string {
    return normalizeCareerCode(refs.careerSelect.value);
  }

  private async handleIndexClick(refs: PanelRefs): Promise<void> {
    if (this.isIndexing) return;

    const subjectCode = this.getActiveSubjectCode(refs);
    if (!subjectCode) {
      this.indexingProgress = "Enter a subject code (example: COMP_SCI).";
      this.refresh();
      return;
    }

    const careerCode = this.getActiveCareerCode(refs);

    this.activityLog = [];
    this.isIndexing = true;
    this.indexingProgress = `Preparing index for ${subjectCode}...`;
    this.logActivity("index_start", { subjectCode, careerCode });
    this.refresh();

    try {
      rememberLastSubject(subjectCode);

      let subjectContext: CtecSubjectContext = { code: subjectCode, label: subjectCode };
      let entries: CtecIndexedEntry[] = [];

      const canUseVisibleRows =
        this.currentRows.length > 0 && this.currentContext?.code === subjectCode;

      if (canUseVisibleRows) {
        const form = document.forms.namedItem("win0");
        if (!(form instanceof HTMLFormElement)) {
          throw new Error("Could not find the CAESAR form for visible-row indexing.");
        }

        subjectContext = this.currentContext ?? { code: subjectCode, label: subjectCode };
        const actionUrl = resolveActionUrl(form.action);
        const baseParams = serializeForm(form);
        this.logActivity("using_visible_rows", {
          subjectCode: subjectContext.code,
          subjectLabel: subjectContext.label,
          rowCount: this.currentRows.length
        });
        entries = await this.indexRows(this.currentRows, actionUrl, baseParams);
      } else {
        this.logActivity("using_remote_subject_page", { subjectCode, careerCode });
        const remoteData = await this.fetchAndIndexRemoteSubject(subjectCode, careerCode);
        subjectContext = remoteData.context;
        entries = remoteData.entries;
      }

      if (entries.length === 0) {
        throw new Error(`No CTEC rows found for ${subjectCode}.`);
      }

      const dedupedEntries = dedupeEntries(entries);
      this.indexingProgress = `Indexed ${dedupedEntries.length} rows for ${subjectCode}.`;
      this.refresh();

      const nextIndex: CtecSubjectIndex = {
        subjectCode,
        subjectLabel: subjectContext.label,
        builtAt: Date.now(),
        sourceUrl: window.location.href,
        entries: dedupedEntries
      };

      writeSubjectIndex(subjectCode, nextIndex);

      this.currentIndex = nextIndex;
      this.logActivity("index_complete", {
        subjectCode,
        indexedRows: dedupedEntries.length,
        failedRows: dedupedEntries.filter((entry) => !entry.blueraUrl).length
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      this.indexingProgress = `Index failed: ${message}`;
      this.logActivity("index_failed", { subjectCode, error: message });
    } finally {
      this.isIndexing = false;
      this.refresh();
    }
  }

  private async indexRows(
    rows: CtecRowSeed[],
    actionUrl: string,
    baseParams: URLSearchParams,
    progressPrefix = ""
  ): Promise<CtecIndexedEntry[]> {
    const total = rows.length;
    if (total === 0) return [];

    let completed = 0;
    this.indexingProgress = `${progressPrefix}Indexing 0/${total}...`;
    this.refresh();

    const tasks = rows.map(async (row) => {
      let blueraUrl: string | null = null;
      let error: string | null = null;
      this.logActivity("class_request_start", row);

      try {
        const params = buildActionParams(baseParams, row.actionId);
        const responseText = await fetchPeopleSoft(actionUrl, params, { owner: REQUEST_OWNER });
        blueraUrl = extractBlueraUrl(responseText);
        if (!blueraUrl) {
          error = "No Bluera URL returned for this row.";
        }
      } catch (reason) {
        error = reason instanceof Error ? reason.message : String(reason);
      }

      completed += 1;
      this.indexingProgress = `${progressPrefix}Indexed ${completed}/${total}: ${row.description}`;
      this.logActivity("class_request_done", {
        actionId: row.actionId,
        term: row.term,
        description: row.description,
        instructor: row.instructor,
        blueraUrl,
        error
      });
      this.refresh();

      return {
        actionId: row.actionId,
        term: row.term,
        description: row.description,
        instructor: row.instructor,
        blueraUrl,
        error,
        searchText: normalizeSearch([row.term, row.description, row.instructor].join(" "))
      };
    });

    return Promise.all(tasks);
  }

  private async fetchAndIndexRemoteSubject(subjectCode: string, careerCode: string): Promise<{
    context: CtecSubjectContext;
    entries: CtecIndexedEntry[];
  }> {
    const resultsUrl = buildSubjectResultsUrl(subjectCode, careerCode);
    this.indexingProgress = `Loading ${subjectCode} results page...`;
    this.logActivity("subject_results_request_start", { resultsUrl });
    this.refresh();

    const html = await fetchPeopleSoftGet(resultsUrl, { owner: REQUEST_OWNER });
    this.logActivity("subject_results_request_done", { htmlLength: html.length });
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const form = doc.forms.namedItem("win0");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Could not parse CTEC results form for indexing.");
    }

    const parsedContext = readSubjectContext(doc, resultsUrl);
    const context: CtecSubjectContext = {
      code: subjectCode,
      label: parsedContext.label || subjectCode
    };
    this.logActivity("subject_context", context);
    const actionUrl = resolveActionUrl(form.action);
    const baseParams = serializeForm(form);

    const directRows = collectClassRows(doc);
    if (directRows.length > 0) {
      this.logActivity("direct_class_rows_found", {
        count: directRows.length,
        sample: directRows.slice(0, 5)
      });
      const entries = await this.indexRows(directRows, actionUrl, baseParams);
      return { context, entries };
    }

    const courseRows = collectCourseRows(doc).slice(0, MAX_COURSES_PER_SUBJECT);
    this.logActivity("course_rows_found", {
      count: courseRows.length,
      sample: courseRows.slice(0, 5)
    });
    if (courseRows.length === 0) {
      return { context, entries: [] };
    }

    const entries: CtecIndexedEntry[] = [];
    const totalCourses = courseRows.length;

    for (let index = 0; index < totalCourses; index += 1) {
      const course = courseRows[index];
      this.indexingProgress = `Loading course ${index + 1}/${totalCourses}: ${course.description}`;
      this.logActivity("course_request_start", {
        index: index + 1,
        total: totalCourses,
        actionId: course.actionId,
        description: course.description
      });
      this.refresh();

      const courseRequest = buildActionParams(baseParams, course.actionId);
      const courseResponse = await fetchPeopleSoft(actionUrl, courseRequest, { owner: REQUEST_OWNER });
      const classRows = collectClassRowsFromText(courseResponse);
      this.logActivity("course_request_done", {
        index: index + 1,
        total: totalCourses,
        actionId: course.actionId,
        description: course.description,
        classRows: classRows.length,
        sample: classRows.slice(0, 5)
      });
      if (classRows.length === 0) {
        continue;
      }

      const classParams = applyResponseState(baseParams, courseResponse);
      const classActionUrl = extractPostUrl(courseResponse) ?? actionUrl;
      const prefix = `Course ${index + 1}/${totalCourses} - `;
      const courseEntries = await this.indexRows(classRows, classActionUrl, classParams, prefix);
      entries.push(...courseEntries);
    }

    return {
      context,
      entries
    };
  }

  private handleClearClick(refs: PanelRefs): void {
    const subjectCode = this.getActiveSubjectCode(refs);
    if (!subjectCode) return;

    clearSubjectIndex(subjectCode);
    this.currentIndex = null;
    this.indexingProgress = `Cleared local cache for ${subjectCode}.`;
    this.logActivity("cache_cleared", { subjectCode });
    this.refresh();
  }

  private refresh(): void {
    const panel = document.getElementById(PANEL_ID);
    if (!(panel instanceof HTMLElement)) return;

    const refs = getPanelRefs(panel);
    if (!refs) return;

    this.render(refs);
  }

  private render(refs: PanelRefs): void {
    const subjectCode = this.getActiveSubjectCode(refs);
    this.currentIndex = subjectCode ? readSubjectIndex(subjectCode) : null;

    const subjectLabel =
      (this.currentIndex && `${this.currentIndex.subjectCode} - ${this.currentIndex.subjectLabel}`) ||
      (subjectCode ? `${subjectCode}` : "No subject selected");
    refs.title.textContent = `Better CAESER CTEC Index (${subjectLabel})`;

    const rowCount = this.currentRows.length;
    const hasVisibleRowsForActiveSubject =
      rowCount > 0 && subjectCode !== null && this.currentContext?.code === subjectCode;
    refs.indexButton.textContent = hasVisibleRowsForActiveSubject
      ? `Index ${rowCount} visible classes`
      : "Index subject now";
    refs.indexButton.disabled = this.isIndexing || !subjectCode;
    refs.clearButton.disabled = this.isIndexing || !this.currentIndex;

    if (this.currentIndex) {
      const builtAtText = new Date(this.currentIndex.builtAt).toLocaleString();
      refs.meta.textContent = `Cached rows: ${this.currentIndex.entries.length} (built ${builtAtText})`;
    } else {
      refs.meta.textContent = subjectCode
        ? `No local cache for ${subjectCode} yet.`
        : "Enter a subject code to build local cache.";
    }

    refs.searchInput.disabled = !this.currentIndex;
    refs.searchInput.placeholder = this.currentIndex
      ? "Search by course, instructor, term..."
      : "Index this subject first";

    if (this.isIndexing) {
      refs.status.textContent = this.indexingProgress;
    } else {
      refs.status.textContent = this.indexingProgress || "Ready.";
    }

    this.renderTrace(refs.trace);

    this.renderResults(refs);
  }

  private logActivity(event: string, data?: unknown): void {
    const stamp = new Date().toLocaleTimeString();
    const payload = formatActivityData(data);
    const line = payload ? `[${stamp}] ${event} ${payload}` : `[${stamp}] ${event}`;
    this.activityLog.push(line);

    if (this.activityLog.length > MAX_ACTIVITY_LOG_LINES) {
      this.activityLog.splice(0, this.activityLog.length - MAX_ACTIVITY_LOG_LINES);
    }

    this.refreshTrace();
  }

  private refreshTrace(): void {
    const panel = document.getElementById(PANEL_ID);
    if (!(panel instanceof HTMLElement)) return;
    const trace = panel.querySelector<HTMLElement>("[data-part='trace']");
    if (!trace) return;

    this.renderTrace(trace);
  }

  private renderTrace(trace: HTMLElement): void {
    const traceText =
      this.activityLog.length > 0
        ? this.activityLog.join("\n")
        : "Processing trace will appear here while indexing.";
    const traceIsNearBottom = trace.scrollTop + trace.clientHeight >= trace.scrollHeight - 24;
    trace.textContent = traceText;
    if (this.isIndexing || traceIsNearBottom) {
      trace.scrollTop = trace.scrollHeight;
    }
  }

  private renderResults(refs: PanelRefs): void {
    refs.results.textContent = "";

    if (!this.currentIndex) {
      refs.results.textContent = "No cached results to search yet.";
      return;
    }

    const query = normalizeSearch(refs.searchInput.value);
    const tokens = query.length > 0 ? query.split(/\s+/).filter(Boolean) : [];

    const matches = this.currentIndex.entries.filter((entry) =>
      tokens.every((token) => entry.searchText.includes(token))
    );

    if (matches.length === 0) {
      refs.results.textContent = "No matches.";
      return;
    }

    const visible = matches.slice(0, MAX_RESULTS);
    const fragment = document.createDocumentFragment();

    for (const entry of visible) {
      fragment.appendChild(buildResultCard(entry));
    }

    refs.results.appendChild(fragment);

    if (matches.length > MAX_RESULTS) {
      const overflow = document.createElement("div");
      overflow.className = "better-caeser-ctec-overflow";
      overflow.textContent = `Showing first ${MAX_RESULTS} of ${matches.length} matches.`;
      refs.results.appendChild(overflow);
    }
  }
}

function getPageId(doc: Document): string | null {
  const pageInfo =
    doc.querySelector<HTMLElement>("#pt_pageinfo_win0") ?? doc.querySelector<HTMLElement>("#pt_pageinfo");
  return pageInfo?.getAttribute("Page") ?? null;
}

function hasCtecDisclaimer(doc: Document): boolean {
  return (
    doc.querySelector<HTMLElement>(".ctec-disclaimer") !== null ||
    doc.querySelector<HTMLElement>("[class*='ctec-disclaimer']") !== null
  );
}

function ensurePanel(doc: Document): HTMLElement | null {
  const existing = doc.getElementById(PANEL_ID);
  if (existing instanceof HTMLElement) return existing;

  const disclaimer =
    doc.querySelector<HTMLElement>("#win0divNW_CTEC_WRK_HTMLAREA1") ??
    doc.querySelector<HTMLElement>("#NW_CTEC_WRK_HTMLAREA1") ??
    doc.querySelector<HTMLElement>(".ctec-disclaimer") ??
    doc.querySelector<HTMLElement>("[class*='ctec-disclaimer']");
  const anchor = disclaimer;
  if (!anchor) return null;

  const root = doc.createElement("section");
  root.id = PANEL_ID;
  root.className = "better-caeser-ctec-panel";

  const title = doc.createElement("h2");
  title.className = "better-caeser-ctec-title";
  title.dataset.part = "title";

  const meta = doc.createElement("div");
  meta.className = "better-caeser-ctec-meta";
  meta.dataset.part = "meta";

  const controls = doc.createElement("div");
  controls.className = "better-caeser-ctec-controls";

  const subjectInput = doc.createElement("input");
  subjectInput.type = "text";
  subjectInput.className = "better-caeser-ctec-control-input";
  subjectInput.placeholder = "Subject code (e.g., COMP_SCI)";
  subjectInput.dataset.part = "subject";

  const careerSelect = doc.createElement("select");
  careerSelect.className = "better-caeser-ctec-control-select";
  careerSelect.dataset.part = "career";

  for (const value of ["UGRD", "TGS"]) {
    const option = doc.createElement("option");
    option.value = value;
    option.textContent = value;
    careerSelect.appendChild(option);
  }

  controls.appendChild(subjectInput);
  controls.appendChild(careerSelect);

  const actions = doc.createElement("div");
  actions.className = "better-caeser-ctec-actions";

  const indexButton = doc.createElement("button");
  indexButton.type = "button";
  indexButton.className = "better-caeser-ctec-btn better-caeser-ctec-btn-primary";
  indexButton.dataset.part = "index";

  const clearButton = doc.createElement("button");
  clearButton.type = "button";
  clearButton.className = "better-caeser-ctec-btn";
  clearButton.dataset.part = "clear";
  clearButton.textContent = "Clear this subject cache";

  actions.appendChild(indexButton);
  actions.appendChild(clearButton);

  const status = doc.createElement("div");
  status.className = "better-caeser-ctec-status";
  status.dataset.part = "status";

  const trace = doc.createElement("pre");
  trace.className = "better-caeser-ctec-trace";
  trace.dataset.part = "trace";

  const searchInput = doc.createElement("input");
  searchInput.type = "search";
  searchInput.className = "better-caeser-ctec-search";
  searchInput.dataset.part = "search";

  const results = doc.createElement("div");
  results.className = "better-caeser-ctec-results";
  results.dataset.part = "results";

  root.appendChild(title);
  root.appendChild(meta);
  root.appendChild(controls);
  root.appendChild(actions);
  root.appendChild(status);
  root.appendChild(trace);
  root.appendChild(searchInput);
  root.appendChild(results);

  anchor.insertAdjacentElement("afterend", root);
  return root;
}

function getPanelRefs(root: HTMLElement): PanelRefs | null {
  const title = root.querySelector<HTMLElement>("[data-part='title']");
  const meta = root.querySelector<HTMLElement>("[data-part='meta']");
  const status = root.querySelector<HTMLElement>("[data-part='status']");
  const trace = root.querySelector<HTMLElement>("[data-part='trace']");
  const subjectInput = root.querySelector<HTMLInputElement>("[data-part='subject']");
  const careerSelect = root.querySelector<HTMLSelectElement>("[data-part='career']");
  const indexButton = root.querySelector<HTMLButtonElement>("[data-part='index']");
  const clearButton = root.querySelector<HTMLButtonElement>("[data-part='clear']");
  const searchInput = root.querySelector<HTMLInputElement>("[data-part='search']");
  const results = root.querySelector<HTMLElement>("[data-part='results']");

  if (
    !title ||
    !meta ||
    !status ||
    !trace ||
    !subjectInput ||
    !careerSelect ||
    !indexButton ||
    !clearButton ||
    !searchInput ||
    !results
  ) {
    return null;
  }

  return {
    root,
    title,
    meta,
    status,
    trace,
    subjectInput,
    careerSelect,
    indexButton,
    clearButton,
    searchInput,
    results
  };
}

function collectClassRows(doc: Document): CtecRowSeed[] {
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

    seeds.push({
      actionId,
      term,
      description,
      instructor
    });
  }

  return seeds;
}

function collectClassRowsFromText(responseText: string): CtecRowSeed[] {
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

function collectCourseRows(doc: Document): CtecCourseSeed[] {
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

function extractActionId(link: HTMLAnchorElement): string | null {
  if (link.id.startsWith("MYLINK1$")) return link.id.trim();

  const href = link.getAttribute("href") ?? "";
  const match = href.match(/submitAction_win0\(document\.win0,'([^']+)'\)/i)?.[1] ?? null;
  return match?.trim() ?? null;
}

function readSubjectContext(doc: Document, sourceUrl: string): CtecSubjectContext {
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

function readSubjectCodeFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, window.location.origin);
    const subject = url.searchParams.get("SUBJECT");
    return normalizeSubjectCode(subject);
  } catch {
    return null;
  }
}

function normalizeSubjectCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return normalized;
}

function normalizeCareerCode(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "TGS") return "TGS";
  return DEFAULT_CAREER_CODE;
}

function readCareerFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl, window.location.origin);
    const career = url.searchParams.get("ACAD_CAREER");
    if (!career) return null;
    return normalizeCareerCode(career);
  } catch {
    return null;
  }
}

function buildSubjectResultsUrl(subjectCode: string, careerCode: string): string {
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

function readLastSubject(): string | null {
  try {
    const value = window.localStorage.getItem(LAST_SUBJECT_STORAGE_KEY);
    return normalizeSubjectCode(value);
  } catch {
    return null;
  }
}

function rememberLastSubject(subjectCode: string): void {
  try {
    window.localStorage.setItem(LAST_SUBJECT_STORAGE_KEY, subjectCode);
  } catch {
    // Ignore storage errors.
  }
}

function buildActionParams(baseParams: URLSearchParams, actionId: string): URLSearchParams {
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

function applyResponseState(baseParams: URLSearchParams, responseText: string): URLSearchParams {
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

function extractPostUrl(responseText: string): string | null {
  const postUrl = responseText.match(/postUrl_win0\s*=\s*'([^']+)'/i)?.[1] ?? null;
  if (!postUrl) return null;
  return resolveActionUrl(postUrl);
}

function extractActionIds(responseText: string, prefix: "MYLINK" | "MYLINK1"): string[] {
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

function extractFieldValue(responseText: string, id: string): string {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`id=['"]${escapedId}\\s*['"][\\s\\S]*?>\\s*([^<]+?)\\s*<`, "i");
  const value = pattern.exec(responseText)?.[1] ?? "";
  return cleanText(value);
}

function extractBlueraUrl(responseText: string): string | null {
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

  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return trimmed;
  }
}

function resolveActionUrl(action: string): string {
  try {
    return new URL(action || window.location.href, window.location.origin).toString();
  } catch {
    return window.location.href;
  }
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

function readStore(): CtecIndexStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: 1, subjects: {} };
    }

    const parsed = JSON.parse(raw) as Partial<CtecIndexStore>;
    if (parsed.version !== 1 || !parsed.subjects || typeof parsed.subjects !== "object") {
      return { version: 1, subjects: {} };
    }

    return {
      version: 1,
      subjects: parsed.subjects as Record<string, CtecSubjectIndex>
    };
  } catch {
    return { version: 1, subjects: {} };
  }
}

function writeStore(store: CtecIndexStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors.
  }
}

function readSubjectIndex(subjectCode: string): CtecSubjectIndex | null {
  const store = readStore();
  const index = store.subjects[subjectCode];
  return index ?? null;
}

function writeSubjectIndex(subjectCode: string, index: CtecSubjectIndex): void {
  const store = readStore();
  store.subjects[subjectCode] = index;
  writeStore(store);
}

function clearSubjectIndex(subjectCode: string): void {
  const store = readStore();
  delete store.subjects[subjectCode];
  writeStore(store);
}

function dedupeEntries(entries: CtecIndexedEntry[]): CtecIndexedEntry[] {
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

function buildResultCard(entry: CtecIndexedEntry): HTMLElement {
  const card = document.createElement("article");
  card.className = "better-caeser-ctec-result";

  const heading = document.createElement("div");
  heading.className = "better-caeser-ctec-result-heading";
  heading.textContent = entry.description || "Untitled course";

  const meta = document.createElement("div");
  meta.className = "better-caeser-ctec-result-meta";
  const pieces = [entry.term, entry.instructor].filter(Boolean);
  meta.textContent = pieces.length > 0 ? pieces.join(" | ") : "No metadata";

  const footer = document.createElement("div");
  footer.className = "better-caeser-ctec-result-footer";

  if (entry.blueraUrl) {
    const link = document.createElement("a");
    link.className = "better-caeser-ctec-link";
    link.href = entry.blueraUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open Bluera evaluation";
    footer.appendChild(link);
  } else {
    const error = document.createElement("span");
    error.className = "better-caeser-ctec-error";
    error.textContent = entry.error ?? "Bluera URL unavailable.";
    footer.appendChild(error);
  }

  card.appendChild(heading);
  card.appendChild(meta);
  card.appendChild(footer);
  return card;
}

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function formatActivityData(data: unknown): string {
  if (typeof data === "undefined") return "";

  try {
    const json = JSON.stringify(data, (_key, value) => {
      if (typeof value === "string" && value.length > 220) {
        return `${value.slice(0, 217)}...`;
      }
      return value;
    });
    if (!json) return "";
    return json.length > 700 ? `${json.slice(0, 697)}...` : json;
  } catch {
    const value = String(data);
    return value.length > 700 ? `${value.slice(0, 697)}...` : value;
  }
}

function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --bc-tyrian: #66023c;
      --bc-tyrian-soft: #f6ecf2;
      --bc-tyrian-mid: #d8b6c8;
      --bc-tyrian-ink: #3f0126;
    }
    .better-caeser-ctec-panel {
      margin: 10px 0 14px;
      padding: 12px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 8px;
      background: var(--bc-tyrian-soft);
      display: grid;
      gap: 8px;
    }
    .better-caeser-ctec-title {
      margin: 0;
      font-size: 15px;
      line-height: 1.2;
      color: var(--bc-tyrian);
    }
    .better-caeser-ctec-meta,
    .better-caeser-ctec-status {
      font-size: 12px;
      color: var(--bc-tyrian-ink);
    }
    .better-caeser-ctec-trace {
      margin: 0;
      padding: 8px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      background: #fff;
      color: var(--bc-tyrian-ink);
      font-size: 11px;
      line-height: 1.35;
      max-height: 180px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .better-caeser-ctec-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .better-caeser-ctec-control-input,
    .better-caeser-ctec-control-select {
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      font-size: 12px;
      color: var(--bc-tyrian-ink);
      padding: 6px 8px;
      background: #fff;
    }
    .better-caeser-ctec-control-input {
      min-width: 220px;
      flex: 1 1 240px;
    }
    .better-caeser-ctec-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .better-caeser-ctec-btn {
      border: 1px solid var(--bc-tyrian-mid);
      background: #fff;
      color: var(--bc-tyrian);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .better-caeser-ctec-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .better-caeser-ctec-btn-primary {
      border-color: var(--bc-tyrian);
      background: var(--bc-tyrian);
      color: #fff;
    }
    .better-caeser-ctec-search {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      font-size: 13px;
      box-sizing: border-box;
    }
    .better-caeser-ctec-results {
      display: grid;
      gap: 8px;
      max-height: 360px;
      overflow: auto;
      padding-right: 2px;
      font-size: 12px;
      color: var(--bc-tyrian-ink);
    }
    .better-caeser-ctec-result {
      padding: 8px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      background: #fff;
      display: grid;
      gap: 4px;
    }
    .better-caeser-ctec-result-heading {
      font-weight: 600;
      color: var(--bc-tyrian);
    }
    .better-caeser-ctec-result-meta {
      color: var(--bc-tyrian-ink);
    }
    .better-caeser-ctec-link {
      color: var(--bc-tyrian);
      text-decoration: underline;
      font-weight: 600;
    }
    .better-caeser-ctec-error {
      color: #7a123f;
    }
    .better-caeser-ctec-overflow {
      color: var(--bc-tyrian-ink);
    }
  `;

  const host = doc.head ?? doc.documentElement ?? doc.body;
  if (!host) return;
  host.appendChild(style);
}
