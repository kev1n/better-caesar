import { STYLE_ID } from "../constants";
import { injectModalStyles } from "../../../framework/modal";
import { cardStyles } from "./cards";
import { modalStyles } from "./modal";
import { modalChartStyles } from "./modal-charts";
import { modalCommentStyles } from "./modal-comments";
import { modalTermStyles } from "./modal-terms";
import { sideCardStyles } from "./side-card";
import { sideCardPanelStyles } from "./side-card-panel";
import { statusBarStyles } from "./status-bar";

// Single style injection point. Each module owns one topical chunk of the
// stylesheet so any single file stays comprehensible. Order matches the
// historical inline file: cards → status bar → side card → modal frame →
// modal charts → modal comments → modal terms. Some later rules legitimately
// depend on cascade order (modal-terms responsive queries override modal-charts
// grid declarations), so keep the order. The auth dialog chrome lives in
// framework/modal.ts and is injected as its own <style> via injectModalStyles().
export function injectStyles(): void {
  injectModalStyles();

  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = [
    cardStyles(),
    statusBarStyles(),
    sideCardStyles(),
    sideCardPanelStyles(),
    modalStyles(),
    modalChartStyles(),
    modalCommentStyles(),
    modalTermStyles()
  ].join("\n");

  (document.head ?? document.documentElement).appendChild(style);
}
