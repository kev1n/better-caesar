// =============================================================================
// Design tokens. Every color, radius, shadow, type size, and motion timing
// the extension uses is declared here as a CSS custom property. To change
// the look-and-feel: edit a value below, or add a new theme override block.
//
// Two scopes:
//   :root, [data-bc-theme="default"]  — base + default light values
//   [data-bc-theme="default"][data-bc-mode="dark"]  — default dark overrides
//
// Theme authors only need to override the vars they want to change; anything
// they leave alone falls back to the default values. The `--bc-*` namespace
// is reserved for this file — never define one elsewhere.
// =============================================================================

export function tokensCss(): string {
  return [base(), defaultLight(), defaultDark()].join("\n");
}

// -----------------------------------------------------------------------------
// Base — values shared across all themes (shape tokens, motion). Themes can
// override but rarely need to.
// -----------------------------------------------------------------------------
function base(): string {
  return `
:root {
  /* Radii */
  --bc-radius-xs: 2px;
  --bc-radius-sm: 4px;
  --bc-radius-md: 6px;
  --bc-radius-lg: 8px;
  --bc-radius-xl: 10px;
  --bc-radius-2xl: 12px;
  --bc-radius-3xl: 14px;
  --bc-radius-pill: 999px;
  --bc-radius-circle: 50%;

  /* Type sizes */
  --bc-font-9: 9px;
  --bc-font-10: 10px;
  --bc-font-11: 11px;
  --bc-font-12: 12px;
  --bc-font-13: 13px;
  --bc-font-14: 14px;
  --bc-font-15: 15px;
  --bc-font-16: 16px;
  --bc-font-18: 18px;
  --bc-font-20: 20px;
  --bc-font-22: 22px;
  --bc-font-24: 24px;
  --bc-font-26: 26px;
  --bc-font-28: 28px;
  --bc-font-36: 36px;

  /* Type weights */
  --bc-fw-regular: 400;
  --bc-fw-medium: 500;
  --bc-fw-semibold: 600;
  --bc-fw-bold: 700;
  --bc-fw-extrabold: 800;

  /* Motion */
  --bc-tx-fast: 80ms;
  --bc-tx-base: 120ms;
  --bc-tx-slow: 220ms;
  --bc-easing: ease;

  /* Static (theme-invariant) colors — used when sitting on an inline-set
     saturated background (e.g. heatmap cells), where the text color must
     stay near-white regardless of light/dark theme. */
  --bc-color-on-saturated: #ffffff;

  /* Letter-spacing */
  --bc-ls-tight: -0.02em;
  --bc-ls-snug: -0.01em;
  --bc-ls-wide: 0.02em;
  --bc-ls-wider: 0.03em;
  --bc-ls-widest: 0.04em;
  --bc-ls-caps: 0.06em;
  --bc-ls-caps-wide: 0.08em;
  --bc-ls-caps-widest: 0.1em;
}
`;
}

