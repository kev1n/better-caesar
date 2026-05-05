// Related-component picker UI (lab/discussion required when adding lecture).
export function relatedPickerStyles(): string {
  return `
    /* ── Related-component picker (lab/discussion required) ──────────────── */
    .bc-cs-related-row {
      display: block;
      padding: 0;
      border-top: 1px solid var(--bc-color-border-divider);
      background: var(--bc-color-accent-surface-tile);
    }
    .bc-cs-related {
      padding: 12px 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-cs-related-header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .bc-cs-related-title {
      font-size: var(--bc-font-13);
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-accent-pressed);
    }
    .bc-cs-related-sub {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      flex: 1;
    }
    .bc-cs-related-cancel {
      appearance: none;
      background: transparent;
      border: 1px solid var(--bc-color-border-strong);
      color: var(--bc-color-text-muted);
      font-size: var(--bc-font-12);
      padding: 4px 10px;
      border-radius: var(--bc-radius-md);
      cursor: pointer;
    }
    .bc-cs-related-cancel:hover {
      background: var(--bc-color-surface-soft);
      color: var(--bc-color-text);
    }
    .bc-cs-related-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bc-cs-related-option {
      appearance: none;
      width: 100%;
      text-align: left;
      background: var(--bc-color-bg);
      border: 1px solid var(--bc-color-border-divider);
      border-radius: var(--bc-radius-lg);
      padding: 10px 12px;
      cursor: pointer;
      display: grid;
      grid-template-columns: minmax(80px, auto) minmax(160px, 1fr) minmax(120px, auto);
      gap: 12px;
      align-items: center;
      font-size: var(--bc-font-13);
      color: var(--bc-color-text);
      transition: border-color 0.12s, box-shadow 0.12s, transform 0.04s;
    }
    .bc-cs-related-option:hover:not(:disabled) {
      border-color: var(--bc-color-accent);
      box-shadow: var(--bc-shadow-input-focus-ring);
    }
    .bc-cs-related-option:active:not(:disabled) {
      transform: translateY(1px);
    }
    .bc-cs-related-option:disabled {
      cursor: progress;
    }
    .bc-cs-related-option[data-status="Closed"] {
      background: var(--bc-color-surface-soft);
    }
    .bc-cs-related-option-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bc-cs-related-option-section {
      font-weight: var(--bc-fw-bold);
      color: var(--bc-color-accent);
    }
    .bc-cs-related-option-mid {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .bc-cs-related-option-right {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: flex-end;
    }
    .bc-cs-related-option-instr {
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bc-cs-related-option-progress {
      margin-left: 8px;
      font-size: var(--bc-font-11);
      color: var(--bc-color-accent);
      font-weight: var(--bc-fw-semibold);
    }
  `;
}
