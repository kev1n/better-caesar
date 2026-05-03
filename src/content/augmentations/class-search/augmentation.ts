import type { Augmentation } from "../../framework";
import { isRetryablePeopleSoftTaskError, lookupClass } from "../../peoplesoft";
import {
  initStorage as initSeatsNotesStorage,
  pruneEmptySeatsCache,
  readCachedEntry as readSeatsNotesCache,
  writeCachedEntry as writeSeatsNotesCache
} from "../seats-notes/storage";
import { toSeatsNotesResult, toFailure as seatsNotesFailure } from "../seats-notes/parser";
import { showToast } from "../seats-notes/toast";
import type { SeatsNotesResult, SeatsNotesSuccess } from "../seats-notes/types";

import {
  addSectionToCart,
  matchCaesarGroup,
  matchCaesarSection,
  searchCaesarCatalog,
  type CaesarCourseGroup,
  type CaesarSection,
  type CaesarSearchResult
} from "./caesar-search";
import {
  bareCatalogNumber,
  formatCourseIdForDisplay
} from "./catalog-format";
import {
  applyFilters,
  buildCatalogIndex,
  formatInstructors,
  formatMeetingPattern,
  formatRoom,
  meetingPatternCount
} from "./filter";
import {
  getDataMapInfo,
  getPlanCourses,
  getSubjects,
  getTermCourses,
  listTerms,
  pruneStalePaperCaches,
  type DataMapInfo,
  type PaperCourse,
  type PaperSection,
  type PaperTermCourse,
  type SubjectInfo,
  type TermSummary
} from "./paper-data";
import { ensureStyles } from "./styles";
import {
  PAPER_DISCIPLINE_LABELS,
  PAPER_DISTRO_LABELS,
  type ResultRow,
  type SearchFilters
} from "./types";

const ROOT_ID = "better-caesar-class-search-root";
const TABS_ID = "better-caesar-class-search-tabs";
const HIDE_NATIVE_STYLE_ID = "better-caesar-class-search-hide-native";
const SEARCH_PAGE_ID = "SSR_CLSRCH_ENTRY";
const RESULTS_PAGE_ID = "SSR_CLSRCH_RSLT";
const CART_PAGE_ID = "SSR_SSENRL_CART";
const SEARCH_COMPONENT = "CLASS_SEARCH";

const TAB_STORAGE_KEY = "better-caesar:class-search:active-tab";
type TabId = "better" | "classic";

const INSTITUTION_DEFAULT = "NWUNV";

type CourseLiveCache = {
  status: "loading" | "ready" | "error";
  result?: CaesarSearchResult;
  error?: string;
};

type MountedState = {
  doc: Document;
  root: HTMLDivElement;
  panelEl: HTMLDivElement;
  resultsEl: HTMLDivElement;
  statusEl: HTMLDivElement;
  filters: SearchFilters;
  info: DataMapInfo;
  subjects: Record<string, SubjectInfo>;
  catalogIndex: Map<string, PaperCourse>;
  career: string;
  institution: string;
  loadedTerms: Map<string, PaperTermCourse[]>;
  termFetchTokens: Map<string, number>;
  renderToken: number;
  searchDebounce: number | null;
  // Per-course CAESAR live data, keyed by `${termId}|${subject}|${bareCatalog}`.
  // Multiple paper.nu courses sharing a bare number (e.g. "111-0" + "111-SG")
  // come from the same CAESAR search response.
  liveCache: Map<string, CourseLiveCache>;
  // Per-section detail row state (seats/notes via lookupClass).
  detailCache: Map<string, { state: "loading" | "ready" | "error"; result?: SeatsNotesResult; error?: string }>;
  // In-flight cart-add prefetch jobs, keyed on classNumber. Dedupes the
  // background lookupClass call that fires after a successful add.
  detailPrefetch: Map<string, Promise<void>>;
  activeTab: TabId;
};

export class ClassSearchAugmentation implements Augmentation {
  readonly id = "class-search";

  private mounted: MountedState | null = null;
  private mountInProgress = false;

  constructor() {
    void initSeatsNotesStorage().then(() => pruneEmptySeatsCache());
    void pruneStalePaperCaches();
  }

  run(doc: Document = document): void {
    if (!isSearchEntryPage(doc)) {
      this.unmount(doc);
      return;
    }

    if (this.mounted && this.mounted.doc === doc && doc.getElementById(ROOT_ID) && doc.getElementById(TABS_ID)) {
      // Re-apply visibility in case PeopleSoft swapped DOM under us.
      applyTabVisibility(this.mounted);
      return;
    }

    if (this.mountInProgress) return;
    void this.mount(doc);
  }

  private async mount(doc: Document): Promise<void> {
    this.mountInProgress = true;
    try {
      ensureStyles(doc);

      const placeholder = ensureRoot(doc);
      placeholder.innerHTML = "";
      placeholder.appendChild(buildLoadingShell(doc));

      let info: DataMapInfo;
      let subjects: Record<string, SubjectInfo>;
      let planCourses: PaperCourse[];
      try {
        [info, subjects, planCourses] = await Promise.all([
          getDataMapInfo(),
          getSubjects(),
          getPlanCourses()
        ]);
      } catch (error) {
        if (doc.getElementById(ROOT_ID)) {
          renderFatalError(
            placeholder,
            doc,
            error instanceof Error ? error.message : String(error)
          );
        }
        return;
      }

      if (!doc.getElementById(ROOT_ID) || !isSearchEntryPage(doc)) {
        return;
      }

      const career = readCareerFromNativeForm(doc) ?? "UGRD";
      const institution = readInstitutionFromNativeForm(doc) ?? INSTITUTION_DEFAULT;
      const initialTerm = readTermFromNativeForm(doc) ?? info.latest;

      const state: MountedState = {
        doc,
        root: placeholder,
        panelEl: doc.createElement("div"),
        resultsEl: doc.createElement("div"),
        statusEl: doc.createElement("div"),
        filters: {
          termId: initialTerm,
          query: "",
          distros: new Set(),
          disciplines: new Set(),
          schools: new Set(),
          components: new Set()
        },
        info,
        subjects,
        catalogIndex: buildCatalogIndex(planCourses),
        career,
        institution,
        loadedTerms: new Map(),
        termFetchTokens: new Map(),
        renderToken: 0,
        searchDebounce: null,
        liveCache: new Map(),
        detailCache: new Map(),
        detailPrefetch: new Map(),
        activeTab: readActiveTab()
      };
      this.mounted = state;

      placeholder.innerHTML = "";
      placeholder.appendChild(this.buildTabs(state));
      state.panelEl.id = "better-caesar-class-search-panel";
      state.panelEl.appendChild(this.buildShell(state));
      placeholder.appendChild(state.panelEl);

      applyTabVisibility(state);

      void this.loadTermAndSearch(state);
    } finally {
      this.mountInProgress = false;
    }
  }

