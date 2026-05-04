import { renderMetricDistribution } from "../dist-render";
import {
  renderHoursDensity,
  type HoursDensitySeries
} from "../hours-density";
import {
  type ModalDisplayData,
  type ModalMetricKind,
  type ModalTerm
} from "../modal-data";
import { abbrTerm } from "../term-format";

// Tracks the active trend-chart ResizeObserver across renders so we can
// disconnect a stale one when the modal re-renders (avoids leaking
// references to detached wrappers).
let activeTrendObserver: ResizeObserver | null = null;

export function disposeTrendChartObserver(): void {
  if (activeTrendObserver) {
    activeTrendObserver.disconnect();
    activeTrendObserver = null;
  }
}

// Trend chart: per-metric line over loaded terms with area fill and value
// labels. Uses a ResizeObserver to track wrapper width so the SVG aspect
// matches the container instead of letterboxing or stretching.
export function renderTrendChart(
  doc: Document,
  data: ModalDisplayData,
  metric: ModalMetricKind
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-trend";

  const values = data.metrics[metric].trend;
  if (values.length < 2) {
    const empty = doc.createElement("div");
    empty.className = "bc-paper-ctec-modal-trend-empty";
    empty.textContent = "Only one term on record — no trend to plot.";
    wrapper.append(empty);
    return wrapper;
  }

  const H = 220;

  const draw = (W: number) => {
    if (W <= 0) return;
    wrapper.replaceChildren();

    const PL = 44;
    const PR = 24;
    const PT = 24;
    const PB = 36;

    const min = Math.min(...values) - 0.3;
    const max = Math.max(...values) + 0.3;
    const range = max - min || 1;
    const xAt = (i: number) =>
      PL + (i / Math.max(1, values.length - 1)) * (W - PL - PR);
    const yAt = (v: number) =>
      H - PB - ((v - min) / range) * (H - PT - PB);

    const SVG_NS = "http://www.w3.org/2000/svg";
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "bc-paper-ctec-modal-trend-svg");

    const ticks = 4;
    for (let i = 0; i < ticks; i++) {
      const yv = min + ((max - min) * i) / (ticks - 1);
      const line = doc.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(PL));
      line.setAttribute("x2", String(W - PR));
      line.setAttribute("y1", String(yAt(yv)));
      line.setAttribute("y2", String(yAt(yv)));
      line.setAttribute("stroke", "#f1ebef");
      svg.append(line);

      const tick = doc.createElementNS(SVG_NS, "text");
      tick.setAttribute("x", String(PL - 6));
      tick.setAttribute("y", String(yAt(yv) + 3));
      tick.setAttribute("fill", "#9b8290");
      tick.setAttribute("font-size", "10");
      tick.setAttribute("text-anchor", "end");
      tick.textContent = yv.toFixed(1);
      svg.append(tick);
    }

    const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
    const area = doc.createElementNS(SVG_NS, "path");
    area.setAttribute(
      "d",
      `M ${xAt(0)},${H - PB} L ${points.split(" ").join(" L ")} L ${xAt(
        values.length - 1
      )},${H - PB} Z`
    );
    area.setAttribute("fill", "rgba(102,2,60,0.08)");
    svg.append(area);

    const polyline = doc.createElementNS(SVG_NS, "polyline");
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "#66023c");
    polyline.setAttribute("stroke-width", "2");
    polyline.setAttribute("stroke-linecap", "round");
    polyline.setAttribute("stroke-linejoin", "round");
    polyline.setAttribute("points", points);
    svg.append(polyline);

    values.forEach((v, i) => {
      const circle = doc.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", String(xAt(i)));
      circle.setAttribute("cy", String(yAt(v)));
      circle.setAttribute("r", "3.5");
      circle.setAttribute("fill", "white");
      circle.setAttribute("stroke", "#66023c");
      circle.setAttribute("stroke-width", "1.6");
      svg.append(circle);

      const valueLabel = doc.createElementNS(SVG_NS, "text");
      valueLabel.setAttribute("x", String(xAt(i)));
      valueLabel.setAttribute("y", String(yAt(v) - 8));
      valueLabel.setAttribute("fill", "#66023c");
      valueLabel.setAttribute("font-size", "11");
      valueLabel.setAttribute("font-weight", "700");
      valueLabel.setAttribute("text-anchor", "middle");
      valueLabel.textContent = v.toFixed(1);
      svg.append(valueLabel);

      const termLabel = doc.createElementNS(SVG_NS, "text");
      termLabel.setAttribute("x", String(xAt(i)));
      termLabel.setAttribute("y", String(H - 12));
      termLabel.setAttribute("fill", "#7a596a");
      termLabel.setAttribute("font-size", "10");
      termLabel.setAttribute("text-anchor", "middle");
      termLabel.textContent = abbrTerm(data.trendTerms[i]?.term ?? "");
      svg.append(termLabel);
    });

    wrapper.append(svg);
  };

  // Disconnect any prior observer (the wrapper it watched is being thrown
  // away by replaceChildren on the parent, so its callback would fire on a
  // detached element until GC).
  disposeTrendChartObserver();

  if (typeof ResizeObserver !== "undefined") {
    activeTrendObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      if (w > 0) draw(w);
    });
    activeTrendObserver.observe(wrapper);
  }

  // Initial draw at a sensible default; the observer will redraw with the
  // real width as soon as the wrapper is mounted.
  draw(800);

  return wrapper;
}

