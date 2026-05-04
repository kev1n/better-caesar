import { renderInlineMarkdown } from "./markdown";
import { readCachedRemoteSchedule, SCHEDULE_CACHE_STORAGE_KEY } from "./server-client";

const HOST_ID = "better-caesar-server-banner";
const DISMISSED_STORAGE_KEY = "better-caesar:server-banner:dismissed-message:v1";

export function mountServerBanner(): void {
  // Content scripts run in every frame (all_frames: true). A position:fixed
  // banner inside an iframe (e.g. CAESAR's #ptifrmtgtframe) would anchor to
  // the iframe's viewport, not the page — gate to the top frame.
  if (!isTopFrame()) return;
  void renderFromCache();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[SCHEDULE_CACHE_STORAGE_KEY] && !changes[DISMISSED_STORAGE_KEY]) return;
    void renderFromCache();
  });
}

function isTopFrame(): boolean {
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}

async function renderFromCache(): Promise<void> {
  const schedule = await readCachedRemoteSchedule();
  const message = schedule?.banner?.message ?? null;
  const dismissed = await readDismissedMessage();
  whenBodyReady(() => render(message, dismissed));
}

function whenBodyReady(cb: () => void): void {
  if (document.body) {
    cb();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!document.body) return;
    observer.disconnect();
    cb();
  });
  observer.observe(document.documentElement, { childList: true });
}

function render(message: string | null, dismissed: string | null): void {
  const existing = document.getElementById(HOST_ID);
  if (!message || message === dismissed) {
    existing?.remove();
    return;
  }

  const { root } = ensureHost(existing);
  paint(root, message);
}

function ensureHost(existing: HTMLElement | null): { host: HTMLElement; root: ShadowRoot } {
  if (existing && existing.shadowRoot) {
    return { host: existing, root: existing.shadowRoot };
  }
  existing?.remove();
  const host = document.createElement("div");
  host.id = HOST_ID;
  // z-index sits one below the gate toast (2147483647) so the toast wins
  // when both happen to be visible.
  host.style.cssText = [
    "all: initial",
    "position: fixed",
    "top: 0",
    "left: 0",
    "right: 0",
    "z-index: 2147483646",
    "pointer-events: none"
  ].join(";");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${BANNER_STYLES}</style><div class="banner"></div>`;
  document.body.appendChild(host);
  return { host, root };
}

function paint(root: ShadowRoot, message: string): void {
  const banner = root.querySelector(".banner");
  if (!(banner instanceof HTMLElement)) return;
  banner.innerHTML = "";

  const text = document.createElement("div");
  text.className = "text";
  renderInlineMarkdown(text, message);

  const close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  close.addEventListener("click", () => {
    void chrome.storage.local.set({ [DISMISSED_STORAGE_KEY]: message });
    document.getElementById(HOST_ID)?.remove();
  });

  banner.append(text, close);
}

async function readDismissedMessage(): Promise<string | null> {
  const result = (await chrome.storage.local.get(DISMISSED_STORAGE_KEY)) as Record<string, unknown>;
  const raw = result[DISMISSED_STORAGE_KEY];
  return typeof raw === "string" ? raw : null;
}

const BANNER_STYLES = `
  :host, * { box-sizing: border-box; }
  .banner {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    background: #fef3c7;
    color: #78350f;
    border-bottom: 1px solid #f59e0b;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.4;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }
  .text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .text a {
    color: inherit;
    text-decoration: underline;
    font-weight: 600;
  }
  .text a:hover { color: #451a03; }
  .close {
    flex: 0 0 auto;
    background: none;
    border: none;
    font-size: 18px;
    line-height: 1;
    color: #92400e;
    cursor: pointer;
    padding: 4px 6px;
  }
  .close:hover { color: #78350f; }
`;
