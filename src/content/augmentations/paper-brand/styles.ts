import { ensureStyle } from "../../framework/dom";
import { HOST_MARKER_ATTR, MARK_MARKER_ATTR, STYLE_ID } from "./constants";

// Paper.nu's logo button is a `flex flex-col` button containing only the
// paper.nu image. Once we graft the mark in as a sibling, flipping the
// direction to row puts "with pencil" + the icon to the right of the
// logo. `!important` is needed to override the Tailwind utility on the
// host button without restructuring its className.
//
// Font family falls back through `--bc-font-hand` (Caveat in the pencil
// theme, inherit in the default NU-purple theme) → an explicit Caveat
// stack so the handwritten look stays visible even when the default
// theme leaves `--bc-font-hand` as `inherit`.
const CSS = `
button[${HOST_MARKER_ATTR}="1"] {
  flex-direction: row !important;
  justify-content: flex-start !important;
  align-items: center !important;
  gap: 6px;
  flex-wrap: nowrap;
  padding-left: 6px !important;
  padding-right: 6px !important;
}

.bc-paper-brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: 0 1 auto;
  min-width: 0;
  cursor: pointer;
  padding: 4px 6px;
  margin: -4px -6px;
  border-radius: var(--bc-radius-lg);
  background: transparent;
  transition: background-color 140ms ease, transform 140ms ease;
}
.bc-paper-brand-mark:hover,
.bc-paper-brand-mark:focus-visible {
  background: var(--bc-color-accent-fill-08);
  transform: translateY(-1px);
}
.bc-paper-brand-mark:focus-visible {
  outline: 2px solid var(--bc-color-accent);
  outline-offset: 2px;
}
.bc-paper-brand-mark:active {
  transform: translateY(0);
}

.bc-paper-brand-mark__text {
  font-family: var(--bc-font-hand, "Caveat", "Patrick Hand", ui-rounded, cursive);
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: var(--bc-color-accent);
  transform: rotate(-3deg);
  white-space: nowrap;
}

.bc-paper-brand-mark__icon {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  transform: rotate(-4deg);
}

[${MARK_MARKER_ATTR}="1"] svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* Paper.nu's dark mode mirrors onto [data-bc-mode="dark"] (see design/index.ts).
   The graphite SVG strokes get hard to read on the dark gray sidebar, so
   lighten them via the near-white --bc-color-text-on-tooltip token (which
   is consistently light across every theme). The attribute selectors match
   the literal stroke/fill values authored into the SVG markup. */
[data-bc-mode="dark"] .bc-paper-brand-mark__icon svg [stroke="#2a2a2e"] {
  stroke: var(--bc-color-text-on-tooltip);
}
[data-bc-mode="dark"] .bc-paper-brand-mark__icon svg polygon[fill="#2a2a2e"] {
  fill: var(--bc-color-text-on-tooltip);
}

/* About modal — uses framework's .bc-modal-card chrome, plus pencil-themed
   typography and the centered icon tile. The card stays comfortably narrow
   so the credit reads like a name plate, not a wall of text.

   The compound .bc-modal-card.bc-paper-brand-about-card selector beats the
   framework's .bc-modal-card text-align: left rule on specificity — needed
   because paper-brand styles get injected on initial run() (before the
   modal opens), so the framework's modal stylesheet ends up later in the
   cascade and would otherwise win the tie. */
.bc-modal-card.bc-paper-brand-about-card {
  width: min(380px, 100%);
  padding: 26px 24px 22px;
  text-align: center;
}
.bc-paper-brand-about-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
}
.bc-paper-brand-about-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.bc-paper-brand-about-eyebrow {
  margin: 0 0 4px;
  font-size: var(--bc-font-11);
  font-weight: var(--bc-fw-bold);
  letter-spacing: var(--bc-ls-wider);
  text-transform: uppercase;
  color: var(--bc-color-text-muted);
}
.bc-paper-brand-about-title {
  margin: 0;
  font-family: var(--bc-font-display, inherit);
  font-size: var(--bc-font-22);
  font-weight: var(--bc-fw-extrabold);
  color: var(--bc-color-accent);
  letter-spacing: -0.01em;
}
.bc-paper-brand-about-version {
  margin: 2px 0 14px;
  font-size: var(--bc-font-12);
  color: var(--bc-color-text-muted);
  font-variant-numeric: tabular-nums;
}
.bc-paper-brand-about-lede {
  margin: 0 0 12px;
  font-size: var(--bc-font-13);
  line-height: 1.5;
  color: var(--bc-color-text-body-warm);
}
.bc-paper-brand-about-credit {
  margin: 0 0 18px;
  font-family: var(--bc-font-hand, "Caveat", "Patrick Hand", ui-rounded, cursive);
  font-size: 20px;
  line-height: 1.2;
  color: var(--bc-color-text);
}
.bc-paper-brand-about-credit strong {
  font-weight: 700;
  color: var(--bc-color-accent);
}
/* Names link out to LinkedIn but keep the handwriting + accent vibe —
   no blue, no underline, no default <a> styling. Hover adds a subtle
   handwritten underline for affordance without breaking the look. */
.bc-paper-brand-about-credit-link {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  border-radius: var(--bc-radius-sm);
}
.bc-paper-brand-about-credit-link:hover strong,
.bc-paper-brand-about-credit-link:focus-visible strong {
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
  text-decoration-color: var(--bc-color-accent);
}
.bc-paper-brand-about-credit-link:focus-visible {
  outline: 2px solid var(--bc-color-accent);
  outline-offset: 2px;
}
.bc-paper-brand-about-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.bc-paper-brand-about-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
.bc-paper-brand-about-disclaimer {
  margin: 0;
  font-size: var(--bc-font-10);
  line-height: 1.45;
  color: var(--bc-color-text-muted);
}
`;

export function injectPaperBrandStyles(doc: Document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}

export function removePaperBrandStyles(doc: Document): void {
  doc.getElementById(STYLE_ID)?.remove();
}
