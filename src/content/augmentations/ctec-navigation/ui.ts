import { MAX_RESULTS, PANEL_ID, PAPER_IFRAME_PANEL_ID, PAPER_IFRAME_URL, STYLE_ID } from "./constants";
import { normalizeSearch } from "./helpers";
import type { CourseProgress, CtecIndexedEntry, CtecSubjectIndex, IndexVisualState, PanelRefs } from "./types";

export function hasCtecDisclaimer(doc: Document): boolean {
  return (
    doc.querySelector<HTMLElement>(".ctec-disclaimer") !== null ||
    doc.querySelector<HTMLElement>("[class*='ctec-disclaimer']") !== null
  );
}

export function ensurePanel(doc: Document): HTMLElement | null {
  const anchor = getCtecDisclaimerAnchor(doc);
  if (!anchor) return null;

  const existing = doc.getElementById(PANEL_ID);
  if (existing instanceof HTMLElement) {
    const iframePanel = ensurePaperIframePanel(doc, anchor, existing);
    positionIframePanelAbovePanel(iframePanel, existing);
    return existing;
  }

  const iframePanel = ensurePaperIframePanel(doc, anchor);

  const root = doc.createElement("section");
  root.id = PANEL_ID;
  root.className = "better-caesar-ctec-panel";

  const title = doc.createElement("h2");
  title.className = "better-caesar-ctec-title";
  title.dataset.part = "title";

  const meta = doc.createElement("div");
  meta.className = "better-caesar-ctec-meta";
  meta.dataset.part = "meta";

  const controls = doc.createElement("div");
  controls.className = "better-caesar-ctec-controls";

  const subjectInput = doc.createElement("input");
  subjectInput.type = "text";
  subjectInput.className = "better-caesar-ctec-control-input";
  subjectInput.placeholder = "Subject code (e.g., COMP_SCI)";
  subjectInput.dataset.part = "subject";

  const careerSelect = doc.createElement("select");
  careerSelect.className = "better-caesar-ctec-control-select";
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
  actions.className = "better-caesar-ctec-actions";

  const indexButton = doc.createElement("button");
  indexButton.type = "button";
  indexButton.className = "better-caesar-ctec-btn better-caesar-ctec-btn-primary";
  indexButton.dataset.part = "index";

  const clearButton = doc.createElement("button");
  clearButton.type = "button";
  clearButton.className = "better-caesar-ctec-btn";
  clearButton.dataset.part = "clear";
  clearButton.textContent = "Clear this subject cache";

  actions.appendChild(indexButton);
  actions.appendChild(clearButton);

  const status = doc.createElement("div");
  status.className = "better-caesar-ctec-status";
  status.dataset.part = "status";

  const progress = doc.createElement("div");
  progress.className = "better-caesar-ctec-progress";
  progress.dataset.part = "progress";

  const progressSummary = doc.createElement("div");
  progressSummary.className = "better-caesar-ctec-progress-summary";
  progressSummary.dataset.part = "progress-summary";
  progressSummary.textContent = "Progress will appear while indexing.";

  const courseProgress = doc.createElement("div");
  courseProgress.className = "better-caesar-ctec-progress-row";
  const courseLabel = doc.createElement("span");
  courseLabel.className = "better-caesar-ctec-progress-label";
  courseLabel.textContent = "Courses";
  const courseTrack = doc.createElement("div");
  courseTrack.className = "better-caesar-ctec-progress-track";
  const courseFill = doc.createElement("div");
  courseFill.className = "better-caesar-ctec-progress-fill";
  courseFill.dataset.part = "course-fill";
  courseTrack.appendChild(courseFill);
  courseProgress.appendChild(courseLabel);
  courseProgress.appendChild(courseTrack);

  const classProgress = doc.createElement("div");
  classProgress.className = "better-caesar-ctec-progress-row";
  const classLabel = doc.createElement("span");
  classLabel.className = "better-caesar-ctec-progress-label";
  classLabel.textContent = "Classes";
  const classTrack = doc.createElement("div");
  classTrack.className = "better-caesar-ctec-progress-track";
  const classFill = doc.createElement("div");
  classFill.className = "better-caesar-ctec-progress-fill";
  classFill.dataset.part = "class-fill";
  classTrack.appendChild(classFill);
  classProgress.appendChild(classLabel);
  classProgress.appendChild(classTrack);

  const progressStats = doc.createElement("div");
  progressStats.className = "better-caesar-ctec-progress-stats";
  progressStats.dataset.part = "progress-stats";

  const courseGrid = doc.createElement("div");
  courseGrid.className = "better-caesar-ctec-course-grid";
  courseGrid.dataset.part = "course-grid";

  progress.appendChild(progressSummary);
  progress.appendChild(courseProgress);
  progress.appendChild(classProgress);
  progress.appendChild(progressStats);
  progress.appendChild(courseGrid);

  const searchInput = doc.createElement("input");
  searchInput.type = "search";
  searchInput.className = "better-caesar-ctec-search";
  searchInput.dataset.part = "search";

  const results = doc.createElement("div");
  results.className = "better-caesar-ctec-results";
  results.dataset.part = "results";

  root.appendChild(title);
  root.appendChild(meta);
  root.appendChild(controls);
  root.appendChild(actions);
  root.appendChild(status);
  root.appendChild(progress);
  root.appendChild(searchInput);
  root.appendChild(results);

  iframePanel.insertAdjacentElement("afterend", root);
  return root;
}

