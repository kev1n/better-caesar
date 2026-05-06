import { html, render, type TemplateResult } from "lit-html";

import { AUTH_MODAL_ID } from "./constants";
import { iconTemplate, preventAndStop, stopPropagation } from "./ui-shared";

type AuthModalCallbacks = {
  onLogin: () => void;
  onDismiss: () => void;
  onCancelPending: () => void;
};

type AuthModalData = {
  loginUrl?: string;
  awaitingAuthRetry: boolean;
  pending: boolean;
};

export function renderAuthModal(
  doc: Document,
  data: AuthModalData,
  callbacks: AuthModalCallbacks
): void {
  let modal = doc.getElementById(AUTH_MODAL_ID) as HTMLDivElement | null;
  if (!modal) {
    modal = doc.createElement("div");
    modal.id = AUTH_MODAL_ID;
    modal.className = "bc-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", `${AUTH_MODAL_ID}-title`);
    (doc.body ?? doc.documentElement).appendChild(modal);
  }

  const dismissAction = data.pending ? callbacks.onCancelPending : callbacks.onDismiss;

  // Modal backdrop click → dismiss. Re-bound on every render so the latest
  // dismissAction wins (pending/idle dispatches differ).
  modal.onclick = (event) => {
    if (event.target !== modal) return;
    preventAndStop(event);
    dismissAction();
  };

  render(
    html`<div class="bc-modal-card" @click=${stopPropagation}>
      <button
        type="button"
        class="bc-modal-close"
        aria-label=${data.pending ? "Cancel login flow" : "Dismiss login prompt"}
        @click=${(event: Event) => {
          preventAndStop(event);
          dismissAction();
        }}
      >×</button>
      ${data.pending ? renderPendingCard(data, callbacks) : renderLoginCard(data, callbacks)}
    </div>`,
    modal
  );
}

export function hideAuthModal(doc: Document): void {
  doc.getElementById(AUTH_MODAL_ID)?.remove();
}

function renderLoginCard(
  data: AuthModalData,
  callbacks: AuthModalCallbacks
): TemplateResult {
  return html`
    <div class="bc-modal-icon">${iconTemplate("lock")}</div>
    <h2 id=${`${AUTH_MODAL_ID}-title`} class="bc-modal-title">
      Northwestern login required
    </h2>
    <p class="bc-modal-body">
      pencil.nu needs a CAESAR login to read CTEC reports on your behalf to
      display on your paper.nu.
      <strong
        >It authorizes that you have the permissions to access CTECs before you
        can view them.</strong
      >
    </p>
    <p class="bc-modal-note">
      You'll need to repeat this any time Northwestern signs you out (typically
      every few hours).
    </p>
    <p class="bc-modal-trust">
      pencil.nu is open source. If you'd like, you may review the code at
      <a
        class="bc-modal-link"
        href="https://github.com/kev1n/pencil"
        target="_blank"
        rel="noopener noreferrer"
        @click=${stopPropagation}
        >github.com/kev1n/pencil</a
      >.
    </p>
    <div class="bc-modal-actions">
      ${data.loginUrl
        ? html`<button
            type="button"
            class="bc-btn bc-btn--primary bc-btn--soft bc-btn--fill"
            @click=${(event: Event) => {
              preventAndStop(event);
              callbacks.onLogin();
            }}
          >${data.awaitingAuthRetry
            ? "Open Northwestern login again"
            : "Open Northwestern login"}</button>`
        : ""}
      <button
        type="button"
        class="bc-btn bc-btn--secondary-accent"
        @click=${(event: Event) => {
          preventAndStop(event);
          callbacks.onDismiss();
        }}
      >Not now</button>
    </div>
  `;
}

function renderPendingCard(
  data: AuthModalData,
  callbacks: AuthModalCallbacks
): TemplateResult {
  return html`
    <div
      class="bc-modal-icon bc-modal-spinner"
      aria-hidden="true"
    ></div>
    <h2 id=${`${AUTH_MODAL_ID}-title`} class="bc-modal-title">
      Waiting for Northwestern login…
    </h2>
    <p class="bc-modal-body">
      Finish signing in on the Northwestern tab. pencil.nu will detect when
      you're back and resume loading CTECs automatically — the login tab will
      close on its own.
    </p>
    <p class="bc-modal-note">
      Don't see the login tab? Click the button below to reopen it.
    </p>
    <div class="bc-modal-actions">
      ${data.loginUrl
        ? html`<button
            type="button"
            class="bc-btn bc-btn--primary bc-btn--soft bc-btn--fill"
            @click=${(event: Event) => {
              preventAndStop(event);
              callbacks.onLogin();
            }}
          >Reopen login tab</button>`
        : ""}
      <button
        type="button"
        class="bc-btn bc-btn--secondary-accent"
        @click=${(event: Event) => {
          preventAndStop(event);
          callbacks.onCancelPending();
        }}
      >Cancel</button>
    </div>
  `;
}
