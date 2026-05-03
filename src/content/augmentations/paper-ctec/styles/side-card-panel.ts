import { PAPER_CTEC_CONFIG } from "../config";

// Content rendered inside the side-card analytics panel: metric grid +
// group + card, star ratings, hours track, term selector + summary, metric
// stack with the chart toggle button, inline chart frame, comments preview,
// refresh + load-more controls. Rendered conditionally when the user has
// the side-card analytics tab open instead of opening the modal.
export function sideCardPanelStyles(): string {
  return `
    .bc-paper-ctec-analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(${PAPER_CTEC_CONFIG.ui.analyticsMetricMinWidthPx}px, 1fr));
      gap: 8px;
      margin-bottom: 0;
    }
    .bc-paper-ctec-analytics-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid var(--bc-color-accent-border-12);
      border-radius: var(--bc-radius-3xl);
      background: var(--bc-color-surface-translucent-86);
    }
    .bc-paper-ctec-analytics-group-title {
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      color: var(--bc-color-text-mauve);
    }
    .bc-paper-ctec-analytics-card {
      border-radius: var(--bc-radius-2xl);
      border: 1px solid var(--bc-color-accent-border-12);
      background: var(--bc-color-surface-translucent-72);
      padding: 10px;
    }
    .bc-paper-ctec-analytics-card-label {
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wider);
      text-transform: uppercase;
      color: var(--bc-color-text-mauve);
    }
    .bc-paper-ctec-analytics-card-rating {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .bc-paper-ctec-analytics-card-value {
      font-size: var(--bc-font-14);
      font-weight: var(--bc-fw-extrabold);
      color: var(--bc-color-text-mauve-deep);
      white-space: nowrap;
    }
    .bc-paper-ctec-analytics-card-hours {
      margin-top: 8px;
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-extrabold);
      color: var(--bc-color-text-mauve-deep);
    }
    .bc-paper-ctec-stars {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .bc-paper-ctec-star {
      position: relative;
      display: inline-flex;
      width: ${PAPER_CTEC_CONFIG.ui.analyticsStarSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.analyticsStarSizePx}px;
      flex: 0 0 auto;
    }
    .bc-paper-ctec-star svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      stroke-width: 1.7;
    }
    .bc-paper-ctec-star-base {
      color: var(--bc-color-star-base);
    }
    .bc-paper-ctec-star-fill {
      position: absolute;
      inset: 0 auto 0 0;
      overflow: hidden;
      color: var(--bc-color-star-fill);
    }
    .bc-paper-ctec-hours-track {
      margin-top: 8px;
      height: 8px;
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-accent-fill-12);
      overflow: hidden;
    }
    .bc-paper-ctec-hours-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--bc-color-hours-grad-start), var(--bc-color-hours-grad-end));
    }
    .bc-paper-ctec-hours-meta {
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--bc-font-11);
      line-height: 1.35;
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-analytics-section-title {
      margin: 16px 0 8px;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      color: var(--bc-color-text-mauve);
    }
    .bc-paper-ctec-analytics-term-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .bc-paper-ctec-analytics-term-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .bc-paper-ctec-analytics-term-selector label {
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text-mauve-soft);
      white-space: nowrap;
    }
    .bc-paper-ctec-analytics-term-select {
      min-width: 0;
      flex: 1 1 auto;
      border: 1px solid var(--bc-color-accent-border-14);
      border-radius: var(--bc-radius-xl);
      background: var(--bc-color-surface-translucent-84);
      color: var(--bc-color-text-mauve-deep);
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      padding: 8px 10px;
    }
    .bc-paper-ctec-analytics-term-summary {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      padding: 12px;
      border-radius: var(--bc-radius-2xl);
      border: 1px solid var(--bc-color-accent-border-08);
      background: var(--bc-color-surface-translucent-56);
    }
    .bc-paper-ctec-analytics-term-title {
      font-size: var(--bc-font-14);
      font-weight: var(--bc-fw-extrabold);
      color: var(--bc-color-text-mauve-deep);
    }
    .bc-paper-ctec-analytics-term-meta {
      margin-top: 4px;
      font-size: var(--bc-font-12);
      line-height: 1.45;
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-analytics-term-link {
      color: var(--bc-color-accent-soft);
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-extrabold);
      text-decoration: underline;
      text-underline-offset: 3px;
      white-space: nowrap;
    }
    .bc-paper-ctec-analytics-state-note {
      font-size: var(--bc-font-12);
      line-height: 1.5;
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-analytics-metric-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-metric-card {
      border-radius: var(--bc-radius-2xl);
      border: 1px solid var(--bc-color-accent-border-08);
      background: var(--bc-color-surface-translucent-62);
      padding: 12px;
    }
    .bc-paper-ctec-analytics-metric-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-metric-chart-btn {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid var(--bc-color-accent-border-12);
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-accent-fill-05);
      color: var(--bc-color-accent-soft);
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-metric-chart-btn svg {
      width: 14px;
      height: 14px;
      stroke-width: 1.9;
    }
    .bc-paper-ctec-analytics-metric-chart-btn:hover {
      background: var(--bc-color-accent-fill-10);
    }
    .bc-paper-ctec-analytics-inline-chart {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--bc-color-accent-border-08);
    }
    .bc-paper-ctec-analytics-inline-chart-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-chart-title {
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      line-height: 1.4;
    }
    .bc-paper-ctec-analytics-chart-image {
      width: 100%;
      border-radius: var(--bc-radius-xl);
      background: var(--bc-color-surface-translucent-88);
    }
    .bc-paper-ctec-analytics-comments-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
    }
    .bc-paper-ctec-analytics-comments-search {
      width: 100%;
      border: 1px solid var(--bc-color-accent-border-14);
      border-radius: var(--bc-radius-xl);
      background: var(--bc-color-surface-translucent-84);
      color: var(--bc-color-text-mauve-deep);
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      padding: 8px 10px;
    }
    .bc-paper-ctec-analytics-comments-count {
      flex: 0 0 auto;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text-mauve-soft);
      white-space: nowrap;
    }
    .bc-paper-ctec-analytics-comments {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 10px;
    }
    .bc-paper-ctec-analytics-comment-group {
      border-radius: var(--bc-radius-2xl);
      border: 1px solid var(--bc-color-accent-border-08);
      background: var(--bc-color-surface-translucent-56);
      padding: 12px;
    }
    .bc-paper-ctec-analytics-comment-prompt {
      margin-bottom: 8px;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-extrabold);
      line-height: 1.45;
      color: var(--bc-color-text-mauve-warm);
    }
    .bc-paper-ctec-analytics-comment-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bc-paper-ctec-analytics-comment-card {
      padding: 10px;
      border-radius: var(--bc-radius-xl);
      background: var(--bc-color-accent-fill-05);
      font-size: var(--bc-font-12);
      line-height: 1.5;
      color: var(--bc-color-text-soft);
      white-space: pre-wrap;
    }
    .bc-paper-ctec-comment-highlight {
      background: var(--bc-color-comment-highlight-light);
      color: inherit;
      border-radius: var(--bc-radius-xs);
      padding: 0 1px;
    }
    .bc-paper-ctec-analytics-refresh-toolbar {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 14px;
      padding: 12px;
      border-radius: var(--bc-radius-2xl);
      border: 1px dashed var(--bc-color-accent-border-22);
      background: var(--bc-color-accent-fill-04);
    }
    .bc-paper-ctec-analytics-refresh-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-refresh-copy {
      flex: 1 1 180px;
      min-width: 0;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      line-height: 1.45;
      color: var(--bc-color-text-mauve-warm);
    }
    .bc-paper-ctec-analytics-refresh-explainer {
      font-size: var(--bc-font-11);
      line-height: 1.4;
      color: var(--bc-color-text-mauve-soft);
    }
    .bc-paper-ctec-analytics-load-more {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin: 16px 0 8px;
      padding: 10px 12px;
      border-radius: var(--bc-radius-2xl);
      border: 1px dashed var(--bc-color-accent-border-22);
      background: var(--bc-color-accent-fill-04);
    }
    .bc-paper-ctec-analytics-load-more-copy {
      flex: 1 1 180px;
      min-width: 0;
      font-size: var(--bc-font-12);
      line-height: 1.4;
      color: var(--bc-color-text-mauve-warm);
    }
    .bc-paper-ctec-analytics-refresh-btn {
      padding: 6px 10px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-color-accent-border-32);
      background: var(--bc-color-surface-translucent-72);
      color: var(--bc-color-accent-soft);
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-refresh-btn:hover:not(:disabled) {
      background: var(--bc-color-accent-fill-12);
    }
    .bc-paper-ctec-analytics-refresh-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .bc-paper-ctec-analytics-load-more-btn {
      flex: 0 0 auto;
      padding: 6px 12px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-color-accent-soft);
      background: var(--bc-color-accent-soft);
      color: var(--bc-color-accent-soft-on);
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-load-more-btn:hover {
      background: var(--bc-color-accent-soft-hover);
      border-color: var(--bc-color-accent-soft-hover);
    }
  `;
}
