import {
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_TABS_CLASS
} from "../constants";

// Side-card shell styles: the tab strip that toggles the analytics view, the
// panel frame around it, the small launcher block that the panel mostly
// reduces to now (the rich rendering moved into the modal). Content rendered
// *inside* the panel (cards, charts, comments preview, refresh controls)
// lives in side-card-panel.ts.
export function sideCardStyles(): string {
  return `
    .${SIDECARD_TABS_CLASS} {
      display: flex;
      gap: 8px;
      margin: 0 0 14px;
      padding: 4px;
      border-radius: var(--bc-radius-2xl);
      background: var(--bc-color-accent-fill-06);
      position: relative;
      z-index: 2;
      pointer-events: auto;
    }
    .bc-paper-ctec-side-tab {
      flex: 1 1 0;
      min-width: 0;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--bc-radius-xl);
      background: transparent;
      color: var(--bc-color-text-mauve-soft);
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-extrabold);
      letter-spacing: var(--bc-ls-wider);
      text-transform: uppercase;
      cursor: pointer;
      transition: background var(--bc-tx-base) var(--bc-easing), color var(--bc-tx-base) var(--bc-easing);
      position: relative;
      z-index: 1;
      pointer-events: auto;
    }
    .bc-paper-ctec-side-tab:hover {
      background: var(--bc-color-accent-fill-08);
    }
    .bc-paper-ctec-side-tab.is-active {
      background: var(--bc-color-accent-fill-15);
      color: var(--bc-color-accent-soft);
    }
    .${SIDECARD_ANALYTICS_PANEL_CLASS} {
      margin: 0 0 12px;
      border: 1px solid var(--bc-color-accent-border-12);
      border-radius: var(--bc-radius-3xl);
      background: linear-gradient(180deg, var(--bc-color-panel-grad-top), var(--bc-color-panel-grad-bottom));
      color: var(--bc-color-text-mauve-panel);
      overflow: hidden;
      box-shadow: var(--bc-shadow-side-panel);
    }
    .bc-paper-ctec-analytics-body {
      padding: 14px;
    }
    .bc-paper-ctec-analytics-head {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      margin-bottom: 12px;
    }
    .bc-paper-ctec-analytics-title {
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-extrabold);
      color: var(--bc-color-accent-soft);
    }
    .bc-paper-ctec-analytics-subtitle {
      margin-top: 4px;
      font-size: var(--bc-font-12);
      line-height: 1.4;
      color: var(--bc-color-text-mauve-soft);
    }
    .bc-paper-ctec-analytics-callout {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: var(--bc-radius-xl);
      background: var(--bc-color-accent-fill-06);
      font-size: var(--bc-font-12);
      line-height: 1.45;
    }
    .bc-paper-ctec-analytics-callout.is-warn {
      background: var(--bc-color-warn-rose-fill-12);
      color: var(--bc-color-warn-rose-text-deep);
    }
    .bc-paper-ctec-analytics-callout.is-muted {
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-analytics-callout a {
      flex-shrink: 0;
      color: inherit;
      font-weight: var(--bc-fw-extrabold);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .bc-paper-ctec-analytics-launcher {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 14px 0 0;
      padding: 12px;
      border-radius: var(--bc-radius-2xl);
      background: var(--bc-color-accent-fill-06);
    }
    .bc-paper-ctec-analytics-launcher-copy {
      font-size: var(--bc-font-12);
      line-height: 1.45;
      color: var(--bc-color-text-mauve-warm);
    }
    .bc-paper-ctec-analytics-launcher-btn {
      align-self: flex-start;
      padding: 8px 14px;
      border-radius: var(--bc-radius-pill);
      border: 1px solid var(--bc-color-accent-soft);
      background: var(--bc-color-accent-soft);
      color: var(--bc-color-accent-soft-on);
      font: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-launcher-btn:hover {
      background: var(--bc-color-accent-soft-hover);
      border-color: var(--bc-color-accent-soft-hover);
    }
  `;
}
