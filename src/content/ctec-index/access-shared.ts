// Constants + types shared between the content-script's access state
// machine (`./access.ts`) and the popup's read-only access-status row
// (`src/popup/sections/ctec-access-status.ts`). Pulled into its own
// module so the popup can import them without dragging in `access.ts`'s
// chrome.storage hydration, legacy-key cleanup, and onChanged listener
// — all of which are content-script-only side effects.

export const CTEC_ACCESS_STORAGE_KEY = "better-caesar:ctec-no-access:v2";

// Auto-expire a "confirmed" verdict after this long. Northwestern can
// revoke CTEC access at any time (failure to complete prior CTECs in the
// last collection period), so a confirmed flag has a real shelf life.
// "denied" never expires — it's sticky until the popup's "Clear CTEC
// cache" button wipes the flag.
export const CONFIRMED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CtecAccessStatus = "denied" | "confirmed" | "unknown";
