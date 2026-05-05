// Wave 9: zod schemas for the CTEC report parser output. Mirrors the
// `CtecReportSummary`, `CtecReportChart`, `CtecReportScalarMetric`,
// `CtecReportHoursMetric`, and `CtecCourseAnalytics` shapes consumed across
// `paper-ctec/` and `class-search/` (via `ctec-links/reports.ts`). Used by
// the `parseCtecReportHtmlSafe` wrapper to surface drift in the parser
// itself; the existing parser stays primary.

import { z } from "zod/mini";

export const CtecReportScalarMetricSchema = z.object({
  mean: z.number(),
  responseCount: z.number()
});

export const CtecReportHoursMetricSchema = z.object({
  mean: z.number(),
  responseCount: z.number(),
  buckets: z.optional(
    z.array(z.object({ label: z.string(), count: z.number() }))
  )
});

export const CtecReportChartSchema = z.object({
  question: z.string(),
  imageUrl: z.string(),
  alt: z.nullable(z.string()),
  counts: z.optional(z.array(z.number()))
});

export const CtecReportCommentGroupSchema = z.object({
  prompt: z.string(),
  comments: z.array(z.string())
});

export const CtecReportSummarySchema = z.object({
  url: z.string(),
  parsedAt: z.number(),
  metrics: z.object({
    instruction: z.optional(CtecReportScalarMetricSchema),
    course: z.optional(CtecReportScalarMetricSchema),
    learned: z.optional(CtecReportScalarMetricSchema),
    challenging: z.optional(CtecReportScalarMetricSchema),
    stimulating: z.optional(CtecReportScalarMetricSchema),
    hours: z.optional(CtecReportHoursMetricSchema)
  }),
  charts: z.array(CtecReportChartSchema),
  commentGroups: z.array(CtecReportCommentGroupSchema)
});

export const CtecAggregateMetricSchema = z.object({
  mean: z.number(),
  totalResponses: z.number(),
  evaluationCount: z.number()
});

export const CtecReportAggregateSchema = z.object({
  evaluationCount: z.number(),
  parsedCount: z.number(),
  aggregateEvaluationCount: z.number(),
  aggregateParsedCount: z.number(),
  maxEntriesUsed: z.nullable(z.number()),
  windowTerms: z.array(z.string()),
  latestTerm: z.nullable(z.string()),
  latestUrl: z.nullable(z.string()),
  allFetched: z.boolean(),
  partial: z.boolean(),
  metrics: z.object({
    instruction: z.optional(CtecAggregateMetricSchema),
    course: z.optional(CtecAggregateMetricSchema),
    learned: z.optional(CtecAggregateMetricSchema),
    challenging: z.optional(CtecAggregateMetricSchema),
    stimulating: z.optional(CtecAggregateMetricSchema),
    hours: z.optional(CtecAggregateMetricSchema)
  })
});

export const CtecCourseAnalyticsEntrySchema = z.object({
  term: z.string(),
  description: z.string(),
  instructor: z.string(),
  url: z.nullable(z.string()),
  status: z.union([z.literal("ready"), z.literal("pending"), z.literal("unavailable")]),
  metrics: z.object({
    instruction: z.optional(CtecReportScalarMetricSchema),
    course: z.optional(CtecReportScalarMetricSchema),
    learned: z.optional(CtecReportScalarMetricSchema),
    challenging: z.optional(CtecReportScalarMetricSchema),
    stimulating: z.optional(CtecReportScalarMetricSchema),
    hours: z.optional(CtecReportHoursMetricSchema)
  }),
  charts: z.array(CtecReportChartSchema),
  commentGroups: z.array(CtecReportCommentGroupSchema)
});

export const CtecCourseAnalyticsSchema = z.object({
  recentAggregate: CtecReportAggregateSchema,
  entries: z.array(CtecCourseAnalyticsEntrySchema),
  allFetched: z.boolean(),
  pendingDiscoveryCount: z.number()
});

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: z.core.$ZodError };
