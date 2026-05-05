// Distro / discipline filter pills + clear-filters button.
export function pillsStyles(): string {
  return `
    /* ── Filter pills ───────────────────────────────────────────────────── */
    .bc-cs-toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--bc-color-border-divider);
      align-items: center;
    }
    .bc-cs-checkbox {
      display: inline-flex;
      gap: 5px;
      align-items: center;
      padding: 4px 10px;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text);
      background: var(--bc-color-surface-soft);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-pill);
      cursor: pointer;
      user-select: none;
      transition: background-color var(--bc-tx-fast), border-color var(--bc-tx-fast);
    }
    .bc-cs-checkbox:hover {
      border-color: var(--bc-color-border-strong);
      background: var(--bc-color-bg);
    }
    .bc-cs-checkbox input {
      accent-color: var(--bc-color-accent);
      margin: 0;
      width: 12px;
      height: 12px;
    }
    .bc-cs-checkbox:has(input:checked) {
      background: var(--bc-color-accent-surface-tile);
      border-color: var(--bc-color-accent-border-18);
      color: var(--bc-color-accent-pressed);
    }
    .bc-cs-clear {
      margin-left: auto;
      background: transparent;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-lg);
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      color: var(--bc-color-text-muted);
      padding: 5px 10px;
      cursor: pointer;
      transition: color var(--bc-tx-fast), border-color var(--bc-tx-fast);
    }
    .bc-cs-clear:hover {
      color: var(--bc-color-accent);
      border-color: var(--bc-color-accent);
    }
  `;
}
