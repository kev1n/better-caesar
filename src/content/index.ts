import type { LookupClassMessage, LookupClassResponse, LookupClassSuccess } from "../shared/messages";
import { lookupClass } from "./peopleSoft";

const CLASS_LINK_SELECTOR = "a[id^='P_CLASS_NAME$'], a[id^='E_CLASS_NAME$']";
const GRID_TABLE_SELECTORS = [
  "#SSR_REGFORM_VW\\$scroll\\$0 table.PSLEVEL1GRID",
  "#STDNT_ENRL_SSVW\\$scroll\\$0 table.PSLEVEL1GRID"
];
const SEATS_HEADER_CLASS = "better-caeser-seats-header";
const NOTES_HEADER_CLASS = "better-caeser-notes-header";
const SEATS_CELL_CLASS = "better-caeser-seats-cell";
const NOTES_CELL_CLASS = "better-caeser-notes-cell";
const STYLE_ID = "better-caeser-style";
const lookupCache = new Map<string, Promise<LookupClassResponse>>();
let queueTail: Promise<void> = Promise.resolve();

chrome.runtime.onMessage.addListener(
  (message: LookupClassMessage, _sender, sendResponse: (response: LookupClassResponse) => void) => {
    if (!message || message.type !== "lookup-class") return;

    void lookupClass(message)
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : "Unknown error.";
        sendResponse({ ok: false, error: text });
      });

    return true;
  }
);

bootstrapRowMetadata();

function bootstrapRowMetadata(): void {
  injectStyles();
  enhanceAllRows();
  observeGridMutations();
}

function observeGridMutations(): void {
  const root = document.body ?? document.documentElement;
  if (!root) return;

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceAllRows();
    });
  });
  observer.observe(root, { childList: true, subtree: true });
}

function enhanceAllRows(): void {
  const tables = queryTargetTables();
  for (const table of tables) {
    ensureCustomHeaders(table);
    const rows = table.querySelectorAll<HTMLTableRowElement>("tr[bufnum]");
    for (const row of Array.from(rows)) {
      const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
      if (!link) continue;

      const classNumber = extractClassNumber(link.textContent ?? "");
      if (!classNumber) continue;
      const careerHint = extractCareerHint(link.textContent ?? "");

      const seatsCell = ensureCustomCell(row, SEATS_CELL_CLASS);
      const notesCell = ensureCustomCell(row, NOTES_CELL_CLASS);
      const loaded =
        seatsCell.dataset.classNumber === classNumber &&
        seatsCell.dataset.loaded === "1" &&
        notesCell.dataset.loaded === "1";
      if (loaded) continue;

      seatsCell.dataset.classNumber = classNumber;
      notesCell.dataset.classNumber = classNumber;
      seatsCell.dataset.loaded = "0";
      notesCell.dataset.loaded = "0";
      seatsCell.textContent = "Loading seats...";
      notesCell.textContent = "Loading notes...";

      void hydrateClassMetadata(classNumber, careerHint, seatsCell, notesCell);
    }
  }
}

function queryTargetTables(): HTMLTableElement[] {
  const tables: HTMLTableElement[] = [];
  for (const selector of GRID_TABLE_SELECTORS) {
    const table = document.querySelector<HTMLTableElement>(selector);
    if (!table) continue;
    tables.push(table);
  }
  return tables;
}

async function hydrateClassMetadata(
  classNumber: string,
  careerHint: "UGRD" | "TGS" | undefined,
  seatsCell: HTMLElement,
  notesCell: HTMLElement
): Promise<void> {
  const cacheKey = `${classNumber}:${careerHint ?? "AUTO"}`;
  const responsePromise = lookupCache.get(cacheKey) ?? enqueueLookup(classNumber, careerHint);
  lookupCache.set(cacheKey, responsePromise);

  const response = await responsePromise;
  renderMetadata(response, classNumber, seatsCell, notesCell);
  seatsCell.dataset.loaded = "1";
  notesCell.dataset.loaded = "1";
}

function enqueueLookup(
  classNumber: string,
  careerHint: "UGRD" | "TGS" | undefined
): Promise<LookupClassResponse> {
  const job = queueTail.then(async () =>
    lookupClass({ type: "lookup-class", classNumber, careerHint }).catch((error: unknown) => {
      const text = error instanceof Error ? error.message : "Unknown error.";
      return { ok: false, error: text } satisfies LookupClassResponse;
    })
  );

  queueTail = job.then(
    () => undefined,
    () => undefined
  );

  return job;
}

function extractCareerHint(text: string): "UGRD" | "TGS" | undefined {
  const catalog = text.match(/\b(\d{3})-\d\b/)?.[1];
  if (!catalog) return undefined;
  const value = Number(catalog);
  if (!Number.isFinite(value)) return undefined;
  return value >= 400 ? "TGS" : "UGRD";
}

function renderMetadata(
  response: LookupClassResponse,
  classNumber: string,
  seatsCell: HTMLElement,
  notesCell: HTMLElement
): void {
  seatsCell.textContent = "";
  notesCell.textContent = "";

  if (!response.ok) {
    seatsCell.appendChild(buildError(`Unavailable: ${response.error}`));
    notesCell.appendChild(buildError("No notes available."));
    return;
  }

  seatsCell.appendChild(buildSeatsCard(response));
  notesCell.appendChild(buildNotesCard(response, classNumber));
}

function buildSeatsCard(response: LookupClassSuccess): HTMLElement {
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

function buildNotesCard(response: LookupClassSuccess, classNumber: string): HTMLElement {
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

function buildPrimarySeatsLine(response: LookupClassSuccess): string | null {
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

function extractClassNumber(rawText: string): string | null {
  const match = rawText.match(/\((\d{4,10})\)/);
  if (match) return match[1];
  const digits = rawText.replace(/\D+/g, "");
  return digits.length >= 4 ? digits : null;
}

function ensureCustomHeaders(table: HTMLTableElement): void {
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

function injectStyles(): void {
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
