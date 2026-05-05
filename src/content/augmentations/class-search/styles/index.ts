import { addCtaStyles } from "./add-cta";
import { cardStyles } from "./card";
import { detailStyles } from "./detail";
import { headerStyles } from "./header";
import { pillsStyles } from "./pills";
import { relatedPickerStyles } from "./related-picker";
import { responsiveStyles } from "./responsive";
import { resultsStyles } from "./results";
import { sectionRowsStyles } from "./section-rows";
import { statusStyles } from "./status";
import { tabsStyles } from "./tabs";

export const STYLE_ID = "better-caesar-class-search-styles";

// Single style injection point. Each module owns one topical chunk of the
// stylesheet so any single file stays comprehensible. Order matches the
// historical inline file: header → tabs → card / form → filter pills →
// status → results (incl. my-classes + course card) → section rows →
// add-cta → related-picker → detail → responsive. Some later rules
// legitimately depend on cascade order (responsive media queries override
// earlier grid declarations), so keep the order.
export function classSearchStyles(): string {
  return [
    headerStyles(),
    tabsStyles(),
    cardStyles(),
    pillsStyles(),
    statusStyles(),
    resultsStyles(),
    sectionRowsStyles(),
    addCtaStyles(),
    relatedPickerStyles(),
    detailStyles(),
    responsiveStyles()
  ].join("\n");
}

export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = classSearchStyles();
  (doc.head ?? doc.documentElement).appendChild(style);
}
