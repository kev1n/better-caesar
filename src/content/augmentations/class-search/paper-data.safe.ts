// Wave 9 — `*Safe` variants of paper.nu data fetchers. Wraps each fetcher
// with zod validation against the upstream payload shape so silent drift
// surfaces via `logQuiet`. Lives in a dedicated module so production paths
// (which still call the unsafe fetchers in `paper-data.ts`) don't pull zod
// into the content bundle. Opt in by importing this module directly.

import { z } from "zod/mini";

import { logQuiet } from "../../../shared/log";
import {
  getDataMapInfo,
  getSubjects,
  getTermCourses,
  type DataMapInfo,
  type PaperTermCourse,
  type SubjectInfo
} from "./paper-data";
import {
  DataMapInfoSchema,
  PaperTermCourseSchema,
  SubjectInfoMapSchema,
  type ParseResult
} from "./paper-data.schemas";

export async function getDataMapInfoSafe(): Promise<ParseResult<DataMapInfo>> {
  const value = await getDataMapInfo();
  const result = DataMapInfoSchema.safeParse(value);
  if (!result.success) {
    logQuiet("paper-data.validate.info", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.data as DataMapInfo };
}

export async function getSubjectsSafe(): Promise<
  ParseResult<Record<string, SubjectInfo>>
> {
  const value = await getSubjects();
  const result = SubjectInfoMapSchema.safeParse(value);
  if (!result.success) {
    logQuiet("paper-data.validate.subjects", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.data as Record<string, SubjectInfo> };
}

export async function getTermCoursesSafe(
  termId: string
): Promise<ParseResult<PaperTermCourse[]>> {
  const value = await getTermCourses(termId);
  const result = z.array(PaperTermCourseSchema).safeParse(value);
  if (!result.success) {
    logQuiet("paper-data.validate.term", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.data as PaperTermCourse[] };
}