// Distribution chart for the currently-selected term + metric. Hours uses
// the parsed buckets if available; rating metrics use chart-extract counts
// or fall back to the raw chart image. Routing lives in dist-render.ts.
//
// When `data` is supplied we mirror the workload card's two-pill pattern:
// the selected term's pill is labeled with the term abbreviation (e.g.
// "Sp'23 5.4") and a secondary "HISTORICAL AVG" pill stacks above it.
export function renderDistChart(
  doc: Document,
  term: ModalTerm | null,
  metric: ModalMetricKind,
  data?: ModalDisplayData
): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-modal-dist";

  if (!term) {
    wrapper.textContent = "No term selected.";
    return wrapper;
  }

  const isHours = metric === "hours";
  const unit = isHours ? "h" : "";
  const termAbbr = abbrTerm(term.term);
  const termValue = term.metrics[metric];
  const primaryLabel = termAbbr
    ? typeof termValue === "number"
      ? `${termAbbr} ${termValue.toFixed(1)}${unit}`
      : termAbbr
    : undefined;

  const historicalMean =
    data && data.terms.length >= 2 ? data.metrics[metric].mean : undefined;
  const showHistorical =
    typeof historicalMean === "number" && historicalMean > 0;
  const historicalLabel = showHistorical
    ? `HISTORICAL AVG ${historicalMean!.toFixed(1)}${unit}`
    : undefined;

  wrapper.append(
    renderMetricDistribution({
      doc,
      term,
      metric,
      altLabel: `${metric} distribution for ${term.term}`,
      className: "bc-paper-ctec-modal-dist-image",
      primaryLabel,
      historicalMean: showHistorical ? historicalMean : undefined,
      historicalLabel: showHistorical ? historicalLabel : undefined,
      renderHoursBuckets: (t) => {
        const series: HoursDensitySeries[] = [];
        if (
          showHistorical &&
          data &&
          data.aggregateHoursBuckets.length > 0
        ) {
          series.push({
            label: historicalLabel ?? "HISTORICAL AVG",
            buckets: data.aggregateHoursBuckets,
            mean: historicalMean,
            style: "secondary"
          });
        }
        const tAbbr = abbrTerm(t.term);
        const tValue = t.metrics.hours;
        const primary =
          tAbbr && typeof tValue === "number"
            ? `${tAbbr} ${tValue.toFixed(1)}h`
            : typeof tValue === "number"
              ? `AVG ${tValue.toFixed(1)}h`
              : tAbbr || "AVG";
        series.push({
          label: primary,
          buckets: t.hoursBuckets,
          mean: tValue,
          style: "primary"
        });
        return renderHoursDensity(doc, series);
      }
    })
  );
  return wrapper;
}

