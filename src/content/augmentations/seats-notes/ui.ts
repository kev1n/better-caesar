import {
  NOTES_CELL_CLASS,
  NOTES_HEADER_CLASS,
  SEATS_CELL_CLASS,
  SEATS_HEADER_CLASS,
  STYLE_ID
} from "./constants";
import type { RowCells, SeatsNotesResult, SeatsNotesSuccess } from "./types";

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

export function renderMetadata(response: SeatsNotesResult, classNumber: string, cells: RowCells): void {
  cells.seatsCell.textContent = "";
  cells.notesCell.textContent = "";

  if (!response.ok) {
    cells.seatsCell.appendChild(buildError(`Unavailable: ${response.error}`));
    cells.notesCell.appendChild(buildError("No notes available."));
    return;
  }

  cells.seatsCell.appendChild(buildSeatsCard(response));
  cells.notesCell.appendChild(buildNotesCard(response, classNumber));
}

export function markCellsLoading(cells: RowCells, classNumber: string): void {
  cells.seatsCell.dataset.classNumber = classNumber;
  cells.notesCell.dataset.classNumber = classNumber;
  cells.seatsCell.dataset.loaded = "0";
  cells.notesCell.dataset.loaded = "0";
  cells.seatsCell.textContent = "Loading seats...";
  cells.notesCell.textContent = "Loading notes...";
}

export function markCellsLoaded(cells: RowCells): void {
  cells.seatsCell.dataset.loaded = "1";
  cells.notesCell.dataset.loaded = "1";
}

export function isCellsLoaded(cells: RowCells, classNumber: string): boolean {
  return (
    cells.seatsCell.dataset.classNumber === classNumber &&
    cells.seatsCell.dataset.loaded === "1" &&
    cells.notesCell.dataset.loaded === "1"
  );
}

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --bc-tyrian: #66023c;
      --bc-tyrian-soft: #f6ecf2;
      --bc-tyrian-mid: #d8b6c8;
      --bc-tyrian-ink: #3f0126;
      --bc-good-bg: #e8f5e9;
      --bc-good-ink: #1b5e20;
    }
    .${SEATS_HEADER_CLASS},
    .${NOTES_HEADER_CLASS} {
      min-width: 220px;
      color: #fff;
      background: var(--bc-tyrian);
      border-color: var(--bc-tyrian-ink);
    }
    .${SEATS_CELL_CLASS},
    .${NOTES_CELL_CLASS} {
      min-width: 220px;
      max-width: 420px;
      padding: 4px 6px;
      border-left: 2px solid var(--bc-tyrian-mid);
      vertical-align: top;
    }
    .better-caeser-card {
      display: grid;
      gap: 6px;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid var(--bc-tyrian-mid);
      background: var(--bc-tyrian-soft);
      color: var(--bc-tyrian-ink);
      font-size: 11px;
      line-height: 1.35;
    }
    .better-caeser-pill {
      display: inline-block;
      justify-self: start;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--bc-good-bg);
      color: var(--bc-good-ink);
      font-weight: 700;
    }
    .better-caeser-lines {
      display: grid;
      gap: 2px;
    }
    .better-caeser-line {
      font-size: 11px;
      color: var(--bc-tyrian-ink);
    }
    .better-caeser-note {
      display: grid;
      gap: 2px;
    }
    .better-caeser-note-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.25px;
      color: var(--bc-tyrian);
    }
    .better-caeser-note-text {
      color: var(--bc-tyrian-ink);
      overflow-wrap: anywhere;
    }
    .better-caeser-warning {
      color: #8a2e00;
      border-top: 1px dashed #d99a66;
      padding-top: 4px;
      font-weight: 600;
    }
    .better-caeser-muted {
      color: #5c4c56;
    }
    .better-caeser-error {
      color: #7a123f;
      font-size: 11px;
      padding: 4px 0;
    }
  `;
  document.head.appendChild(style);
}

function buildSeatsCard(response: SeatsNotesSuccess): HTMLElement {
  const card = document.createElement("div");
  card.className = "better-caeser-card";

  const primary = document.createElement("div");
  primary.className = "better-caeser-pill";
  primary.textContent = buildPrimarySeatsLine(response) ?? "Seat counts unavailable";
  card.appendChild(primary);

  const details = document.createElement("div");
  details.className = "better-caeser-lines";
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
  card.className = "better-caeser-card";

  appendNote(card, "Enrollment Information", response.enrollmentInfoNotes);
  appendNote(card, "Class Notes", response.classNotes);

  if (!response.enrollmentInfoNotes && !response.classNotes) {
    const empty = document.createElement("div");
    empty.className = "better-caeser-muted";
    empty.textContent = "No notes listed.";
    card.appendChild(empty);
  }

  if (response.criteriaClassNumber && response.criteriaClassNumber !== classNumber) {
    const mismatch = document.createElement("div");
    mismatch.className = "better-caeser-warning";
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
  line.className = "better-caeser-line";
  line.textContent = `${label}: ${value}`;
  container.appendChild(line);
}

function appendNote(container: HTMLElement, label: string, value: string | null): void {
  if (!value) return;
  const block = document.createElement("div");
  block.className = "better-caeser-note";

  const labelEl = document.createElement("div");
  labelEl.className = "better-caeser-note-label";
  labelEl.textContent = label;

  const textEl = document.createElement("div");
  textEl.className = "better-caeser-note-text";
  textEl.textContent = value;

  block.appendChild(labelEl);
  block.appendChild(textEl);
  container.appendChild(block);
}

function buildError(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "better-caeser-error";
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
