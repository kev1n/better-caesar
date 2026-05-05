// Search form card surface + form layout, fields, inputs, selects.
export function cardStyles(): string {
  return `
    /* ── Card / form ────────────────────────────────────────────────────── */
    .bc-cs-card {
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-2xl);
      padding: 14px;
      box-shadow: var(--bc-shadow-elev-1);
    }
    .bc-cs-form {
      display: grid;
      grid-template-columns: minmax(280px, 3fr) minmax(180px, 1fr);
      gap: 12px;
      align-items: end;
    }
    .bc-cs-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .bc-cs-field label {
      font-size: var(--bc-font-10);
      font-weight: var(--bc-fw-bold);
      letter-spacing: var(--bc-ls-caps);
      color: var(--bc-color-text-muted);
      text-transform: uppercase;
    }
    .bc-cs-input, .bc-cs-select {
      width: 100%;
      font: inherit;
      font-size: var(--bc-font-14);
      padding: 8px 10px;
      border: 1px solid var(--bc-color-border-strong);
      border-radius: var(--bc-radius-lg);
      background: var(--bc-color-bg);
      color: var(--bc-color-text);
      transition: border-color 100ms, box-shadow 100ms;
    }
    .bc-cs-input:focus, .bc-cs-select:focus {
      outline: none;
      border-color: var(--bc-color-accent);
      box-shadow:
        var(--bc-shadow-input-focus-ring),
        var(--bc-shadow-input-focus-inner);
    }
    .bc-cs-input-query {
      font-size: var(--bc-font-16);
      padding: 12px 14px;
      letter-spacing: 0.005em;
    }
    .bc-cs-input::placeholder { color: var(--bc-color-text-subtle); }
  `;
}
