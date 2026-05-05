// Root container + page header (title, subtitle).
export function headerStyles(): string {
  return `
    .bc-cs-root {
      position: relative;
      margin: 12px auto 32px;
      max-width: 1180px;
      padding: 0 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      color: var(--bc-color-text);
      box-sizing: border-box;
    }
    .bc-cs-root *, .bc-cs-root *::before, .bc-cs-root *::after { box-sizing: border-box; }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .bc-cs-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .bc-cs-title {
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-22);
      font-weight: var(--bc-fw-regular);
      letter-spacing: 0;
      color: var(--bc-color-text);
      margin: 0;
    }
    .bc-cs-subtitle {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      line-height: 1.4;
    }
    .bc-cs-subtitle a { color: var(--bc-color-text); text-decoration: underline; text-decoration-color: var(--bc-color-border-strong); }
    .bc-cs-subtitle a:hover { text-decoration-color: var(--bc-color-text); }
  `;
}
