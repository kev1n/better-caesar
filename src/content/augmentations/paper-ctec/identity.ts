import type { CtecCourseAnalytics } from "../ctec-links/reports";
import type { CtecLinkParams } from "../ctec-links/types";

type CourseIdentity = Pick<CtecLinkParams, "subject" | "catalogNumber" | "instructor">;
type AnalyticsEntry = CtecCourseAnalytics["entries"][number];

export function buildCourseKey(params: CourseIdentity, titleHint: string): string {
  const title = titleHint.toLowerCase().replace(/\s+/g, " ").trim();
  return `${params.subject}:${params.catalogNumber}:${params.instructor.toLowerCase().trim()}:${title}`;
}

export function buildAnalyticsEntryKey(entry: AnalyticsEntry): string {
  return [entry.term, entry.instructor, entry.url ?? entry.description].join("::");
}

export function buildInstructorLastNameLabel(names: string[]): string {
  return names
    .map((name) => {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length === 0) return "";

      let last = parts[parts.length - 1] ?? "";
      if (last.endsWith(".")) last = last.slice(0, -1);
      const normalized = last.toLowerCase();
      if ((normalized === "jr" || normalized === "sr") && parts.length > 1) {
        last = parts[parts.length - 2] ?? last;
      }
      return last;
    })
    .filter(Boolean)
    .join(", ");
}
