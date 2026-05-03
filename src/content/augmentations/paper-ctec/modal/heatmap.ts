import {
  MODAL_METRIC_LABELS,
  MODAL_RATING_METRICS,
  type ModalDisplayData,
  type ModalMetricKind
} from "../modal-data";
import { preventAndStop } from "../ui-shared";
import { spacerCell } from "./common";
import type { AnalyticsModalCallbacks, AnalyticsModalState } from "./types";

// Term × Metric heatmap. Term-cell click sets selectedTermId via the
// onTermChange callback; the Terms tab shows the drill-in for whatever
// term is currently selected. Rating cells share one shading scale (deep
// maroon) and hours cells share another (purple) — different units,
// different scales.
export function renderHeatmap(
  doc: Document,
  data: ModalDisplayData,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const grid = doc.createElement("div");
  grid.className = "bc-paper-ctec-modal-heatmap";

  // Header row.
  grid.append(spacerCell(doc));
  for (const kind of [...MODAL_RATING_METRICS, "hours"] as ModalMetricKind[]) {
    const header = doc.createElement("div");
    header.className = "bc-paper-ctec-modal-heatmap-header";
    header.textContent = MODAL_METRIC_LABELS[kind];
    grid.append(header);
  }

  const ratings: number[] = [];
  data.terms.forEach((term) =>
    MODAL_RATING_METRICS.forEach((kind) => {
      const value = term.metrics[kind];
      if (typeof value === "number") ratings.push(value);
    })
  );
  const minR = ratings.length ? Math.min(...ratings) : 0;
  const maxR = ratings.length ? Math.max(...ratings) : 0;
  const spanR = maxR - minR;
  const cellR = (value: number) => {
    if (spanR < 0.05) return "rgba(102,2,60,0.45)";
    return `rgba(102,2,60,${0.18 + ((value - minR) / spanR) * 0.72})`;
  };

  const hourValues: number[] = [];
  data.terms.forEach((term) => {
    const value = term.metrics.hours;
    if (typeof value === "number") hourValues.push(value);
  });
  const minH = hourValues.length ? Math.min(...hourValues) : 0;
  const maxH = hourValues.length ? Math.max(...hourValues) : 0;
  const spanH = maxH - minH;
  const cellH = (value: number) => {
    if (spanH < 0.05) return "rgba(162,28,175,0.45)";
    return `rgba(162,28,175,${0.18 + ((value - minH) / spanH) * 0.72})`;
  };

  for (const term of data.terms) {
    const isActive = state.selectedTermId === term.id;
    const termCell = doc.createElement("button");
    termCell.type = "button";
    termCell.className = `bc-paper-ctec-modal-heatmap-term${isActive ? " is-active" : ""}`;
    const termTitle = doc.createElement("div");
    termTitle.className = "bc-paper-ctec-modal-heatmap-term-title";
    termTitle.textContent = term.term;
    const termSub = doc.createElement("div");
    termSub.className = "bc-paper-ctec-modal-heatmap-term-sub";
    termSub.textContent = `${term.responses} responded`;
    termCell.append(termTitle, termSub);
    termCell.addEventListener("click", (event) => {
      preventAndStop(event);
      callbacks.onTermChange(term.id);
    });
    grid.append(termCell);

    for (const kind of MODAL_RATING_METRICS) {
      const value = term.metrics[kind];
      const cell = doc.createElement("div");
      cell.className = "bc-paper-ctec-modal-heatmap-cell";
      if (typeof value === "number") {
        cell.style.background = cellR(value);
        cell.textContent = value.toFixed(1);
      } else {
        cell.classList.add("is-empty");
        cell.textContent = "—";
      }
      grid.append(cell);
    }

    const hoursValue = term.metrics.hours;
    const hoursCell = doc.createElement("div");
    hoursCell.className = "bc-paper-ctec-modal-heatmap-cell";
    if (typeof hoursValue === "number") {
      hoursCell.style.background = cellH(hoursValue);
      hoursCell.textContent = `${hoursValue.toFixed(1)}h`;
    } else {
      hoursCell.classList.add("is-empty");
      hoursCell.textContent = "—";
    }
    grid.append(hoursCell);
  }

  return grid;
}
