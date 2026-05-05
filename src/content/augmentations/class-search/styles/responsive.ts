import { maxWidth } from "../../../design/breakpoints";

// Responsive overrides — at narrower viewports the form collapses to one
// column and the section grid reflows to 4 columns (then 2 columns on mobile).
export function responsiveStyles(): string {
  return `
    /* ── Responsive ─────────────────────────────────────────────────────── */
    @media ${maxWidth("xl")} {
      .bc-cs-form { grid-template-columns: 1fr; }
      .bc-cs-section {
        grid-template-columns: 60px 60px 1fr 1fr;
        row-gap: 6px;
      }
      .bc-cs-section-room,
      .bc-cs-section-instructor { grid-column: span 2; }
      .bc-cs-section-live,
      .bc-cs-section-actions { grid-column: 1 / -1; justify-self: start; }
    }
    @media ${maxWidth("sm")} {
      .bc-cs-root { padding: 0 10px; }
      .bc-cs-tabs { padding: 0 10px; }
      .bc-cs-course-head { grid-template-columns: 1fr; gap: 4px; }
      .bc-cs-course-units { justify-self: start; }
      .bc-cs-section { grid-template-columns: 1fr 1fr; }
    }
  `;
}
