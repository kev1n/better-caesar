import { CTEC_CELL_CLASS, STYLE_ID } from "./constants";
import type { CtecLinkData } from "./types";

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${CTEC_CELL_CLASS} {
      padding: 4px 8px;
      min-width: 120px;
      vertical-align: top;
    }
    .bc-ctec-widget {
      font-size: 11px;
      line-height: 1.6;
      font-family: Helvetica, Arial, sans-serif;
    }
    .bc-ctec-count {
      font-weight: 700;
      color: #66023c;
      margin-bottom: 1px;
    }
    .bc-ctec-link {
      display: block;
      color: #66023c;
      text-decoration: none;
      white-space: nowrap;
    }
    .bc-ctec-link:hover { text-decoration: underline; }
    .bc-ctec-muted { color: #888; }
    .bc-ctec-warn { color: #a00; }
    .bc-ctec-auth-link {
      color: #66023c;
      font-weight: 600;
    }
    .bc-ctec-btn {
      margin-top: 2px;
      padding: 2px 6px;
      font-size: 10px;
      cursor: pointer;
      border: 1px solid #66023c;
      background: white;
      color: #66023c;
      border-radius: 2px;
    }
    .bc-ctec-btn:hover { background: #66023c; color: white; }
    .bc-ctec-expand {
      display: block;
      margin-top: 2px;
      padding: 0;
      font-size: 10px;
      cursor: pointer;
      border: none;
      background: none;
      color: #888;
      text-decoration: underline;
    }
    .bc-ctec-expand:hover { color: #66023c; }
    .bc-ctec-fetch {
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #66023c;
      background: white;
      color: #66023c;
      border-radius: 2px;
      letter-spacing: 0.3px;
    }
    .bc-ctec-fetch:hover { background: #66023c; color: white; }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}

export function renderFetchButton(container: HTMLElement, onFetch: () => void): void {
  container.innerHTML = "";
  const btn = document.createElement("button");
  btn.className = "bc-ctec-fetch";
  btn.textContent = "CTEC";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    onFetch();
  });
  container.appendChild(btn);
}

export function renderLoading(container: HTMLElement): void {
  container.innerHTML = '<div class="bc-ctec-widget bc-ctec-muted">Loading\u2026</div>';
}

export function isCtecCellReady(container: HTMLElement): boolean {
  return container.dataset.ctecReady === "1";
}

export function markCtecCellReady(container: HTMLElement): void {
  container.dataset.ctecReady = "1";
}

export function renderCtecLinksWidget(
  container: HTMLElement,
  data: CtecLinkData,
  onRetry: () => void
): void {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "bc-ctec-widget";

  switch (data.state) {
    case "found": {
      const count = document.createElement("div");
      count.className = "bc-ctec-count";
      const evalWord = data.totalCount === 1 ? "evaluation" : "evaluations";
      count.textContent = `${data.totalCount} ${evalWord}`;
      root.appendChild(count);

      const INITIAL_SHOWN = 3;
      const renderLinks = (entries: typeof data.entries) => {
        for (const entry of entries) {
          const a = document.createElement("a");
          a.className = "bc-ctec-link";
          a.href = entry.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = `\u2197 ${entry.term}`;
          root.appendChild(a);
        }
      };

      renderLinks(data.entries.slice(0, INITIAL_SHOWN));

      if (data.entries.length > INITIAL_SHOWN) {
        const remaining = data.entries.length - INITIAL_SHOWN;

        const extraContainer = document.createElement("div");
        extraContainer.style.display = "none";
        renderLinks(data.entries.slice(INITIAL_SHOWN));
        // Move the extra links into extraContainer
        const allLinks = root.querySelectorAll<HTMLElement>(".bc-ctec-link");
        allLinks.forEach((el, i) => { if (i >= INITIAL_SHOWN) extraContainer.appendChild(el); });
        root.appendChild(extraContainer);

        const expandBtn = document.createElement("button");
        expandBtn.className = "bc-ctec-expand";
        expandBtn.textContent = `Show ${remaining} more`;
        expandBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const isHidden = extraContainer.style.display === "none";
          extraContainer.style.display = isHidden ? "" : "none";
          expandBtn.textContent = isHidden ? "Show less" : `Show ${remaining} more`;
        });
        root.appendChild(expandBtn);
      }
      break;
    }
    case "not-found": {
      const msg = document.createElement("div");
      msg.className = "bc-ctec-muted";
      msg.textContent = "No CTECs";
      root.appendChild(msg);
      break;
    }
    case "auth-required": {
      const msg = document.createElement("div");
      msg.className = "bc-ctec-warn";
      msg.textContent = "Auth required \u2014 ";
      const link = document.createElement("a");
      link.className = "bc-ctec-auth-link";
      link.href = data.loginUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Log in";
      msg.appendChild(link);
      root.appendChild(msg);
      root.appendChild(makeRetryButton(onRetry));
      break;
    }
    case "error": {
      const msg = document.createElement("div");
      msg.className = "bc-ctec-warn";
      msg.textContent = data.message.slice(0, 80);
      root.appendChild(msg);
      root.appendChild(makeRetryButton(onRetry));
      break;
    }
  }

  container.appendChild(root);
}

function makeRetryButton(onRetry: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "bc-ctec-btn";
  btn.textContent = "Retry";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    onRetry();
  });
  return btn;
}

export function ensureCtecCell(row: HTMLTableRowElement): HTMLElement {
  const existing = row.querySelector<HTMLTableCellElement>(`.${CTEC_CELL_CLASS}`);
  if (existing) return existing;
  const td = document.createElement("td");
  td.className = CTEC_CELL_CLASS;
  row.appendChild(td);
  return td;
}

export function isCtecCellDone(container: HTMLElement): boolean {
  return container.dataset.ctecDone === "1";
}

export function markCtecCellDone(container: HTMLElement): void {
  container.dataset.ctecDone = "1";
}
