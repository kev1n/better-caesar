// Per-section rows (id, component, time, instructor, room, live status,
// status pills, and the per-section actions cluster including Details).
export function sectionRowsStyles(): string {
  return `
    /* ── Section rows ───────────────────────────────────────────────────── */
    .bc-cs-section-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .bc-cs-section {
      display: grid;
      grid-template-columns: 80px 64px minmax(0, 1.4fr) minmax(0, 1.4fr) minmax(0, 1.2fr) minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 16px;
      border-top: 1px solid var(--bc-color-border-divider);
      font-size: var(--bc-font-13);
      transition: background-color var(--bc-tx-fast);
    }
    .bc-cs-section:hover { background: var(--bc-color-surface-soft); }
    .bc-cs-section-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
    }
    .bc-cs-section-component { color: var(--bc-color-text-muted); font-size: var(--bc-font-12); }
    .bc-cs-section-time { color: var(--bc-color-text); font-size: var(--bc-font-12); line-height: 1.4; }
    .bc-cs-section-time .bc-cs-mute { color: var(--bc-color-text-subtle); font-size: var(--bc-font-11); }
    .bc-cs-section-instructor {
      color: var(--bc-color-text);
      font-size: var(--bc-font-12);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-section-room {
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-11);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-section-live {
      font-size: var(--bc-font-11);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      color: var(--bc-color-text-muted);
    }
    .bc-cs-section-live[data-tone="muted"] {
      color: var(--bc-color-text-subtle);
      font-style: italic;
    }

    .bc-cs-status-pill {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-widest);
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: var(--bc-radius-pill);
      background: var(--bc-color-surface-soft);
      color: var(--bc-color-text-muted);
      border: 1px solid var(--bc-color-border-divider);
      line-height: 1.4;
    }
    .bc-cs-status-pill[data-status="Open"]      { background: var(--bc-color-success-bg); color: var(--bc-color-success); border-color: transparent; }
    .bc-cs-status-pill[data-status="Closed"]    { background: var(--bc-color-danger-bg);  color: var(--bc-color-danger);  border-color: transparent; }
    .bc-cs-status-pill[data-status="Wait List"] { background: var(--bc-color-warn-bg);    color: var(--bc-color-warn);    border-color: transparent; }

    .bc-cs-section-actions {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: flex-end;
      /* Each .bc-cs-section is its own grid (the auto last column sizes
         to content) — a min-width here reserves the actions column even
         on rows that hide buttons (DIS / LAB under a LEC), so the row
         stays aligned with its LEC sibling. Width covers the natural
         "Details" + "Add to cart" cluster. */
      min-width: 188px;
    }
    .bc-cs-details-btn {
      background: transparent;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-lg);
      padding: 5px 10px;
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      cursor: pointer;
      transition: color var(--bc-tx-fast), border-color var(--bc-tx-fast), background-color var(--bc-tx-fast);
      /* Inline-flex so a spinner span sits next to the label text inside
         the button when data-state="loading". min-width keeps the button
         a stable size across "Details" / "Loading…" / "Hide" so the row's
         actions cluster never reflows mid-click — important at narrow
         viewports where a few extra pixels can push Add-to-cart to wrap. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 76px;
    }
    .bc-cs-details-btn:hover {
      color: var(--bc-color-text);
      border-color: var(--bc-color-border-strong);
      background: var(--bc-color-surface-hover);
    }
    .bc-cs-details-btn[data-expanded="true"] {
      background: var(--bc-color-surface-hover-strong);
      color: var(--bc-color-text);
      border-color: var(--bc-color-border-strong);
    }
    .bc-cs-details-btn[disabled],
    .bc-cs-details-btn[data-state="loading"] {
      cursor: progress;
      opacity: 0.7;
    }
    .bc-cs-details-btn[data-state="loading"] {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text);
    }

    /* Inline button spinner — used inside .bc-cs-details-btn and
       .bc-cs-add when data-state="loading". Inherits color from the
       host button via currentColor so it reads on both transparent and
       filled backgrounds without per-button overrides. */
    .bc-cs-btn-spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: var(--bc-radius-circle);
      opacity: 0.75;
      animation: bc-cs-spin 0.7s linear infinite;
      flex: 0 0 auto;
    }
  `;
}
