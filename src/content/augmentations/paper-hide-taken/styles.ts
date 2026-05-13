import { ensureStyle } from "../../framework/dom";
import { HIDDEN_CARD_ATTR, STYLE_ID, TOGGLE_BTN_ID } from "./constants";

// The switch sits inside prereq-filter's shared controls row, so it
// inherits the row's font + color. Visual structure (pill knob + sliding
// circle) mirrors prereq-filter's switches but keeps its own class names
// so the two augmentations don't grow a hidden CSS dependency.
const CSS = `
[${HIDDEN_CARD_ATTR}="1"] {
  display: none !important;
}

#${TOGGLE_BTN_ID} {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  user-select: none;
}

#${TOGGLE_BTN_ID} .bc-hide-taken-knob {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  flex-shrink: 0;
  background: var(--bc-color-border-strong);
  transition: background var(--bc-tx-base) var(--bc-easing);
}

#${TOGGLE_BTN_ID} .bc-hide-taken-knob::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--bc-color-bg);
  box-shadow: var(--bc-shadow-toggle-knob);
  transition: left var(--bc-tx-base) var(--bc-easing);
}

#${TOGGLE_BTN_ID}[data-on="1"] .bc-hide-taken-knob {
  background: var(--bc-color-accent);
}

#${TOGGLE_BTN_ID}[data-on="1"] .bc-hide-taken-knob::after {
  left: 19px;
}

#${TOGGLE_BTN_ID} .bc-hide-taken-label {
  font-weight: 600;
  letter-spacing: 0.01em;
}

#${TOGGLE_BTN_ID} .bc-hide-taken-count {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--bc-color-text-muted);
}
`;

export function injectHideTakenStyles(doc: Document): void {
  ensureStyle(doc, STYLE_ID, CSS);
}

export function removeHideTakenStyles(doc: Document): void {
  doc.getElementById(STYLE_ID)?.remove();
}
