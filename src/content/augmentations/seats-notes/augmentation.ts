import { TemplateAugmentation } from "../../framework";
import { isRetryablePeopleSoftTaskError, lookupClass } from "../../peoplesoft";
import { ensureActionBar } from "../action-bar";
import { CLASS_LINK_SELECTOR, NOTES_CELL_CLASS, SEATS_CELL_CLASS } from "./constants";
import { extractCareerHint, extractClassNumber, queryTargetTables } from "./helpers";
import { toFailure, toSeatsNotesResult } from "./parser";
import type { RowTarget, SeatsNotesResult } from "./types";
import {
  ensureCustomCells,
  ensureCustomHeaders,
  findExistingCells,
  injectStyles,
  isCellsLoaded,
  markCellsLoaded,
  markCellsLoading,
  renderMetadata
} from "./ui";

const RELOAD_BTN_ID = "bc-seats-reload-btn";

export class SeatsNotesAugmentation extends TemplateAugmentation<RowTarget, SeatsNotesResult> {
  private runOnce = false;

  constructor() {
    super("seats-notes");
  }

  override run(doc: Document = document): void {
    super.run(doc);
    this.runOnce = false;
  }

  protected beforeRun(doc: Document): void {
    injectStyles();
    this.ensureReloadButton(doc);
  }

  protected appliesToPage(): boolean {
    return queryTargetTables().length > 0;
  }

  protected collectTargets(): RowTarget[] {
    const targets: RowTarget[] = [];
    const tables = queryTargetTables();

    for (const table of tables) {
      // Only inject headers and create cells when actively loading.
      if (this.runOnce) ensureCustomHeaders(table);

      const rows = table.querySelectorAll<HTMLTableRowElement>("tr[bufnum]");

      for (const row of Array.from(rows)) {
        const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
        if (!link) continue;

        const classNumber = extractClassNumber(link.textContent ?? "");
        if (!classNumber) continue;

        const cells = this.runOnce ? ensureCustomCells(row) : findExistingCells(row);
        if (!cells) continue;

        targets.push({
          classNumber,
          careerHint: extractCareerHint(link.textContent ?? ""),
          cells
        });
      }
    }

    return targets;
  }

  protected targetKey(target: RowTarget): string {
    return `${target.classNumber}:${target.careerHint ?? "AUTO"}`;
  }

  protected shouldProcessTarget(target: RowTarget): boolean {
    return this.runOnce && !isCellsLoaded(target.cells, target.classNumber);
  }

  protected markLoading(target: RowTarget): void {
    markCellsLoading(target.cells, target.classNumber);
  }

  protected async fetchData(target: RowTarget): Promise<SeatsNotesResult> {
    try {
      const lookupResponse = await lookupClass(
        {
          type: "lookup-class",
          classNumber: target.classNumber,
          careerHint: target.careerHint
        },
        {
          priority: "background",
          owner: "seats-notes"
        }
      );

      return toSeatsNotesResult(lookupResponse);
    } catch (error) {
      if (isRetryablePeopleSoftTaskError(error)) {
        throw error;
      }

      return toFailure(error);
    }
  }

  protected renderSuccess(target: RowTarget, data: SeatsNotesResult): void {
    renderMetadata(data, target.classNumber, target.cells);
  }

  protected renderError(target: RowTarget, error: Error): void {
    renderMetadata({ ok: false, error: error.message }, target.classNumber, target.cells);
  }

  protected markLoaded(target: RowTarget): void {
    markCellsLoaded(target.cells);
  }

  private ensureReloadButton(doc: Document): void {
    let btn = doc.getElementById(RELOAD_BTN_ID) as HTMLButtonElement | null;

    if (!btn) {
      const bar = ensureActionBar(doc);
      if (!bar) return;

      btn = doc.createElement("button");
      btn.type = "button";
      btn.id = RELOAD_BTN_ID;
      btn.className = "bc-action-btn";
      btn.addEventListener("click", () => { this.reloadAll(doc, btn!); });
      bar.appendChild(btn);
    }

    if (!btn.disabled) {
      const anyLoaded = this.collectTargets().some((t) =>
        isCellsLoaded(t.cells, t.classNumber)
      );
      btn.textContent = anyLoaded ? "Reload Seats & Notes" : "Load Seats & Notes";
    }
  }

  private reloadAll(doc: Document, btn: HTMLButtonElement): void {
    btn.disabled = true;

    for (const table of queryTargetTables()) {
      for (const row of Array.from(table.querySelectorAll<HTMLTableRowElement>("tr[bufnum]"))) {
        const seatsCell = row.querySelector<HTMLElement>(`.${SEATS_CELL_CLASS}`);
        const notesCell = row.querySelector<HTMLElement>(`.${NOTES_CELL_CLASS}`);
        if (seatsCell) seatsCell.dataset.loaded = "0";
        if (notesCell) notesCell.dataset.loaded = "0";
      }
    }

    this.clearCache();
    this.runOnce = true;
    this.run(doc);

    btn.textContent = "Reload Seats & Notes";
    btn.disabled = false;
  }
}
