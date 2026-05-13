import { ANALYTICS_MODAL_ID } from "../constants";

// Modal frame styles: backdrop, card, close button, header (identity, title,
// meta strip, report link, action buttons), refresh-flash banners, status
// body (loading + error states), and the tab strip.
export function modalStyles(): string {
  return `
    #${ANALYTICS_MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bc-color-overlay-modal);
      backdrop-filter: blur(2px);
      animation: bc-paper-ctec-modal-fade 140ms ease-out;
      padding: 12px;
    }
    @keyframes bc-paper-ctec-modal-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .bc-paper-ctec-modal-card {
      width: min(1800px, 98vw);
      height: 96vh;
      background: var(--bc-color-bg);
      color: var(--bc-color-text);
      border-radius: var(--bc-radius-3xl);
      box-shadow: var(--bc-shadow-modal);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--bc-font-body);
    }
    .bc-paper-ctec-modal-card *,
    .bc-paper-ctec-modal-card *::before,
    .bc-paper-ctec-modal-card *::after {
      box-sizing: border-box;
    }
    .bc-paper-ctec-modal-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 32px;
      height: 32px;
      border-radius: var(--bc-radius-lg);
      display: grid;
      place-items: center;
      border: 1px solid var(--bc-color-border);
      background: var(--bc-color-bg);
      color: var(--bc-color-text-muted);
      cursor: pointer;
      font-size: var(--bc-font-16);
      z-index: 2;
    }
    .bc-paper-ctec-modal-close:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-header {
      position: relative;
      padding: 22px 32px 0;
      border-bottom: 1px solid var(--bc-color-border);
      flex-shrink: 0;
    }
    .bc-paper-ctec-modal-identity {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: end;
    }
    .bc-paper-ctec-modal-code {
      font-family: ui-monospace, monospace;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text-muted);
      letter-spacing: var(--bc-ls-wide);
    }
    .bc-paper-ctec-modal-title {
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-28);
      font-weight: var(--bc-fw-display);
      letter-spacing: var(--bc-ls-tight);
      margin: 0;
      line-height: 1.1;
    }
    .bc-paper-ctec-modal-meta {
      margin-top: 10px;
      display: flex;
      align-items: center;
      gap: 0;
      row-gap: 6px;
      flex-wrap: wrap;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-modal-meta > * + *::before {
      content: "";
      display: inline-block;
      width: 1px;
      height: 11px;
      background: var(--bc-color-border-strong);
      margin: 0 14px;
      vertical-align: -1px;
    }
    .bc-paper-ctec-modal-meta strong {
      color: var(--bc-color-text);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-report-link {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text);
      text-decoration: none;
      border: 1px solid var(--bc-color-border);
      padding: 7px 12px;
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-bg);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-report-link:hover {
      background: var(--bc-color-surface-hover);
    }
    .bc-paper-ctec-modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .bc-paper-ctec-modal-action-btn {
      font: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      letter-spacing: var(--bc-ls-snug);
      padding: 7px 12px;
      border-radius: var(--bc-radius-lg);
      border: 1px solid var(--bc-color-border);
      background: var(--bc-color-bg);
      color: var(--bc-color-text);
      cursor: pointer;
      white-space: nowrap;
    }
    .bc-paper-ctec-modal-action-btn:hover:not(:disabled) {
      background: var(--bc-color-surface-hover);
    }
    .bc-paper-ctec-modal-action-btn.is-primary {
      border-color: var(--bc-color-accent);
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-paper-ctec-modal-action-btn.is-primary:hover:not(:disabled) {
      background: var(--bc-color-accent-hover);
    }
    .bc-paper-ctec-modal-action-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .bc-paper-ctec-modal-action-loadmore {
      font-weight: var(--bc-fw-medium);
      font-size: 11.5px;
      padding: 6px 10px;
      color: var(--bc-color-text-muted);
      background: transparent;
      border-color: transparent;
    }
    .bc-paper-ctec-modal-action-loadmore:hover:not(:disabled) {
      background: var(--bc-color-surface-hover-strong);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-action-refresh:disabled {
      opacity: 1;
      color: var(--bc-color-text-muted);
      background: var(--bc-color-surface-hover);
      animation: bc-paper-ctec-refresh-pulse 1.6s ease-in-out infinite;
    }
    @keyframes bc-paper-ctec-refresh-pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    .bc-paper-ctec-modal-flash {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: var(--bc-radius-xl);
      border: 1px solid;
      animation: bc-paper-ctec-flash-in 220ms ease-out;
    }
    @keyframes bc-paper-ctec-flash-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .bc-paper-ctec-modal-flash-success {
      background: var(--bc-color-success-bg-soft);
      border-color: var(--bc-color-success-border);
      color: var(--bc-color-success-text);
    }
    .bc-paper-ctec-modal-flash-auth {
      background: var(--bc-color-warn-bg-soft);
      border-color: var(--bc-color-warn-border);
      color: var(--bc-color-warn-text);
    }
    .bc-paper-ctec-modal-flash-error {
      background: var(--bc-color-danger-bg-soft);
      border-color: var(--bc-color-danger-border);
      color: var(--bc-color-danger-text);
    }
    .bc-paper-ctec-modal-flash-icon {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      border-radius: var(--bc-radius-circle);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      background: var(--bc-color-flash-pill-bg);
    }
    .bc-paper-ctec-modal-flash-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .bc-paper-ctec-modal-flash-title {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-flash-body {
      font-size: var(--bc-font-12);
      opacity: 0.85;
    }
    .bc-paper-ctec-modal-flash-action {
      font: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      padding: 6px 10px;
      border-radius: var(--bc-radius-md);
      border: 1px solid currentColor;
      background: var(--bc-color-flash-action-bg);
      color: inherit;
      cursor: pointer;
      white-space: nowrap;
      align-self: center;
    }
    .bc-paper-ctec-modal-flash-action:hover {
      background: var(--bc-color-flash-action-bg-hover);
    }
    .bc-paper-ctec-modal-flash-dismiss {
      font: inherit;
      font-size: var(--bc-font-14);
      line-height: 1;
      width: 22px;
      height: 22px;
      border-radius: var(--bc-radius-md);
      border: none;
      background: transparent;
      color: inherit;
      opacity: 0.55;
      cursor: pointer;
      align-self: center;
    }
    .bc-paper-ctec-modal-flash-dismiss:hover {
      opacity: 1;
      background: var(--bc-color-overlay-on-light);
    }
    .bc-paper-ctec-modal-status-body {
      flex: 1;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 32px;
      background: var(--bc-color-bg-muted);
    }
    .bc-paper-ctec-modal-status-card {
      max-width: 440px;
      padding: 28px 30px;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-3xl);
      text-align: center;
      box-shadow: var(--bc-shadow-modal-status);
    }
    .bc-paper-ctec-modal-status-card.is-warn {
      border-color: var(--bc-color-accent-border-28);
      background: var(--bc-color-accent-surface-faint);
    }
    .bc-paper-ctec-modal-status-title {
      font-size: var(--bc-font-18);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text);
      margin: 0 0 8px;
    }
    .bc-paper-ctec-modal-status-card.is-warn .bc-paper-ctec-modal-status-title {
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-modal-status-text {
      font-size: var(--bc-font-13);
      line-height: 1.5;
      color: var(--bc-color-text-soft);
      margin: 0 0 16px;
    }
    .bc-paper-ctec-modal-status-pivots {
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px dashed var(--bc-color-border);
    }
    .bc-paper-ctec-modal-status-pivots-prompt {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      margin: 0 0 10px;
      letter-spacing: var(--bc-ls-wide);
      text-transform: uppercase;
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-status-pivots-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: stretch;
    }
    .bc-paper-ctec-modal-status-pivot-btn {
      width: 100%;
    }
    .bc-paper-ctec-modal-status-spinner {
      width: 32px;
      height: 32px;
      margin: 0 auto 14px;
      border-radius: var(--bc-radius-circle);
      border: 3px solid var(--bc-color-accent-fill-18);
      border-top-color: var(--bc-color-accent);
      animation: bc-paper-ctec-modal-spin 900ms linear infinite;
    }
    @keyframes bc-paper-ctec-modal-spin {
      to { transform: rotate(360deg); }
    }
    .bc-paper-ctec-modal-disclaimer {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
      padding: 4px 10px;
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-ink-fill-04);
      font-size: var(--bc-font-12);
      line-height: 1.4;
      color: var(--bc-color-text-muted);
      align-self: flex-start;
    }
    .bc-paper-ctec-modal-disclaimer-name {
      color: var(--bc-color-accent);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-modal-disclaimer-count {
      font-family: ui-monospace, monospace;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-regular);
      color: var(--bc-color-text-muted);
      letter-spacing: var(--bc-ls-wide);
    }
    .bc-paper-ctec-modal-strategy-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-modal-strategy-row .bc-paper-ctec-modal-disclaimer {
      margin-top: 0;
      margin-left: auto;
      align-self: center;
    }
    .bc-paper-ctec-modal-strategy {
      display: inline-flex;
      gap: 0;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-md);
      padding: 3px;
    }
    .bc-paper-ctec-modal-strategy-reopen {
      appearance: none;
      background: transparent;
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-medium);
      color: var(--bc-color-text-muted);
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-color: var(--bc-color-border-strong);
    }
    .bc-paper-ctec-modal-strategy-reopen:hover {
      color: var(--bc-color-text);
      text-decoration-color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-strategy-option {
      appearance: none;
      background: transparent;
      border: none;
      border-radius: calc(var(--bc-radius-md) - 3px);
      padding: 6px 12px;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      line-height: 1.2;
      letter-spacing: var(--bc-ls-tight);
      transition: background 80ms ease, color 80ms ease;
    }
    .bc-paper-ctec-modal-strategy-option:hover {
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-strategy-option.is-active {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-paper-ctec-modal-strategy-option.is-active:hover {
      color: var(--bc-color-accent-on);
    }
    .bc-paper-ctec-modal-tabs {
      display: flex;
      gap: 6px;
      margin-top: 16px;
    }
    .bc-paper-ctec-modal-tab {
      position: relative;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-md) var(--bc-radius-md) 0 0;
      padding: 8px 14px;
      margin-bottom: -1px;
      cursor: pointer;
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bc-paper-ctec-modal-tab:hover {
      border-color: var(--bc-color-border-strong);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-modal-tab.is-active {
      background: var(--bc-color-bg-muted);
      border-color: var(--bc-color-accent);
      border-bottom-color: var(--bc-color-bg-muted);
      color: var(--bc-color-accent);
      z-index: 1;
    }
    .bc-paper-ctec-modal-tab-count {
      font-size: var(--bc-font-10);
      font-family: ui-monospace, monospace;
      color: var(--bc-color-text-subtle);
      background: var(--bc-color-surface-hover);
      padding: 2px 6px;
      border-radius: var(--bc-radius-lg);
    }
    .bc-paper-ctec-modal-tab.is-active .bc-paper-ctec-modal-tab-count {
      color: var(--bc-color-accent);
      background: var(--bc-color-accent-surface-tile);
    }
    .bc-paper-ctec-modal-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: var(--bc-color-bg-muted);
    }
    .bc-paper-ctec-modal-overview {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 24px 32px 36px;
    }
    .bc-paper-ctec-dry-run-backdrop {
      position: absolute;
      inset: 0;
      background: var(--bc-color-overlay-modal);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      border-radius: inherit;
      animation: bc-paper-ctec-modal-fade 120ms ease-out;
      z-index: 10;
    }
    .bc-paper-ctec-dry-run-dialog {
      width: min(680px, 96%);
      max-height: 92vh;
      background: var(--bc-color-bg);
      color: var(--bc-color-text);
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-3xl);
      box-shadow: var(--bc-shadow-modal);
      padding: 22px 24px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      overflow: hidden;
    }
    .bc-paper-ctec-dry-run-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .bc-paper-ctec-dry-run-heading {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bc-paper-ctec-dry-run-eyebrow {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-semibold);
      letter-spacing: var(--bc-ls-wide);
      text-transform: uppercase;
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-title {
      font-size: var(--bc-font-18);
      font-weight: var(--bc-fw-bold);
      margin: 0;
      color: var(--bc-color-text);
      line-height: 1.25;
    }
    .bc-paper-ctec-dry-run-subtitle {
      font-size: var(--bc-font-13);
      color: var(--bc-color-text-soft);
      margin: 0;
      line-height: 1.4;
    }
    .bc-paper-ctec-dry-run-close {
      appearance: none;
      background: transparent;
      border: none;
      cursor: pointer;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      font-size: 16px;
      color: var(--bc-color-text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
    }
    .bc-paper-ctec-dry-run-close:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-dry-run-stage {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-height: 0;
      overflow: hidden;
    }
    .bc-paper-ctec-dry-run-stage--pick {
      flex: 1;
      min-height: 0;
    }
    .bc-paper-ctec-dry-run-back {
      appearance: none;
      background: transparent;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      padding: 4px 8px 4px 0;
      margin-right: 4px;
      align-self: center;
      border-radius: var(--bc-radius-sm);
      flex: 0 0 auto;
    }
    .bc-paper-ctec-dry-run-back:hover {
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-choices {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-paper-ctec-dry-run-choice {
      appearance: none;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-md);
      transition: border-color 100ms ease, background 100ms ease,
        transform 100ms ease;
    }
    .bc-paper-ctec-dry-run-choice:hover {
      border-color: var(--bc-color-accent);
      background: var(--bc-color-accent-surface-faint);
      transform: translateY(-1px);
    }
    .bc-paper-ctec-dry-run-choice.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .bc-paper-ctec-dry-run-choice.is-disabled:hover {
      border-color: var(--bc-color-border);
      background: var(--bc-color-bg);
      transform: none;
    }
    .bc-paper-ctec-dry-run-choice-icon {
      flex: 0 0 auto;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--bc-color-accent-surface-tile);
      color: var(--bc-color-accent);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .bc-paper-ctec-dry-run-choice-keyword {
      color: var(--bc-color-text);
      font-weight: var(--bc-fw-bold);
    }
    .bc-paper-ctec-dry-run-choice-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bc-paper-ctec-dry-run-choice-title {
      font-size: var(--bc-font-14);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text);
      line-height: 1.3;
    }
    .bc-paper-ctec-dry-run-choice-sublabel {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-dry-run-choice-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex: 0 0 auto;
      min-width: 96px;
      position: relative;
    }
    .bc-paper-ctec-dry-run-choice-count {
      font-size: var(--bc-font-18);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-accent);
      font-family: ui-monospace, monospace;
      line-height: 1;
    }
    .bc-paper-ctec-dry-run-choice-count-label {
      font-size: 11px;
      color: var(--bc-color-text-muted);
      letter-spacing: var(--bc-ls-tight);
    }
    .bc-paper-ctec-dry-run-choice-loading {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .bc-paper-ctec-dry-run-choice-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid var(--bc-color-border);
      border-top-color: var(--bc-color-accent);
      border-radius: 50%;
      animation: bc-paper-ctec-dry-run-spin 700ms linear infinite;
    }
    @keyframes bc-paper-ctec-dry-run-spin {
      to { transform: rotate(360deg); }
    }
    .bc-paper-ctec-dry-run-choice-loading-text {
      font-size: 11px;
      color: var(--bc-color-text-muted);
      letter-spacing: var(--bc-ls-tight);
    }
    .bc-paper-ctec-dry-run-choice-status {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      font-weight: var(--bc-fw-semibold);
      text-align: right;
    }
    .bc-paper-ctec-dry-run-choice-status.is-error {
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-choice-chevron {
      position: absolute;
      right: -10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--bc-color-accent);
      font-size: 16px;
      opacity: 0;
      transition: opacity 120ms ease, transform 120ms ease;
    }
    .bc-paper-ctec-dry-run-choice:hover .bc-paper-ctec-dry-run-choice-chevron {
      opacity: 1;
      transform: translate(4px, -50%);
    }
    .bc-paper-ctec-dry-run-footer--choose {
      justify-content: flex-end;
      border-top: 1px solid var(--bc-color-border);
      padding-top: 10px;
    }
    .bc-paper-ctec-dry-run-empty {
      list-style: none;
      padding: 14px;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      font-style: italic;
      text-align: center;
      border: 1px dashed var(--bc-color-border);
      border-radius: var(--bc-radius-md);
    }
    .bc-paper-ctec-dry-run-presets {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 56vh;
      overflow-y: auto;
      padding-right: 2px;
    }
    .bc-paper-ctec-dry-run-pick-status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 120px;
      padding: 24px;
      color: var(--bc-color-text-muted);
      font-size: 13px;
      text-align: center;
      border: 1px dashed var(--bc-color-border);
      border-radius: var(--bc-radius-md);
    }
    .bc-paper-ctec-dry-run-preset {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 14px;
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-md);
      cursor: pointer;
      background: var(--bc-color-bg);
      transition: border-color 80ms ease, background 80ms ease;
    }
    .bc-paper-ctec-dry-run-preset:hover {
      border-color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-preset.is-active {
      border-color: var(--bc-color-accent);
      background: var(--bc-color-accent-surface-faint);
    }
    .bc-paper-ctec-dry-run-preset-radio {
      margin-top: 3px;
      accent-color: var(--bc-color-accent);
      cursor: pointer;
      flex: 0 0 auto;
    }
    .bc-paper-ctec-dry-run-preset-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bc-paper-ctec-dry-run-preset-headline {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-dry-run-preset-title {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-dry-run-preset-title-suffix {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-soft);
      font-weight: var(--bc-fw-regular);
    }
    .bc-paper-ctec-dry-run-preset-badge {
      font-size: 10px;
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      text-transform: uppercase;
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      padding: 2px 6px;
      border-radius: 999px;
    }
    .bc-paper-ctec-dry-run-preset-sublabel {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-dry-run-preset-preview {
      list-style: none;
      padding: 0;
      margin: 6px 0 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bc-paper-ctec-dry-run-preset-preview-row {
      font-size: 11.5px;
      color: var(--bc-color-text-soft);
      display: flex;
      gap: 5px;
      align-items: baseline;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-dry-run-preset-preview-term {
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
      min-width: 86px;
    }
    .bc-paper-ctec-dry-run-preset-preview-sep {
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-dry-run-preset-preview-axis {
      color: var(--bc-color-text-soft);
    }
    .bc-paper-ctec-dry-run-preset-preview-axis-faint {
      color: var(--bc-color-text-subtle);
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-dry-run-preset-preview-title {
      font-family: var(--bc-font-sans, inherit);
      color: var(--bc-color-text-soft);
      font-style: italic;
    }
    .bc-paper-ctec-dry-run-preset-empty {
      font-size: 11.5px;
      color: var(--bc-color-text-subtle);
      font-style: italic;
      margin-top: 6px;
    }
    .bc-paper-ctec-dry-run-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 8px 12px;
      background: var(--bc-color-bg-muted);
      border: 1px dashed var(--bc-color-border);
      border-radius: var(--bc-radius-md);
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-dry-run-hint-icon {
      font-size: 14px;
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-hint-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      font-size: 11px;
      font-weight: var(--bc-fw-bold);
      vertical-align: middle;
    }
    .bc-paper-ctec-dry-run-zone {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bc-paper-ctec-dry-run-zone--selected {
      padding: 10px 12px 12px;
      background: var(--bc-color-accent-surface-faint);
      border: 2px dashed var(--bc-color-accent);
      border-radius: var(--bc-radius-md);
    }
    .bc-paper-ctec-dry-run-zone--available {
      max-height: 38vh;
      overflow-y: auto;
      padding-right: 4px;
    }
    .bc-paper-ctec-dry-run-zone-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .bc-paper-ctec-dry-run-zone-label {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      text-transform: uppercase;
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-zone-counter {
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-dry-run-slots {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bc-paper-ctec-dry-run-slot {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--bc-radius-md);
      min-height: 40px;
      transition: background 80ms ease, opacity 80ms ease,
        border-color 80ms ease;
    }
    .bc-paper-ctec-dry-run-slot--empty {
      border: 1px dashed var(--bc-color-border-strong);
      background: var(--bc-color-bg);
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-12);
      font-style: italic;
    }
    .bc-paper-ctec-dry-run-slot--filled {
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      cursor: grab;
    }
    .bc-paper-ctec-dry-run-slot--filled:hover {
      border-color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-slot.is-dragging {
      opacity: 0.4;
      cursor: grabbing;
    }
    .bc-paper-ctec-dry-run-slot-handle {
      color: var(--bc-color-text-subtle);
      font-size: 14px;
      cursor: grab;
      user-select: none;
    }
    .bc-paper-ctec-dry-run-slot-rank,
    .bc-paper-ctec-dry-run-slot-empty-rank {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-text-subtle);
      background: var(--bc-color-bg-muted);
      border-radius: 999px;
      min-width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-dry-run-slot--filled .bc-paper-ctec-dry-run-slot-rank {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
    }
    .bc-paper-ctec-dry-run-slot-empty-text {
      flex: 1;
    }
    .bc-paper-ctec-dry-run-slot-body {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: baseline;
      gap: 6px;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-dry-run-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 4px;
    }
    .bc-paper-ctec-dry-run-group + .bc-paper-ctec-dry-run-group {
      margin-top: 4px;
      padding-top: 12px;
      border-top: 1px solid var(--bc-color-border);
    }
    .bc-paper-ctec-dry-run-group-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bc-paper-ctec-dry-run-group-title {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-soft);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-dry-run-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bc-paper-ctec-dry-run-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border);
      border-radius: var(--bc-radius-md);
      cursor: grab;
      transition: background 80ms ease, border-color 80ms ease, opacity 80ms ease;
    }
    .bc-paper-ctec-dry-run-row:hover {
      border-color: var(--bc-color-accent);
      background: var(--bc-color-accent-surface-faint);
    }
    .bc-paper-ctec-dry-run-row.is-dragging {
      opacity: 0.4;
      cursor: grabbing;
    }
    .bc-paper-ctec-dry-run-row-handle {
      color: var(--bc-color-text-subtle);
      font-size: 14px;
      cursor: grab;
      user-select: none;
    }
    .bc-paper-ctec-dry-run-row-body {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: baseline;
      gap: 6px;
      flex-wrap: wrap;
    }
    .bc-paper-ctec-dry-run-row-term,
    .bc-paper-ctec-dry-run-slot-body .bc-paper-ctec-dry-run-row-term {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
      min-width: 88px;
    }
    .bc-paper-ctec-dry-run-row-sep {
      color: var(--bc-color-text-subtle);
    }
    .bc-paper-ctec-dry-run-row-axis {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-soft);
      font-weight: var(--bc-fw-semibold);
    }
    .bc-paper-ctec-dry-run-row-axis-faint {
      font-size: var(--bc-font-11);
      color: var(--bc-color-text-subtle);
      font-family: ui-monospace, monospace;
    }
    .bc-paper-ctec-dry-run-source {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 999px;
      flex: 0 0 auto;
    }
    .bc-paper-ctec-dry-run-source--course {
      background: var(--bc-color-accent-surface-tile);
      color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-source--instructor {
      background: var(--bc-color-bg-muted);
      color: var(--bc-color-text);
      border: 1px solid var(--bc-color-border);
    }
    .bc-paper-ctec-dry-run-source--combo {
      background: transparent;
      color: var(--bc-color-text-subtle);
      border: 1px dashed var(--bc-color-border);
    }
    .bc-paper-ctec-dry-run-action {
      appearance: none;
      background: var(--bc-color-bg-muted);
      border: 1px solid var(--bc-color-border);
      width: 26px;
      height: 26px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      font-weight: var(--bc-fw-bold);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--bc-color-text);
      flex: 0 0 auto;
      line-height: 1;
    }
    .bc-paper-ctec-dry-run-action--add:hover {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      border-color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-action--remove:hover {
      background: var(--bc-color-bg);
      color: var(--bc-color-accent);
      border-color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--bc-color-border);
    }
    .bc-paper-ctec-dry-run-count {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
    }
    .bc-paper-ctec-dry-run-count strong {
      color: var(--bc-color-text);
      font-weight: var(--bc-fw-bold);
    }
    .bc-paper-ctec-dry-run-actions {
      display: flex;
      gap: 8px;
    }
    .bc-paper-ctec-dry-run-btn {
      appearance: none;
      font-family: inherit;
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-semibold);
      padding: 8px 16px;
      border-radius: var(--bc-radius-md);
      cursor: pointer;
      border: 1px solid var(--bc-color-border);
      background: var(--bc-color-bg);
      color: var(--bc-color-text);
    }
    .bc-paper-ctec-dry-run-btn:hover {
      background: var(--bc-color-surface-hover);
    }
    .bc-paper-ctec-dry-run-btn--primary {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      border-color: var(--bc-color-accent);
    }
    .bc-paper-ctec-dry-run-btn--primary:hover {
      background: var(--bc-color-accent-hover);
      border-color: var(--bc-color-accent-hover);
    }
    .bc-paper-ctec-dry-run-btn--primary:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `;
}
