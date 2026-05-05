// Better/Classic tab buttons that sit above the card surface.
export function tabsStyles(): string {
  return `
    /* ── Tabs ───────────────────────────────────────────────────────────── */
    /* Sit flush with the top edge of the card below: only the active tab
       is "lifted" into the surface; inactive tabs are flat with muted
       text. The negative margin pulls the active tab over the card border. */
    .bc-cs-tabs {
      display: flex;
      gap: 2px;
      max-width: 1180px;
      margin: 12px auto 0;
      padding: 0 16px;
      border-bottom: 1px solid var(--bc-color-border-divider);
    }
    .bc-cs-tab {
      position: relative;
      bottom: -1px;
      background: transparent;
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: var(--bc-radius-lg) var(--bc-radius-lg) 0 0;
      padding: 8px 14px;
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-15);
      font-weight: var(--bc-fw-regular);
      letter-spacing: 0;
      color: var(--bc-color-text-muted);
      cursor: pointer;
      transition: color var(--bc-tx-fast), background-color var(--bc-tx-fast);
    }
    .bc-cs-tab:hover {
      color: var(--bc-color-text);
      background: var(--bc-color-surface-hover);
    }
    .bc-cs-tab[data-active="true"] {
      background: var(--bc-color-bg);
      border-color: var(--bc-color-border-divider);
      color: var(--bc-color-text);
      box-shadow: var(--bc-shadow-card-soft);
    }
    .bc-cs-tab[data-active="true"]:hover {
      background: var(--bc-color-bg);
    }
    #better-caesar-class-search-panel { margin-top: 24px; }
  `;
}
