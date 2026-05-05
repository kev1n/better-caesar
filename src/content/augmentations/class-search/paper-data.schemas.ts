// Wave 9: zod schemas for paper.nu's three remote payloads. Mirrors the
// `DataMapInfo`, `SubjectInfo`, and `PaperTermCourse` shapes consumed by
// `paper-data.ts`. Used by the `*Safe` fetcher variants to surface upstream
// shape drift via logQuiet without breaking the unsafe (default) path.

import { z } from "zod/mini";

const TermInfoSchema = z.object({
  name: z.string(),
  updated: z.string(),
  start: z.optional(z.string()),
  end: z.optional(z.string())
});

export const DataMapInfoSchema = z.object({
  latest: z.string(),
  subjects: z.string(),
  plan: z.string(),
  terms: z.record(z.string(), TermInfoSchema)
});

export const SubjectInfoSchema = z.object({
  symbol: z.string(),
  display: z.string(),
  color: z.optional(z.string()),
  schools: z.optional(z.array(z.string()))
});

export const SubjectInfoMapSchema = z.record(z.string(), SubjectInfoSchema);

const TimeOfDaySchema = z.nullable(z.object({ h: z.number(), m: z.number() }));

const InstructorSchema = z.object({
  name: z.optional(z.string()),
  phone: z.optional(z.string()),
  campus_address: z.optional(z.string()),
  office_hours: z.optional(z.string()),
  bio: z.optional(z.string()),
  url: z.optional(z.string())
});

const PaperSectionSchema = z.object({
  section_id: z.string(),
  course_id: z.string(),
  subject: z.string(),
  catalog: z.string(),
  number: z.optional(z.string()),
  title: z.string(),
  topic: z.optional(z.string()),
  section: z.string(),
  component: z.string(),
  meeting_days: z.array(z.nullable(z.string())),
  start_time: z.array(TimeOfDaySchema),
  end_time: z.array(TimeOfDaySchema),
  room: z.array(z.nullable(z.string())),
  start_date: z.optional(z.string()),
  end_date: z.optional(z.string()),
  capacity: z.optional(z.string()),
  enrl_req: z.optional(z.string()),
  descs: z.optional(z.array(z.tuple([z.string(), z.string()]))),
  distros: z.optional(z.string()),
  disciplines: z.optional(z.string()),
  school: z.optional(z.string()),
  instructors: z.optional(z.array(InstructorSchema))
});

export const PaperTermCourseSchema = z.object({
  course_id: z.string(),
  subject: z.string(),
  catalog: z.string(),
  number: z.optional(z.string()),
  title: z.string(),
  school: z.optional(z.string()),
  sections: z.array(PaperSectionSchema)
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: z.core.$ZodError };
