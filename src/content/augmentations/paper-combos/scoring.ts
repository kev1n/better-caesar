import { getRecentAggregationTerms } from "../../settings";
import { getCachedReportAggregate } from "../ctec-links/reports";
import { buildInstructorLastNameLabel } from "../paper-ctec/identity";
import { NEUTRAL_RATING_MIDPOINT } from "./constants";
import type { ComboSection, Combination } from "./types";

export type SortMode =
  | "rating"
  | "early-end"
  | "late-start"
  | "early-start"
  | "fewest-days"
  | "most-credits"
  | "least-credits";

export const DEFAULT_SORT_MODE: SortMode = "rating";

export const SORT_MODE_LABELS: Record<SortMode, string> = {
  rating: "Top CTEC rating",
  "early-end": "Earliest end of day",
  "late-start": "Latest start (sleep in)",
  "early-start": "Earliest start",
  "fewest-days": "Fewest days on campus",
  "most-credits": "Most credits",
  "least-credits": "Fewest credits"
};

// Pulls the cached CTEC instructor-rating mean for one section, or null
// when nothing is cached. Mirrors paper-ctec's lookup contract: subject +
// catalog + last-name-only instructor label, terms-window from the popup
// setting.
function getSectionRating(section: ComboSection): number | null {
  const instructor = buildInstructorLastNameLabel(section.instructorNames);
  if (!instructor) return null;
  const aggregate = getCachedReportAggregate(
    {
      subject: section.subject,
      catalogNumber: section.catalog,
      instructor
    },
    section.title,
    getRecentAggregationTerms()
  );
  return aggregate?.metrics.instruction?.mean ?? null;
}

// Combination score = mean of available CTEC ratings, with the neutral
// midpoint (3 on the 0–6 scale) imputed for sections that have no cached
// aggregate. Keeps unrated electives from sinking an otherwise-strong combo
// while still rewarding combos where every section has a real rating.
export function scoreCombination(combo: Combination): {
  score: number;
  ratedCount: number;
} {
  if (combo.sections.length === 0) return { score: 0, ratedCount: 0 };
  let total = 0;
  let rated = 0;
  for (const section of combo.sections) {
    const rating = getSectionRating(section);
    if (rating !== null) {
      total += rating;
      rated += 1;
    } else {
      total += NEUTRAL_RATING_MIDPOINT;
    }
  }
  return { score: total / combo.sections.length, ratedCount: rated };
}

function latestEndMinutes(combo: Combination): number {
  let latest = 0;
  for (const section of combo.sections) {
    for (const block of section.blocks) {
      const minutes = block.end.h * 60 + block.end.m;
      if (minutes > latest) latest = minutes;
    }
  }
  return latest;
}

function earliestStartMinutes(combo: Combination): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const section of combo.sections) {
    for (const block of section.blocks) {
      const minutes = block.start.h * 60 + block.start.m;
      if (minutes < earliest) earliest = minutes;
    }
  }
  return Number.isFinite(earliest) ? earliest : 0;
}

function distinctMeetingDays(combo: Combination): number {
  const days = new Set<number>();
  for (const section of combo.sections) {
    for (const block of section.blocks) {
      days.add(block.day);
    }
  }
  return days.size;
}

function totalCredits(combo: Combination): number {
  return combo.totalUnits;
}

// Stable lexicographic key — every sort uses this as the final tiebreak
// so cycling combos never reshuffles within a tie group across renders.
function stableKey(combo: Combination): string {
  return combo.sectionIds.slice().sort().join("|");
}

// Each sort mode returns a comparator. The "rating" sort keeps the
// original two-level behavior (rating desc, end-of-day asc) so it
// reads identically to the previous default. New modes apply the
// requested primary order, then fall back to rating + end-of-day so
// near-ties still surface high-quality combos.
function compareForMode(
  mode: SortMode
): (a: Combination, b: Combination) => number {
  return (a, b) => {
    let primary = 0;
    switch (mode) {
      case "rating":
        primary = b.score - a.score;
        break;
      case "early-end":
        primary = latestEndMinutes(a) - latestEndMinutes(b);
        break;
      case "late-start":
        // Highest earliest-start wins (so the user can sleep in).
        primary = earliestStartMinutes(b) - earliestStartMinutes(a);
        break;
      case "early-start":
        primary = earliestStartMinutes(a) - earliestStartMinutes(b);
        break;
      case "fewest-days":
        primary = distinctMeetingDays(a) - distinctMeetingDays(b);
        break;
      case "most-credits":
        primary = totalCredits(b) - totalCredits(a);
        break;
      case "least-credits":
        primary = totalCredits(a) - totalCredits(b);
        break;
    }
    if (primary !== 0) return primary;
    // Credits-desc tiebreak ahead of rating: when the primary order
    // doesn't differentiate, prefer the fuller schedule. Without this,
    // the new [min,max] window surfaced lower-credit combos in front
    // of higher-credit ones whose primary metric happened to tie.
    // Safe for the credits-* sort modes too — combos that tie on the
    // primary credit comparison have equal totalUnits anyway, so this
    // line is a no-op there.
    if (b.totalUnits !== a.totalUnits) return b.totalUnits - a.totalUnits;
    if (b.score !== a.score) return b.score - a.score;
    const endA = latestEndMinutes(a);
    const endB = latestEndMinutes(b);
    if (endA !== endB) return endA - endB;
    return stableKey(a).localeCompare(stableKey(b));
  };
}

export function sortCombinations(
  combos: Combination[],
  mode: SortMode = DEFAULT_SORT_MODE
): Combination[] {
  const scored = combos.map((combo) => {
    const { score, ratedCount } = scoreCombination(combo);
    return { ...combo, score, ratedCount };
  });
  scored.sort(compareForMode(mode));
  return scored;
}

export function isSortMode(value: string): value is SortMode {
  return (
    value === "rating" ||
    value === "early-end" ||
    value === "late-start" ||
    value === "early-start" ||
    value === "fewest-days" ||
    value === "most-credits" ||
    value === "least-credits"
  );
}
