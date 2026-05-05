import { html, type TemplateResult } from "lit-html";

import { renderMetricDistribution } from "../dist-render";
import { renderHoursDensity } from "../hours-density";
import {
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { stopPropagation } from "../ui-shared";
import { cardTemplate, pickSelectedTerm } from "./common";
import type { Section } from "./section";
import type { AnalyticsModalCallbacks, AnalyticsModalState } from "./types";

export type TermsSectionProps = {
  doc: Document;
  data: ModalDisplayData;
  state: AnalyticsModalState;
  callbacks: AnalyticsModalCallbacks;
};

// Terms tab. Term selector dropdown above a single drill-in card whose body
// is a grid of per-metric blocks. Each block packs label + value + delta +
// distribution chart into one unit, so the number and the chart it summarizes
// are side-by-side instead of split across two parallel cards.
export const TermsSection: Section<TermsSectionProps> = {
  render({ doc, data, state, callbacks }) {
    const selectedTerm = pickSelectedTerm(data, state.selectedTermId);

    return html`<div class="bc-paper-ctec-modal-terms">
      ${renderTermPicker(data, selectedTerm, callbacks)}
      ${selectedTerm
        ? cardTemplate(
            selectedTerm.term,
            `${selectedTerm.instructor} · ${selectedTerm.responses} responded`,
            renderTermMetricBlocks(doc, data, selectedTerm),
            selectedTerm.reportUrl
              ? { label: "↗ Report", href: selectedTerm.reportUrl }
              : undefined
          )
        : ""}
    </div>`;
  }
};

// <select> picker over the loaded terms, since the heatmap (which used to
// double as the picker) moved to the Overview Global view. Pickers fire
// onTermChange so other tabs see the updated selection.
function renderTermPicker(
  data: ModalDisplayData,
  selectedTerm: ModalTerm | null,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return html`<div class="bc-paper-ctec-analytics-term-toolbar">
    <div class="bc-paper-ctec-analytics-term-selector">
      <label>Term</label>
      <select
        class="bc-paper-ctec-analytics-term-select"
        @click=${stopPropagation}
        @change=${(event: Event) => {
          callbacks.onTermChange((event.target as HTMLSelectElement).value);
        }}
      >${data.terms.map(
          (term) => html`<option
            value=${term.id}
            ?selected=${selectedTerm?.id === term.id}
          >${term.term} · ${term.instructor} · ${term.responses} responded</option>`
        )}</select>
    </div>
  </div>`;
}

// One block per metric: header (label + value + vs-other-terms delta) over
// the distribution chart. Replaces the previous split where numbers and
// charts lived in two adjacent cards.
function renderTermMetricBlocks(
  doc: Document,
  data: ModalDisplayData,
  term: ModalTerm
): TemplateResult {
  const peers = data.terms.filter((t) => t.id !== term.id);
  const kinds: ModalMetricKind[] = [...MODAL_RATING_METRICS, "hours"];
  return html`<div class="bc-paper-ctec-modal-term-blocks">
    ${kinds.map((kind) => renderTermMetricBlock(doc, term, peers, kind))}
  </div>`;
}

function renderTermMetricBlock(
  doc: Document,
  term: ModalTerm,
  peers: ModalTerm[],
  kind: ModalMetricKind
): TemplateResult {
  const value = term.metrics[kind];
  const chart = renderMetricDistribution({
    doc,
    term,
    metric: kind,
    altLabel: `${MODAL_METRIC_LABELS[kind]} chart for ${term.term}`,
    className: "bc-paper-ctec-modal-term-chart-image",
    renderHoursBuckets: (t) =>
      renderHoursDensity(doc, [
        {
          label:
            typeof t.metrics.hours === "number"
              ? `AVG ${t.metrics.hours.toFixed(1)}h`
              : "AVG",
          buckets: t.hoursBuckets,
          mean: t.metrics.hours,
          style: "primary"
        }
      ])
  });

  return html`<div class="bc-paper-ctec-modal-term-block">
    <div class="bc-paper-ctec-modal-term-block-head">
      <div class="bc-paper-ctec-modal-term-block-label">
        ${MODAL_METRIC_LABELS[kind]}
      </div>
      <div class="bc-paper-ctec-modal-term-block-value">
        ${typeof value === "number"
          ? html`<span class="bc-paper-ctec-modal-term-block-value-num"
                >${value.toFixed(1)}</span
              ><span class="bc-paper-ctec-modal-term-block-unit"
                >${kind === "hours" ? "h" : "/6"}</span
              >`
          : "—"}
      </div>
      ${renderDelta(value, peers, kind)}
    </div>
    <div class="bc-paper-ctec-modal-term-block-chart">${chart}</div>
  </div>`;
}

function renderDelta(
  value: number | undefined,
  peers: ModalTerm[],
  kind: ModalMetricKind
): TemplateResult {
  const peerValues = peers
    .map((peer) => peer.metrics[kind])
    .filter((entry): entry is number => typeof entry === "number");
  const peerMean = peerValues.length
    ? peerValues.reduce((sum, v) => sum + v, 0) / peerValues.length
    : null;

  if (peerMean == null || typeof value !== "number") {
    return html`<div class="bc-paper-ctec-modal-term-block-delta is-muted"
      >only term</div
    >`;
  }

  const d = value - peerMean;
  const positive = kind === "hours" ? d <= 0 : d >= 0;
  if (Math.abs(d) < 0.05) {
    return html`<div class="bc-paper-ctec-modal-term-block-delta is-muted"
      >— vs other terms</div
    >`;
  }
  const arrow = positive ? "▲" : "▼";
  const cls = `bc-paper-ctec-modal-term-block-delta ${
    positive ? "is-positive" : "is-negative"
  }`;
  return html`<div class=${cls}
    >${`${arrow} ${Math.abs(d).toFixed(1)}`}<span
      class="bc-paper-ctec-modal-term-block-delta-note"
    > vs other terms</span
    ></div
  >`;
}

// Backwards-compat shim.
export function renderTerms(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): TemplateResult {
  return TermsSection.render({ doc, data, state, callbacks });
}
