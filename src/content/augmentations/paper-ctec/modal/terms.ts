import { renderMetricDistribution } from "../dist-render";
import { renderHoursDensity } from "../hours-density";
import {
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { preventAndStop, stopPropagation } from "../ui-shared";
import { pickSelectedTerm, renderCard } from "./common";
import type { AnalyticsModalCallbacks, AnalyticsModalState } from "./types";

// Terms tab: term selector dropdown over a two-column drill-in for the
// selected term (per-metric stats with vs-other-terms delta on the left,
// per-metric distribution charts on the right). The cross-term heatmap
// that used to live here moved to the Overview "Global" view.
export function renderTerms(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const root = doc.createElement("div");
  root.className = "bc-paper-ctec-modal-terms";

  const selectedTerm = pickSelectedTerm(data, state.selectedTermId);
  root.append(renderTermPicker(doc, data, selectedTerm, callbacks));
  if (!selectedTerm) return root;

  const drillRow = doc.createElement("div");
  drillRow.className = "bc-paper-ctec-modal-drill";

  const metricCard = renderCard(
    doc,
    selectedTerm.term,
    `${selectedTerm.instructor} · ${selectedTerm.responses} responded`,
    selectedTerm.reportUrl
      ? { label: "↗ Report", href: selectedTerm.reportUrl }
      : undefined
  );
  metricCard.body.append(renderTermMetricGrid(doc, data, selectedTerm));
  drillRow.append(metricCard.root);

  const distsCard = renderCard(doc, "Distributions · all metrics", selectedTerm.term);
  distsCard.body.append(renderTermDistributionList(doc, selectedTerm));
  drillRow.append(distsCard.root);

  root.append(drillRow);
  return root;
}

// <select> picker over the loaded terms, since the heatmap (which used to
// double as the picker) moved to the Overview Global view. Pickers fire
// onTermChange so other tabs see the updated selection.
function renderTermPicker(
  doc: Document,
  data: ModalDisplayData,
  selectedTerm: ModalTerm | null,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-analytics-term-toolbar";

  const selectorWrap = doc.createElement("div");
  selectorWrap.className = "bc-paper-ctec-analytics-term-selector";

  const label = doc.createElement("label");
  label.textContent = "Term";
  selectorWrap.append(label);

  const select = doc.createElement("select");
  select.className = "bc-paper-ctec-analytics-term-select";
  for (const term of data.terms) {
    const option = doc.createElement("option");
    option.value = term.id;
    option.textContent = `${term.term} · ${term.instructor} · ${term.responses} responded`;
    if (selectedTerm?.id === term.id) option.selected = true;
    select.append(option);
  }
  select.addEventListener("click", stopPropagation);
  select.addEventListener("change", () => {
    callbacks.onTermChange(select.value);
  });
  selectorWrap.append(select);
  wrapper.append(selectorWrap);

  return wrapper;
}

function renderTermMetricGrid(
  doc: Document,
  data: ModalDisplayData,
  term: ModalTerm
): HTMLElement {
  const grid = doc.createElement("div");
  grid.className = "bc-paper-ctec-modal-term-metrics";

  const peers = data.terms.filter((t) => t.id !== term.id);
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as ModalMetricKind[]) {
    const value = term.metrics[kind];
    const cell = doc.createElement("div");
    cell.className = "bc-paper-ctec-modal-term-metric";

    const label = doc.createElement("div");
    label.className = "bc-paper-ctec-modal-term-metric-label";
    label.textContent = MODAL_METRIC_LABELS[kind];
    cell.append(label);

    const valueEl = doc.createElement("div");
    valueEl.className = "bc-paper-ctec-modal-term-metric-value";
    if (typeof value === "number") {
      const big = doc.createElement("span");
      big.textContent = value.toFixed(1);
      const unit = doc.createElement("span");
      unit.className = "bc-paper-ctec-modal-term-metric-unit";
      unit.textContent = kind === "hours" ? "h" : "/6";
      valueEl.append(big, unit);
    } else {
      valueEl.textContent = "—";
    }
    cell.append(valueEl);

    const peerValues = peers
      .map((peer) => peer.metrics[kind])
      .filter((entry): entry is number => typeof entry === "number");
    const peerMean = peerValues.length
      ? peerValues.reduce((sum, v) => sum + v, 0) / peerValues.length
      : null;

    const delta = doc.createElement("div");
    delta.className = "bc-paper-ctec-modal-term-metric-delta";
    if (peerMean == null || typeof value !== "number") {
      delta.textContent = "only term";
      delta.classList.add("is-muted");
    } else {
      const d = value - peerMean;
      const positive = kind === "hours" ? d <= 0 : d >= 0;
      if (Math.abs(d) < 0.05) {
        delta.textContent = "— vs other terms";
        delta.classList.add("is-muted");
      } else {
        delta.classList.add(positive ? "is-positive" : "is-negative");
        const arrow = positive ? "▲" : "▼";
        const note = doc.createElement("span");
        note.className = "bc-paper-ctec-modal-term-metric-delta-note";
        note.textContent = " vs other terms";
        delta.append(
          doc.createTextNode(`${arrow} ${Math.abs(d).toFixed(1)}`),
          note
        );
      }
    }
    cell.append(delta);
    grid.append(cell);
  }
  return grid;
}

function renderTermDistributionList(
  doc: Document,
  term: ModalTerm
): HTMLElement {
  const list = doc.createElement("div");
  list.className = "bc-paper-ctec-modal-term-charts";

  // Show one chart-image card per rating metric, plus the hours bucket
  // bars when buckets exist for this term. We don't fall back to fake
  // bars when a chart is missing — empty card + note instead.
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as ModalMetricKind[]) {
    const card = doc.createElement("div");
    card.className = "bc-paper-ctec-modal-term-chart-card";

    const head = doc.createElement("div");
    head.className = "bc-paper-ctec-modal-term-chart-head";

    const label = doc.createElement("div");
    label.className = "bc-paper-ctec-modal-term-chart-label";
    label.textContent = MODAL_METRIC_LABELS[kind];
    head.append(label);

    const meanValue = term.metrics[kind];
    if (typeof meanValue === "number") {
      const value = doc.createElement("div");
      value.className = "bc-paper-ctec-modal-term-chart-value";
      value.textContent = kind === "hours"
        ? `${meanValue.toFixed(1)} h`
        : meanValue.toFixed(1);
      head.append(value);
    }
    card.append(head);

    const body = doc.createElement("div");
    body.className = "bc-paper-ctec-modal-term-chart-body";

    body.append(
      renderMetricDistribution({
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
      })
    );
    card.append(body);
    list.append(card);
  }

  return list;
}
