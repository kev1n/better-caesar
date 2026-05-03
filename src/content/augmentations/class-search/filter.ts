import type { PaperCourse, PaperSection, PaperTermCourse, SubjectInfo } from "./paper-data";
import type { ResultRow, SearchFilters } from "./types";

export function applyFilters(
  termCourses: PaperTermCourse[],
  catalogIndex: Map<string, PaperCourse>,
  subjects: Record<string, SubjectInfo>,
  filters: SearchFilters
): ResultRow[] {
  const tokens = tokenizeQuery(filters.query);
  const wantedDistros = filters.distros;
  const wantedDisciplines = filters.disciplines;
  const wantedSchools = filters.schools;
  const wantedComponents = filters.components;

  type Scored = { row: ResultRow; rank: number };
  const scored: Scored[] = [];

  for (const course of termCourses) {
    if (wantedSchools.size > 0 && (!course.school || !wantedSchools.has(course.school))) continue;

    const planEntry = catalogIndex.get(`${course.subject} ${course.catalog}`);

    if (wantedDistros.size > 0) {
      const distroCodes = (planEntry?.distros ?? "").split("");
      if (!distroCodes.some((c) => wantedDistros.has(c))) continue;
    }
    if (wantedDisciplines.size > 0) {
      const disciplineCodes = (planEntry?.disciplines ?? "").split("");
      if (!disciplineCodes.some((c) => wantedDisciplines.has(c))) continue;
    }

    const sections = course.sections.filter((section) => {
      if (wantedComponents.size > 0 && !wantedComponents.has(section.component)) return false;
      return true;
    });
    if (sections.length === 0) continue;

    if (tokens.length > 0) {
      const subjectName = subjects[course.subject]?.display ?? "";
      const idHaystack = normalize(
        `${subjectName} ${course.subject} ${course.catalog}`
      );
      const titleHaystack = normalize(course.title);
      const descHaystack = planEntry?.description ? normalize(planEntry.description) : "";

      let matchedAllOnId = true;
      let matchedAllOnAny = true;
      for (const token of tokens) {
        const re = tokenRegex(token);
        const idHit = re.test(idHaystack);
        const titleHit = re.test(titleHaystack);
        const descHit = descHaystack.length > 0 && re.test(descHaystack);
        if (!idHit) matchedAllOnId = false;
        if (!idHit && !titleHit && !descHit) {
          matchedAllOnAny = false;
          break;
        }
      }
      if (!matchedAllOnAny) continue;

      // Rank: pure id matches win over title/description matches.
      scored.push({ row: { course, sections }, rank: matchedAllOnId ? 0 : 1 });
    } else {
      scored.push({ row: { course, sections }, rank: 0 });
    }
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.row.course.subject !== b.row.course.subject) {
      return a.row.course.subject.localeCompare(b.row.course.subject);
    }
    return naturalCompare(a.row.course.catalog, b.row.course.catalog);
  });

  return scored.map((s) => s.row);
}

export function buildCatalogIndex(courses: PaperCourse[]): Map<string, PaperCourse> {
  const map = new Map<string, PaperCourse>();
  for (const course of courses) {
    map.set(course.id, course);
  }
  return map;
}

export function formatMeetingPattern(section: PaperSection, index: number): string {
  const days = section.meeting_days[index] ?? null;
  const start = section.start_time[index] ?? null;
  const end = section.end_time[index] ?? null;
  if (!days && !start && !end) return "TBA";

  const dayLabel = days ?? "—";
  if (!start || !end) return dayLabel;
  return `${dayLabel} ${formatTime(start)}–${formatTime(end)}`;
}

export function meetingPatternCount(section: PaperSection): number {
  return Math.max(
    section.meeting_days.length,
    section.start_time.length,
    section.end_time.length,
    section.room.length,
    1
  );
}

export function formatRoom(section: PaperSection, index: number): string | null {
  return section.room[index] ?? null;
}

export function formatInstructors(section: PaperSection): string {
  const names = (section.instructors ?? [])
    .map((i) => i.name)
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return "Staff";
  return names.join(", ");
}

function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

function tokenRegex(token: string): RegExp {
  // Mirrors paper.nu's behavior: escape regex specials, then treat literal
  // `x` as a digit wildcard so queries like "31x" match "311".
  // We also relax `_` to whitespace because the haystack normalizes
  // `_` → " " (so "COMP_SCI" lives there as "comp sci"); without this,
  // typing the literal subject code `comp_sci` would never match.
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wildcarded = escaped.replace(/x/g, "[\\dx]");
  // Use \s+ (one or more whitespace) so `comp_sci` requires a separator,
  // i.e. matches "comp sci" but not "compsci" — codex flagged \s* as too
  // permissive (would let "compsci" match "comp sci" too).
  const underscoresRelaxed = wildcarded.replace(/_/g, "\\s+");
  return new RegExp(underscoresRelaxed, "i");
}

function formatTime(time: { h: number; m: number }): string {
  const minute = time.m.toString().padStart(2, "0");
  if (time.h === 0) return `12:${minute}am`;
  if (time.h < 12) return `${time.h}:${minute}am`;
  if (time.h === 12) return `12:${minute}pm`;
  return `${time.h - 12}:${minute}pm`;
}

function naturalCompare(a: string, b: string): number {
  const an = parseInt(a, 10);
  const bn = parseInt(b, 10);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) return an - bn;
  return a.localeCompare(b);
}
