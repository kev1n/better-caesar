import { injectModalStyles } from "../framework/modal";
import {
  getGateStatusSync,
  onGateStatusChange,
  type GateStatus
} from "./index";
import { canonicalizeCodeInput, isCodeValidForLastName } from "./code";
import { renderInlineMarkdown } from "./markdown";
import { writeStoredCode } from "./storage";

const HOST_ID = "better-caesar-gate-modal";
// Storage key intentionally keeps the legacy "gate-toast" segment so dismissals
// recorded by previous installs survive the rename to "modal".
const DISMISSED_KILL_IDS_STORAGE_KEY = "better-caesar:gate-toast:dismissed-kill-ids:v1";

let lastShownKind: Exclude<GateStatus["kind"], "unlocked"> | null = null;
let dismissedKind: GateStatus["kind"] | null = null;
let codeFormOpen = false;
let dismissedKillIds: Set<string> = new Set();

export function mountAccessGateModal(): void {
  const apply = (status: GateStatus) => {
    if (status.kind !== "unlocked" && lastShownKind !== status.kind) {
      // New lock state — reset the per-status dismissal and any open form.
      dismissedKind = null;
      codeFormOpen = false;
    }
    if (status.kind !== "unlocked") {
      lastShownKind = status.kind;
    }
    whenBodyReady(() => render(status));
  };

  void readDismissedKillIds().then((ids) => {
    dismissedKillIds = ids;
    apply(getGateStatusSync());
  });

  apply(getGateStatusSync());
  onGateStatusChange(apply);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes[DISMISSED_KILL_IDS_STORAGE_KEY]) return;
    void readDismissedKillIds().then((ids) => {
      dismissedKillIds = ids;
      apply(getGateStatusSync());
    });
  });
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

type LockedStatus = Exclude<GateStatus, { kind: "unlocked" }>;

function render(status: GateStatus): void {
  const existing = document.getElementById(HOST_ID);

  if (status.kind === "unlocked") {
    existing?.remove();
    return;
  }
  if (status.kind === "killed" && dismissedKillIds.has(status.killId)) {
    existing?.remove();
    return;
  }
  if (status.kind !== "killed" && dismissedKind === status.kind) {
    existing?.remove();
    return;
  }
  // Hide the "needs CAESAR" prompt on CAESAR itself — we expect the cookie/
  // fetch handshake to resolve in seconds, so the prompt is just noise there.
  if (status.kind === "needs-caesar" && isCaesarHost()) {
    existing?.remove();
    return;
  }

  injectModalStyles();
  const host = ensureHost(existing);
  paint(host, status);
}

function ensureHost(existing: HTMLElement | null): HTMLElement {
  if (existing) return existing;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.className = "bc-modal";
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-labelledby", `${HOST_ID}-title`);
  document.body.appendChild(host);
  return host;
}

