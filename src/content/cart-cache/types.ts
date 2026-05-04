// Persistent CAESAR cart/enrollment cache. Tells UIs in class-search and
// paper-ctec whether a section is already in the user's shopping cart or
// already enrolled, so Add-to-cart buttons render with the right state on
// initial mount instead of flashing "Added!" and reverting.
//
// Keyed by CAESAR `STRM` (term id). Cart and enrolled rows are kept
// separate because they want different UI badges.

export type CartEntryStatus = "in-cart" | "enrolled";

export type CartEntry = {
  classNumber: string;     // 5-digit CAESAR class number
  subject: string;         // "COMP_SCI"
  catalog: string;         // "111-0"
  sectionLabel: string;    // "1-LEC" — section + component
  description?: string;    // free-form (CAESAR enrolled-row "Description")
  capturedAt: number;
};

export type TermCart = {
  cart: Record<string, CartEntry>;       // keyed by classNumber
  enrolled: Record<string, CartEntry>;   // keyed by classNumber
  refreshedAt: number;                   // last cart-page reconcile, ms
  source: "cart-page" | "optimistic";    // cart-page = ground truth
};

export type CartCache = {
  version: 1;
  byTerm: Record<string, TermCart>;
};

export const CART_CACHE_STORAGE_KEY = "better-caesar:cart-cache:v1";

export function emptyCache(): CartCache {
  return { version: 1, byTerm: {} };
}

export function emptyTermCart(): TermCart {
  return { cart: {}, enrolled: {}, refreshedAt: 0, source: "optimistic" };
}