  private unmount(doc: Document): void {
    const root = doc.getElementById(ROOT_ID);
    if (root) root.remove();
    const hider = doc.getElementById(HIDE_NATIVE_STYLE_ID);
    if (hider) hider.remove();
    this.mounted = null;
  }

  // ── Tab bar ───────────────────────────────────────────────────────────────

  private buildTabs(state: MountedState): HTMLElement {
    const { doc } = state;
    const wrap = doc.createElement("div");
    wrap.id = TABS_ID;
    wrap.className = "bc-cs-tabs";

    const better = this.buildTabButton(state, "better", "Better Search");
    const classic = this.buildTabButton(state, "classic", "Classic CAESAR");
    wrap.append(better, classic);
    return wrap;
  }

  private buildTabButton(state: MountedState, id: TabId, label: string): HTMLButtonElement {
    const { doc } = state;
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "bc-cs-tab";
    btn.dataset.tab = id;
    btn.textContent = label;
    btn.dataset.active = state.activeTab === id ? "true" : "false";
    btn.addEventListener("click", () => {
      if (state.activeTab === id) return;
      state.activeTab = id;
      writeActiveTab(id);
      const tabsEl = doc.getElementById(TABS_ID);
      tabsEl?.querySelectorAll<HTMLButtonElement>("button.bc-cs-tab").forEach((el) => {
        el.dataset.active = el.dataset.tab === id ? "true" : "false";
      });
      applyTabVisibility(state);
    });
    return btn;
  }

  // ── Shell ─────────────────────────────────────────────────────────────────

  private buildShell(state: MountedState): HTMLElement {
    const { doc } = state;

    const root = doc.createElement("div");
    root.className = "bc-cs-shell";

    const header = doc.createElement("div");
    header.className = "bc-cs-header";
    const title = doc.createElement("h1");
    title.className = "bc-cs-title";
    title.textContent = "Search for Classes";
    const subtitle = doc.createElement("div");
    subtitle.className = "bc-cs-subtitle";
    subtitle.innerHTML = `Catalog from <a href="https://paper.nu" target="_blank" rel="noopener">paper.nu</a> · live status fetched from CAESAR on demand`;
    header.append(title, subtitle);

    const card = doc.createElement("div");
    card.className = "bc-cs-card";

    const form = doc.createElement("div");
    form.className = "bc-cs-form";
    form.append(this.buildQueryField(state), this.buildTermField(state));

    const toggles = doc.createElement("div");
    toggles.className = "bc-cs-toggles";
    for (const code of Object.keys(PAPER_DISTRO_LABELS)) {
      toggles.appendChild(this.buildDistroToggle(state, code));
    }
    for (const code of Object.keys(PAPER_DISCIPLINE_LABELS)) {
      toggles.appendChild(this.buildDisciplineToggle(state, code));
    }
    const clear = doc.createElement("button");
    clear.type = "button";
    clear.className = "bc-cs-clear";
    clear.textContent = "Clear filters";
    clear.addEventListener("click", () => this.clearFilters(state));
    toggles.appendChild(clear);

    state.statusEl.className = "bc-cs-status";
    state.statusEl.textContent = "";

    state.resultsEl.className = "bc-cs-results";

    card.append(form, toggles, state.statusEl);

    root.append(header, card, state.resultsEl);
    return root;
  }

  // ── Form fields ───────────────────────────────────────────────────────────

