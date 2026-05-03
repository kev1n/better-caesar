import {
  NOTES_CELL_CLASS,
  NOTES_HEADER_CLASS,
  SEATS_CELL_CLASS,
  SEATS_HEADER_CLASS,
  STYLE_ID
} from "./constants";
import type { RowCells, SeatsNotesResult, SeatsNotesSuccess } from "./types";

const TIMESTAMP_REFRESH_INTERVAL_MS = 30_000;
let timestampRefreshTimer: number | null = null;

export function ensureCustomHeaders(table: HTMLTableElement): void {
  const headerRow = table.querySelector("tr");
  if (!headerRow) return;

  if (!headerRow.querySelector(`.${SEATS_HEADER_CLASS}`)) {
    const seatsHeader = document.createElement("th");
    seatsHeader.scope = "col";
    seatsHeader.className = `PSLEVEL1GRIDCOLUMNHDR ${SEATS_HEADER_CLASS}`;
    seatsHeader.textContent = "Seats";
    headerRow.appendChild(seatsHeader);
  }

  if (!headerRow.querySelector(`.${NOTES_HEADER_CLASS}`)) {
    const notesHeader = document.createElement("th");
    notesHeader.scope = "col";
    notesHeader.className = `PSLEVEL1GRIDCOLUMNHDR ${NOTES_HEADER_CLASS}`;
    notesHeader.textContent = "Notes";
    headerRow.appendChild(notesHeader);
  }
}

export function ensureCustomCells(row: HTMLTableRowElement): RowCells {
  return {
    seatsCell: ensureCustomCell(row, SEATS_CELL_CLASS),
    notesCell: ensureCustomCell(row, NOTES_CELL_CLASS)
  };
}

export function renderIdle(cells: RowCells, classNumber: string, onLoad: () => void): void {
  cells.seatsCell.dataset.classNumber = classNumber;
  cells.notesCell.dataset.classNumber = classNumber;
  cells.seatsCell.dataset.bcState = "idle";
  cells.notesCell.dataset.bcState = "idle";

  clearChildren(cells.seatsCell);
  clearChildren(cells.notesCell);

  const wrap = document.createElement("div");
  wrap.className = "better-caesar-idle";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "better-caesar-load-btn";
  button.textContent = "Load seats & notes";
  button.addEventListener("click", () => {
    onLoad();
  });
  wrap.appendChild(button);

  cells.seatsCell.appendChild(wrap);

  const dash = document.createElement("div");
  dash.className = "better-caesar-muted";
  dash.textContent = "—";
  cells.notesCell.appendChild(dash);
}

export function renderLoading(cells: RowCells, classNumber: string): void {
  cells.seatsCell.dataset.classNumber = classNumber;
  cells.notesCell.dataset.classNumber = classNumber;
  cells.seatsCell.dataset.bcState = "loading";
  cells.notesCell.dataset.bcState = "loading";
  cells.seatsCell.textContent = "Loading seats…";
  cells.notesCell.textContent = "Loading notes…";
}

export function renderLoaded(
  cells: RowCells,
  result: SeatsNotesResult,
  fetchedAt: number,
  classNumber: string,
  onRefresh: () => void
): void {
  cells.seatsCell.dataset.classNumber = classNumber;
  cells.notesCell.dataset.classNumber = classNumber;
  cells.seatsCell.dataset.bcState = "loaded";
  cells.notesCell.dataset.bcState = "loaded";

  clearChildren(cells.seatsCell);
  clearChildren(cells.notesCell);

  const meta = buildMetaBar(fetchedAt, onRefresh);
  cells.seatsCell.appendChild(meta);

  if (!result.ok) {
    cells.seatsCell.appendChild(buildError(`Unavailable: ${result.error}`));
    cells.notesCell.appendChild(buildError("No notes available."));
    return;
  }

  cells.seatsCell.appendChild(buildSeatsCard(result));
  cells.notesCell.appendChild(buildNotesCard(result, classNumber));

  ensureTimestampRefresh();
}

export function getCellState(cells: RowCells): string | undefined {
  return cells.seatsCell.dataset.bcState;
}

