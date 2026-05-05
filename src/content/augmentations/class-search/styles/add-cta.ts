// Primary "Add to cart" CTA + its loading / success / error / disabled states.
export function addCtaStyles(): string {
  return `
    /* ── Add-to-cart: primary CAESAR CTA ────────────────────────────────── */
    .bc-cs-add {
      background: var(--bc-color-accent);
      color: var(--bc-color-accent-on);
      border: 1px solid var(--bc-color-accent);
      border-radius: var(--bc-radius-lg);
      padding: 6px 12px;
      font: inherit;
      font-size: var(--bc-font-12);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-wide);
      cursor: pointer;
      transition: background-color 100ms, transform var(--bc-tx-fast), box-shadow 100ms;
    }
    .bc-cs-add:hover {
      background: var(--bc-color-accent-hover);
      border-color: var(--bc-color-accent-hover);
      box-shadow: var(--bc-shadow-add-cta);
    }
    .bc-cs-add:active { transform: translateY(1px); box-shadow: none; }
    .bc-cs-add[disabled] {
      background: var(--bc-color-disabled-bg);
      border-color: var(--bc-color-disabled-bg);
      cursor: progress;
      box-shadow: none;
    }
    .bc-cs-add[data-state="loading"] {
      background: var(--bc-color-accent-hover);
      border-color: var(--bc-color-accent-hover);
      cursor: progress;
    }
    .bc-cs-add[data-state="success"] {
      background: var(--bc-color-success);
      border-color: var(--bc-color-success);
    }
    .bc-cs-add[data-state="error"] {
      background: var(--bc-color-danger);
      border-color: var(--bc-color-danger);
    }
  `;
}
