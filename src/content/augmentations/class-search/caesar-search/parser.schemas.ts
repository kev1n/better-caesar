// Wave 9: zod schemas mirroring the TypeScript output types in `./types.ts`.
// Used by the `*Safe` parser variants in `./parser.ts` to surface silent shape
// drift as a logged validation error instead of a misrender. The unsafe
// parsers still exist; callers opt into validation by switching to the safe
// variant.

// `zod/mini` exports a tree-shakeable functional API. A few hundred KB
// smaller than the full classic `zod` builder when bundled — matters for
// the content script which already runs on every CAESAR / Paper.nu page.
import { z } from "zod/mini";

export const CaesarStatusSchema = z.union([
  z.literal("Open"),
  z.literal("Closed"),
  z.literal("Wait List"),
  z.literal("Unknown")
]);

export const CaesarSectionSchema = z.object({
  classNumber: z.string(),
  sectionLabel: z.string(),
  sectionNumber: z.string(),
  component: z.string(),
  daysTime: z.string(),
  room: z.string(),
  instructor: z.string(),
  meetingDates: z.string(),
  grading: z.string(),
  status: CaesarStatusSchema,
  selectActionId: z.string(),
  selectAvailable: z.boolean()
});

export const CaesarCourseGroupSchema = z.object({
  courseId: z.string(),
  catalog: z.string(),
  title: z.string(),
  sections: z.array(CaesarSectionSchema)
});

export const RelatedSectionOptionSchema = z.object({
  rowIndex: z.number(),
  classNumber: z.string(),
  section: z.string(),
  schedule: z.string(),
  room: z.string(),
  instructor: z.string(),
  status: CaesarStatusSchema
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: z.core.$ZodError };
