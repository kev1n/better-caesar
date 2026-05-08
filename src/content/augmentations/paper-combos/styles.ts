import { ensureStyle } from "../../framework";
import {
  CARD_PIN_BUTTON_CLASS,
  FEATURE_TOGGLE_CLASS,
  REAL_CARD_HIDE_ATTR,
  ROOT_ATTR,
  STYLE_ID,
  TOP_BAR_ID
} from "./constants";

const REAL_CARD_HIDE_SELECTOR =
  "div.absolute.z-10.rounded-lg" + `[${REAL_CARD_HIDE_ATTR}="1"]`;

// margin-top clears paper-ctec's floating status bar (which is anchored
// at top: 1rem inside the absolute-positioned action toolbar). 3.25rem
// is enough to land below the status text without being so tall it eats
// canvas space.
const CSS = `
#${TOP_BAR_ID} {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  padding: 0.5rem 0.7rem;
  margin: 3.25rem 0 0.6rem 0;
  border-radius: var(--bc-radius-lg);
  background: var(--bc-color-bg);
  border: 1px solid var(--bc-color-border);
  font-family: inherit;
  color: var(--bc-color-text);
  font-size: 0.875rem;
}

/* Hide native number-input spinner arrows on the bar's number inputs.
 * Combo of WebKit pseudo-elements + appearance:textfield covers Chrome,
 * Safari, and Firefox. */
#${TOP_BAR_ID} input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}

#${TOP_BAR_ID} input[type="number"]::-webkit-inner-spin-button,
#${TOP_BAR_ID} input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

/* Always-visible feature toggle pill. Its iOS-style track + thumb makes
 * the on/off state obvious from a glance, and it sits to the left of
 * everything else in the bar so it's the first thing users see. */
.${FEATURE_TOGGLE_CLASS} {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.2rem 0.55rem 0.2rem 0.3rem;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-bg);
  color: var(--bc-color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: var(--bc-fw-medium);
  line-height: 1.2;
  transition: border-color var(--bc-tx-fast) var(--bc-easing),
              background var(--bc-tx-fast) var(--bc-easing);
}

.${FEATURE_TOGGLE_CLASS}:hover {
  border-color: var(--bc-color-border-strong);
  background: var(--bc-color-surface-hover);
}

.${FEATURE_TOGGLE_CLASS} .bc-paper-combos-toggle-track {
  position: relative;
  display: inline-block;
  width: 1.85rem;
  height: 1rem;
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-border);
  transition: background var(--bc-tx-fast) var(--bc-easing);
  flex-shrink: 0;
}

.${FEATURE_TOGGLE_CLASS} .bc-paper-combos-toggle-thumb {
  position: absolute;
  top: 0.1rem;
  left: 0.1rem;
  width: 0.8rem;
  height: 0.8rem;
  border-radius: var(--bc-radius-circle);
  background: var(--bc-color-bg);
  box-shadow: var(--bc-shadow-button);
  transition: transform var(--bc-tx-base) var(--bc-easing);
}

.${FEATURE_TOGGLE_CLASS}[data-on="true"] .bc-paper-combos-toggle-track {
  background: var(--bc-color-accent);
}

.${FEATURE_TOGGLE_CLASS}[data-on="true"] .bc-paper-combos-toggle-thumb {
  transform: translateX(0.85rem);
}

.${FEATURE_TOGGLE_CLASS}[data-on="true"] {
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent);
}

#${TOP_BAR_ID} .bc-paper-combos-toggle-hint {
  color: var(--bc-color-text-muted);
  font-size: 0.78rem;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button {
  cursor: pointer;
  border: 1px solid var(--bc-color-border);
  background: transparent;
  border-radius: var(--bc-radius-md);
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.85rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button[disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}

#${TOP_BAR_ID} .bc-paper-combos-cycle button:not([disabled]):hover {
  background: var(--bc-color-surface-hover);
}

#${TOP_BAR_ID} .bc-paper-combos-counter {
  font-variant-numeric: tabular-nums;
  font-weight: var(--bc-fw-semibold);
  min-width: 4.5rem;
  text-align: center;
  font-size: 0.8rem;
}

#${TOP_BAR_ID} .bc-paper-combos-rating {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  background: var(--bc-color-bg-muted);
  border-radius: var(--bc-radius-md);
  font-weight: var(--bc-fw-medium);
  font-size: 0.78rem;
  color: var(--bc-color-text-muted);
}

#${TOP_BAR_ID} .bc-paper-combos-rating[data-rated="0"] {
  opacity: 0.55;
}

#${TOP_BAR_ID} .bc-paper-combos-max {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

#${TOP_BAR_ID} .bc-paper-combos-max input {
  width: 3.5rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.8rem;
  text-align: center;
}

#${TOP_BAR_ID} .bc-paper-combos-sort {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

#${TOP_BAR_ID} .bc-paper-combos-sort-select {
  padding: 0.25rem 1.5rem 0.25rem 0.5rem;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position:
    calc(100% - 0.6rem) center,
    calc(100% - 0.4rem) center;
  background-size: 0.25rem 0.25rem, 0.25rem 0.25rem;
  background-repeat: no-repeat;
}

#${TOP_BAR_ID} .bc-paper-combos-sort-select:hover {
  background-color: var(--bc-color-surface-hover);
}

#${TOP_BAR_ID} .bc-paper-combos-status {
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.4rem 0.55rem;
  border-radius: var(--bc-radius-md);
  background: var(--bc-color-bg-muted);
  color: var(--bc-color-text-muted);
  font-size: 0.8rem;
}

[${ROOT_ATTR}] .schedule-grid-cols ${REAL_CARD_HIDE_SELECTOR} {
  display: none !important;
}

/* Drag preview while the user is creating a zone — semi-transparent
 * accent fill with a dashed border so it reads as "in progress" until
 * mouseup commits it. pointer-events:none so the mousemove handler
 * still gets coordinates from the underlying day column. */
.bc-paper-combos-zone-preview {
  background: var(--bc-color-accent-surface-soft);
  border: 1px dashed var(--bc-color-accent);
  border-radius: var(--bc-radius-sm);
  pointer-events: none;
  z-index: 11;
}

/* Persisted zones: dimmer fill + diagonal stripes so they read as
 * "this time slot is off-limits" without competing with paper.nu's
 * actual class cards. Hover reveals the X button. */
.bc-paper-combos-zone {
  background: var(--bc-color-accent-surface-soft);
  background-image: repeating-linear-gradient(
    45deg,
    transparent 0,
    transparent 6px,
    var(--bc-color-accent-surface-tile) 6px,
    var(--bc-color-accent-surface-tile) 12px
  );
  border: 1px solid var(--bc-color-accent);
  border-radius: var(--bc-radius-sm);
  z-index: 11;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 2px 4px;
  font-size: 0.65rem;
  color: var(--bc-color-accent);
  font-weight: var(--bc-fw-semibold);
  overflow: hidden;
  transition: background var(--bc-tx-fast) var(--bc-easing);
}

.bc-paper-combos-zone:hover {
  background-color: var(--bc-color-accent-surface-tile);
}

/* Multi-day zones render as one segment per day. The leftmost/rightmost
 * data attrs let us drop the seam borders + radii so a 3-day zone reads
 * as a single rounded rectangle spanning Mon-Wed. */
.bc-paper-combos-zone[data-leftmost="false"] {
  border-left: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.bc-paper-combos-zone[data-rightmost="false"] {
  border-right: 0;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.bc-paper-combos-zone-label {
  pointer-events: none;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* X button: two crossed pseudo-element bars instead of the × glyph.
 * The glyph version had visible vertical drift in most fonts (× sits
 * slightly above the baseline) and looked off-center in a 16px circle.
 * Pseudo-bars are pixel-precise: each is a 1.5px-tall rod centered on
 * the button's geometric middle and rotated ±45°. */
.bc-paper-combos-zone-remove {
  flex-shrink: 0;
  position: relative;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: var(--bc-radius-circle);
  background: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
  cursor: pointer;
  font-size: 0;
  line-height: 0;
}

.bc-paper-combos-zone-remove::before,
.bc-paper-combos-zone-remove::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 1.5px;
  background: currentColor;
  border-radius: 1px;
}

.bc-paper-combos-zone-remove::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.bc-paper-combos-zone-remove::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.bc-paper-combos-zone-remove:hover {
  background: var(--bc-color-accent-hover);
}

/* Empty space inside a day column is dragable — show a crosshair so the
 * affordance reads. Off the schedule cards themselves, the cursor stays
 * pointer (paper.nu's existing behavior). Only takes effect while the
 * feature is active so the off-state is undisturbed. */
[${ROOT_ATTR}] .schedule-grid-cols > div:not(:first-child) {
  cursor: crosshair;
}

[${ROOT_ATTR}] .schedule-grid-cols > div:not(:first-child) div.absolute.z-10.rounded-lg {
  cursor: pointer;
}

#${TOP_BAR_ID} .bc-paper-combos-clear-zones {
  cursor: pointer;
  border: 1px solid var(--bc-color-accent);
  background: var(--bc-color-accent-surface-soft);
  color: var(--bc-color-accent);
  border-radius: var(--bc-radius-md);
  padding: 0.25rem 0.55rem;
  font: inherit;
  font-size: 0.78rem;
  font-weight: var(--bc-fw-medium);
}

#${TOP_BAR_ID} .bc-paper-combos-clear-zones:hover {
  background: var(--bc-color-accent-surface-tile);
}

/* Pin button: direct child of the card, sibling of paper-ctec's
 * analytics-anchor. Sits just above the analytics pill in the bottom
 * right so the user always finds it in the same spot relative to the
 * other action affordance. Always full opacity so it's discoverable
 * without hovering — pin state is visually obvious from the bg + border. */
.${CARD_PIN_BUTTON_CLASS} {
  position: absolute;
  bottom: 14px;
  right: 6px;
  z-index: 13;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--bc-color-border);
  border-radius: var(--bc-radius-pill);
  background: var(--bc-color-bg);
  color: var(--bc-color-text);
  font-size: 11px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--bc-shadow-button);
  pointer-events: auto;
  transition: background var(--bc-tx-fast) var(--bc-easing),
              border-color var(--bc-tx-fast) var(--bc-easing),
              transform var(--bc-tx-fast) var(--bc-easing);
}

.${CARD_PIN_BUTTON_CLASS}:hover {
  background: var(--bc-color-surface-hover);
  border-color: var(--bc-color-border-strong);
  transform: scale(1.08);
}

.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"] {
  background: var(--bc-color-accent);
  border-color: var(--bc-color-accent);
  color: var(--bc-color-accent-on);
}

.${CARD_PIN_BUTTON_CLASS}[data-pinned="true"]:hover {
  background: var(--bc-color-accent-hover);
  border-color: var(--bc-color-accent-hover);
}
`;

export function injectCombosStyles(doc: Document = document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}
