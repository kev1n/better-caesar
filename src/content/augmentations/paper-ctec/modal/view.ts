import { html, render, type TemplateResult } from "lit-html";

import { ANALYTICS_MODAL_ID } from "../constants";
import { preventAndStop, stopPropagation } from "../ui-shared";
import { disposeTrendChartObserver } from "./charts";
import { CommentsSection } from "./comments";
import { renderDryRunOverlay } from "./dry-run";
import { HeaderSection } from "./header";
import { OverviewSection } from "./overview";
import { TermsSection } from "./terms";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState
} from "./types";

// Modal orchestrator. Owns the root <div id="bc-paper-ctec-modal"> element,
// the lit-html render lifecycle, ESC-key handling, and the dark-mode mirror
// observer. Tab dispatch is centralized here so each section receives only
// the props it needs.
//
// lit-html does its own template-result diffing across renders, so the
// dataset.bcPaperCtecSignature short-circuit the legacy renderer used has
// been removed: every callsite invokes view.open() and lit-html minimizes
// the actual DOM mutations.
export interface ModalView {
  open(
    input: AnalyticsModalInput,
    state: AnalyticsModalState,
    callbacks: AnalyticsModalCallbacks
  ): void;
  close(): void;
  isOpen(): boolean;
}

export interface ModalViewDeps {
  doc: Document;
}

export function createModalView(deps: ModalViewDeps): ModalView {
  const { doc } = deps;
  let escKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
  let darkObserver: MutationObserver | null = null;
  let modalEl: HTMLElement | null = null;

  const ensureRoot = (): HTMLElement => {
    let modal = doc.getElementById(ANALYTICS_MODAL_ID) as HTMLDivElement | null;
    if (!modal) {
      modal = doc.createElement("div");
      modal.id = ANALYTICS_MODAL_ID;
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      (doc.body ?? doc.documentElement).appendChild(modal);
    }
    return modal;
  };

  // paper.nu applies its `.dark` class to a div inside the React tree, but
  // our modal is appended to document.body — outside that ancestor — so
  // `.dark .bc-paper-ctec-modal-*` rules never match. Mirror paper.nu's dark
  // state onto the modal element itself, and observe DOM mutations so the
  // modal updates live when the user toggles the setting.
  const syncDarkMode = (modal: HTMLElement): void => {
    const apply = () => {
      modal.classList.toggle("dark", !!doc.querySelector(".dark"));
    };
    apply();
    if (!darkObserver && typeof MutationObserver !== "undefined") {
      darkObserver = new MutationObserver(apply);
      darkObserver.observe(doc.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: true
      });
    }
  };

  return {
    open(input, state, callbacks) {
      const modal = ensureRoot();
      modalEl = modal;
      syncDarkMode(modal);

      // Backdrop click → close. Re-bound on every render via lit-html's
      // event syntax through the inner card stopPropagation guard.
      modal.onclick = (event) => {
        if (event.target !== modal) return;
        preventAndStop(event);
        callbacks.onClose();
      };

      if (escKeydownHandler) {
        doc.removeEventListener("keydown", escKeydownHandler);
      }
      escKeydownHandler = (event) => {
        if (event.key !== "Escape") return;
        if (!doc.getElementById(ANALYTICS_MODAL_ID)) return;
        callbacks.onClose();
      };
      doc.addEventListener("keydown", escKeydownHandler);

      render(buildTemplate(doc, input, state, callbacks), modal);
    },
    close() {
      doc.getElementById(ANALYTICS_MODAL_ID)?.remove();
      modalEl = null;
      if (escKeydownHandler) {
        doc.removeEventListener("keydown", escKeydownHandler);
        escKeydownHandler = null;
      }
      disposeTrendChartObserver();
      darkObserver?.disconnect();
      darkObserver = null;
    },
    isOpen() {
      return !!modalEl && !!doc.getElementById(ANALYTICS_MODAL_ID);
    }
  };
}

function buildTemplate(
  doc: Document,
  input: AnalyticsModalInput,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-card" @click=${stopPropagation}>
    ${HeaderSection.render({ doc, input, state, callbacks })}
    ${input.freshLensLoading
      ? renderFreshLensLoading(input)
      : input.data
        ? renderBody(doc, input.data, input.strategy, state, callbacks)
        : renderStatusBody(input, callbacks)}
    ${renderDryRunOverlay(input, state, callbacks)}
  </div>`;
}

// First-time lens switch: a fetch is in flight and we have NO confirmed
// discovery for the active lens. Suppress the data body so cached combo
// entries (which the course/instructor matchers treat as a valid subset)
// don't render as if they were the new lens's data.
function renderFreshLensLoading(input: AnalyticsModalInput): TemplateResult {
  const label =
    input.strategy === "course"
      ? "Loading Course view…"
      : input.strategy === "instructor"
        ? "Loading Prof view…"
        : "Loading CTEC reports…";
  return html`<div class="bc-paper-ctec-modal-status-body">
    <div class="bc-paper-ctec-modal-status-card">
      <div class="bc-paper-ctec-modal-status-spinner"></div>
      <h3 class="bc-paper-ctec-modal-status-title">${label}</h3>
      <p class="bc-paper-ctec-modal-status-text">
        Pulling fresh data for this view from Northwestern.
      </p>
    </div>
  </div>`;
}

// Tab dispatcher. Order matches the header tab order: overview → comments →
// terms. Body wrapper carries .bc-paper-ctec-modal-body so charts/tabs can
// scroll independently of the header.
function renderBody(
  doc: Document,
  data: NonNullable<AnalyticsModalInput["data"]>,
  strategy: AnalyticsModalInput["strategy"],
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-body">
    ${state.tab === "overview"
      ? OverviewSection.render({ doc, data, state, callbacks })
      : state.tab === "comments"
        ? CommentsSection.render({ doc, data, strategy, state, callbacks })
        : TermsSection.render({ doc, data, state, callbacks })}
  </div>`;
}

