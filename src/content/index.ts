import { startAccessGate } from "./access-gate";
import { mountServerBanner } from "./access-gate/banner";
import { mountAccessGateModal } from "./access-gate/modal";
import { augmentationRegistry } from "./augmentations/registry";
import { initModalCache } from "./augmentations/paper-ctec/modal-cache";
import { initCartCache, runOpportunisticReconcile } from "./cart-cache";
import {
  initCourseHistoryCache,
  runOpportunisticCourseHistoryReconcile
} from "./course-history";
import { mountCtecAccessDetector } from "./ctec-index/access-detector";
import { bootstrapTheme } from "./design";
import { gateTokensCss } from "./design/tokens";
import { AugmentationRunner } from "./framework";
import { registerLookupMessageHandler } from "./messaging";
import { mountTrafficIndicator } from "./peoplesoft/traffic-indicator";

// Gate tokens must paint synchronously, *before* anything else — the
// access-gate UI and the early term-page mask both consume them on the
// very first frame, while bootstrapTheme() is still resolving theme
// preferences asynchronously.
injectGateTokens();
void bootstrapTheme();
injectEarlyTermPageMask();
registerLookupMessageHandler();
void startAccessGate();
mountAccessGateModal();
mountServerBanner();
void initCartCache();
// Hydrate course history on every host — the cache is read by the
// paper.nu prereq-filter augmentation to mark eligibility, not just
// CAESAR. Read-only on non-CAESAR hosts (no fetch); the opportunistic
// reconcile that actually pulls fresh data still gates on CAESAR.
const courseHistoryReady = initCourseHistoryCache();
initModalCache();
const augmentationRunner = new AugmentationRunner(augmentationRegistry);
augmentationRunner.start();
// First augmentation tick fires before storage hydration finishes; once
// the course-history cache lands, kick the runner so the prereq-filter
// re-evaluates with real data instead of an empty map.
void courseHistoryReady.then(() => augmentationRunner.requestRun());

// Opportunistic cart-cache reconcile. Only fires on CAESAR pages — we need
// the user's PeopleSoft session cookies to fetch the cart URL, and they
// only flow with the request when a CAESAR tab is loaded. Internally
// gates on a 1hr stale check so we don't hit CAESAR on every page load.
if (/caesar\.ent\.northwestern\.edu/i.test(window.location.host)) {
  void initCartCache().then(() => runOpportunisticReconcile());
  // Same opportunistic pattern as cart-cache: needs the live PeopleSoft
  // session cookies, gated on a 1hr stale check internally.
  void courseHistoryReady.then(() => runOpportunisticCourseHistoryReconcile());
  // Queue indicator is also CAESAR-only — paper.nu has its own
  // status-bar surface and doesn't drive the PeopleSoft mutex.
  mountTrafficIndicator(document);
  // Watches for the inline "not authorized to access CTECs" panel CAESAR
  // shows on the NU Manage Classes / CTEC pages. Self-disconnects once
  // the access flag flips.
  mountCtecAccessDetector(document);
}

function injectGateTokens(): void {
  // Idempotent: re-inserting on subframe load is fine, but we don't want
  // duplicate <style> nodes piling up under <head>.
  if (document.getElementById("bc-gate-tokens")) return;
  const host = document.head ?? document.documentElement ?? document.body;
  if (!host) return;
  const style = document.createElement("style");
  style.id = "bc-gate-tokens";
  style.textContent = gateTokensCss();
  // Prepend so theme bootstrap can override without specificity wars
  // (theme tokens live on :root too, but they win by source order).
  host.insertBefore(style, host.firstChild);
}

function injectEarlyTermPageMask(): void {
  const url = new URL(window.location.href);
  const page = url.searchParams.get("PAGE") ?? url.searchParams.get("Page");
  if (page !== "SSR_SSENRL_TERM") return;

  const style = document.createElement("style");
  style.id = "better-caesar-early-term-mask";
  // Variables resolve from <style id="bc-gate-tokens"> injected above —
  // the design system's per-theme tokens aren't loaded yet here.
  style.textContent = `
    body > * { visibility: hidden !important; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background: var(--bc-gate-bg);
      z-index: 2147483646;
    }
    body::after {
      content: "Switching term...";
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      color: var(--bc-gate-accent);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.2px;
      font-family: Helvetica, Arial, sans-serif;
    }
  `;

  const host = document.head ?? document.documentElement ?? document.body;
  if (!host) return;
  host.appendChild(style);
}
