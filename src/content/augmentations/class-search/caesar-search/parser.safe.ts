// Wave 9 — `*Safe` variants of caesar-search parsers. Wrap each parser with
// zod validation and surface shape drift via logQuiet. Always uses safeParse
// (never throws). Lives in a separate module from parser.ts so the schema
// + zod payload only loads when a caller actually opts in — keeps the
// production content bundle free of zod until a future wave migrates a
// caller.

import { z } from "zod/mini";

import { logQuiet } from "../../../../shared/log";
import {
  CaesarCourseGroupSchema,
  CaesarSectionSchema,
  RelatedSectionOptionSchema,
  type ParseResult
} from "./parser.schemas";
import {
  parseCaesarGroups,
  parseRelatedComponentOptions,
  parseSectionRow
} from "./parser";
import type {
  CaesarCourseGroup,
  CaesarSection,
  RelatedSectionOption
} from "./types";

export function parseCaesarGroupsSafe(
  searchHtml: string
): ParseResult<CaesarCourseGroup[]> {
  const value = parseCaesarGroups(searchHtml);
  const result = z.array(CaesarCourseGroupSchema).safeParse(value);
  if (!result.success) {
    logQuiet("caesar-search.parser.parseCaesarGroups", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.data };
}

export function parseSectionRowSafe(
  doc: Document,
  rowIndex: number
): ParseResult<CaesarSection | null> {
  const value = parseSectionRow(doc, rowIndex);
  if (value === null) return { ok: true, value: null };
  const result = CaesarSectionSchema.safeParse(value);
  if (!result.success) {
    logQuiet("caesar-search.parser.parseSectionRow", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.data };
}

export function parseRelatedComponentOptionsSafe(
  html: string
): ParseResult<RelatedSectionOption[] | null> {
  const value = parseRelatedComponentOptions(html);
  if (value === null) return { ok: true, value: null };
  const result = z.array(RelatedSectionOptionSchema).safeParse(value);
  if (!result.success) {
    logQuiet("caesar-search.parser.parseRelatedComponentOptions", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.data };
}