// -----------------------------------------------------------------------------
// Default theme — light values. This is what CAESAR + the popup always show
// and what paper.nu shows when its .dark class is absent.
// -----------------------------------------------------------------------------
function defaultLight(): string {
  return `
:root,
[data-bc-theme="default"] {
  /* ----- Brand accent (NU purple) ----- */
  --bc-color-accent: #66023c;
  --bc-color-accent-hover: #500030;
  --bc-color-accent-pressed: #3f0126;
  --bc-color-accent-on: #ffffff;

  /* Auxiliary accent (paper.nu side card / status bar / auth modal). Same
     purple in light mode; diverges from --bc-color-accent only in dark. */
  --bc-color-accent-soft: #66023c;
  --bc-color-accent-soft-hover: #500030;
  --bc-color-accent-soft-on: #ffffff;

  /* Accent fill alpha ladder — overlays of the accent color used as
     subtle backgrounds, hovers, and rings. */
  --bc-color-accent-fill-04: rgba(102, 2, 60, 0.04);
  --bc-color-accent-fill-05: rgba(102, 2, 60, 0.05);
  --bc-color-accent-fill-06: rgba(102, 2, 60, 0.06);
  --bc-color-accent-fill-08: rgba(102, 2, 60, 0.08);
  --bc-color-accent-fill-10: rgba(102, 2, 60, 0.10);
  --bc-color-accent-fill-12: rgba(102, 2, 60, 0.12);
  --bc-color-accent-fill-15: rgba(102, 2, 60, 0.15);
  --bc-color-accent-fill-18: rgba(102, 2, 60, 0.18);
  --bc-color-accent-fill-22: rgba(102, 2, 60, 0.22);
  --bc-color-accent-fill-24: rgba(102, 2, 60, 0.24);
  --bc-color-accent-fill-32: rgba(102, 2, 60, 0.32);
  --bc-color-accent-fill-45: rgba(102, 2, 60, 0.45);

  /* Accent border alpha ladder — used for borders/outlines/dashed dividers. */
  --bc-color-accent-border-08: rgba(102, 2, 60, 0.08);
  --bc-color-accent-border-12: rgba(102, 2, 60, 0.12);
  --bc-color-accent-border-14: rgba(102, 2, 60, 0.14);
  --bc-color-accent-border-18: rgba(102, 2, 60, 0.18);
  --bc-color-accent-border-22: rgba(102, 2, 60, 0.22);
  --bc-color-accent-border-28: rgba(102, 2, 60, 0.28);
  --bc-color-accent-border-32: rgba(102, 2, 60, 0.32);
  --bc-color-accent-border-45: rgba(102, 2, 60, 0.45);

  /* Named accent surface tints (semantic shorthands for the most common roles) */
  --bc-color-accent-surface-faint: #fff7fb;
  --bc-color-accent-surface-soft: #fdeef5;
  --bc-color-accent-surface-tint: #faf3f7;
  --bc-color-accent-surface-tile: #f6ecf2;
  --bc-color-accent-surface-tile-2: #f1ebef;
  --bc-color-accent-surface-row: #faf7f9;
  --bc-color-accent-surface-row-border: #f0e4eb;
  --bc-color-accent-mid-border: #d8b6c8;

  /* Warn-rose (a magenta-adjacent accent used for "warn" state on accent
     chips — distinct from the generic warning amber palette). */
  --bc-color-warn-rose-text: #9f1239;
  --bc-color-warn-rose-text-deep: #881337;
  --bc-color-warn-rose-fill-12: rgba(190, 24, 93, 0.12);
  --bc-color-warn-rose-border-28: rgba(190, 24, 93, 0.28);
  --bc-color-warn-rose-border-32: rgba(190, 24, 93, 0.32);
  --bc-color-warn-rose-fill-20: rgba(190, 24, 93, 0.20);

  /* Paper.nu's own purple (used by class-search to mimic paper.nu badges). */
  --bc-color-paper: #4e2a84;
  --bc-color-paper-deep: #3a1f63;
  --bc-color-paper-soft: #f3eef9;

  /* ----- Surfaces ----- */
  --bc-color-bg: #ffffff;
  --bc-color-bg-app: #f3f4f6;
  --bc-color-bg-muted: #fafafa;
  --bc-color-bg-inset: var(--bc-color-accent-surface-row);
  --bc-color-surface-hover: #f7f7f8;
  --bc-color-surface-hover-strong: #f3f3f5;
  --bc-color-surface-soft: #f9fafb;

  /* Borders */
  --bc-color-border: #e6e6ea;
  --bc-color-border-strong: #d1d5db;
  --bc-color-border-divider: #e5e7eb;

  /* Translucent surface ladder (used in side-card-panel for layered cards
     over paper.nu's own gradient). */
  --bc-color-surface-translucent-86: rgba(255, 251, 253, 0.86);
  --bc-color-surface-translucent-72: rgba(255, 255, 255, 0.72);
  --bc-color-surface-translucent-62: rgba(255, 255, 255, 0.62);
  --bc-color-surface-translucent-56: rgba(255, 255, 255, 0.56);
  --bc-color-surface-translucent-84: rgba(255, 255, 255, 0.84);
  --bc-color-surface-translucent-88: rgba(255, 255, 255, 0.88);
  --bc-color-surface-translucent-92: rgba(255, 255, 255, 0.92);
  --bc-color-surface-translucent-98: rgba(255, 255, 255, 0.98);
  --bc-color-surface-warm-grad-top: rgba(255, 250, 252, 0.98);

  /* ----- Text ----- */
  --bc-color-text: #1f2937;
  --bc-color-text-strong: #111827;
  --bc-color-text-soft: #4b5563;
  --bc-color-text-muted: #6b7280;
  --bc-color-text-subtle: #9ca3af;

  /* Mauve text scale — warm grays paired with the accent for analytics
     panels; preserved verbatim from the side-card and side-card-panel
     designs. */
  --bc-color-text-mauve: #7a596a;
  --bc-color-text-mauve-soft: #6b5a65;
  --bc-color-text-mauve-warm: #5b4451;
  --bc-color-text-mauve-deep: #2f1f29;
  --bc-color-text-mauve-panel: #3f3340;
  --bc-color-text-mauve-pale: #c9b4bf;
  --bc-color-text-mauve-cool: #9b6b81;
  --bc-color-text-mauve-axis: #9b8290;
  --bc-color-text-mauve-axis-strong: #7a596a;

  /* Body/secondary text used in auth-modal (deep-mauve tinted). */
  --bc-color-text-body-warm: #4b3a44;
  --bc-color-text-mauve-cool-alt: #6b5a65;

  /* On-color text (when sitting on a colored background). */
  --bc-color-text-on-tooltip: #f9fafb;
  --bc-color-text-on-histogram: #3a2730;

  /* ----- Status: success / warn / danger ----- */
  --bc-color-success: #15803d;
  --bc-color-success-bg: #dcfce7;
  --bc-color-success-bg-soft: #ecfdf5;
  --bc-color-success-border: #abefc6;
  --bc-color-success-text: #054f31;
  --bc-color-success-deep: #047857;
  --bc-color-success-distro-text: #065f46;
  --bc-color-success-distro-bg: #ecfdf5;

  --bc-color-warn: #b45309;
  --bc-color-warn-bg: #fef3c7;
  --bc-color-warn-bg-soft: #fffaeb;
  --bc-color-warn-bg-page: #fff7ed;
  --bc-color-warn-border: #fedf89;
  --bc-color-warn-border-page: #fdba74;
  --bc-color-warn-text: #93370d;
  --bc-color-warn-text-page: #7c2d12;
  --bc-color-warn-text-discipline: #92400e;

  --bc-color-danger: #b91c1c;
  --bc-color-danger-bg: #fee2e2;
  --bc-color-danger-bg-soft: #fef3f2;
  --bc-color-danger-bg-pill: #fdecec;
  --bc-color-danger-border: #fecdca;
  --bc-color-danger-text: #912018;
  --bc-color-danger-text-pill: #b03d3d;
  --bc-color-danger-deep: #b91c1c;
  --bc-color-danger-rose: #9f1239;

  /* Lock/info (gate-card and inline indigo tones in seats-notes). */
  --bc-color-info-bg: #eef2ff;
  --bc-color-info-border: #c7d2fe;
  --bc-color-info-text: #1e1b4b;
  --bc-color-info-text-deep: #3730a3;

  /* Highlight (yellow text mark + amber comment-theme "is-active" pills). */
  --bc-color-highlight: #fef08a;
  --bc-color-highlight-text: #713f12;
  --bc-color-highlight-mark: rgba(254, 240, 138, 0.7);

  /* ----- Star/rating + chart palette ----- */
  --bc-color-star-base: #c9b4bf;
  --bc-color-star-fill: #d97706;
  --bc-color-hours-grad-start: #a21caf;
  --bc-color-hours-grad-end: #db2777;
  --bc-color-chart-trend-axis: #f1ebef;
  --bc-color-chart-trend-text: #9b8290;
  --bc-color-chart-trend-text-strong: #7a596a;
  --bc-color-chart-axis-cool: #475569;

  /* ----- Slate ink (cart button + cool shadows) ----- */
  --bc-color-ink: #1f2937;
  --bc-color-ink-deep: #0f172a;
  --bc-color-ink-text: #1f2937;
  --bc-color-ink-text-on-light: #f9fafb;
  --bc-color-ink-fill-04: rgba(15, 23, 42, 0.04);
  --bc-color-ink-fill-06: rgba(15, 23, 42, 0.06);
  --bc-color-ink-fill-08: rgba(15, 23, 42, 0.08);
  --bc-color-ink-fill-025: rgba(15, 23, 42, 0.025);
  --bc-color-ink-border-12: rgba(17, 24, 39, 0.12);
  --bc-color-ink-instructor-pill-bg: rgba(17, 24, 39, 0.06);

  /* ----- Shadows ----- */
  --bc-shadow-elev-1: 0 1px 2px rgba(15, 23, 42, 0.04);
  --bc-shadow-elev-2: 0 2px 8px rgba(15, 23, 42, 0.05);
  --bc-shadow-card-soft: 0 -1px 2px rgba(15, 23, 42, 0.04);
  --bc-shadow-button: 0 2px 6px rgba(15, 23, 42, 0.18);
  --bc-shadow-button-hover: 0 3px 8px rgba(15, 23, 42, 0.22);
  --bc-shadow-add-cta: 0 2px 6px rgba(102, 2, 60, 0.22);
  --bc-shadow-modal: 0 1px 2px rgba(0, 0, 0, 0.06), 0 30px 60px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.04);
  --bc-shadow-modal-status: 0 1px 2px rgba(0, 0, 0, 0.04);
  --bc-shadow-auth-card: 0 28px 60px rgba(15, 23, 42, 0.32);
  --bc-shadow-side-panel: 0 10px 28px rgba(102, 2, 60, 0.08);
  --bc-shadow-tooltip: 0 8px 24px rgba(0, 0, 0, 0.18);
  --bc-shadow-kpi-active-ring: 0 0 0 3px rgba(102, 2, 60, 0.08);
  --bc-shadow-toggle-knob: 0 1px 3px rgba(0, 0, 0, 0.25);
  --bc-shadow-input-focus-ring: 0 0 0 3px rgba(102, 2, 60, 0.18);
  --bc-shadow-input-focus-inner: inset 0 1px 2px rgba(15, 23, 42, 0.04);

  /* Modal overlay scrims */
  --bc-color-overlay-modal: rgba(15, 23, 42, 0.55);
  --bc-color-overlay-auth: rgba(15, 23, 42, 0.6);
  --bc-color-overlay-on-light: rgba(15, 23, 42, 0.08);

  /* ----- Side-card / panel gradient (paper.nu analytics card frame) ----- */
  --bc-color-panel-grad-top: rgba(255, 250, 252, 0.98);
  --bc-color-panel-grad-bottom: rgba(255, 255, 255, 0.98);

  /* ----- Card hover-lift outline override (paper.nu schedule cards) ----- */
  --bc-color-card-outline: rgba(17, 24, 39, 0.7);
  --bc-color-card-divider-soft: rgba(17, 24, 39, 0.12);

  /* ----- Card "ink" state colors (cart button states) ----- */
  --bc-color-cart-bg: #1f2937;
  --bc-color-cart-bg-hover: #0f172a;
  --bc-color-cart-border: rgba(15, 23, 42, 0.45);
  --bc-color-cart-border-hover: rgba(15, 23, 42, 0.7);
  --bc-color-cart-text: #f9fafb;
  --bc-color-cart-success-bg: #047857;
  --bc-color-cart-success-border: rgba(4, 120, 87, 0.65);
  --bc-color-cart-success-text: #ecfdf5;
  --bc-color-cart-error-bg: #b91c1c;
  --bc-color-cart-error-border: rgba(185, 28, 28, 0.7);
  --bc-color-cart-error-text: #fef2f2;
  --bc-color-cart-loading-bg: #4b5563;
  --bc-color-cart-loading-border: rgba(75, 85, 99, 0.65);
  --bc-color-cart-loading-text: #f3f4f6;

  /* ----- Comment highlight (search match) ----- */
  --bc-color-comment-highlight-light: rgba(250, 204, 21, 0.38);

  /* ----- Disabled / muted greys (CAESAR add-to-cart disabled state) ----- */
  --bc-color-disabled-bg: #c7c2d6;

  /* ----- Page-style status banner colors (gate cards in popup) ----- */
  --bc-color-gate-warn-bg: #fff7ed;
  --bc-color-gate-warn-border: #fdba74;
  --bc-color-gate-warn-text: #7c2d12;
  --bc-color-gate-lock-bg: #eef2ff;
  --bc-color-gate-lock-border: #c7d2fe;
  --bc-color-gate-lock-text: #1e1b4b;
  --bc-color-gate-ok-bg: #ecfdf5;
  --bc-color-gate-ok-border: #a7f3d0;
  --bc-color-gate-ok-text: #064e3b;

  /* ----- Seats-notes occupancy palette (CAESAR seat tone) ----- */
  --bc-color-seat-full-bg: #fde8e8;
  --bc-color-seat-full-border: #f4a9a9;
  --bc-color-seat-full-ink: #8c1d18;
  --bc-color-seat-waitlist-bg: #fff0d9;
  --bc-color-seat-waitlist-border: #f1c27a;
  --bc-color-seat-waitlist-ink: #8a4b00;
  --bc-color-seat-info-bg: #eef2ff;
  --bc-color-seat-info-border: #c7d2fe;
  --bc-color-seat-info-ink: #3730a3;
  --bc-color-seat-warn-bg: #fff1df;
  --bc-color-seat-warn-border: #f7c58a;
  --bc-color-seat-warn-ink: #94410d;
  --bc-color-seat-tight-bg: #fff8d9;
  --bc-color-seat-tight-border: #eed46b;
  --bc-color-seat-tight-ink: #7a5d00;
  --bc-color-seat-room-bg: #eef8d7;
  --bc-color-seat-room-border: #bfdc7d;
  --bc-color-seat-room-ink: #4d6b00;
  --bc-color-seat-open-bg: #e8f5e9;
  --bc-color-seat-open-border: #b9ddbc;
  --bc-color-seat-open-ink: #1b5e20;
  --bc-color-seat-warn-row-text: #8a2e00;
  --bc-color-seat-warn-row-border: #d99a66;
  --bc-color-seat-error-text: #7a123f;
  --bc-color-seat-muted-text: #5c4c56;
}
`;
}

