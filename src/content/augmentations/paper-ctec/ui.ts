import type { CtecAggregateMetric } from "../ctec-links/reports";
import { STATUS_BAR_ID, STYLE_ID, WIDGET_CLASS } from "./constants";
import type { PaperCtecStatusBarData, PaperCtecWidgetData } from "./types";

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${WIDGET_CLASS} {
      margin-top: 3px;
      padding-top: 3px;
      border-top: 1px solid rgba(17, 24, 39, 0.12);
      min-height: 14px;
      color: #4b5563;
      pointer-events: none;
    }
    .dark .${WIDGET_CLASS} {
      border-top-color: rgba(255, 255, 255, 0.14);
      color: #d1d5db;
    }
    .${WIDGET_CLASS}-summary {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      min-width: 0;
      font-size: 10px;
      line-height: 1.1;
    }
    .${WIDGET_CLASS}-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-width: 0;
      max-width: 100%;
      padding: 1px 4px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.56);
      color: #374151;
      white-space: nowrap;
      font-weight: 600;
    }
    .dark .${WIDGET_CLASS}-chip {
      background: rgba(17, 24, 39, 0.54);
      color: #e5e7eb;
    }
    .${WIDGET_CLASS}-chip svg {
      width: 10px;
      height: 10px;
      flex: 0 0 auto;
      stroke-width: 1.8;
    }
    .${WIDGET_CLASS}-chip.is-muted {
      font-weight: 500;
      color: #6b7280;
    }
    .dark .${WIDGET_CLASS}-chip.is-muted {
      color: #cbd5e1;
    }
    .${WIDGET_CLASS}-chip.is-warn {
      background: rgba(190, 24, 93, 0.12);
      color: #9f1239;
    }
    .dark .${WIDGET_CLASS}-chip.is-warn {
      background: rgba(251, 113, 133, 0.14);
      color: #fecdd3;
    }
    #${STATUS_BAR_ID} {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      width: auto;
      max-width: none;
      min-height: 28px;
      padding: 4px 10px;
      border: 1px solid rgba(102, 2, 60, 0.18);
      border-radius: 8px;
      background: rgba(102, 2, 60, 0.08);
      color: #66023c;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      flex: 1 1 auto;
      box-sizing: border-box;
      overflow: hidden;
    }
    #${STATUS_BAR_ID}.is-loading {
      background: rgba(102, 2, 60, 0.08);
    }
    #${STATUS_BAR_ID}.is-auth {
      border-color: rgba(102, 2, 60, 0.28);
      background: rgba(102, 2, 60, 0.12);
    }
    #${STATUS_BAR_ID}.is-ready {
      border-color: rgba(102, 2, 60, 0.14);
      background: rgba(102, 2, 60, 0.05);
    }
    #${STATUS_BAR_ID} svg {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
      stroke-width: 1.9;
    }
    .dark #${STATUS_BAR_ID} {
      border-color: rgba(252, 165, 207, 0.2);
      background: rgba(157, 23, 77, 0.18);
      color: #fbcfe8;
    }
    .dark #${STATUS_BAR_ID}.is-auth {
      border-color: rgba(252, 165, 207, 0.34);
      background: rgba(157, 23, 77, 0.26);
    }
    .bc-paper-ctec-status-mark {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex-shrink: 0;
    }
    .bc-paper-ctec-status-brand {
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-copy {
      min-width: 0;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.95;
    }
    .bc-paper-ctec-status-action {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      margin-left: auto;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(102, 2, 60, 0.24);
      background: rgba(255, 255, 255, 0.72);
      color: inherit;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-decoration: none;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-action:hover {
      background: rgba(255, 255, 255, 0.92);
    }
    .dark .bc-paper-ctec-status-action {
      border-color: rgba(252, 165, 207, 0.26);
      background: rgba(17, 24, 39, 0.28);
    }
    .dark .bc-paper-ctec-status-action:hover {
      background: rgba(17, 24, 39, 0.4);
    }
    @media (max-width: 900px) {
      .bc-paper-ctec-status-brand {
        display: none;
      }
    }
  `;

  (document.head ?? document.documentElement).appendChild(style);
}

export function renderLoading(widget: HTMLElement, message = "CTEC…"): void {
  widget.textContent = "";
  widget.removeAttribute("title");

  const summary = document.createElement("div");
  summary.className = `${WIDGET_CLASS}-summary`;
  summary.appendChild(makeChip("spark", message, "is-muted"));
  widget.appendChild(summary);
}

export function renderWidget(widget: HTMLElement, data: PaperCtecWidgetData): void {
  widget.textContent = "";
  widget.removeAttribute("title");

  const summary = document.createElement("div");
  summary.className = `${WIDGET_CLASS}-summary`;
  widget.appendChild(summary);

  if (data.state === "not-found") {
    summary.appendChild(makeChip("spark", "No CTEC", "is-muted"));
    return;
  }

  if (data.state === "auth-required") {
    widget.title = "CTEC data requires a Northwestern login before the reports can be read.";
    summary.appendChild(makeChip("lock", "Login needed", "is-warn"));
    return;
  }

  if (data.state === "error") {
    widget.title = data.message;
    summary.appendChild(makeChip("spark", "CTEC unavailable", "is-muted"));
    return;
  }

  const { aggregate } = data;
  widget.title = buildTooltip(aggregate);

  const chips = [
    metricChip("user", aggregate.metrics.instruction),
    metricChip("book", aggregate.metrics.course),
    metricChip("cap", aggregate.metrics.learned),
    metricChip("clock", aggregate.metrics.hours)
  ].filter((chip): chip is HTMLElement => !!chip);

  if (chips.length === 0) {
    summary.appendChild(makeChip("spark", "CTEC loaded", "is-muted"));
  } else {
    chips.forEach((chip) => summary.appendChild(chip));
  }

  summary.appendChild(
    makeChip("stack", `${aggregate.evaluationCount}`, aggregate.partial ? "is-warn" : "is-muted")
  );
}

export function renderStatusBar(doc: Document, data: PaperCtecStatusBarData, onLogin: () => void): void {
  const host = findActionHost(doc);
  if (!host) return;
  ensureActionHostLayout(host);

  let bar = doc.getElementById(STATUS_BAR_ID) as HTMLDivElement | null;
  if (!bar) {
    bar = doc.createElement("div");
    bar.id = STATUS_BAR_ID;
    bar.setAttribute("aria-live", "polite");
  }

  if (bar.parentElement !== host || host.firstElementChild !== bar) {
    host.prepend(bar);
  }

  const signature = buildStatusSignature(data);
  if (bar.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  const nextClassName = data.state === "auth-required"
    ? "is-auth"
    : data.state === "ready"
      ? "is-ready"
      : "is-loading";

  bar.className = nextClassName;
  bar.replaceChildren();
  bar.title = buildStatusTitle(data);

  const mark = doc.createElement("div");
  mark.className = "bc-paper-ctec-status-mark";
  mark.append(createIcon(statusIcon(data.state)));

  const brand = doc.createElement("span");
  brand.className = "bc-paper-ctec-status-brand";
  brand.textContent = "Better CAESAR";
  mark.append(brand);

  const copy = doc.createElement("div");
  copy.className = "bc-paper-ctec-status-copy";
  copy.textContent = buildStatusCopy(data);

  bar.append(mark, copy);

  if (data.state === "auth-required" && data.loginUrl) {
    const action = doc.createElement("a");
    action.className = "bc-paper-ctec-status-action";
    action.href = data.loginUrl;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = data.awaitingAuthRetry ? "Open again" : "Open login";
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      onLogin();
    });
    bar.append(action);
  }

  bar.dataset.bcPaperCtecSignature = signature;
}

export function hideStatusBar(doc: Document): void {
  doc.getElementById(STATUS_BAR_ID)?.remove();
}

function findActionHost(doc: Document): HTMLElement | null {
  const exact = Array.from(
    doc.querySelectorAll<HTMLElement>("div.absolute.right-7.top-4.flex.items-center.gap-1")
  ).find((candidate) => hasPaperActions(candidate));
  if (exact) return exact;

  return Array.from(doc.querySelectorAll<HTMLElement>("div.absolute.flex.items-center")).find((candidate) =>
    hasPaperActions(candidate)
  ) ?? null;
}

function ensureActionHostLayout(host: HTMLElement): void {
  if (host.dataset.bcPaperCtecExpanded === "1") return;

  host.style.left = "1.75rem";
  host.style.right = "1.75rem";
  host.style.justifyContent = "flex-end";
  host.style.minWidth = "0";
  host.dataset.bcPaperCtecExpanded = "1";
}

function buildStatusSignature(data: PaperCtecStatusBarData): string {
  return [
    data.state,
    data.totalCount,
    data.resolvedCount,
    data.activeCount,
    data.foundCount,
    data.notFoundCount,
    data.errorCount,
    data.authCount,
    data.latestMessage ?? "",
    data.loginUrl ?? "",
    data.awaitingAuthRetry ? "1" : "0"
  ].join("|");
}

function hasPaperActions(candidate: HTMLElement): boolean {
  const labels = Array.from(candidate.querySelectorAll("button")).map((button) =>
    (button.textContent ?? "").trim().toLowerCase()
  );

  return labels.some((label) => label.includes("custom")) &&
    labels.some((label) => label.includes("export")) &&
    labels.some((label) => label.includes("clear"));
}

function buildStatusCopy(data: PaperCtecStatusBarData): string {
  if (data.state === "auth-required") {
    const prefix = data.awaitingAuthRetry
      ? "Waiting for Northwestern login to resume CTECs on Paper"
      : "Northwestern login required to continue CTECs on Paper";
    return `${prefix} · ${data.resolvedCount}/${data.totalCount} classes checked`;
  }

  if (data.state === "loading") {
    const detail = data.latestMessage
      ? ` · ${data.latestMessage}`
      : data.activeCount > 0
        ? ` · ${data.activeCount} active`
        : "";
    return `Loading CTECs into Paper · ${data.resolvedCount}/${data.totalCount} classes checked${detail}`;
  }

  const parts = [];
  if (data.foundCount > 0) parts.push(`${data.foundCount} enriched`);
  if (data.notFoundCount > 0) parts.push(`${data.notFoundCount} no CTEC`);
  if (data.errorCount > 0) parts.push(`${data.errorCount} unavailable`);
  if (parts.length === 0) parts.push("no visible classes");
  return `CTEC sync complete on Paper · ${parts.join(" · ")}`;
}

function buildStatusTitle(data: PaperCtecStatusBarData): string {
  if (data.state === "auth-required") {
    return "Better CAESAR needs one Northwestern login before it can keep reading CTEC reports for this Paper schedule.";
  }

  if (data.state === "loading") {
    return "Better CAESAR is reading Northwestern CTEC data and attaching summaries to the current Paper schedule.";
  }

  return "Better CAESAR finished syncing Northwestern CTEC summaries into the current Paper schedule.";
}

function statusIcon(state: PaperCtecStatusBarData["state"]): IconName {
  if (state === "auth-required") return "lock";
  if (state === "ready") return "stack";
  return "spark";
}

function metricChip(
  icon: IconName,
  metric?: CtecAggregateMetric
): HTMLElement | null {
  if (!metric) return null;
  return makeChip(icon, metric.mean.toFixed(1));
}

function makeChip(icon: IconName, text: string, extraClass = ""): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip${extraClass ? ` ${extraClass}` : ""}`;
  chip.append(createIcon(icon), document.createTextNode(text));
  return chip;
}

function buildTooltip(data: Extract<PaperCtecWidgetData, { state: "found" }>["aggregate"]): string {
  const parts = [`CTEC aggregated from ${data.evaluationCount} evaluation${data.evaluationCount === 1 ? "" : "s"}.`];

  appendMetricTooltip(parts, "Instructor", data.metrics.instruction);
  appendMetricTooltip(parts, "Course", data.metrics.course);
  appendMetricTooltip(parts, "Learned", data.metrics.learned);
  appendMetricTooltip(parts, "Challenge", data.metrics.challenging);
  appendMetricTooltip(parts, "Interest", data.metrics.stimulating);
  if (data.metrics.hours) {
    parts.push(
      `Hours ${data.metrics.hours.mean.toFixed(1)}/week approx from ${data.metrics.hours.totalResponses} responses across ${data.metrics.hours.evaluationCount} evals.`
    );
  }
  if (data.latestTerm) parts.push(`Latest ${data.latestTerm}.`);
  if (data.partial) parts.push("Some linked evaluations were available but not fully parsed.");

  return parts.join(" ");
}

function appendMetricTooltip(
  parts: string[],
  label: string,
  metric?: CtecAggregateMetric
): void {
  if (!metric) return;
  parts.push(
    `${label} ${metric.mean.toFixed(1)} from ${metric.totalResponses} responses across ${metric.evaluationCount} evals.`
  );
}

type IconName = "book" | "cap" | "clock" | "lock" | "spark" | "stack" | "user";

function createIcon(name: IconName): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const addPath = (d: string) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  };

  if (name === "book") {
    addPath("M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 0 4 22z");
    addPath("M8 4v16");
    return svg;
  }

  if (name === "cap") {
    addPath("m3 10 9-4 9 4-9 4-9-4Z");
    addPath("M7 12v4.5c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5V12");
    addPath("M21 10v6");
    return svg;
  }

  if (name === "clock") {
    addPath("M12 6v6l4 2");
    addPath("M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z");
    return svg;
  }

  if (name === "lock") {
    addPath("M7 11V8a5 5 0 0 1 10 0v3");
    addPath("M5 11h14v10H5z");
    return svg;
  }

  if (name === "spark") {
    addPath("m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z");
    return svg;
  }

  if (name === "stack") {
    addPath("m12 4 8 4-8 4-8-4 8-4Z");
    addPath("m4 12 8 4 8-4");
    addPath("m4 16 8 4 8-4");
    return svg;
  }

  addPath("M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z");
  addPath("M5 20a7 7 0 0 1 14 0");
  return svg;
}