  private buildQueryField(state: MountedState): HTMLDivElement {
    const { doc } = state;
    const field = doc.createElement("div");
    field.className = "bc-cs-field bc-cs-field-query";
    const label = doc.createElement("label");
    label.htmlFor = "bc-cs-query";
    label.textContent = "Search";
    const input = doc.createElement("input");
    input.id = "bc-cs-query";
    input.className = "bc-cs-input bc-cs-input-query";
    input.placeholder = "comp_sci 111, machine learning, stat 21x, …";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      state.filters.query = input.value;
      this.scheduleSearch(state);
    });
    field.append(label, input);
    return field;
  }

  private buildTermField(state: MountedState): HTMLDivElement {
    const { doc } = state;
    const field = doc.createElement("div");
    field.className = "bc-cs-field";
    const label = doc.createElement("label");
    label.htmlFor = "bc-cs-term";
    label.textContent = "Term";
    const select = doc.createElement("select");
    select.id = "bc-cs-term";
    select.className = "bc-cs-select";

    const terms = listTerms(state.info);
    for (const term of terms) {
      const option = doc.createElement("option");
      option.value = term.id;
      option.textContent = formatTermLabel(term);
      if (term.id === state.filters.termId) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      state.filters.termId = select.value;
      void this.loadTermAndSearch(state);
    });

    field.append(label, select);
    return field;
  }

  private buildDistroToggle(state: MountedState, code: string): HTMLLabelElement {
    const { doc } = state;
    const wrap = doc.createElement("label");
    wrap.className = "bc-cs-checkbox";
    const cb = doc.createElement("input");
    cb.type = "checkbox";
    cb.addEventListener("change", () => {
      if (cb.checked) state.filters.distros.add(code);
      else state.filters.distros.delete(code);
      this.scheduleSearch(state);
    });
    const span = doc.createElement("span");
    span.textContent = `Dist ${code}`;
    span.title = PAPER_DISTRO_LABELS[code];
    wrap.append(cb, span);
    return wrap;
  }

  private buildDisciplineToggle(state: MountedState, code: string): HTMLLabelElement {
    const { doc } = state;
    const wrap = doc.createElement("label");
    wrap.className = "bc-cs-checkbox";
    const cb = doc.createElement("input");
    cb.type = "checkbox";
    cb.addEventListener("change", () => {
      if (cb.checked) state.filters.disciplines.add(code);
      else state.filters.disciplines.delete(code);
      this.scheduleSearch(state);
    });
    const span = doc.createElement("span");
    span.textContent = `Disc ${code}`;
    span.title = PAPER_DISCIPLINE_LABELS[code];
    wrap.append(cb, span);
    return wrap;
  }

  private clearFilters(state: MountedState): void {
    state.filters.query = "";
    state.filters.distros = new Set();
    state.filters.disciplines = new Set();
    state.filters.schools = new Set();
    state.filters.components = new Set();
    const queryInput = state.doc.getElementById("bc-cs-query") as HTMLInputElement | null;
    if (queryInput) queryInput.value = "";
    const checkboxes = state.root.querySelectorAll<HTMLInputElement>(".bc-cs-checkbox input");
    checkboxes.forEach((cb) => (cb.checked = false));
    this.scheduleSearch(state);
  }

  // ── Search execution ──────────────────────────────────────────────────────

  private scheduleSearch(state: MountedState): void {
    if (state.searchDebounce !== null) {
      window.clearTimeout(state.searchDebounce);
    }
    state.searchDebounce = window.setTimeout(() => {
      state.searchDebounce = null;
      this.runSearch(state);
    }, 120);
  }

  private async loadTermAndSearch(state: MountedState): Promise<void> {
    const termId = state.filters.termId;
    const cached = state.loadedTerms.get(termId);
    if (cached) {
      this.runSearch(state);
      return;
    }

    const token = (state.termFetchTokens.get(termId) ?? 0) + 1;
    state.termFetchTokens.set(termId, token);
    this.setStatus(state, "loading", `Loading ${state.info.terms[termId]?.name ?? termId} sections…`);
    try {
      const courses = await getTermCourses(termId);
      if (state.termFetchTokens.get(termId) !== token) return;
      state.loadedTerms.set(termId, courses);
      this.setStatus(state, "ok", "");
      this.runSearch(state);
    } catch (error) {
      if (state.termFetchTokens.get(termId) !== token) return;
      const msg = error instanceof Error ? error.message : String(error);
      this.setStatus(state, "error", `Couldn't load term data: ${msg}`);
    }
  }

  private runSearch(state: MountedState): void {
    const courses = state.loadedTerms.get(state.filters.termId);
    if (!courses) return;
    state.renderToken += 1;
    const renderId = state.renderToken;

    const rows = applyFilters(courses, state.catalogIndex, state.subjects, state.filters);

    if (state.renderToken !== renderId) return;
    this.renderResults(state, rows);
  }

  private renderResults(state: MountedState, rows: ResultRow[]): void {
    const { doc } = state;
    state.resultsEl.innerHTML = "";

    if (!hasAnyFilter(state.filters)) {
      const empty = doc.createElement("div");
      empty.className = "bc-cs-empty";
      empty.textContent =
        'Start typing — try "comp_sci 111", "econ 21x", or "machine learning".';
      state.resultsEl.appendChild(empty);
      this.setStatus(
        state,
        "ok",
        `Term loaded · ${(state.loadedTerms.get(state.filters.termId)?.length ?? 0).toLocaleString()} courses available`
      );
      return;
    }

    if (rows.length === 0) {
      const empty = doc.createElement("div");
      empty.className = "bc-cs-empty";
      empty.textContent = "No matches. Try loosening filters or switching terms.";
      state.resultsEl.appendChild(empty);
      this.setStatus(state, "ok", "0 results");
      return;
    }

    let totalSections = 0;
    for (const row of rows) {
      totalSections += row.sections.length;
      state.resultsEl.appendChild(this.buildCourseCard(state, row));
    }
    this.setStatus(
      state,
      "ok",
      `${rows.length} course${rows.length === 1 ? "" : "s"} · ${totalSections} section${totalSections === 1 ? "" : "s"}`
    );
  }

  // ── Course card ──────────────────────────────────────────────────────────

  private buildCourseCard(state: MountedState, row: ResultRow): HTMLElement {
    const { doc } = state;
    const card = doc.createElement("div");
    card.className = "bc-cs-course";

    const head = doc.createElement("div");
    head.className = "bc-cs-course-head";
    const id = doc.createElement("div");
    id.className = "bc-cs-course-id";
    id.textContent = formatCourseIdForDisplay(row.course.subject, row.course.catalog);
    const title = doc.createElement("div");
    title.className = "bc-cs-course-title";
    title.textContent = row.course.title;
    const planEntry = state.catalogIndex.get(`${row.course.subject} ${row.course.catalog}`);
    const units = doc.createElement("div");
    units.className = "bc-cs-course-units";
    if (planEntry?.units) {
      units.textContent = `${planEntry.units} unit${planEntry.units === "1.00" ? "" : "s"}`;
    }
    head.append(id, title, units);

    const tags = doc.createElement("div");
    tags.className = "bc-cs-course-tags";
    if (row.course.school) {
      const t = doc.createElement("span");
      t.className = "bc-cs-tag";
      t.dataset.kind = "school";
      t.textContent = row.course.school;
      tags.appendChild(t);
    }
    if (planEntry?.distros) {
      for (const code of planEntry.distros) {
        const label = PAPER_DISTRO_LABELS[code];
        if (!label) continue;
        const t = doc.createElement("span");
        t.className = "bc-cs-tag";
        t.dataset.kind = "distro";
        t.textContent = `Dist ${code} · ${label}`;
        tags.appendChild(t);
      }
    }
    if (planEntry?.disciplines) {
      for (const code of planEntry.disciplines) {
        const label = PAPER_DISCIPLINE_LABELS[code];
        if (!label) continue;
        const t = doc.createElement("span");
        t.className = "bc-cs-tag";
        t.dataset.kind = "discipline";
        t.textContent = `Disc ${code} · ${label}`;
        tags.appendChild(t);
      }
    }
    const liveBtn = doc.createElement("button");
    liveBtn.type = "button";
    liveBtn.className = "bc-cs-live-btn";
    liveBtn.dataset.role = "load-live";
    liveBtn.textContent = "Load CAESAR data";
    liveBtn.addEventListener("click", () => {
      void this.loadCourseLive(state, row, card);
    });
    tags.appendChild(liveBtn);

    card.appendChild(head);
    card.appendChild(tags);

    if (planEntry?.description) {
      const desc = doc.createElement("div");
      desc.className = "bc-cs-course-desc";
      desc.textContent = planEntry.description;
      desc.addEventListener("click", () => desc.classList.toggle("bc-cs-expanded"));
      card.appendChild(desc);
    }

    const sectionList = doc.createElement("ul");
    sectionList.className = "bc-cs-section-list";
    for (const section of row.sections) {
      sectionList.appendChild(this.buildSectionRow(state, row, section));
    }
    card.appendChild(sectionList);

    // If the live data is already cached for this bare catalog, paint it now.
    const cachedLive = state.liveCache.get(liveCacheKey(state, row));
    if (cachedLive?.status === "ready" && cachedLive.result) {
      this.applyLiveDataToCard(state, row, card, cachedLive.result);
    }

    return card;
  }

  // ── Section row ──────────────────────────────────────────────────────────

  private buildSectionRow(state: MountedState, row: ResultRow, section: PaperSection): HTMLLIElement {
    const { doc } = state;
    const li = doc.createElement("li");
    li.className = "bc-cs-section";
    li.dataset.sectionNumber = section.section;
    li.dataset.component = section.component;

    const idCell = doc.createElement("div");
    idCell.className = "bc-cs-section-id";
    idCell.textContent = section.section;

    const compCell = doc.createElement("div");
    compCell.className = "bc-cs-section-component";
    compCell.textContent = section.component;

    const timeCell = doc.createElement("div");
    timeCell.className = "bc-cs-section-time";
    const patterns = meetingPatternCount(section);
    for (let i = 0; i < patterns; i += 1) {
      const line = doc.createElement("div");
      line.textContent = formatMeetingPattern(section, i);
      timeCell.appendChild(line);
    }
    if (section.start_date && section.end_date) {
      const range = doc.createElement("div");
      range.className = "bc-cs-mute";
      range.textContent = `${section.start_date} – ${section.end_date}`;
      timeCell.appendChild(range);
    }

    const instructorCell = doc.createElement("div");
    instructorCell.className = "bc-cs-section-instructor";
    instructorCell.textContent = formatInstructors(section);

    const roomCell = doc.createElement("div");
    roomCell.className = "bc-cs-section-room";
    const rooms = new Set<string>();
    for (let i = 0; i < patterns; i += 1) {
      const room = formatRoom(section, i);
      if (room) rooms.add(room);
    }
    roomCell.textContent = rooms.size > 0 ? Array.from(rooms).join(" · ") : "";

    const liveCell = doc.createElement("div");
    liveCell.className = "bc-cs-section-live";
    liveCell.dataset.role = "live";
    liveCell.textContent = "";

    const actions = doc.createElement("div");
    actions.className = "bc-cs-section-actions";

    const detailsBtn = doc.createElement("button");
    detailsBtn.type = "button";
    detailsBtn.className = "bc-cs-details-btn";
    detailsBtn.textContent = "Details";
    detailsBtn.addEventListener("click", () => {
      void this.toggleSectionDetails(state, row, section, li, detailsBtn);
    });

    const addBtn = doc.createElement("button");
    addBtn.type = "button";
    addBtn.className = "bc-cs-add";
    addBtn.textContent = "Add to cart";
    addBtn.addEventListener("click", () => {
      void this.handleAdd(state, row, section, addBtn);
    });

    actions.append(detailsBtn, addBtn);

    li.append(idCell, compCell, timeCell, instructorCell, roomCell, liveCell, actions);
    return li;
  }

  // ── Live CAESAR data: per-course search ──────────────────────────────────

  private async loadCourseLive(
    state: MountedState,
    row: ResultRow,
    card: HTMLElement
  ): Promise<void> {
    const key = liveCacheKey(state, row);
    const existing = state.liveCache.get(key);
    if (existing?.status === "loading") return;

    const liveBtn = card.querySelector<HTMLButtonElement>(".bc-cs-live-btn");
    if (liveBtn) {
      liveBtn.disabled = true;
      liveBtn.textContent = "Loading CAESAR…";
      liveBtn.dataset.state = "loading";
    }
    state.liveCache.set(key, { status: "loading" });

    try {
      const result = await searchCaesarCatalog({
        termId: state.filters.termId,
        career: state.career,
        institution: state.institution,
        subject: row.course.subject,
        bareCatalog: bareCatalogNumber(row.course.catalog)
      });
      state.liveCache.set(key, { status: "ready", result });
      if (liveBtn) {
        liveBtn.disabled = false;
        liveBtn.dataset.state = "ready";
        liveBtn.textContent = "Refresh CAESAR data";
      }
      this.applyLiveDataToCard(state, row, card, result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      state.liveCache.set(key, { status: "error", error: msg });
      if (liveBtn) {
        liveBtn.disabled = false;
        liveBtn.dataset.state = "error";
        liveBtn.textContent = "Retry CAESAR";
        liveBtn.title = msg;
      }
      showToast(`Couldn't load CAESAR data: ${msg}`, { tone: "error", durationMs: 5000 });
    }
  }

  private applyLiveDataToCard(
    state: MountedState,
    row: ResultRow,
    card: HTMLElement,
    result: CaesarSearchResult
  ): void {
    void state;
    const matchingGroup = matchCaesarGroup(result.groups, row.course.catalog);
    const sectionLis = card.querySelectorAll<HTMLLIElement>("li.bc-cs-section");

    sectionLis.forEach((li) => {
      const live = li.querySelector<HTMLElement>("[data-role='live']");
      if (!live) return;
      const number = li.dataset.sectionNumber ?? "";
      const component = li.dataset.component ?? "";
      const caesar = matchingGroup ? matchCaesarSection(matchingGroup, number, component) : null;

      live.innerHTML = "";
      if (!caesar) {
        live.textContent = matchingGroup ? "(no CAESAR row)" : "(course not on CAESAR)";
        live.dataset.tone = "muted";
        return;
      }

      const status = state.doc.createElement("span");
      status.className = "bc-cs-status-pill";
      status.dataset.status = caesar.status;
      status.textContent = caesar.status;
      live.appendChild(status);

      const num = state.doc.createElement("span");
      num.className = "bc-cs-class-num";
      num.textContent = `#${caesar.classNumber}`;
      live.appendChild(num);
    });
  }

  // ── Per-section detail (seats / notes / requirements) ────────────────────

  private async toggleSectionDetails(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): Promise<void> {
    const { doc } = state;
    let detailRow = li.nextElementSibling instanceof HTMLLIElement && li.nextElementSibling.classList.contains("bc-cs-detail-row")
      ? (li.nextElementSibling as HTMLLIElement)
      : null;

    if (detailRow) {
      detailRow.remove();
      button.dataset.expanded = "false";
      button.textContent = "Details";
      return;
    }

    const liveKey = liveCacheKey(state, row);
    let live = state.liveCache.get(liveKey);
    if (!live || live.status !== "ready" || !live.result) {
      // Need a class number first — load CAESAR data, then continue.
      const card = li.closest<HTMLElement>(".bc-cs-course");
      if (card) await this.loadCourseLive(state, row, card);
      live = state.liveCache.get(liveKey);
      if (!live || live.status !== "ready" || !live.result) {
        showToast("Could not load CAESAR data for this course.", { tone: "error" });
        return;
      }
    }

    const matchingGroup = matchCaesarGroup(live.result.groups, row.course.catalog);
    const caesar = matchingGroup
      ? matchCaesarSection(matchingGroup, section.section, section.component)
      : null;
    if (!caesar) {
      showToast("No matching CAESAR section found.", { tone: "error" });
      return;
    }

    detailRow = doc.createElement("li");
    detailRow.className = "bc-cs-detail-row";
    li.parentElement?.insertBefore(detailRow, li.nextSibling);

    const detailKey = caesar.classNumber;
    const cachedDisk = readSeatsNotesCache(detailKey);

    if (cachedDisk?.result) {
      state.detailCache.set(detailKey, { state: "ready", result: cachedDisk.result });
      this.renderDetailRow(state, detailRow, caesar, cachedDisk.result, cachedDisk.fetchedAt, () =>
        this.refreshDetailRow(state, detailRow, caesar)
      );
    } else {
      await this.fetchAndRenderDetail(state, detailRow, caesar);
    }

    button.dataset.expanded = "true";
    button.textContent = "Hide";
  }

  private async refreshDetailRow(
    state: MountedState,
    detailRow: HTMLLIElement,
    caesar: CaesarSection
  ): Promise<void> {
    if (!detailRow.isConnected) return;
    await this.fetchAndRenderDetail(state, detailRow, caesar);
  }

  private async fetchAndRenderDetail(
    state: MountedState,
    detailRow: HTMLLIElement,
    caesar: CaesarSection
  ): Promise<void> {
    this.renderDetailLoading(state, detailRow);
    try {
      const lookupResponse = await lookupClass(
        {
          type: "lookup-class",
          classNumber: caesar.classNumber,
          careerHint: state.career === "TGS" ? "TGS" : "UGRD"
        },
        { priority: "background", owner: "class-search-detail" }
      );
      const result = toSeatsNotesResult(lookupResponse);
      const fetchedAt = Date.now();
      state.detailCache.set(caesar.classNumber, { state: "ready", result });
      writeSeatsNotesCache(caesar.classNumber, { result, fetchedAt });
      if (detailRow.isConnected) {
        this.renderDetailRow(state, detailRow, caesar, result, fetchedAt, () =>
          this.refreshDetailRow(state, detailRow, caesar)
        );
      }
    } catch (error) {
      if (isRetryablePeopleSoftTaskError(error)) return;
      const failure = seatsNotesFailure(error);
      state.detailCache.set(caesar.classNumber, { state: "ready", result: failure });
      if (detailRow.isConnected) {
        this.renderDetailRow(state, detailRow, caesar, failure, Date.now(), () =>
          this.refreshDetailRow(state, detailRow, caesar)
        );
      }
    }
  }

  private renderDetailLoading(state: MountedState, detailRow: HTMLLIElement): void {
    const { doc } = state;
    detailRow.innerHTML = "";
    const wrap = doc.createElement("div");
    wrap.className = "bc-cs-detail";
    const spinner = doc.createElement("span");
    spinner.className = "bc-cs-spinner";
    const text = doc.createElement("span");
    text.textContent = "Fetching seats and notes from CAESAR…";
    text.style.color = "var(--bc-text-muted)";
    wrap.append(spinner, text);
    detailRow.appendChild(wrap);
  }

  private renderDetailRow(
    state: MountedState,
    detailRow: HTMLLIElement,
    caesar: CaesarSection,
    result: SeatsNotesResult,
    fetchedAt: number,
    onRefresh: () => void
  ): void {
    const { doc } = state;
    detailRow.innerHTML = "";
    const wrap = doc.createElement("div");
    wrap.className = "bc-cs-detail";

    const header = doc.createElement("div");
    header.className = "bc-cs-detail-header";
    header.innerHTML = `<strong>Class #${caesar.classNumber}</strong> · ${escapeHtml(caesar.daysTime)} · ${escapeHtml(caesar.room)}`;
    wrap.appendChild(header);

    if (!result.ok) {
      const err = doc.createElement("div");
      err.className = "bc-cs-detail-error";
      err.textContent = result.error ?? "Couldn't load CAESAR detail.";
      wrap.appendChild(err);
      wrap.appendChild(buildDetailFooter(doc, fetchedAt, onRefresh));
      detailRow.appendChild(wrap);
      return;
    }

    const stats = doc.createElement("div");
    stats.className = "bc-cs-detail-stats";
    appendStat(doc, stats, "Capacity", result.classCapacity);
    appendStat(doc, stats, "Enrolled", result.enrollmentTotal);
    appendStat(doc, stats, "Open seats", result.availableSeats);
    appendStat(doc, stats, "Wait cap", result.waitListCapacity);
    appendStat(doc, stats, "Wait total", result.waitListTotal);
    if (stats.children.length > 0) wrap.appendChild(stats);

    appendDetailBlock(doc, wrap, "Class Attributes", result.classAttributes);
    appendDetailBlock(doc, wrap, "Enrollment Requirements", result.enrollmentRequirements);
    appendDetailBlock(doc, wrap, "Class Notes", result.classNotes);

    if (result.classCapacity === null && hasNoEnrichedFields(result)) {
      const note = doc.createElement("div");
      note.className = "bc-cs-detail-note";
      note.textContent = "CAESAR did not return a detail panel for this section. Status from search-results page is shown above.";
      wrap.appendChild(note);
    }

    wrap.appendChild(buildDetailFooter(doc, fetchedAt, onRefresh));
    detailRow.appendChild(wrap);
  }

  // ── Add to cart ──────────────────────────────────────────────────────────

  private async handleAdd(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): Promise<void> {
    if (button.dataset.state === "success") return;
    button.disabled = true;
    button.dataset.state = "loading";
    button.textContent = "Loading…";

    // We need the 5-digit CAESAR class number for the cart-add chain.
    // Live data is the source of truth; load it first if it isn't already
    // in the cache.
    const liveKey = liveCacheKey(state, row);
    let live = state.liveCache.get(liveKey);
    if (!live || live.status !== "ready" || !live.result) {
      const card = button.closest<HTMLElement>(".bc-cs-course");
      if (card) await this.loadCourseLive(state, row, card);
      live = state.liveCache.get(liveKey);
    }

    let classNumber: string | null = null;
    if (live?.status === "ready" && live.result) {
      const group = matchCaesarGroup(live.result.groups, row.course.catalog);
      if (group) {
        classNumber =
          matchCaesarSection(group, section.section, section.component)?.classNumber ?? null;
      }
    }

    if (!classNumber) {
      button.dataset.state = "error";
      button.textContent = "Add to cart";
      button.disabled = false;
      showToast("Couldn't resolve the CAESAR class number for this section.", {
        tone: "error"
      });
      return;
    }

    button.textContent = `Adding #${classNumber}…`;

    const result = await addSectionToCart({
      classNumber,
      termId: state.filters.termId,
      career: state.career,
      institution: state.institution
    });

    // The class-number search response we ran as part of the chain
    // already has fresh status / instructor / room for this row — fold
    // it into the live-status cache so the badge appears without a
    // separate "Load CAESAR data" round-trip.
    const searchGroups = "searchGroups" in result ? result.searchGroups : undefined;
    if (searchGroups && searchGroups.length > 0) {
      mergeLiveCache(state, row, searchGroups);
      const card = button.closest<HTMLElement>(".bc-cs-course");
      const merged = state.liveCache.get(liveCacheKey(state, row));
      if (card && merged?.status === "ready" && merged.result) {
        this.applyLiveDataToCard(state, row, card, merged.result);
      }
    }

    // Background-prefetch real seat/notes data so the shopping-cart
    // augmentation has a warm cache when the user gets there. We can't
    // reuse the cart-add chain's response — that's CAESAR's "Confirm
    // Your Selection" wizard page, which doesn't carry the
    // `SSR_CLS_DTL_WRK_*` field IDs the seats-notes parser needs.
    // `lookupClass` runs the proper search → MTG_CLASSNAME chain that
    // hits `SSR_CLSRCH_DTL`. Fire-and-forget; user sees the toast now,
    // cache fills in within a couple seconds.
    if (result.ok || result.alreadyInCart) {
      void prefetchSeatsNotes(state, classNumber);
    }

    if (result.ok) {
      button.dataset.state = "success";
      button.textContent = "Added ✓";
      button.disabled = true;
      showToast(
        `Added ${formatCourseIdForDisplay(row.course.subject, row.course.catalog)} ${section.section}-${section.component} (#${result.classNumber}) to your shopping cart.`,
        {
          tone: "success",
          durationMs: 6000,
          action: {
            label: "View cart",
            run: () => {
              window.location.assign(
                "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A"
              );
            }
          }
        }
      );
    } else if (result.alreadyInCart) {
      // Friendlier UX: show the button as already-handled and surface a
      // pointer to the cart instead of a generic error.
      button.dataset.state = "success";
      button.textContent = "In cart";
      button.disabled = true;
      showToast(
        `${formatCourseIdForDisplay(row.course.subject, row.course.catalog)} #${classNumber} is already in your shopping cart.`,
        {
          tone: "info",
          durationMs: 5000,
          action: {
            label: "View cart",
            run: () => {
              window.location.assign(
                "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A"
              );
            }
          }
        }
      );
    } else {
      button.dataset.state = "error";
      button.textContent = "Try again";
      button.disabled = false;
      const needsClassicFallback = /extra confirmation|preferences|related component/i.test(
        result.error ?? ""
      );
      showToast(result.error ?? "Couldn't add to cart.", {
        tone: "error",
        durationMs: 6000,
        action: needsClassicFallback
          ? {
              label: "Open Classic",
              run: () => {
                state.activeTab = "classic";
                writeActiveTab("classic");
                applyTabVisibility(state);
              }
            }
          : undefined
      });
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  private setStatus(state: MountedState, kind: "loading" | "ok" | "error", message: string): void {
    const { statusEl, doc } = state;
    statusEl.innerHTML = "";
    statusEl.dataset.state = kind;
    if (kind === "loading") {
      const spinner = doc.createElement("span");
      spinner.className = "bc-cs-spinner";
      statusEl.appendChild(spinner);
    }
    const text = doc.createElement("span");
    text.textContent = message;
    statusEl.appendChild(text);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Module helpers (no `this` access)

function liveCacheKey(state: MountedState, row: ResultRow): string {
  return `${state.filters.termId}|${row.course.subject}|${bareCatalogNumber(row.course.catalog)}`;
}

// Fold a partial CaesarSearchResult (typically from a class-number search,
// which returns a single section) into the live-status cache. If the cache
// already has data from a wider subject search, we replace just the
// matching section so other sections' status badges aren't lost. If
// nothing is cached yet, we seed it with whatever the partial response
// gave us — better than a blank.
function mergeLiveCache(
  state: MountedState,
  row: ResultRow,
  incomingGroups: CaesarCourseGroup[]
): void {
  const key = liveCacheKey(state, row);
  const incomingMatch = matchCaesarGroup(incomingGroups, row.course.catalog);
  if (!incomingMatch) return;

  const existing = state.liveCache.get(key);
  if (!existing || existing.status !== "ready" || !existing.result) {
    state.liveCache.set(key, {
      status: "ready",
      result: { groups: incomingGroups }
    });
    return;
  }

  const existingGroups = existing.result.groups;
  const existingMatch = matchCaesarGroup(existingGroups, row.course.catalog);
  if (!existingMatch) {
    state.liveCache.set(key, {
      status: "ready",
      result: { groups: [...existingGroups, ...incomingGroups] }
    });
    return;
  }

  // Merge section-by-section, keyed on classNumber (every CAESAR section
  // has a unique 5-digit number within a term).
  const mergedSections = [...existingMatch.sections];
  for (const incomingSection of incomingMatch.sections) {
    const idx = mergedSections.findIndex(
      (s) => s.classNumber === incomingSection.classNumber
    );
    if (idx >= 0) mergedSections[idx] = incomingSection;
    else mergedSections.push(incomingSection);
  }

  const mergedGroup: CaesarCourseGroup = { ...existingMatch, sections: mergedSections };
  const mergedGroups = existingGroups.map((g) => (g === existingMatch ? mergedGroup : g));
  state.liveCache.set(key, { status: "ready", result: { groups: mergedGroups } });
}

// Run the proper class-detail lookup (search → click MTG_CLASSNAME → parse
// SSR_CLSRCH_DTL) in the background and write the result to the shared
// seats-notes cache. Fire-and-forget. Errors are swallowed because this is
// a best-effort prefetch — the cart augmentation will retry on demand if
// the cache is empty when the user lands there.
function prefetchSeatsNotes(state: MountedState, classNumber: string): Promise<void> {
  if (state.detailPrefetch.has(classNumber)) {
    return state.detailPrefetch.get(classNumber)!;
  }
  const job = (async () => {
    try {
      const lookupResponse = await lookupClass(
        {
          type: "lookup-class",
          classNumber,
          careerHint: state.career === "TGS" ? "TGS" : "UGRD"
        },
        { priority: "background", owner: "class-search-prefetch" }
      );
      const result = toSeatsNotesResult(lookupResponse);
      const fetchedAt = Date.now();
      writeSeatsNotesCache(classNumber, { result, fetchedAt });
      state.detailCache.set(classNumber, { state: "ready", result });
    } catch (error) {
      if (isRetryablePeopleSoftTaskError(error)) return;
      // Best-effort: log and move on. We don't write a failure entry,
      // since seats-notes treats an empty cache as "click Refresh" and
      // that's the right user-facing affordance.
      console.warn("[bc-class-search] seats prefetch failed", error);
    } finally {
      state.detailPrefetch.delete(classNumber);
    }
  })();
  state.detailPrefetch.set(classNumber, job);
  return job;
}

function buildDetailFooter(
  doc: Document,
  fetchedAt: number,
  onRefresh: () => void
): HTMLElement {
  const footer = doc.createElement("div");
  footer.className = "bc-cs-detail-footer";

  const stamp = doc.createElement("span");
  stamp.className = "bc-cs-detail-stamp";
  stamp.textContent = `Loaded ${formatRelativeTime(fetchedAt)}`;
  stamp.title = new Date(fetchedAt).toLocaleString();
  footer.appendChild(stamp);

  const refresh = doc.createElement("button");
  refresh.type = "button";
  refresh.className = "bc-cs-detail-refresh";
  refresh.textContent = "Refresh";
  refresh.addEventListener("click", () => {
    refresh.disabled = true;
    refresh.textContent = "Refreshing…";
    void Promise.resolve(onRefresh());
  });
  footer.appendChild(refresh);

  return footer;
}

function formatRelativeTime(timestamp: number): string {
  const deltaSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (deltaSec < 5) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.round(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  const deltaDay = Math.round(deltaHr / 24);
  return `${deltaDay}d ago`;
}

function appendStat(
  doc: Document,
  parent: HTMLElement,
  label: string,
  value: string | null
): void {
  if (!value) return;
  const cell = doc.createElement("div");
  cell.className = "bc-cs-stat";
  const v = doc.createElement("div");
  v.className = "bc-cs-stat-value";
  v.textContent = value;
  const l = doc.createElement("div");
  l.className = "bc-cs-stat-label";
  l.textContent = label;
  cell.append(v, l);
  parent.appendChild(cell);
}

function appendDetailBlock(
  doc: Document,
  parent: HTMLElement,
  label: string,
  text: string | null
): void {
  if (!text) return;
  const block = doc.createElement("div");
  block.className = "bc-cs-detail-block";
  const heading = doc.createElement("div");
  heading.className = "bc-cs-detail-block-label";
  heading.textContent = label;
  const body = doc.createElement("div");
  body.className = "bc-cs-detail-block-body";
  body.textContent = text;
  block.append(heading, body);
  parent.appendChild(block);
}

function hasNoEnrichedFields(result: SeatsNotesSuccess): boolean {
  return (
    result.classCapacity === null &&
    result.enrollmentTotal === null &&
    result.availableSeats === null &&
    result.classAttributes === null &&
    result.enrollmentRequirements === null &&
    result.classNotes === null
  );
}

function isSearchEntryPage(doc: Document): boolean {
  const pageInfo = doc.getElementById("pt_pageinfo_win0");
  if (!pageInfo) return false;
  const page = pageInfo.getAttribute("Page");
  const component = pageInfo.getAttribute("Component");
  if (component !== SEARCH_COMPONENT) return false;
  if (page === SEARCH_PAGE_ID) return true;
  if (page === RESULTS_PAGE_ID || page === CART_PAGE_ID) return false;
  return false;
}

function ensureRoot(doc: Document): HTMLDivElement {
  let root = doc.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (root) {
    // Defensive: the class drives every style variable. If a previous
    // build left the element without the class, restore it.
    if (!root.classList.contains("bc-cs-root")) root.classList.add("bc-cs-root");
    return root;
  }
  root = doc.createElement("div");
  root.id = ROOT_ID;
  // CSS custom properties (--bc-purple, etc.) and the root reset live on
  // `.bc-cs-root`. Without this class every nested selector that calls
  // `var(--bc-purple)` resolves to the empty string and the UI renders
  // unstyled — found by codex consult.
  root.className = "bc-cs-root";
  const anchor =
    doc.getElementById("win0divPAGECONTAINER") ??
    doc.querySelector(".PSPAGECONTAINER")?.closest("td") ??
    doc.body;
  anchor?.parentElement
    ? anchor.parentElement.insertBefore(root, anchor)
    : doc.body.appendChild(root);
  return root;
}

function applyTabVisibility(state: MountedState): void {
  const { doc, panelEl } = state;
  if (state.activeTab === "better") {
    ensureNativeHider(doc);
    panelEl.style.display = "";
  } else {
    removeNativeHider(doc);
    panelEl.style.display = "none";
  }
}

function ensureNativeHider(doc: Document): void {
  if (doc.getElementById(HIDE_NATIVE_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = HIDE_NATIVE_STYLE_ID;
  style.textContent = `
    #win0divPAGECONTAINER { display: none !important; }
    #win0divPAGEBAR, #win0divPSPANELTABS { display: none !important; }
  `;
  (doc.head ?? doc.documentElement).appendChild(style);
}

function removeNativeHider(doc: Document): void {
  doc.getElementById(HIDE_NATIVE_STYLE_ID)?.remove();
}

function readActiveTab(): TabId {
  try {
    const raw = window.sessionStorage.getItem(TAB_STORAGE_KEY);
    if (raw === "classic") return "classic";
    return "better";
  } catch {
    return "better";
  }
}

function writeActiveTab(tab: TabId): void {
  try {
    window.sessionStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // ignore storage errors
  }
}

function readCareerFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "SSR_CLSRCH_WRK_ACAD_CAREER");
  if (select?.value) return select.value;
  const url = new URL(window.location.href);
  return url.searchParams.get("ACAD_CAREER");
}

function readInstitutionFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "CLASS_SRCH_WRK2_INSTITUTION");
  return select?.value ?? null;
}

function readTermFromNativeForm(doc: Document): string | null {
  const select = findSelectByPrefix(doc, "CLASS_SRCH_WRK2_STRM");
  return select?.value || null;
}

function findSelectByPrefix(doc: Document, prefix: string): HTMLSelectElement | null {
  const selects = doc.querySelectorAll<HTMLSelectElement>("select");
  for (const select of Array.from(selects)) {
    if (select.name?.startsWith(prefix)) return select;
  }
  return null;
}

function renderFatalError(root: HTMLElement, doc: Document, message: string): void {
  root.innerHTML = "";
  const wrap = doc.createElement("div");
  wrap.className = "bc-cs-root";
  const card = doc.createElement("div");
  card.className = "bc-cs-card";
  card.style.borderColor = "#fca5a5";
  card.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;color:#b91c1c;">
      <strong>Couldn't load paper.nu catalog data.</strong>
      <span style="color:#6b7280;">${escapeHtml(message)}</span>
      <span style="color:#6b7280;font-size:12px;">Reload the page to try again, or switch to Classic CAESAR using the tab above.</span>
    </div>
  `;
  wrap.appendChild(card);
  root.appendChild(wrap);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLoadingShell(doc: Document): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "bc-cs-root";
  const card = doc.createElement("div");
  card.className = "bc-cs-card";
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:#6b7280;font-size:13px;">
      <span class="bc-cs-spinner"></span>
      <span>Loading paper.nu catalog data…</span>
    </div>
  `;
  wrap.appendChild(card);
  return wrap;
}

function formatTermLabel(term: TermSummary): string {
  void term.start;
  void term.end;
  return term.name;
}

function hasAnyFilter(filters: SearchFilters): boolean {
  if (filters.query.trim()) return true;
  if (filters.distros.size > 0) return true;
  if (filters.disciplines.size > 0) return true;
  if (filters.schools.size > 0) return true;
  if (filters.components.size > 0) return true;
  return false;
}