// -----------------------------------------------------------------------------
// Default theme — dark variant. Activated by paper.nu's .dark class (mirrored
// onto data-bc-mode="dark"). Two accent tracks here, faithful to the existing
// design: the modal stack uses lavender (#d8b4fe), and the side-card / status
// bar / auth modal stack uses pink (#fbcfe8). Theme authors who want a single
// dark accent can set both --bc-color-accent and --bc-color-accent-soft to
// the same value.
// -----------------------------------------------------------------------------
function defaultDark(): string {
  return `
[data-bc-theme="default"][data-bc-mode="dark"] {
  /* ----- Brand accent (lavender) — modal frame, KPI cards, comment rail ----- */
  --bc-color-accent: #d8b4fe;
  --bc-color-accent-hover: #c084fc;
  --bc-color-accent-pressed: #c084fc;
  --bc-color-accent-on: #1f1147;

  /* ----- Auxiliary accent (pink) — side card, status bar, auth modal ----- */
  --bc-color-accent-soft: #fbcfe8;
  --bc-color-accent-soft-hover: #f9a8d4;
  --bc-color-accent-soft-on: #500030;

  /* Accent fill ladder (pink overlays — the dominant dark accent backgrounds) */
  --bc-color-accent-fill-04: rgba(252, 165, 207, 0.06);
  --bc-color-accent-fill-05: rgba(252, 165, 207, 0.06);
  --bc-color-accent-fill-06: rgba(252, 165, 207, 0.06);
  --bc-color-accent-fill-08: rgba(252, 165, 207, 0.08);
  --bc-color-accent-fill-10: rgba(252, 165, 207, 0.10);
  --bc-color-accent-fill-12: rgba(252, 165, 207, 0.12);
  --bc-color-accent-fill-15: rgba(252, 165, 207, 0.16);
  --bc-color-accent-fill-18: rgba(252, 165, 207, 0.16);
  --bc-color-accent-fill-22: rgba(252, 165, 207, 0.22);
  --bc-color-accent-fill-24: rgba(252, 165, 207, 0.22);
  --bc-color-accent-fill-32: rgba(252, 165, 207, 0.30);
  --bc-color-accent-fill-45: rgba(252, 165, 207, 0.40);

  /* Accent border ladder (pink) */
  --bc-color-accent-border-08: rgba(252, 165, 207, 0.12);
  --bc-color-accent-border-12: rgba(252, 165, 207, 0.12);
  --bc-color-accent-border-14: rgba(252, 165, 207, 0.14);
  --bc-color-accent-border-18: rgba(252, 165, 207, 0.18);
  --bc-color-accent-border-22: rgba(252, 165, 207, 0.22);
  --bc-color-accent-border-28: rgba(252, 165, 207, 0.30);
  --bc-color-accent-border-32: rgba(252, 165, 207, 0.36);
  --bc-color-accent-border-45: rgba(252, 165, 207, 0.45);

  /* Named accent surface tints (dark tints reuse lavender/pink) */
  --bc-color-accent-surface-faint: rgba(168, 85, 247, 0.08);
  --bc-color-accent-surface-soft: rgba(216, 180, 254, 0.18);
  --bc-color-accent-surface-tint: rgba(252, 165, 207, 0.08);
  --bc-color-accent-surface-tile: rgba(252, 165, 207, 0.14);
  --bc-color-accent-surface-tile-2: rgba(252, 165, 207, 0.10);
  --bc-color-accent-surface-row: rgba(17, 24, 39, 0.30);
  --bc-color-accent-surface-row-border: rgba(252, 165, 207, 0.14);
  --bc-color-accent-mid-border: rgba(252, 165, 207, 0.30);

  /* Warn-rose dark variants */
  --bc-color-warn-rose-text: #fecdd3;
  --bc-color-warn-rose-text-deep: #fecdd3;
  --bc-color-warn-rose-fill-12: rgba(251, 113, 133, 0.14);
  --bc-color-warn-rose-border-28: rgba(251, 113, 133, 0.30);
  --bc-color-warn-rose-border-32: rgba(251, 113, 133, 0.40);
  --bc-color-warn-rose-fill-20: rgba(251, 113, 133, 0.22);

  /* ----- Surfaces ----- */
  --bc-color-bg: #262626;
  --bc-color-bg-app: #171717;
  --bc-color-bg-muted: #171717;
  --bc-color-bg-inset: #262626;
  --bc-color-surface-hover: #404040;
  --bc-color-surface-hover-strong: #525252;
  --bc-color-surface-soft: #262626;

  --bc-color-border: #404040;
  --bc-color-border-strong: #525252;
  --bc-color-border-divider: #404040;

  --bc-color-surface-translucent-86: rgba(17, 24, 39, 0.26);
  --bc-color-surface-translucent-72: rgba(17, 24, 39, 0.32);
  --bc-color-surface-translucent-62: rgba(17, 24, 39, 0.22);
  --bc-color-surface-translucent-56: rgba(17, 24, 39, 0.22);
  --bc-color-surface-translucent-84: rgba(17, 24, 39, 0.35);
  --bc-color-surface-translucent-88: transparent;
  --bc-color-surface-translucent-92: rgba(17, 24, 39, 0.40);
  --bc-color-surface-translucent-98: rgba(31, 24, 29, 0.98);
  --bc-color-surface-warm-grad-top: rgba(31, 24, 29, 0.98);

  /* ----- Text ----- */
  --bc-color-text: #fafafa;
  --bc-color-text-strong: #f9fafb;
  --bc-color-text-soft: #d1d5db;
  --bc-color-text-muted: #a3a3a3;
  --bc-color-text-subtle: #737373;

  --bc-color-text-mauve: #d4b9c5;
  --bc-color-text-mauve-soft: #d8c7d0;
  --bc-color-text-mauve-warm: #f3e5ed;
  --bc-color-text-mauve-deep: #fff6fb;
  --bc-color-text-mauve-panel: #f5e7ee;
  --bc-color-text-mauve-pale: rgba(255, 227, 238, 0.36);
  --bc-color-text-mauve-cool: #c4b5fd;
  --bc-color-text-mauve-axis: #a3a3a3;
  --bc-color-text-mauve-axis-strong: #a3a3a3;

  --bc-color-text-body-warm: #e8d3dc;
  --bc-color-text-mauve-cool-alt: #d8c7d0;

  --bc-color-text-on-tooltip: #fafafa;
  --bc-color-text-on-histogram: #fafafa;

  /* ----- Status ----- */
  --bc-color-success: #6ee7b7;
  --bc-color-success-bg: rgba(16, 78, 53, 0.32);
  --bc-color-success-bg-soft: rgba(16, 78, 53, 0.32);
  --bc-color-success-border: rgba(110, 231, 183, 0.36);
  --bc-color-success-text: #d1fadf;
  --bc-color-success-deep: #6ee7b7;
  --bc-color-success-distro-text: #d1fadf;
  --bc-color-success-distro-bg: rgba(16, 78, 53, 0.32);

  --bc-color-warn: #fef3c7;
  --bc-color-warn-bg: rgba(120, 53, 15, 0.32);
  --bc-color-warn-bg-soft: rgba(120, 53, 15, 0.32);
  --bc-color-warn-bg-page: rgba(120, 53, 15, 0.32);
  --bc-color-warn-border: rgba(254, 223, 137, 0.36);
  --bc-color-warn-border-page: rgba(254, 223, 137, 0.36);
  --bc-color-warn-text: #fef3c7;
  --bc-color-warn-text-page: #fef3c7;
  --bc-color-warn-text-discipline: #fef3c7;

  --bc-color-danger: #fda4af;
  --bc-color-danger-bg: rgba(127, 29, 29, 0.32);
  --bc-color-danger-bg-soft: rgba(127, 29, 29, 0.32);
  --bc-color-danger-bg-pill: rgba(127, 29, 29, 0.32);
  --bc-color-danger-border: rgba(254, 205, 202, 0.36);
  --bc-color-danger-text: #fee4e2;
  --bc-color-danger-text-pill: #fda4af;
  --bc-color-danger-deep: #fda4af;
  --bc-color-danger-rose: #fda4af;

  --bc-color-info-bg: rgba(168, 85, 247, 0.14);
  --bc-color-info-border: rgba(216, 180, 254, 0.32);
  --bc-color-info-text: #d8b4fe;
  --bc-color-info-text-deep: #c4b5fd;

  --bc-color-highlight: rgba(254, 240, 138, 0.85);
  --bc-color-highlight-text: #1f1147;
  --bc-color-highlight-mark: rgba(254, 240, 138, 0.35);

  --bc-color-star-base: rgba(255, 227, 238, 0.36);
  --bc-color-star-fill: #fbbf24;
  --bc-color-hours-grad-start: #d8b4fe;
  --bc-color-hours-grad-end: #f9a8d4;
  --bc-color-chart-trend-axis: #525252;
  --bc-color-chart-trend-text: #a3a3a3;
  --bc-color-chart-trend-text-strong: #a3a3a3;
  --bc-color-chart-axis-cool: #a3a3a3;

  --bc-color-ink: #d8b4fe;
  --bc-color-ink-deep: #c084fc;
  --bc-color-ink-text: #fafafa;
  --bc-color-ink-text-on-light: #1f1147;
  --bc-color-ink-fill-04: rgba(248, 250, 252, 0.04);
  --bc-color-ink-fill-06: rgba(248, 250, 252, 0.06);
  --bc-color-ink-fill-08: rgba(248, 250, 252, 0.08);
  --bc-color-ink-fill-025: rgba(248, 250, 252, 0.05);
  --bc-color-ink-border-12: rgba(255, 255, 255, 0.14);
  --bc-color-ink-instructor-pill-bg: rgba(255, 255, 255, 0.08);

  /* Shadows (deepen for dark mode) */
  --bc-shadow-elev-1: 0 1px 2px rgba(0, 0, 0, 0.4);
  --bc-shadow-elev-2: 0 2px 8px rgba(0, 0, 0, 0.4);
  --bc-shadow-card-soft: 0 -1px 2px rgba(0, 0, 0, 0.4);
  --bc-shadow-button: 0 2px 6px rgba(0, 0, 0, 0.4);
  --bc-shadow-button-hover: 0 3px 8px rgba(0, 0, 0, 0.5);
  --bc-shadow-add-cta: 0 2px 6px rgba(216, 180, 254, 0.3);
  --bc-shadow-modal: 0 1px 2px rgba(0, 0, 0, 0.4), 0 30px 60px -10px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.04);
  --bc-shadow-modal-status: 0 1px 2px rgba(0, 0, 0, 0.4);
  --bc-shadow-auth-card: 0 28px 60px rgba(0, 0, 0, 0.6);
  --bc-shadow-side-panel: 0 10px 28px rgba(0, 0, 0, 0.22);
  --bc-shadow-tooltip: 0 8px 24px rgba(0, 0, 0, 0.45);
  --bc-shadow-kpi-active-ring: 0 0 0 3px rgba(216, 180, 254, 0.18);
  --bc-shadow-toggle-knob: 0 1px 3px rgba(0, 0, 0, 0.45);
  --bc-shadow-input-focus-ring: 0 0 0 3px rgba(216, 180, 254, 0.24);
  --bc-shadow-input-focus-inner: inset 0 1px 2px rgba(0, 0, 0, 0.3);

  --bc-color-overlay-modal: rgba(0, 0, 0, 0.55);
  --bc-color-overlay-auth: rgba(0, 0, 0, 0.6);
  --bc-color-overlay-on-light: rgba(255, 255, 255, 0.08);

  --bc-color-panel-grad-top: rgba(31, 24, 29, 0.98);
  --bc-color-panel-grad-bottom: rgba(23, 18, 22, 0.98);

  --bc-color-card-outline: rgba(248, 250, 252, 0.7);
  --bc-color-card-divider-soft: rgba(255, 255, 255, 0.14);

  /* Cart button states retain semantic meaning in dark mode */
  --bc-color-cart-bg: #404040;
  --bc-color-cart-bg-hover: #525252;
  --bc-color-cart-border: #525252;
  --bc-color-cart-border-hover: #737373;
  --bc-color-cart-text: #fafafa;
  --bc-color-cart-success-bg: #047857;
  --bc-color-cart-success-border: #10b981;
  --bc-color-cart-success-text: #ecfdf5;
  --bc-color-cart-error-bg: #b91c1c;
  --bc-color-cart-error-border: #ef4444;
  --bc-color-cart-error-text: #fef2f2;
  --bc-color-cart-loading-bg: #525252;
  --bc-color-cart-loading-border: #737373;
  --bc-color-cart-loading-text: #f3f4f6;

  --bc-color-comment-highlight-light: rgba(250, 204, 21, 0.24);

  --bc-color-disabled-bg: #525252;

  /* Gate-card / popup status banners aren't used in paper.nu and the popup
     never enters dark mode, but provide reasonable dark values for parity. */
  --bc-color-gate-warn-bg: rgba(120, 53, 15, 0.32);
  --bc-color-gate-warn-border: rgba(254, 223, 137, 0.36);
  --bc-color-gate-warn-text: #fef3c7;
  --bc-color-gate-lock-bg: rgba(168, 85, 247, 0.14);
  --bc-color-gate-lock-border: rgba(216, 180, 254, 0.32);
  --bc-color-gate-lock-text: #d8b4fe;
  --bc-color-gate-ok-bg: rgba(16, 78, 53, 0.32);
  --bc-color-gate-ok-border: rgba(110, 231, 183, 0.36);
  --bc-color-gate-ok-text: #d1fadf;
}
`;
}
