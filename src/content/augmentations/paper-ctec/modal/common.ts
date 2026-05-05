import { html, type TemplateResult } from "lit-html";

import type { ModalDisplayData, ModalTerm } from "../modal-data";
import { stopPropagation } from "../ui-shared";

// Section card with a header (title + optional right-side meta + optional
// CTA link) and a body slot. lit-html flavor — preferred for new section
// migrations.
export function cardTemplate(
  title: string,
  right: string,
  body: unknown,
  cta?: { label: string; href: string }
): TemplateResult {
  return html`<section class="bc-paper-ctec-modal-card-section">
    <div class="bc-paper-ctec-modal-card-head">
      <div class="bc-paper-ctec-modal-card-title">${title}</div>
      ${right || cta
        ? html`<div class="bc-paper-ctec-modal-card-meta">
            ${right ? html`<span>${right}</span>` : ""}
            ${cta
              ? html`<a
                  href=${cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="bc-paper-ctec-modal-card-cta"
                  @click=${stopPropagation}
                >${cta.label}</a>`
              : ""}
          </div>`
        : ""}
    </div>
    <div class="bc-paper-ctec-modal-card-body">${body}</div>
  </section>`;
}

// Selected term resolver. The selectedId might be stale (term gone from the
// dataset after a refresh) — fall back to the most recent term so the modal
// always has *some* term to show in the drill-in panes.
export function pickSelectedTerm(
  data: ModalDisplayData,
  selectedId: string | null
): ModalTerm | null {
  if (selectedId) {
    const match = data.terms.find((term) => term.id === selectedId);
    if (match) return match;
  }
  return data.terms[0] ?? null;
}
