import type { Augmentation } from "../../framework";
import { isRetryablePeopleSoftTaskError } from "../../peoplesoft";
import { extractClassNumber } from "../seats-notes/helpers";
import { ensureActionBar } from "../action-bar";
import { CLASS_LINK_SELECTOR, CLASS_ROW_SELECTOR, PAGE_ID } from "./constants";
import { clearCtecCacheForCourse, fetchCtecLinks, fetchCtecLinksBackground, getCtecLinksFromCache } from "./fetcher";
import { extractInstructorFromRow, extractSubjectAndCatalog } from "./helpers";
import type { CtecLinkData, CtecLinkTarget } from "./types";
import {
  ensureCtecCell,
  ensureCtecHeader,
  injectStyles,
  isCtecCellDone,
  isCtecCellReady,
  markCtecCellDone,
  markCtecCellReady,
  renderCtecLinksWidget,
  renderFetchButton,
  renderLoading
} from "./ui";

const LOAD_ALL_BTN_ID = "bc-ctec-load-all-btn";

export class CtecLinksAugmentation implements Augmentation {
  readonly id = "ctec-links";

  private readonly inFlight = new Set<string>();

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;
    injectStyles();
    this.ensureLoadAllButton(doc);

    for (const target of this.collectTargets(doc)) {
      const key = this.targetKey(target);
      if (this.inFlight.has(key)) continue;
      if (isCtecCellDone(target.container)) continue;
      if (isCtecCellReady(target.container)) continue;
      markCtecCellReady(target.container);

      const cached = getCtecLinksFromCache(target.params);
      if (cached) {
        renderCtecLinksWidget(target.container, cached, () => this.kick(target, key));
        markCtecCellDone(target.container);
      } else {
        renderFetchButton(target.container, () => this.kick(target, key));
      }
    }
  }

  private appliesToPage(doc: Document): boolean {
    const pageId = doc
      .querySelector<HTMLElement>("#pt_pageinfo_win0")
      ?.getAttribute("Page");
    return pageId === PAGE_ID;
  }

  private collectTargets(doc: Document): CtecLinkTarget[] {
    const targets: CtecLinkTarget[] = [];
    const seenTables = new Set<HTMLTableElement>();

    for (const row of Array.from(
      doc.querySelectorAll<HTMLTableRowElement>(CLASS_ROW_SELECTOR)
    )) {
      const table = row.closest<HTMLTableElement>("table");
      if (table && !seenTables.has(table)) {
        ensureCtecHeader(table);
        seenTables.add(table);
      }

      const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
      if (!link) continue;

      const linkText = link.textContent ?? "";
      const parsed = extractSubjectAndCatalog(linkText);
      if (!parsed) continue;

      const catalogNum = parseInt(parsed.catalogNumber, 10);
      const career: "UGRD" | "TGS" = catalogNum >= 500 ? "TGS" : "UGRD";

      targets.push({
        row,
        params: {
          classNumber: extractClassNumber(linkText) ?? "",
          subject: parsed.subject,
          catalogNumber: parsed.catalogNumber,
          instructor: extractInstructorFromRow(row),
          career
        },
        container: ensureCtecCell(row)
      });
    }

    return targets;
  }

  private targetKey(target: CtecLinkTarget): string {
    const { subject, catalogNumber, instructor } = target.params;
    return `${subject}:${catalogNumber}:${instructor.toLowerCase().trim()}`;
  }

  private ensureLoadAllButton(doc: Document): void {
    let btn = doc.getElementById(LOAD_ALL_BTN_ID) as HTMLButtonElement | null;

    if (!btn) {
      const bar = ensureActionBar(doc);
      if (!bar) return;

      btn = doc.createElement("button");
      btn.type = "button";
      btn.id = LOAD_ALL_BTN_ID;
      btn.className = "bc-action-btn";
      btn.addEventListener("click", () => { this.loadAll(btn!); });
      bar.prepend(btn);
    }

    if (!btn.disabled) {
      const anyDone = this.collectTargets(doc).some((t) => isCtecCellDone(t.container));
      btn.textContent = anyDone ? "Reload all CTECs" : "Load all CTECs";
    }
  }

  private loadAll(btn: HTMLButtonElement): void {
    const allTargets = this.collectTargets(document);
    const isReload = allTargets.some((t) => isCtecCellDone(t.container));

    if (isReload) {
      for (const t of allTargets) {
        // Clear DOM state and cached entries so the fetcher hits the network.
        delete t.container.dataset.ctecDone;
        clearCtecCacheForCourse(t.params.subject, t.params.catalogNumber, t.params.instructor);
      }
    }

    const pending = allTargets.filter((t) => !this.inFlight.has(this.targetKey(t)));

    if (pending.length === 0) {
      btn.textContent = isReload ? "Reload all CTECs" : "Load all CTECs";
      return;
    }

    btn.disabled = true;
    let completed = 0;
    const total = pending.length;
    btn.textContent = `Loading 0/${total}\u2026`;

    const onComplete = () => {
      completed++;
      if (completed >= total) {
        const stillAnyDone = this.collectTargets(document).some((t) =>
          isCtecCellDone(t.container)
        );
        btn.textContent = stillAnyDone ? "Reload all CTECs" : "Load all CTECs";
        btn.disabled = false;
      } else {
        btn.textContent = `Loading ${completed}/${total}\u2026`;
      }
    };

    for (const target of pending) {
      const key = this.targetKey(target);
      this.inFlight.add(key);
      renderLoading(target.container, "Loading CTEC\u2026 (may take a moment)");

      void fetchCtecLinksBackground(
        target.params,
        isReload,
        (msg) => { renderLoading(target.container, msg); }
      )
        .then((data: CtecLinkData) => {
          this.inFlight.delete(key);
          renderCtecLinksWidget(target.container, data, () => this.kick(target, key));
          if (data.state === "found" || data.state === "not-found") {
            markCtecCellDone(target.container);
          }
        })
        .catch((err: unknown) => {
          this.inFlight.delete(key);
          if (isRetryablePeopleSoftTaskError(err)) {
            renderFetchButton(target.container, () => this.kick(target, key));
          } else {
            renderCtecLinksWidget(
              target.container,
              {
                state: "error",
                message: err instanceof Error ? err.message : "Unknown error"
              },
              () => this.kick(target, key)
            );
          }
        })
        .finally(onComplete);
    }
  }

  private kick(target: CtecLinkTarget, key: string): void {
    this.inFlight.add(key);
    renderLoading(target.container);

    void fetchCtecLinks(target.params, (msg) => { renderLoading(target.container, msg); })
      .then((data: CtecLinkData) => {
        this.inFlight.delete(key);
        renderCtecLinksWidget(target.container, data, () => this.kick(target, key));
        if (data.state === "found" || data.state === "not-found") {
          markCtecCellDone(target.container);
        }
      })
      .catch((err: unknown) => {
        this.inFlight.delete(key);
        if (isRetryablePeopleSoftTaskError(err)) {
          renderFetchButton(target.container, () => this.kick(target, key));
          return;
        }

        const errData: CtecLinkData = {
          state: "error",
          message: err instanceof Error ? err.message : "Unknown error"
        };
        renderCtecLinksWidget(target.container, errData, () => this.kick(target, key));
      });
  }
}
