const TOAST_HOST_ID = "bc-seats-toast-host";
const TOAST_STYLE_ID = "bc-seats-toast-style";

export type ToastTone = "info" | "warn" | "success" | "error";

export type ToastAction = {
  label: string;
  run: () => void;
};

export function showToast(
  message: string,
  options?: {
    tone?: ToastTone;
    durationMs?: number;
    action?: ToastAction;
  }
): void {
  const host = ensureHost();
  if (!host) return;

  const tone = options?.tone ?? "info";
  const duration = options?.durationMs ?? 3500;

  const toast = document.createElement("div");
  toast.className = `bc-toast bc-toast-${tone}`;

  const text = document.createElement("span");
  text.className = "bc-toast-text";
  text.textContent = message;
  toast.appendChild(text);

  const remove = (): void => {
    if (!toast.isConnected) return;
    toast.classList.add("bc-toast-leaving");
    window.setTimeout(() => {
      toast.remove();
    }, 200);
  };

  if (options?.action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bc-toast-action";
    btn.textContent = options.action.label;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      try {
        options.action?.run();
      } finally {
        remove();
      }
    });
    toast.appendChild(btn);
  }

  host.appendChild(toast);

  window.setTimeout(remove, duration);
  toast.addEventListener("click", remove);
}

function ensureHost(): HTMLElement | null {
  injectToastStyles();
  const existing = document.getElementById(TOAST_HOST_ID);
  if (existing instanceof HTMLElement) return existing;

  const parent = document.body ?? document.documentElement;
  if (!parent) return null;

  const host = document.createElement("div");
  host.id = TOAST_HOST_ID;
  parent.appendChild(host);
  return host;
}

function injectToastStyles(): void {
  if (document.getElementById(TOAST_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    #${TOAST_HOST_ID} {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      pointer-events: none;
      max-width: calc(100vw - 32px);
    }
    .bc-toast {
      pointer-events: auto;
      cursor: pointer;
      padding: 8px 12px;
      border-radius: var(--bc-radius-md);
      font: 500 var(--bc-font-12)/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: var(--bc-shadow-elev-2);
      max-width: 360px;
      animation: bc-toast-in 180ms ease-out;
      border: 1px solid transparent;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bc-toast-text { flex: 1; }
    .bc-toast-action {
      flex-shrink: 0;
      background: var(--bc-color-surface-translucent-72);
      color: inherit;
      border: 1px solid currentColor;
      border-radius: var(--bc-radius-sm);
      padding: 3px 8px;
      font: inherit;
      font-size: var(--bc-font-11);
      font-weight: var(--bc-fw-semibold);
      cursor: pointer;
    }
    .bc-toast-action:hover { background: var(--bc-color-surface-translucent-92); }
    .bc-toast-info {
      background: var(--bc-color-accent-surface-tile);
      border-color: var(--bc-color-accent-mid-border);
      color: var(--bc-color-accent-pressed);
    }
    .bc-toast-warn {
      background: var(--bc-color-seat-waitlist-bg);
      border-color: var(--bc-color-seat-waitlist-border);
      color: var(--bc-color-seat-waitlist-ink);
    }
    .bc-toast-success {
      background: var(--bc-color-success-bg-soft);
      border-color: var(--bc-color-success-border);
      color: var(--bc-color-success-text);
    }
    .bc-toast-error {
      background: var(--bc-color-danger-bg-soft);
      border-color: var(--bc-color-danger-border);
      color: var(--bc-color-danger-text);
    }
    .bc-toast-leaving {
      animation: bc-toast-out 180ms ease-in forwards;
    }
    @keyframes bc-toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes bc-toast-out {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(8px); }
    }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}
