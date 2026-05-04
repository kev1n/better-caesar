import { startAccessGate } from "./access-gate";
import { mountServerBanner } from "./access-gate/banner";
import { mountAccessGateToast } from "./access-gate/toast";
import { augmentationRegistry } from "./augmentations/registry";
import { initModalCache } from "./augmentations/paper-ctec/modal-cache";
import { initCartCache, runOpportunisticReconcile } from "./cart-cache";
import { bootstrapTheme } from "./design";
import { AugmentationRunner } from "./framework";
import { registerLookupMessageHandler } from "./messaging";

void bootstrapTheme();
injectEarlyTermPageMask();
registerLookupMessageHandler();
void startAccessGate();
mountAccessGateToast();
mountServerBanner();
void initCartCache();
initModalCache();
new AugmentationRunner(augmentationRegistry).start();

// Opportunistic cart-cache reconcile. Only fires on CAESAR pages — we need
// the user's PeopleSoft session cookies to fetch the cart URL, and they
// only flow with the request when a CAESAR tab is loaded. Internally
// gates on a 1hr stale check so we don't hit CAESAR on every page load.
if (/caesar\.ent\.northwestern\.edu/i.test(window.location.host)) {
  void initCartCache().then(() => runOpportunisticReconcile());
}

function injectEarlyTermPageMask(): void {
  const url = new URL(window.location.href);
  const page = url.searchParams.get("PAGE") ?? url.searchParams.get("Page");
  if (page !== "SSR_SSENRL_TERM") return;

  const style = document.createElement("style");
  style.id = "better-caesar-early-term-mask";
  // Inlined raw colors here (not vars) because this style runs BEFORE
  // bootstrapTheme() injects --bc-* tokens — the design system isn't
  // available yet on the very first paint of a term-switch page.
  style.textContent = `
    body > * { visibility: hidden !important; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background: #ffffff;
      z-index: 2147483646;
    }
    body::after {
      content: "Switching term...";
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      color: #66023c;
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
