// Related-component picker UI controller. CAESAR sometimes returns a
// "needs-related" payload after the user clicks Select — the user has to
// pick a discussion / lab / recitation before the cart-add can finalize.
// This controller renders the inline picker under the section row, lets
// the user click an option (or Cancel), and resolves a Promise with the
// selection (or null on cancel). Recursion when CAESAR serves another
// picker after the first pick is the AddToCart controller's job — we just
// open one picker at a time.
//
// Extracted from augmentation.ts (Wave 5d). The controller owns its DOM
// (a single <li class="bc-cs-related-row"> appended right after the
// section row) and tears it down on close, so a stale picker can't
// stack when the user re-clicks Add.
//
// Toast / continuation network is the caller's concern; this controller
// only shows / resolves the picker UI. Keeping the surface narrow makes
// the related-picker testable without mocking the cart-flow chain.

import { el } from "../../../framework/dom";
import { formatCourseIdForDisplay } from "../catalog-format";
import type {
  PaperSection
} from "../paper-data";
import type { ResultRow } from "../types";
import type { RelatedSectionOption } from "../caesar-search";

export type RelatedPickerOpenContext = {
  /** Course + section that triggered the picker — used for the heading. */
  row: ResultRow;
  section: PaperSection;
  /** The <li class="bc-cs-section"> the picker should anchor under. */
  sectionLi: HTMLLIElement;
};

export interface RelatedPickerController {
  /**
   * Render the picker under `ctx.sectionLi`. Resolves with the chosen
   * option once the user clicks one, or `null` when the user cancels.
   * Replaces any existing picker for the same section row.
   */
  open(
    options: RelatedSectionOption[],
    ctx: RelatedPickerOpenContext
  ): Promise<RelatedSectionOption | null>;

  /** Force-close any open picker without resolving. Used for cleanup paths. */
  close(): void;
}

export type RelatedPickerDeps = {
  doc: Document;
};

export function createRelatedPickerController(
  deps: RelatedPickerDeps
): RelatedPickerController {
  let activePickerLi: HTMLLIElement | null = null;
  // Resolver for the in-flight open() promise — invoked by Cancel /
  // option click / explicit close().
  let resolveActive: ((value: RelatedSectionOption | null) => void) | null = null;

  function teardown(): void {
    if (activePickerLi && activePickerLi.isConnected) {
      activePickerLi.remove();
    }
    activePickerLi = null;
    resolveActive = null;
  }

  function open(
    options: RelatedSectionOption[],
    ctx: RelatedPickerOpenContext
  ): Promise<RelatedSectionOption | null> {
    // If a picker is already open, resolve it as cancelled before
    // opening the new one. Prevents leaking the prior promise.
    if (resolveActive) {
      resolveActive(null);
      teardown();
    }

    return new Promise((resolve) => {
      resolveActive = resolve;
      const pickerLi = renderPicker(deps.doc, options, ctx, (option) => {
        if (resolveActive === resolve) {
          // Drop the resolver so a follow-up `close()` can't double-resolve,
          // but keep `activePickerLi` tracked so `close()` (called by the
          // consumer once the continuation finishes) tears down the DOM.
          // Without this the picker would linger forever on success paths.
          resolveActive = null;
          resolve(option);
        }
      });
      // Replace any earlier picker DOM for this section so re-clicking Add
      // doesn't stack pickers.
      const next = ctx.sectionLi.nextElementSibling;
      if (next instanceof HTMLLIElement && next.classList.contains("bc-cs-related-row")) {
        next.remove();
      }
      ctx.sectionLi.parentElement?.insertBefore(pickerLi, ctx.sectionLi.nextSibling);
      activePickerLi = pickerLi;
    });
  }

  function close(): void {
    if (resolveActive) {
      const r = resolveActive;
      resolveActive = null;
      r(null);
    }
    teardown();
  }

  return { open, close };
}

// ────────────────────────────────────────────────────────────────────────────
// DOM rendering — pure functions, no controller state.

function renderPicker(
  doc: Document,
  options: RelatedSectionOption[],
  ctx: RelatedPickerOpenContext,
  onResolve: (option: RelatedSectionOption | null) => void
): HTMLLIElement {
  const pickerLi = el(doc, "li", { class: "bc-cs-related-row" });
  const wrap = el(doc, "div", { class: "bc-cs-related" });

  const header = el(doc, "div", { class: "bc-cs-related-header" });
  const title = el(doc, "div", {
    class: "bc-cs-related-title",
    text: `${formatCourseIdForDisplay(ctx.row.course.subject, ctx.row.course.catalog)} needs a related section`
  });
  const sub = el(doc, "div", {
    class: "bc-cs-related-sub",
    text: "Pick one to finish adding to your cart."
  });
  header.append(title, sub);

  const cancel = el(doc, "button", {
    class: "bc-cs-related-cancel",
    attrs: { type: "button" },
    text: "Cancel",
    on: {
      click: () => {
        pickerLi.remove();
        onResolve(null);
      }
    }
  });
  header.appendChild(cancel);
  wrap.appendChild(header);

  const list = el(doc, "div", { class: "bc-cs-related-list" });
  for (const option of options) {
    list.appendChild(buildOptionRow(doc, option, pickerLi, onResolve));
  }
  wrap.appendChild(list);

  pickerLi.appendChild(wrap);
  return pickerLi;
}

function buildOptionRow(
  doc: Document,
  option: RelatedSectionOption,
  pickerLi: HTMLLIElement,
  onResolve: (option: RelatedSectionOption | null) => void
): HTMLElement {
  const item = el(doc, "button", {
    class: "bc-cs-related-option",
    attrs: { type: "button" },
    dataset: {
      status: option.status,
      // Stash row-index so the click handler can identify the option
      // without a user-visible class number in the DOM.
      rowIndex: String(option.rowIndex)
    }
  });

  const left = el(doc, "div", { class: "bc-cs-related-option-left" });
  left.appendChild(
    el(doc, "div", {
      class: "bc-cs-related-option-section",
      text: option.section || "—"
    })
  );

  const mid = el(doc, "div", { class: "bc-cs-related-option-mid" });
  mid.appendChild(el(doc, "div", { text: option.schedule || "—" }));
  mid.appendChild(
    el(doc, "div", { class: "bc-cs-mute", text: option.room || "" })
  );

  const right = el(doc, "div", { class: "bc-cs-related-option-right" });
  right.appendChild(
    el(doc, "div", {
      class: "bc-cs-related-option-instr",
      text: option.instructor || "—"
    })
  );
  const status = el(doc, "span", {
    class: "bc-cs-status-pill",
    dataset: { status: option.status },
    text: option.status
  });
  right.appendChild(status);

  item.append(left, mid, right);
  item.addEventListener("click", () => {
    // Disable every option button so the user can't double-fire while the
    // continuation runs. Mark the picked one for visual distinction.
    const buttons = pickerLi.querySelectorAll<HTMLButtonElement>(".bc-cs-related-option");
    buttons.forEach((b) => {
      b.disabled = true;
      if (b !== item) b.style.opacity = "0.5";
    });
    item.dataset.picked = "true";
    item.style.opacity = "1";
    const stamp = el(doc, "span", {
      class: "bc-cs-related-option-progress",
      text: "Adding…"
    });
    item.appendChild(stamp);
    onResolve(option);
  });
  return item;
}
