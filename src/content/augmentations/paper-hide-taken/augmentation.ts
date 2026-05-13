import { logQuiet } from "../../../shared/log";
import { readCourseHistory } from "../../course-history";
import type { Augmentation } from "../../framework";
import { el } from "../../framework/dom";
import { isFeatureEnabled, setFeatureEnabled } from "../../settings";
import { getPlanCourses, type PaperCourse } from "../class-search/paper-data";
import { SEARCH_ROW_ID } from "../prereq-filter/constants";
import {
  FEATURE_ID,
  HIDDEN_CARD_ATTR,
  MOUNT_ID,
  STATE_ATTR,
  TOGGLE_BTN_ID
} from "./constants";
import { injectHideTakenStyles, removeHideTakenStyles } from "./styles";

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

// paper.nu only renders its Browse/Filter button strip when `queryEmpty`
// is true. The strip's absence is the canonical "user is searching"
// signal — DOM-driven so the AugmentationRunner's MutationObserver
// re-ticks us across the transition automatically.
function isUserSearching(doc: Document): boolean {
  return !doc.querySelector("div.m-4.flex.justify-center.gap-2");
}

// Selector that resolves the search-results scroll container. Mirrored
// from prereq-filter so the two stay in sync if paper.nu reshapes the
// search panel.
const RESULTS_LIST_SELECTOR = "div.no-scrollbar.flex-1.overflow-hidden.overflow-y-scroll";
const CARD_SELECTORS = ["div.group.m-4.rounded-lg.border-2", "div.group.m-4"] as const;
const CARD_CODE_SELECTOR = "p.text-lg.font-bold";

const COURSE_CODE_RE = /\b([A-Z][A-Z_]+)\s+(\d{3}(?:-[A-Za-z0-9]+)?)\b/;

// Drop the registrar's "-0" no-subdivision suffix so a paper.nu card
// labeled "COMP_SCI 211" matches a CAESAR history row catalogued as
// "COMP_SCI 211-0". Sequence courses like "MATH 220-1" keep the suffix.
function normalizeCatalog(catalog: string): string {
  return catalog.replace(/-0$/, "");
}

function makeKey(subject: string, catalog: string): string {
  return `${subject} ${normalizeCatalog(catalog)}`;
}

function extractCardCourseKey(card: HTMLElement): string | null {
  const codeEl = card.querySelector<HTMLElement>(CARD_CODE_SELECTOR);
  const text = codeEl?.textContent ?? card.textContent ?? "";
  const m = COURSE_CODE_RE.exec(text);
  if (!m) return null;
  return makeKey(m[1], m[2]);
}

function findResultsList(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(RESULTS_LIST_SELECTOR);
}

function findCards(list: HTMLElement): HTMLElement[] {
  for (const sel of CARD_SELECTORS) {
    const cards = Array.from(list.querySelectorAll<HTMLElement>(sel));
    if (cards.length > 0) return cards;
  }
  return [];
}

// "Taken" = completed with a grade, "Transferred" = T-grade transfer
// credit. In-Progress + In-Cart stay visible.
function isCompletedStatus(status: string): boolean {
  return status === "Taken" || status === "Transferred";
}

export class PaperHideTakenAugmentation implements Augmentation {
  readonly id = MOUNT_ID;

  private repeatableKeys: Set<string> | null = null;
  private planLoadInFlight: Promise<void> | null = null;
  private toggleEl: HTMLElement | null = null;

  run(doc: Document = document): void {
    if (!isPaperHost()) return;

    const featureOn = isFeatureEnabled(FEATURE_ID);
    const searching = isUserSearching(doc);
    injectHideTakenStyles(doc);

    // Mount the switch into prereq-filter's shared controls row whenever
    // that row exists. The switch is the user's way to flip the feature
    // on or off without leaving the page — so it's always (re)mounted
    // regardless of feature state, then visibility toggles below.
    this.ensureToggleButton(doc, featureOn, searching);

    if (!featureOn) {
      this.clearHiddenMarkers(doc);
      return;
    }

    if (!this.repeatableKeys && !this.planLoadInFlight) {
      this.planLoadInFlight = this.loadPlan(doc);
      return;
    }
    if (!this.repeatableKeys) return;

    this.applyFilter(doc);
  }

  cleanup(doc: Document = document): void {
    this.clearHiddenMarkers(doc);
    this.toggleEl?.remove();
    this.toggleEl = null;
    removeHideTakenStyles(doc);
  }

  private async loadPlan(doc: Document): Promise<void> {
    try {
      const courses = await getPlanCourses();
      this.repeatableKeys = buildRepeatableSet(courses);
    } catch (err) {
      logQuiet("paper-hide-taken.loadPlan", err);
      return;
    } finally {
      this.planLoadInFlight = null;
    }
    this.run(doc);
  }

