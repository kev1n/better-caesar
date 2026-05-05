// Wave 9: zod schemas mirroring the cart-cache `CartEntry` shape and the
// `ParsedCartPage` envelope returned by `parseCartPage`. Used by the
// `parseCartPageSafe` wrapper to surface drift in the live-cart parser
// without touching the unsafe path.

import { z } from "zod/mini";

export const CartEntrySchema = z.object({
  classNumber: z.string(),
  subject: z.string(),
  catalog: z.string(),
  sectionLabel: z.string(),
  description: z.optional(z.string()),
  capturedAt: z.number()
});

export const ParsedCartPageSchema = z.object({
  termId: z.string(),
  cart: z.array(CartEntrySchema),
  enrolled: z.array(CartEntrySchema)
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: z.core.$ZodError };
