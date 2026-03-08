import { TemplateAugmentation } from "../../framework";
import { isRetryablePeopleSoftTaskError, lookupClass } from "../../peoplesoft";
import { CLASS_LINK_SELECTOR } from "./constants";
import { extractCareerHint, extractClassNumber, queryTargetTables } from "./helpers";
import { toFailure, toSeatsNotesResult } from "./parser";
import type { RowTarget, SeatsNotesResult } from "./types";
import {
  ensureCustomCells,
  ensureCustomHeaders,
  injectStyles,
  isCellsLoaded,
  markCellsLoaded,
  markCellsLoading,
  renderMetadata
} from "./ui";

export class SeatsNotesAugmentation extends TemplateAugmentation<RowTarget, SeatsNotesResult> {
  constructor() {
    super("seats-notes");
  }

  protected beforeRun(): void {
    injectStyles();
  }

  protected appliesToPage(): boolean {
    return queryTargetTables().length > 0;
  }

  protected collectTargets(): RowTarget[] {
    const targets: RowTarget[] = [];
    const tables = queryTargetTables();

    for (const table of tables) {
      ensureCustomHeaders(table);
      const rows = table.querySelectorAll<HTMLTableRowElement>("tr[bufnum]");

      for (const row of Array.from(rows)) {
        const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
        if (!link) continue;

        const classNumber = extractClassNumber(link.textContent ?? "");
        if (!classNumber) continue;

        targets.push({
          classNumber,
          careerHint: extractCareerHint(link.textContent ?? ""),
          cells: ensureCustomCells(row)
        });
      }
    }

    return targets;
  }

  protected targetKey(target: RowTarget): string {
    return `${target.classNumber}:${target.careerHint ?? "AUTO"}`;
  }

  protected shouldProcessTarget(target: RowTarget): boolean {
    return !isCellsLoaded(target.cells, target.classNumber);
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
}