function getCtecDisclaimerAnchor(doc: Document): HTMLElement | null {
  return (
    doc.querySelector<HTMLElement>("#win0divNW_CTEC_WRK_HTMLAREA1") ??
    doc.querySelector<HTMLElement>("#NW_CTEC_WRK_HTMLAREA1") ??
    doc.querySelector<HTMLElement>(".ctec-disclaimer") ??
    doc.querySelector<HTMLElement>("[class*='ctec-disclaimer']")
  );
}

function ensurePaperIframePanel(
  doc: Document,
  anchor: HTMLElement,
  panel?: HTMLElement
): HTMLElement {
  const existing = doc.getElementById(PAPER_IFRAME_PANEL_ID);
  if (existing instanceof HTMLElement) {
    if (panel) {
      positionIframePanelAbovePanel(existing, panel);
    }
    return existing;
  }

  const wrap = doc.createElement("section");
  wrap.id = PAPER_IFRAME_PANEL_ID;
  wrap.className = "better-caesar-ctec-paper-panel";

  const title = doc.createElement("div");
  title.className = "better-caesar-ctec-paper-title";
  title.textContent = "paper.nu (experiment)";

  const frame = doc.createElement("iframe");
  frame.className = "better-caesar-ctec-paper-frame";
  frame.src = PAPER_IFRAME_URL;
  frame.loading = "lazy";
  frame.referrerPolicy = "no-referrer";
  frame.setAttribute("allow", "clipboard-read; clipboard-write");

  wrap.appendChild(title);
  wrap.appendChild(frame);

  if (panel) {
    panel.insertAdjacentElement("beforebegin", wrap);
  } else {
    anchor.insertAdjacentElement("afterend", wrap);
  }
  return wrap;
}

function positionIframePanelAbovePanel(iframePanel: HTMLElement, panel: HTMLElement): void {
  if (iframePanel.nextElementSibling === panel) return;
  panel.insertAdjacentElement("beforebegin", iframePanel);
}

export function getPanelRefs(root: HTMLElement): PanelRefs | null {
  const title = root.querySelector<HTMLElement>("[data-part='title']");
  const meta = root.querySelector<HTMLElement>("[data-part='meta']");
  const status = root.querySelector<HTMLElement>("[data-part='status']");
  const progressSummary = root.querySelector<HTMLElement>("[data-part='progress-summary']");
  const courseProgressFill = root.querySelector<HTMLElement>("[data-part='course-fill']");
  const classProgressFill = root.querySelector<HTMLElement>("[data-part='class-fill']");
  const progressStats = root.querySelector<HTMLElement>("[data-part='progress-stats']");
  const courseGrid = root.querySelector<HTMLElement>("[data-part='course-grid']");
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
    !progressSummary ||
    !courseProgressFill ||
    !classProgressFill ||
    !progressStats ||
    !courseGrid ||
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
    progressSummary,
    courseProgressFill,
    classProgressFill,
    progressStats,
    courseGrid,
    subjectInput,
    careerSelect,
    indexButton,
    clearButton,
    searchInput,
    results
  };
}

