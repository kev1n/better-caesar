import type { Augmentation } from "../../framework";
import { fetchPeopleSoft, fetchPeopleSoftGet } from "../../peoplesoft/http";
import {
  DEFAULT_CAREER_CODE,
  DEFAULT_SUBJECT_CODE,
  MAX_COURSES_PER_SUBJECT,
  MAX_PARALLEL_CLASS_WORKERS,
  PANEL_ID,
  PROGRESS_REFRESH_INTERVAL_MS,
  REQUEST_OWNER
} from "./constants";
import {
  applyResponseState,
  buildActionParams,
  buildSubjectResultsUrl,
  collectClassRows,
  collectClassRowsFromText,
  collectCourseRows,
  createInitialVisualState,
  dedupeEntries,
  extractBlueraUrl,
  extractPostUrl,
  mapWithConcurrency,
  normalizeCareerCode,
  normalizeSearch,
  normalizeSubjectCode,
  readCareerFromUrl,
  readSubjectContext,
  resolveActionUrl,
  serializeForm
} from "./helpers";
import { clearSubjectIndex, readLastSubject, readSubjectIndex, rememberLastSubject, writeSubjectIndex } from "./storage";
import type {
  ClassTask,
  CourseProgress,
  CtecIndexedEntry,
  CtecRowSeed,
  CtecSubjectContext,
  CtecSubjectIndex,
  IndexVisualState,
  PanelRefs
} from "./types";
import { ensurePanel, getPanelRefs, hasCtecDisclaimer, injectStyles, renderCourseGrid, renderResultsToContainer } from "./ui";

export class CtecNavigationAugmentation implements Augmentation {
  readonly id = "ctec-navigation";

  private isIndexing = false;
  private indexingProgress = "";
  private currentContext: CtecSubjectContext | null = null;
  private currentRows: CtecRowSeed[] = [];
  private currentIndex: CtecSubjectIndex | null = null;
  private visualState: IndexVisualState = createInitialVisualState();
  private progressRenderTimer: number | null = null;
  private lastProgressRenderAtMs = 0;
  private initialized = false;

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;

    if (this.initialized) {
      const existing = doc.getElementById(PANEL_ID);
      if (existing) return;
      this.initialized = false;
    }

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
    this.initialized = true;

