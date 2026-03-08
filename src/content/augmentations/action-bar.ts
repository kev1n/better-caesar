export const ACTION_BAR_ID = "bc-action-bar";
const ACTION_BAR_STYLE_ID = "bc-action-bar-style";

export function ensureActionBar(doc: Document): HTMLElement | null {
  injectActionBarStyles(doc);

  const existing = doc.getElementById(ACTION_BAR_ID);
  if (existing instanceof HTMLElement) return existing;

  // Prefer the term switcher injected by enrollment-navigation; fall back to
  // the same anchors that enrollment-navigation itself uses.
  const anchor =
    doc.getElementById("better-caesar-term-switcher") ??
    doc.querySelector("#win0divDERIVED_REGFRM1_SSR_STDNTKEY_DESCR") ??
    doc.querySelector("#win0divDERIVED_REGFRM1_TITLE1") ??
    (doc.querySelector(".PAPAGETITLE") as HTMLElement | null)?.parentElement ??
    null;

  if (!anchor) return null;

  const bar = doc.createElement("div");
  bar.id = ACTION_BAR_ID;
  anchor.insertAdjacentElement("afterend", bar);
  return bar;
}

function injectActionBarStyles(doc: Document): void {
  if (doc.getElementById(ACTION_BAR_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = ACTION_BAR_STYLE_ID;
  style.textContent = `
    #${ACTION_BAR_ID} {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 6px;
    }
    .bc-action-btn {
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #66023c;
      background: white;
      color: #66023c;
      border-radius: 2px;
      letter-spacing: 0.3px;
      font-family: inherit;
    }
    .bc-action-btn:hover { background: #66023c; color: white; }
    .bc-action-btn:disabled { opacity: 0.6; cursor: default; }
    .bc-action-btn:disabled:hover { background: white; color: #66023c; }
  `;
  (doc.head ?? doc.documentElement).appendChild(style);
}