  private applyFilter(doc: Document): void {
    const list = findResultsList(doc);
    if (!list) return;
    const cards = findCards(list);
    if (cards.length === 0) return;

    const history = readCourseHistory();
    const takenKeys = new Set<string>();
    for (const entry of history.entries) {
      if (!isCompletedStatus(entry.status)) continue;
      takenKeys.add(makeKey(entry.subject, entry.number));
    }

    let hiddenCount = 0;
    for (const card of cards) {
      const key = extractCardCourseKey(card);
      if (!key) {
        card.removeAttribute(HIDDEN_CARD_ATTR);
        card.removeAttribute(STATE_ATTR);
        continue;
      }
      const shouldHide =
        takenKeys.has(key) && !(this.repeatableKeys?.has(key) ?? false);
      const sig = `${key}|${shouldHide ? "1" : "0"}`;
      if (card.getAttribute(STATE_ATTR) === sig) {
        if (shouldHide) hiddenCount += 1;
        continue;
      }
      card.setAttribute(STATE_ATTR, sig);
      if (shouldHide) {
        card.setAttribute(HIDDEN_CARD_ATTR, "1");
        hiddenCount += 1;
      } else {
        card.removeAttribute(HIDDEN_CARD_ATTR);
      }
    }

    this.updateToggleCount(hiddenCount);
  }

  private clearHiddenMarkers(doc: Document): void {
    for (const card of Array.from(
      doc.querySelectorAll<HTMLElement>(`[${HIDDEN_CARD_ATTR}]`)
    )) {
      card.removeAttribute(HIDDEN_CARD_ATTR);
    }
    for (const card of Array.from(
      doc.querySelectorAll<HTMLElement>(`[${STATE_ATTR}]`)
    )) {
      card.removeAttribute(STATE_ATTR);
    }
  }

  private ensureToggleButton(
    doc: Document,
    featureOn: boolean,
    searching: boolean
  ): void {
    // The shared row is owned by prereq-filter's always-mounted
    // augmentation. If it isn't in the DOM yet (first tick, before
    // prereq-filter's run() has fired), drop our cached ref so the
    // next tick rebuilds the switch in the correct parent.
    const row = doc.getElementById(SEARCH_ROW_ID);
    if (!row) {
      if (this.toggleEl) {
        this.toggleEl.remove();
        this.toggleEl = null;
      }
      return;
    }

    if (!this.toggleEl || !row.contains(this.toggleEl)) {
      this.toggleEl?.remove();
      this.toggleEl = this.buildSwitch(doc, featureOn);
      // Slot in right after prereq-filter's feature switch so the
      // visible order when searching is [Hide Taken, Show Only Prereq
      // Fulfilled] regardless of whether the filter switch was
      // appended before or after we ran.
      const firstChild = row.firstElementChild;
      if (firstChild) {
        firstChild.insertAdjacentElement("afterend", this.toggleEl);
      } else {
        row.appendChild(this.toggleEl);
      }
    }

    this.updateToggleState(featureOn);
    this.toggleEl.style.display = searching ? "" : "none";
  }

  private buildSwitch(doc: Document, featureOn: boolean): HTMLElement {
    const btn = el(doc, "button", {
      attrs: {
        id: TOGGLE_BTN_ID,
        type: "button",
        role: "switch",
        "aria-checked": String(featureOn),
        title: "Hide courses you've already taken or transferred (repeatable courses like 396/397 still show)"
      },
      dataset: { on: featureOn ? "1" : "0" },
      on: {
        click: (event: MouseEvent): void => {
          event.preventDefault();
          event.stopPropagation();
          void this.toggleFeature();
        }
      }
    });
    const knob = el(doc, "span", { class: "bc-hide-taken-knob" });
    const label = el(doc, "span", {
      class: "bc-hide-taken-label",
      text: "Hide Taken"
    });
    const count = el(doc, "span", { class: "bc-hide-taken-count" });
    btn.append(knob, label, count);
    return btn;
  }

  private updateToggleState(featureOn: boolean): void {
    if (!this.toggleEl) return;
    const onAttr = featureOn ? "1" : "0";
    if (this.toggleEl.dataset.on !== onAttr) {
      this.toggleEl.dataset.on = onAttr;
    }
    const ariaChecked = String(featureOn);
    if (this.toggleEl.getAttribute("aria-checked") !== ariaChecked) {
      this.toggleEl.setAttribute("aria-checked", ariaChecked);
    }
    if (!featureOn) this.updateToggleCount(0);
  }

  private updateToggleCount(hidden: number): void {
    const counter = this.toggleEl?.querySelector(".bc-hide-taken-count");
    if (!counter) return;
    const next = hidden > 0 ? String(hidden) : "";
    // Same self-mutation-loop guard as prereq-filter's counter: skip
    // same-value writes so MutationObserver doesn't churn on us.
    if (counter.textContent !== next) counter.textContent = next;
  }

  private async toggleFeature(): Promise<void> {
    try {
      const now = isFeatureEnabled(FEATURE_ID);
      await setFeatureEnabled(FEATURE_ID, !now);
    } catch (err) {
      logQuiet("paper-hide-taken.toggleFeature", err);
    }
  }
}

function buildRepeatableSet(courses: readonly PaperCourse[]): Set<string> {
  const out = new Set<string>();
  for (const course of courses) {
    if (course.repeatable === true) {
      out.add(makeKey(course.subject, course.catalog));
    }
  }
  return out;
}