    // --- Temporary probe: test Bluera access via background tab ---
    this.probeBluera();
  }

  private probeBluera(): void {
    const TEST_URL =
      "https://northwestern.bluera.com/northwestern/rpvf-eng.aspx?lang=eng&redi=1&SelectedIDforPrint=3994a7578f3bc9ba6400d7d8bef882e48186720dd278264fd4f79fede1f0a57d4234ddddae8d97e877ec470662793b08&ReportType=2&regl=en-US";

    console.log("[probe] Testing Bluera access via background tab...");
    chrome.runtime.sendMessage(
      { type: "probe-bluera-tab", url: TEST_URL },
      (response) => {
        console.log("[probe] Background tab result:", response);
      }
    );
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

    this.visualState = createInitialVisualState(subjectCode);
    this.isIndexing = true;
    this.indexingProgress = `Preparing index for ${subjectCode}...`;
    this.queueProgressRender(true);
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
        entries = await this.indexClassTasks(
          this.currentRows.map((row) => ({ row, actionUrl, params: baseParams, courseIndex: -1 }))
        );
      } else {
        const remoteData = await this.fetchAndIndexRemoteSubject(subjectCode, careerCode);
        subjectContext = remoteData.context;
        entries = remoteData.entries;
      }

      if (entries.length === 0) {
        throw new Error(`No CTEC rows found for ${subjectCode}.`);
      }

      const dedupedEntries = dedupeEntries(entries);
      this.indexingProgress = `Indexed ${dedupedEntries.length} rows for ${subjectCode}.`;
      this.queueProgressRender(true);

      const nextIndex: CtecSubjectIndex = {
        subjectCode,
        subjectLabel: subjectContext.label,
        builtAt: Date.now(),
        sourceUrl: window.location.href,
        entries: dedupedEntries
      };

      writeSubjectIndex(subjectCode, nextIndex);

      this.currentIndex = nextIndex;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      this.indexingProgress = `Index failed: ${message}`;
      this.queueProgressRender(true);
    } finally {
      this.isIndexing = false;
      this.queueProgressRender(true);
      this.refresh();
    }
  }

  private async fetchAndIndexRemoteSubject(subjectCode: string, careerCode: string): Promise<{
    context: CtecSubjectContext;
    entries: CtecIndexedEntry[];
  }> {
    const resultsUrl = buildSubjectResultsUrl(subjectCode, careerCode);
    this.indexingProgress = `Loading ${subjectCode} results page...`;
    this.queueProgressRender();

    const html = await fetchPeopleSoftGet(resultsUrl, { owner: REQUEST_OWNER });
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
    const actionUrl = resolveActionUrl(form.action);
    const baseParams = serializeForm(form);

    // If the page already has class rows (no course drill-down needed)
    const directRows = collectClassRows(doc);
    if (directRows.length > 0) {
      this.updateVisualState((s) => { s.classesTotal += directRows.length; });
      const entries = await this.indexClassTasks(
        directRows.map((row) => ({ row, actionUrl, params: baseParams, courseIndex: -1 }))
      );
      return { context, entries };
    }

    const courseRows = collectCourseRows(doc).slice(0, MAX_COURSES_PER_SUBJECT);
    const totalCourses = courseRows.length;

    // Initialize per-course visual state
    this.updateVisualState((s) => {
      s.coursesTotal = totalCourses;
      s.courses = courseRows.map((c, i) => ({
        index: i,
        description: c.description,
        status: "queued",
        classesTotal: 0,
        classesCompleted: 0
      }));
    });
    this.queueProgressRender(true);

    if (totalCourses === 0) {
      return { context, entries: [] };
    }

    // For each course sequentially:
    //   1. Load the course page (stateful — changes ICStateNum)
    //   2. Promise.all that course's class Bluera fetches
    // Class fetches are scoped to their course's server state, so we
    // can't mix classes from different courses in the same batch.
    const allEntries: CtecIndexedEntry[] = [];

    for (let index = 0; index < courseRows.length; index++) {
      const course = courseRows[index];
      this.setCourseStatus(index, "loading");
      this.updateVisualState((s) => {
        s.coursesStarted += 1;
        s.inFlightCourses += 1;
      });
      this.indexingProgress = `Loading course ${index + 1}/${totalCourses}: ${course.description}`;
      this.queueProgressRender(true);

      try {
        const courseRequest = buildActionParams(baseParams, course.actionId);
        const courseResponse = await fetchPeopleSoft(actionUrl, courseRequest, { owner: REQUEST_OWNER });
        const classRows = collectClassRowsFromText(courseResponse);

        const classParams = applyResponseState(baseParams, courseResponse);
        const classActionUrl = extractPostUrl(courseResponse) ?? actionUrl;

        this.updateVisualState((s) => {
          s.coursesCompleted += 1;
          s.inFlightCourses = Math.max(0, s.inFlightCourses - 1);
          s.classesTotal += classRows.length;
          s.courses[index].classesTotal = classRows.length;
        });

        if (classRows.length === 0) {
          this.setCourseStatus(index, "done");
          this.queueProgressRender(true);
          continue;
        }

        // Index all classes for this course in parallel
        this.setCourseStatus(index, "indexing");
        this.indexingProgress = `Indexing ${classRows.length} classes for ${course.description}...`;
        this.queueProgressRender(true);

        const courseEntries = await Promise.all(
          classRows.map(async (row) => {
            this.updateVisualState((s) => {
              s.classesStarted += 1;
              s.inFlightClasses += 1;
            });
            this.queueProgressRender();

            let blueraUrl: string | null = null;
            let error: string | null = null;

            try {
              const params = buildActionParams(classParams, row.actionId);
              const responseText = await fetchPeopleSoft(classActionUrl, params, { owner: REQUEST_OWNER });
              blueraUrl = extractBlueraUrl(responseText);
              if (!blueraUrl) {
                error = "No Bluera URL returned for this row.";
              }
            } catch (reason) {
              error = reason instanceof Error ? reason.message : String(reason);
            }

            this.updateVisualState((s) => {
              s.classesCompleted += 1;
              s.inFlightClasses = Math.max(0, s.inFlightClasses - 1);
              if (blueraUrl) {
                s.linksFound += 1;
              } else {
                s.linksMissing += 1;
              }
              const cp = s.courses[index];
              cp.classesCompleted += 1;
            });
            this.queueProgressRender();

            return {
              actionId: row.actionId,
              term: row.term,
              description: row.description,
              instructor: row.instructor,
              blueraUrl,
              error,
              searchText: normalizeSearch([row.term, row.description, row.instructor].join(" "))
            };
          })
        );

        allEntries.push(...courseEntries);
        this.setCourseStatus(index, "done");
      } catch {
        this.setCourseStatus(index, "error");
        this.updateVisualState((s) => {
          s.coursesCompleted += 1;
          s.inFlightCourses = Math.max(0, s.inFlightCourses - 1);
        });
      }

      this.indexingProgress = `Completed course ${index + 1}/${totalCourses}: ${course.description}`;
      this.queueProgressRender(true);
    }

    return { context, entries: allEntries };
  }

  /**
   * Index a flat list of class tasks using a shared worker pool.
   * Used for visible-row and direct-class indexing (no course drill-down).
   */
  private async indexClassTasks(tasks: ClassTask[]): Promise<CtecIndexedEntry[]> {
    if (tasks.length === 0) return [];

    this.updateVisualState((s) => {
      s.classesTotal += tasks.length;
    });
    this.queueProgressRender();

    let completed = 0;

    return mapWithConcurrency(tasks, MAX_PARALLEL_CLASS_WORKERS, async (task) => {
      let blueraUrl: string | null = null;
      let error: string | null = null;
      this.updateVisualState((s) => {
        s.classesStarted += 1;
        s.inFlightClasses += 1;
      });
      this.queueProgressRender();

      try {
        const params = buildActionParams(task.params, task.row.actionId);
        const responseText = await fetchPeopleSoft(task.actionUrl, params, { owner: REQUEST_OWNER });
        blueraUrl = extractBlueraUrl(responseText);
        if (!blueraUrl) {
          error = "No Bluera URL returned for this row.";
        }
      } catch (reason) {
        error = reason instanceof Error ? reason.message : String(reason);
      }

      completed += 1;
      this.indexingProgress = `Indexed ${completed}/${tasks.length}: ${task.row.description}`;
      this.updateVisualState((s) => {
        s.classesCompleted += 1;
        s.inFlightClasses = Math.max(0, s.inFlightClasses - 1);
        if (blueraUrl) {
          s.linksFound += 1;
        } else {
          s.linksMissing += 1;
        }
      });
      this.queueProgressRender();

      return {
        actionId: task.row.actionId,
        term: task.row.term,
        description: task.row.description,
        instructor: task.row.instructor,
        blueraUrl,
        error,
        searchText: normalizeSearch([task.row.term, task.row.description, task.row.instructor].join(" "))
      };
    });
  }

  private setCourseStatus(index: number, status: CourseProgress["status"]): void {
    this.updateVisualState((s) => {
      if (index >= 0 && index < s.courses.length) {
        s.courses[index].status = status;
      }
    });
  }

  private handleClearClick(refs: PanelRefs): void {
    const subjectCode = this.getActiveSubjectCode(refs);
    if (!subjectCode) return;

    clearSubjectIndex(subjectCode);
    this.currentIndex = null;
    this.visualState = createInitialVisualState(subjectCode);
    this.indexingProgress = `Cleared local cache for ${subjectCode}.`;
    this.queueProgressRender(true);
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
    refs.title.textContent = `Better CAESAR CTEC Index (${subjectLabel})`;

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
    this.renderProgress(refs);

    this.renderResults(refs);
  }

  private updateVisualState(mutator: (state: IndexVisualState) => void): void {
    mutator(this.visualState);
  }

  private queueProgressRender(force = false): void {
    if (force) {
      if (this.progressRenderTimer !== null) {
        window.clearTimeout(this.progressRenderTimer);
        this.progressRenderTimer = null;
      }
      this.renderProgressNow();
      return;
    }

    const elapsedMs = Date.now() - this.lastProgressRenderAtMs;
    if (elapsedMs >= PROGRESS_REFRESH_INTERVAL_MS) {
      this.renderProgressNow();
      return;
    }

    if (this.progressRenderTimer !== null) return;

    const waitMs = PROGRESS_REFRESH_INTERVAL_MS - elapsedMs;
    this.progressRenderTimer = window.setTimeout(() => {
      this.progressRenderTimer = null;
      this.renderProgressNow();
    }, waitMs);
  }

  private renderProgressNow(): void {
    this.lastProgressRenderAtMs = Date.now();
    const panel = document.getElementById(PANEL_ID);
    if (!(panel instanceof HTMLElement)) return;

    const refs = getPanelRefs(panel);
    if (!refs) return;
    this.renderProgress(refs);
  }

  private renderProgress(refs: PanelRefs): void {
    refs.status.textContent = this.indexingProgress || "Ready.";

    const state = this.visualState;
    const coursesPct =
      state.coursesTotal > 0 ? Math.round((state.coursesCompleted / state.coursesTotal) * 100) : 0;
    const classesPct =
      state.classesTotal > 0 ? Math.round((state.classesCompleted / state.classesTotal) * 100) : 0;

    refs.courseProgressFill.style.width = `${coursesPct}%`;
    refs.classProgressFill.style.width = `${classesPct}%`;

    // Render per-course grid
    renderCourseGrid(refs.courseGrid, state);

    if (!this.isIndexing) {
      refs.progressSummary.textContent = "Progress will appear while indexing.";
      refs.progressStats.textContent = "";
      return;
    }

    refs.progressSummary.textContent = `Courses ${state.coursesCompleted}/${state.coursesTotal} | Classes ${state.classesCompleted}/${state.classesTotal}`;
    const elapsedSec = Math.max(0, Math.floor((Date.now() - state.startedAtMs) / 1000));
    refs.progressStats.textContent = `In flight: ${state.inFlightCourses} courses, ${state.inFlightClasses} classes | Bluera found ${state.linksFound}, missing ${state.linksMissing} | ${elapsedSec}s elapsed`;
  }

  private renderResults(refs: PanelRefs): void {
    const query = normalizeSearch(refs.searchInput.value);
    renderResultsToContainer(refs.results, this.currentIndex, query);
  }
}
