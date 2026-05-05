// Wave 9 — `parseCartPageSafe`. Wraps `parseCartPage` with zod validation;
// null pass-through (login-page bail) is preserved. Lives in a dedicated
// module so production callers (still on the unsafe parser) don't pull zod
// into the content bundle.

import { logQuiet } from "../../shared/log";
import { parseCartPage, type ParsedCartPage } from "./parse-cart-page";
import { ParsedCartPageSchema, type ParseResult } from "./parse-cart-page.schemas";

export function parseCartPageSafe(
  doc: Document,
  htmlSource?: string
): ParseResult<ParsedCartPage | null> {
  const value = parseCartPage(doc, htmlSource);
  if (value === null) return { ok: true, value: null };
  const result = ParsedCartPageSchema.safeParse(value);
  if (!result.success) {
    logQuiet("cart-cache.parse-cart-page", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.data as ParsedCartPage };
}