export function removeAllInjectedDom(doc: Document = document): void {
  const selectors = [
    `.${SEATS_HEADER_CLASS}`,
    `.${NOTES_HEADER_CLASS}`,
    `.${SEATS_CELL_CLASS}`,
    `.${NOTES_CELL_CLASS}`,
    `#${STYLE_ID}`
  ];
  for (const selector of selectors) {
    for (const el of Array.from(doc.querySelectorAll(selector))) {
      el.remove();
    }
  }
}

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${SEATS_HEADER_CLASS},
    .${NOTES_HEADER_CLASS} {
      min-width: 220px;
      color: var(--bc-color-accent-on);
      background: var(--bc-color-accent);
      border-color: var(--bc-color-accent-pressed);
    }
    .${SEATS_CELL_CLASS},
    .${NOTES_CELL_CLASS} {
      min-width: 220px;
      width: 220px;
      max-width: 320px;
      padding: 4px 6px;
      border-left: 2px solid var(--bc-color-accent-mid-border);
      vertical-align: top;
      overflow: hidden;
      box-sizing: border-box;
    }
    .better-caesar-idle {
      display: grid;
      gap: 6px;
      padding: 8px 4px;
    }
    .better-caesar-load-btn {
      padding: 6px 10px;
      font: var(--bc-fw-semibold) var(--bc-font-11)/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: 0.3px;
      cursor: pointer;
      border: 1px solid var(--bc-color-accent);
      background: var(--bc-color-bg);
      color: var(--bc-color-accent);
      border-radius: var(--bc-radius-sm);
    }
    .better-caesar-load-btn:hover { background: var(--bc-color-accent); color: var(--bc-color-accent-on); }
    .better-caesar-load-btn:disabled { opacity: 0.6; cursor: default; }
    .better-caesar-load-btn:disabled:hover { background: var(--bc-color-bg); color: var(--bc-color-accent); }
    .better-caesar-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 4px;
      font-size: var(--bc-font-10);
      color: var(--bc-color-accent);
    }
    .better-caesar-meta-time {
      font-weight: var(--bc-fw-semibold);
      letter-spacing: 0.2px;
    }
    .better-caesar-refresh-btn {
      padding: 2px 6px;
      font: var(--bc-fw-semibold) var(--bc-font-10)/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      cursor: pointer;
      border: 1px solid var(--bc-color-accent);
      background: var(--bc-color-bg);
      color: var(--bc-color-accent);
      border-radius: var(--bc-radius-xs);
    }
    .better-caesar-refresh-btn:hover { background: var(--bc-color-accent); color: var(--bc-color-accent-on); }
    .better-caesar-refresh-btn:disabled { opacity: 0.6; cursor: default; }
    .better-caesar-refresh-btn:disabled:hover { background: var(--bc-color-bg); color: var(--bc-color-accent); }
    .better-caesar-hint {
      font-size: var(--bc-font-10);
    }
    .better-caesar-card {
      display: grid;
      gap: 6px;
      padding: 8px;
      border-radius: var(--bc-radius-lg);
      border: 1px solid var(--bc-color-accent-mid-border);
      background: var(--bc-color-accent-surface-tile);
      color: var(--bc-color-accent-pressed);
      font-size: var(--bc-font-11);
      line-height: 1.35;
      width: 100%;
      min-width: 0;
      overflow: hidden;
      box-sizing: border-box;
    }
    .better-caesar-pill {
      display: inline-block;
      justify-self: start;
      padding: 2px 8px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid transparent;
      font-weight: var(--bc-fw-bold);
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .better-caesar-lines {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .better-caesar-line {
      font-size: var(--bc-font-11);
      color: var(--bc-color-accent-pressed);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .better-caesar-note {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .better-caesar-note-label {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      text-transform: uppercase;
      letter-spacing: 0.25px;
      color: var(--bc-color-accent);
    }
    .better-caesar-note-text {
      color: var(--bc-color-accent-pressed);
      overflow-wrap: anywhere;
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
    }
    .better-caesar-warning {
      color: var(--bc-color-seat-warn-row-text);
      border-top: 1px dashed var(--bc-color-seat-warn-row-border);
      padding-top: 4px;
      font-weight: var(--bc-fw-semibold);
    }
    .better-caesar-muted {
      color: var(--bc-color-seat-muted-text);
    }
    .better-caesar-error {
      color: var(--bc-color-seat-error-text);
      font-size: var(--bc-font-11);
      padding: 4px 0;
    }
  `;
  const host = document.head ?? document.documentElement ?? document.body;
  if (!host) return;
  host.appendChild(style);
}

function buildMetaBar(fetchedAt: number, onRefresh: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "better-caesar-meta";

  const time = document.createElement("span");
  time.className = "better-caesar-meta-time";
  time.dataset.bcFetchedAt = String(fetchedAt);
  time.textContent = `Loaded ${formatRelativeTime(Date.now() - fetchedAt)}`;
  bar.appendChild(time);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "better-caesar-refresh-btn";
  button.textContent = "↻ Refresh";
  button.addEventListener("click", () => {
    onRefresh();
  });
  bar.appendChild(button);

  return bar;
}

function buildSeatsCard(response: SeatsNotesSuccess): HTMLElement {
  const card = document.createElement("div");
  card.className = "better-caesar-card";

  const primary = document.createElement("div");
  primary.className = "better-caesar-pill";
  const primaryLine = buildPrimarySeatsLine(response) ?? "Seat counts unavailable";
  primary.textContent = primaryLine;
  primary.title = primaryLine;
  applySeatsTone(primary, response);
  card.appendChild(primary);

  const details = document.createElement("div");
  details.className = "better-caesar-lines";
  appendLine(details, "Open seats", response.availableSeats ? `${response.availableSeats}` : null);
  appendLine(
    details,
    "Waitlist",
    response.waitListTotal && response.waitListCapacity
      ? `${response.waitListTotal}/${response.waitListCapacity}`
      : null
  );
  card.appendChild(details);

  return card;
}

function buildNotesCard(response: SeatsNotesSuccess, classNumber: string): HTMLElement {
  const card = document.createElement("div");
  card.className = "better-caesar-card";

  appendNote(card, "Class Attributes", response.classAttributes);
  appendNote(card, "Enrollment Requirements", response.enrollmentRequirements);
  appendNote(card, "Class Notes", response.classNotes);

  if (!response.classAttributes && !response.enrollmentRequirements && !response.classNotes) {
    const empty = document.createElement("div");
    empty.className = "better-caesar-muted";
    empty.textContent = "No notes listed.";
    card.appendChild(empty);
  }

  if (response.criteriaClassNumber && response.criteriaClassNumber !== classNumber) {
    const mismatch = document.createElement("div");
    mismatch.className = "better-caesar-warning";
    mismatch.textContent = `Criteria mismatch: ${response.criteriaClassNumber}`;
    card.appendChild(mismatch);
  }

  return card;
}

function buildPrimarySeatsLine(response: SeatsNotesSuccess): string | null {
  if (response.enrollmentTotal && response.classCapacity) {
    return `${response.enrollmentTotal}/${response.classCapacity} enrolled`;
  }
  if (response.availableSeats) {
    return `${response.availableSeats} seats open`;
  }
  return null;
}

function appendLine(container: HTMLElement, label: string, value: string | null): void {
  if (!value) return;
  const line = document.createElement("div");
  line.className = "better-caesar-line";
  const text = `${label}: ${value}`;
  line.textContent = text;
  line.title = text;
  container.appendChild(line);
}

function appendNote(container: HTMLElement, label: string, value: string | null): void {
  if (!value) return;
  const block = document.createElement("div");
  block.className = "better-caesar-note";

  const labelEl = document.createElement("div");
  labelEl.className = "better-caesar-note-label";
  labelEl.textContent = label;

  const textEl = document.createElement("div");
  textEl.className = "better-caesar-note-text";
  textEl.textContent = value;
  textEl.title = value;

  block.appendChild(labelEl);
  block.appendChild(textEl);
  container.appendChild(block);
}

function applySeatsTone(element: HTMLElement, response: SeatsNotesSuccess): void {
  const tone = getSeatsTone(response);
  element.style.background = tone.background;
  element.style.borderColor = tone.border;
  element.style.color = tone.ink;
}

function getSeatsTone(response: SeatsNotesSuccess): {
  background: string;
  border: string;
  ink: string;
} {
  const classCapacity = toNumber(response.classCapacity);
  const enrollmentTotal = toNumber(response.enrollmentTotal);
  const availableSeats = toNumber(response.availableSeats);
  const waitListTotal = toNumber(response.waitListTotal);

  if (classCapacity !== null) {
    if ((availableSeats !== null && availableSeats <= 0) || (enrollmentTotal !== null && enrollmentTotal >= classCapacity)) {
      return {
        background: "var(--bc-color-seat-full-bg)",
        border: "var(--bc-color-seat-full-border)",
        ink: "var(--bc-color-seat-full-ink)"
      };
    }

    if (enrollmentTotal !== null) {
      const occupancy = Math.min(Math.max(enrollmentTotal / classCapacity, 0), 1.2);
      return occupancyToTone(occupancy);
    }

    if (availableSeats !== null) {
      const occupancy = Math.min(Math.max((classCapacity - availableSeats) / classCapacity, 0), 1.2);
      return occupancyToTone(occupancy);
    }
  }

  if (waitListTotal !== null && waitListTotal > 0) {
    return {
      background: "var(--bc-color-seat-waitlist-bg)",
      border: "var(--bc-color-seat-waitlist-border)",
      ink: "var(--bc-color-seat-waitlist-ink)"
    };
  }

  return {
    background: "var(--bc-color-seat-info-bg)",
    border: "var(--bc-color-seat-info-border)",
    ink: "var(--bc-color-seat-info-ink)"
  };
}

function occupancyToTone(occupancy: number): {
  background: string;
  border: string;
  ink: string;
} {
  if (occupancy >= 0.95) {
    return {
      background: "var(--bc-color-seat-full-bg)",
      border: "var(--bc-color-seat-full-border)",
      ink: "var(--bc-color-seat-full-ink)"
    };
  }
  if (occupancy >= 0.8) {
    return {
      background: "var(--bc-color-seat-warn-bg)",
      border: "var(--bc-color-seat-warn-border)",
      ink: "var(--bc-color-seat-warn-ink)"
    };
  }
  if (occupancy >= 0.6) {
    return {
      background: "var(--bc-color-seat-tight-bg)",
      border: "var(--bc-color-seat-tight-border)",
      ink: "var(--bc-color-seat-tight-ink)"
    };
  }
  if (occupancy >= 0.35) {
    return {
      background: "var(--bc-color-seat-room-bg)",
      border: "var(--bc-color-seat-room-border)",
      ink: "var(--bc-color-seat-room-ink)"
    };
  }
  return {
    background: "var(--bc-color-seat-open-bg)",
    border: "var(--bc-color-seat-open-border)",
    ink: "var(--bc-color-seat-open-ink)"
  };
}

function toNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildError(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "better-caesar-error";
  el.textContent = text;
  return el;
}

function ensureCustomCell(row: HTMLTableRowElement, customClass: string): HTMLTableCellElement {
  const existing = row.querySelector<HTMLTableCellElement>(`.${customClass}`);
  if (existing) return existing;

  const td = document.createElement("td");
  const rowClass = row.querySelector("td,th")?.className ?? "";
  td.className = `${rowClass} ${customClass}`.trim();
  td.style.verticalAlign = "top";
  row.appendChild(td);
  return td;
}

function clearChildren(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function ensureTimestampRefresh(): void {
  if (timestampRefreshTimer !== null) return;
  timestampRefreshTimer = window.setInterval(() => {
    const now = Date.now();
    document.querySelectorAll<HTMLElement>("[data-bc-fetched-at]").forEach((el) => {
      const ts = Number(el.dataset.bcFetchedAt);
      if (!Number.isFinite(ts)) return;
      el.textContent = `Loaded ${formatRelativeTime(now - ts)}`;
    });
  }, TIMESTAMP_REFRESH_INTERVAL_MS);
}

function formatRelativeTime(deltaMs: number): string {
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