export function renderCourseGrid(container: HTMLElement, state: IndexVisualState): void {
  const courses = state.courses;
  if (courses.length === 0) {
    container.textContent = "";
    return;
  }

  // Reuse existing pill elements where possible to avoid DOM thrash
  const existingPills = container.querySelectorAll<HTMLElement>("[data-ci]");
  const existingByIndex = new Map<number, HTMLElement>();
  for (const pill of Array.from(existingPills)) {
    existingByIndex.set(Number(pill.dataset.ci), pill);
  }

  for (const course of courses) {
    let pill = existingByIndex.get(course.index);
    if (!pill) {
      pill = document.createElement("div");
      pill.className = "better-caesar-ctec-pill";
      pill.dataset.ci = String(course.index);
      container.appendChild(pill);
    }

    const statusClass = `better-caesar-ctec-pill--${course.status}`;
    if (!pill.classList.contains(statusClass)) {
      pill.className = `better-caesar-ctec-pill ${statusClass}`;
    }

    const label = formatPillLabel(course);
    if (pill.textContent !== label) {
      pill.textContent = label;
    }

    pill.title = formatPillTooltip(course);
    existingByIndex.delete(course.index);
  }

  // Remove stale pills
  for (const stale of existingByIndex.values()) {
    stale.remove();
  }
}

function formatPillLabel(course: CourseProgress): string {
  const num = course.index + 1;
  switch (course.status) {
    case "queued":
      return `${num}`;
    case "loading":
      return `${num}`;
    case "indexing":
      return `${num} ${course.classesCompleted}/${course.classesTotal}`;
    case "done":
      return `${num} ${course.classesTotal}`;
    case "error":
      return `${num} !`;
  }
}

function formatPillTooltip(course: CourseProgress): string {
  const desc = course.description || `Course ${course.index + 1}`;
  switch (course.status) {
    case "queued":
      return `${desc} — queued`;
    case "loading":
      return `${desc} — loading course page...`;
    case "indexing":
      return `${desc} — indexing ${course.classesCompleted}/${course.classesTotal} classes`;
    case "done":
      return `${desc} — done (${course.classesTotal} classes)`;
    case "error":
      return `${desc} — error`;
  }
}

export function buildResultCard(entry: CtecIndexedEntry): HTMLElement {
  const card = document.createElement("article");
  card.className = "better-caesar-ctec-result";

  const heading = document.createElement("div");
  heading.className = "better-caesar-ctec-result-heading";
  heading.textContent = entry.description || "Untitled course";

  const meta = document.createElement("div");
  meta.className = "better-caesar-ctec-result-meta";
  const pieces = [entry.term, entry.instructor].filter(Boolean);
  meta.textContent = pieces.length > 0 ? pieces.join(" | ") : "No metadata";

  const footer = document.createElement("div");
  footer.className = "better-caesar-ctec-result-footer";

  if (entry.blueraUrl) {
    const link = document.createElement("a");
    link.className = "better-caesar-ctec-link";
    link.href = entry.blueraUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open Bluera evaluation";
    footer.appendChild(link);
  } else {
    const error = document.createElement("span");
    error.className = "better-caesar-ctec-error";
    error.textContent = entry.error ?? "Bluera URL unavailable.";
    footer.appendChild(error);
  }

  card.appendChild(heading);
  card.appendChild(meta);
  card.appendChild(footer);
  return card;
}

export function renderResultsToContainer(
  container: HTMLElement,
  index: CtecSubjectIndex | null,
  query: string
): void {
  if (!index) {
    container.textContent = "No cached results to search yet.";
    return;
  }

  const tokens = query.length > 0 ? query.split(/\s+/).filter(Boolean) : [];

  const matches = index.entries.filter((entry) =>
    tokens.every((token) => entry.searchText.includes(token))
  );

  if (matches.length === 0) {
    container.textContent = "No matches.";
    return;
  }

  const visible = matches.slice(0, MAX_RESULTS);
  const fragment = document.createDocumentFragment();

  for (const entry of visible) {
    fragment.appendChild(buildResultCard(entry));
  }

  container.textContent = "";
  container.appendChild(fragment);

  if (matches.length > MAX_RESULTS) {
    const overflow = document.createElement("div");
    overflow.className = "better-caesar-ctec-overflow";
    overflow.textContent = `Showing first ${MAX_RESULTS} of ${matches.length} matches.`;
    container.appendChild(overflow);
  }
}

