// Status row (loading spinner, error text) + meta footer.
export function statusStyles(): string {
  return `
    /* ── Status row ─────────────────────────────────────────────────────── */
    .bc-cs-status {
      margin-top: 10px;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 16px;
    }
    .bc-cs-status[data-state="error"] { color: var(--bc-color-danger); }
    .bc-cs-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid var(--bc-color-accent-fill-18);
      border-top-color: var(--bc-color-accent);
      border-radius: var(--bc-radius-circle);
      animation: bc-cs-spin 0.7s linear infinite;
    }
    @keyframes bc-cs-spin { to { transform: rotate(360deg); } }

    .bc-cs-meta { font-size: var(--bc-font-11); color: var(--bc-color-text-muted); }
  `;
}