// Centered status callout when there's no loaded data yet — error, loading,
// or not-found. Replaces the rich body with a single message + (optionally)
// an action button. Identity in the header is still drawn from
// input.identity so the user knows what course they were looking at while
// the data fetches.
function renderStatusBody(
  input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  const inner = (() => {
    if (input.errorMessage) {
      return html`<h3 class="bc-paper-ctec-modal-status-title">
          Couldn't load CTEC reports
        </h3>
        <p class="bc-paper-ctec-modal-status-text">${input.errorMessage}</p>
        ${input.canRefresh
          ? html`<button
              type="button"
              class="bc-btn bc-btn--primary bc-btn--pill"
              ?disabled=${input.backgroundRefreshing}
              @click=${(event: Event) => {
                preventAndStop(event);
                if (input.backgroundRefreshing) return;
                callbacks.onRefresh();
              }}
            >${input.backgroundRefreshing ? "Retrying…" : "Try again"}</button>`
          : ""}`;
    }

    if (input.notFound) {
      return html`<h3 class="bc-paper-ctec-modal-status-title">
          ${notFoundTitle(input)}
        </h3>
        <p class="bc-paper-ctec-modal-status-text">
          ${notFoundBody(input)}
        </p>
        ${renderStrategyPivots(input, callbacks)}`;
    }

    if (input.loading) {
      return html`<div class="bc-paper-ctec-modal-status-spinner"></div>
        <h3 class="bc-paper-ctec-modal-status-title">Loading CTEC reports…</h3>
        <p class="bc-paper-ctec-modal-status-text">
          Pulling the most recent ${input.loadMoreBatchSize} term${input.loadMoreBatchSize === 1 ? "" : "s"} from Northwestern.
        </p>`;
    }

    // Fallback: nothing loaded for the active lens and no fetch in
    // flight. Without an explicit affordance the modal renders an
    // empty card body (the "grey box" users reported when navigating
    // to a section with no data for their preferred lens). Give them
    // a clear status message and the wizard re-entry button so
    // they're never stuck staring at blank space.
    return html`<h3 class="bc-paper-ctec-modal-status-title">
        Nothing loaded for this view yet
      </h3>
      <p class="bc-paper-ctec-modal-status-text">
        Pick another lens from the tabs above, or open the preview to
        explore alternatives.
      </p>
      ${renderStrategyPivots(input, callbacks)}`;
  })();

  const cardCls = input.errorMessage
    ? "bc-paper-ctec-modal-status-card is-warn"
    : "bc-paper-ctec-modal-status-card";

  return html`<div class="bc-paper-ctec-modal-status-body">
    <div class=${cardCls}>${inner}</div>
  </div>`;
}

// Empty-state copy varies by lens so the message tracks what we *did*
// search rather than reading the same way every time. Combo (the
// default) is the only case that has obvious pivots — "try the course
// without instructor", "try the instructor without course" — so it gets
// the most encouraging message; the course/instructor lenses' empty
// states are rarer and more terminal.
function notFoundTitle(input: AnalyticsModalInput): string {
  if (input.strategy === "course") {
    return `No CTECs for ${input.identity.subject} ${input.identity.catalog}`;
  }
  if (input.strategy === "instructor") {
    const name = input.identity.instructor.trim() || "this professor";
    return `No CTECs for ${name} in ${input.identity.subject}`;
  }
  return "No CTECs for this professor + course";
}

function notFoundBody(input: AnalyticsModalInput): string {
  if (input.strategy === "combo") {
    const name = input.identity.instructor.trim() || "this professor";
    return `${name} doesn't have any published CTEC evaluations for ${input.identity.subject} ${input.identity.catalog}. You can still get a read using one of the broader views below.`;
  }
  if (input.strategy === "course") {
    return `Northwestern hasn't published any CTECs for ${input.identity.subject} ${input.identity.catalog} yet — that's pretty unusual.`;
  }
  return `Northwestern hasn't published CTECs for this professor in ${input.identity.subject} yet.`;
}

// Recovery affordance for the not-found body: gives the user a single
// click back into the dry-run dialog after they've explicitly dismissed
// it. Without this, cancelling the dry-run would strand them on the
// empty body with no way forward — the original bug we fixed.
function renderStrategyPivots(
  _input: AnalyticsModalInput,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<div class="bc-paper-ctec-modal-status-pivots">
    <p class="bc-paper-ctec-modal-status-pivots-prompt">
      Want to look at alternatives instead?
    </p>
    <div class="bc-paper-ctec-modal-status-pivots-row">
      <button
        type="button"
        class="bc-btn bc-btn--primary bc-btn--pill bc-paper-ctec-modal-status-pivot-btn"
        @click=${(event: Event) => {
          preventAndStop(event);
          callbacks.onOpenDryRun();
        }}
      >Reopen preview →</button>
    </div>
  </div>`;
}