export function injectStyles(doc: Document): void {
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
    .better-caesar-ctec-panel {
      margin: 10px 0 14px;
      padding: 12px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 8px;
      background: var(--bc-tyrian-soft);
      display: grid;
      gap: 8px;
    }
    .better-caesar-ctec-paper-panel {
      margin: 10px 0 10px;
      padding: 10px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 8px;
      background: #fff;
      display: grid;
      gap: 8px;
    }
    .better-caesar-ctec-paper-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--bc-tyrian);
    }
    .better-caesar-ctec-paper-frame {
      width: 100%;
      height: 480px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      background: #fff;
    }
    .better-caesar-ctec-title {
      margin: 0;
      font-size: 15px;
      line-height: 1.2;
      color: var(--bc-tyrian);
    }
    .better-caesar-ctec-meta,
    .better-caesar-ctec-status {
      font-size: 12px;
      color: var(--bc-tyrian-ink);
    }
    .better-caesar-ctec-progress {
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      background: #fff;
      padding: 8px;
      display: grid;
      gap: 6px;
    }
    .better-caesar-ctec-progress-summary {
      font-size: 12px;
      color: var(--bc-tyrian-ink);
      font-weight: 600;
    }
    .better-caesar-ctec-progress-row {
      display: grid;
      grid-template-columns: 56px 1fr;
      align-items: center;
      gap: 8px;
    }
    .better-caesar-ctec-progress-label {
      font-size: 11px;
      color: var(--bc-tyrian-ink);
    }
    .better-caesar-ctec-progress-track {
      height: 8px;
      background: var(--bc-tyrian-soft);
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 999px;
      overflow: hidden;
    }
    .better-caesar-ctec-progress-fill {
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, #8b2d5b 0%, var(--bc-tyrian) 100%);
      transition: width 120ms ease-out;
    }
    .better-caesar-ctec-progress-stats {
      font-size: 11px;
      color: var(--bc-tyrian-ink);
    }
    .better-caesar-ctec-course-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      min-height: 0;
    }
    .better-caesar-ctec-pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      line-height: 1.4;
      white-space: nowrap;
      border: 1px solid transparent;
      transition: background 150ms, border-color 150ms;
    }
    .better-caesar-ctec-pill--queued {
      background: #e8e8e8;
      color: #888;
      border-color: #d0d0d0;
    }
    .better-caesar-ctec-pill--loading {
      background: #dbeafe;
      color: #1e40af;
      border-color: #93c5fd;
      animation: bc-pulse 1.2s ease-in-out infinite;
    }
    .better-caesar-ctec-pill--indexing {
      background: #fef3c7;
      color: #92400e;
      border-color: #fcd34d;
    }
    .better-caesar-ctec-pill--done {
      background: #d1fae5;
      color: #065f46;
      border-color: #6ee7b7;
    }
    .better-caesar-ctec-pill--error {
      background: #fee2e2;
      color: #991b1b;
      border-color: #fca5a5;
    }
    @keyframes bc-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.55; }
    }
    .better-caesar-ctec-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .better-caesar-ctec-control-input,
    .better-caesar-ctec-control-select {
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      font-size: 12px;
      color: var(--bc-tyrian-ink);
      padding: 6px 8px;
      background: #fff;
    }
    .better-caesar-ctec-control-input {
      min-width: 220px;
      flex: 1 1 240px;
    }
    .better-caesar-ctec-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .better-caesar-ctec-btn {
      border: 1px solid var(--bc-tyrian-mid);
      background: #fff;
      color: var(--bc-tyrian);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .better-caesar-ctec-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .better-caesar-ctec-btn-primary {
      border-color: var(--bc-tyrian);
      background: var(--bc-tyrian);
      color: #fff;
    }
    .better-caesar-ctec-search {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      font-size: 13px;
      box-sizing: border-box;
    }
    .better-caesar-ctec-results {
      display: grid;
      gap: 8px;
      max-height: 360px;
      overflow: auto;
      padding-right: 2px;
      font-size: 12px;
      color: var(--bc-tyrian-ink);
    }
    .better-caesar-ctec-result {
      padding: 8px;
      border: 1px solid var(--bc-tyrian-mid);
      border-radius: 6px;
      background: #fff;
      display: grid;
      gap: 4px;
    }
    .better-caesar-ctec-result-heading {
      font-weight: 600;
      color: var(--bc-tyrian);
    }
    .better-caesar-ctec-result-meta {
      color: var(--bc-tyrian-ink);
    }
    .better-caesar-ctec-link {
      color: var(--bc-tyrian);
      text-decoration: underline;
      font-weight: 600;
    }
    .better-caesar-ctec-error {
      color: #7a123f;
    }
    .better-caesar-ctec-overflow {
      color: var(--bc-tyrian-ink);
    }
  `;

  const host = doc.head ?? doc.documentElement ?? doc.body;
  if (!host) return;
  host.appendChild(style);
}
