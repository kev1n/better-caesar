import type { Augmentation } from "../framework";
import { initCartCache, replaceTermFromCartPage } from "./storage";
import {
  parseCartPage,
  type ParsedCartPage
} from "./parse-cart-page";

// Reconciles the cache against the live CAESAR shopping-cart page. Whenever
// the user lands on the cart page, we scrape both the "Shopping Cart" grid
// and the "My Class Schedule" grid (enrolled + dropped) and replace the
// term's cache entry. This is the only path that can drop sections from
// the cache — optimistic adds never remove.
//
// Not user-toggleable; it's supporting infrastructure for class-search and
// paper-ctec, not a feature of its own.
export class CartPageHydrator implements Augmentation {
  readonly id = "cart-cache-hydrator";

  // Last (term, signature) we wrote — keeps us idempotent under the runner's
  // mutation-driven re-runs (PeopleSoft swaps DOM aggressively).
  private lastSignature: { termId: string; signature: string } | null = null;

  constructor() {
    void initCartCache();
  }

  // No DOM is ever mutated by this augmentation, so cleanup is a no-op.
  cleanup(): void {
    this.lastSignature = null;
  }

  run(doc: Document = document): void {
    if (!isCartPage(doc)) return;

    let parsed: ParsedCartPage | null;
    try {
      parsed = parseCartPage(doc);
    } catch {
      return;
    }
    if (!parsed) return;

    const signature = buildSignature(parsed);
    if (
      this.lastSignature &&
      this.lastSignature.termId === parsed.termId &&
      this.lastSignature.signature === signature
    ) {
      return;
    }

    replaceTermFromCartPage(parsed.termId, parsed.cart, parsed.enrolled);
    this.lastSignature = { termId: parsed.termId, signature };
  }
}

function isCartPage(doc: Document): boolean {
  if (!/caesar\.ent\.northwestern\.edu/i.test(doc.location?.host ?? "")) return false;
  const pageInfo = doc.getElementById("pt_pageinfo_win0");
  if (pageInfo?.getAttribute("Component") === "SSR_SSENRL_CART") return true;
  // Defense in depth: if the framework swapped the page in without
  // refreshing pt_pageinfo, the shopping-cart grid is still a reliable tell.
  return !!doc.querySelector("#SSR_REGFORM_VW\\$scroll\\$0");
}

function buildSignature(parsed: ParsedCartPage): string {
  const cartSig = parsed.cart.map((e) => e.classNumber).sort().join(",");
  const enrolledSig = parsed.enrolled.map((e) => e.classNumber).sort().join(",");
  return `${cartSig}|${enrolledSig}`;
}