function paint(host: HTMLElement, status: LockedStatus): void {
  host.dataset.kind = status.kind;
  host.innerHTML = "";

  // Backdrop click → dismiss. Re-bound on every paint so the latest status
  // (and its dismissal semantics) wins.
  host.onclick = (event) => {
    if (event.target !== host) return;
    dismiss(status);
  };

  const card = document.createElement("div");
  card.className = "bc-modal-card";
  card.addEventListener("click", (event) => event.stopPropagation());

  const close = document.createElement("button");
  close.className = "bc-modal-close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  close.addEventListener("click", () => dismiss(status));

  const title = document.createElement("h2");
  title.id = `${HOST_ID}-title`;
  title.className = "bc-modal-title";

  const body = document.createElement("p");
  body.className = "bc-modal-body";

  const actions = document.createElement("div");
  actions.className = "bc-modal-actions";

  card.append(close, title, body, actions);
  host.append(card);

  if (status.kind === "needs-caesar") {
    title.textContent = "Sign in to CAESAR";
    body.textContent = "pencil.nu will activate automatically once you've signed in.";
    const link = document.createElement("a");
    link.className = "bc-btn bc-btn--primary bc-btn--soft bc-btn--fill";
    link.textContent = "Open CAESAR";
    link.href = "https://caesar.ent.northwestern.edu/";
    link.target = "_blank";
    link.rel = "noopener";
    actions.append(link);
    return;
  }

  if (status.kind === "killed") {
    title.textContent = "pencil.nu is disabled";
    body.textContent = "";
    renderInlineMarkdown(body, status.message);
    return;
  }

  // locked-bucket
  const when = new Date(status.releaseAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
  title.textContent = `pencil.nu launches ${when}`;
  body.textContent = `${status.bucketLabel} gets access at that time.`;

  if (codeFormOpen) {
    actions.append(buildCodeForm(status, host));
  } else {
    const codeBtn = document.createElement("button");
    codeBtn.className = "bc-btn bc-btn--primary bc-btn--soft bc-btn--fill";
    codeBtn.type = "button";
    codeBtn.textContent = "I have a code";
    codeBtn.addEventListener("click", () => {
      codeFormOpen = true;
      paint(host, status);
      const input = host.querySelector(".bc-modal-code-input");
      if (input instanceof HTMLInputElement) input.focus();
    });
    actions.append(codeBtn);
  }
}

function dismiss(status: LockedStatus): void {
  if (status.kind === "killed") {
    void persistDismissedKillId(status.killId);
  } else {
    dismissedKind = status.kind;
  }
  codeFormOpen = false;
  document.getElementById(HOST_ID)?.remove();
}

function buildCodeForm(status: LockedStatus, host: HTMLElement): HTMLElement {
  const form = document.createElement("form");
  form.className = "bc-modal-code-form";
  form.style.cssText =
    "display: flex; flex-wrap: wrap; gap: 6px; align-items: center; width: 100%;";

  const input = document.createElement("input");
  input.className = "bc-input bc-modal-code-input";
  input.type = "text";
  input.placeholder = "XXX-XXX";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.maxLength = 8;
  input.style.cssText =
    "flex: 1 1 140px; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.08em; text-transform: uppercase;";

  const submit = document.createElement("button");
  // Inside a flex row alongside an input that already grows; use --soft for
  // the dialog look but suppress --fill so the input keeps its share of space.
  submit.className = "bc-btn bc-btn--primary bc-btn--soft";
  submit.type = "submit";
  submit.style.flex = "0 0 auto";
  submit.textContent = "Unlock";

  const msg = document.createElement("div");
  msg.className = "bc-modal-code-msg";
  msg.style.cssText =
    "flex-basis: 100%; font-size: var(--bc-font-11); color: var(--bc-color-text-mauve-cool-alt);";

  form.append(input, submit, msg);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    msg.textContent = "";
    msg.style.color = "var(--bc-color-text-mauve-cool-alt)";
    const cleaned = canonicalizeCodeInput(input.value);
    if (cleaned.length === 0) return;
    if (status.kind !== "locked-bucket") {
      msg.textContent = "Sign in to CAESAR first so we know who you are.";
      msg.style.color = "var(--bc-color-danger-text)";
      return;
    }
    const ok = await isCodeValidForLastName(cleaned, status.lastName);
    if (!ok) {
      msg.textContent = "Code didn't match.";
      msg.style.color = "var(--bc-color-danger-text)";
      return;
    }
    await writeStoredCode(cleaned);
    // Storage change triggers gate re-eval → modal removes itself.
  });

  // Re-render keeps `host` referenced; silence unused-var warning by reading it.
  void host;

  return form;
}

function isCaesarHost(): boolean {
  return window.location.hostname === "caesar.ent.northwestern.edu";
}

async function readDismissedKillIds(): Promise<Set<string>> {
  const result = (await chrome.storage.local.get(DISMISSED_KILL_IDS_STORAGE_KEY)) as Record<
    string,
    unknown
  >;
  const raw = result[DISMISSED_KILL_IDS_STORAGE_KEY];
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((s) => typeof s === "string"));
}

async function persistDismissedKillId(id: string): Promise<void> {
  const current = await readDismissedKillIds();
  if (current.has(id)) return;
  current.add(id);
  await chrome.storage.local.set({ [DISMISSED_KILL_IDS_STORAGE_KEY]: [...current] });
}
