import { COMBO_HARD_CAP } from "./constants";
import { sectionsConflict } from "./overlap";
import type { ComboPool, ComboSection, Combination, CourseGroup } from "./types";

export type EnumerateOptions = {
  // Maximum total units (Northwestern "credits") allowed in any
  // combination. The enumerator returns the largest-credit combos that
  // fit within this budget without overlapping in time.
  maxCredits: number;
  // Minimum total units required. Combos with fewer credits are
  // discarded before the "highest credit class wins" reduction. Defaults
  // to 0 (no floor).
  minCredits?: number;
  // Section IDs the user has pinned. Every produced combination must
  // include each pinned section. Conflicting pins yield an empty result.
  pinnedSectionIds: ReadonlySet<string>;
  // Hard upper bound on the number of combinations enumerated. Defaults
  // to COMBO_HARD_CAP — pathological inputs (large product space) won't
  // OOM the page, the UI just truncates and surfaces a warning.
  hardCap?: number;
};

export type EnumerateResult = {
  combinations: Combination[];
  truncated: boolean;
  conflictingPins: boolean;
  // Total credits in the combos we returned (all returned combos share
  // this total — we keep only the highest-credit class).
  effectiveCredits: number;
  requestedCredits: number;
  // Echoes the floor the caller requested (defaults to 0). Used by the
  // UI to render an accurate status message when filtering empties out
  // the result.
  requestedMinCredits: number;
};

const FLOAT_EPS = 1e-6;

export function enumerateCombinations(
  pool: ComboPool,
  options: EnumerateOptions
): EnumerateResult {
  const cap = options.hardCap ?? COMBO_HARD_CAP;
  const groups = pool.groups;
  const requestedCredits = Math.max(0, options.maxCredits);
  const requestedMinCredits = Math.max(0, options.minCredits ?? 0);

  if (groups.length === 0) {
    return {
      combinations: [],
      truncated: false,
      conflictingPins: false,
      effectiveCredits: 0,
      requestedCredits,
      requestedMinCredits
    };
  }

  const pinnedByCourse = new Map<string, ComboSection>();
  for (const sectionId of options.pinnedSectionIds) {
    const section = pool.byId.get(sectionId);
    if (!section) continue;
    pinnedByCourse.set(section.courseId, section);
  }

  // A pin only counts if its course is represented in the current pool.
  const pinnedList: ComboSection[] = [];
  const pinnedCourseIds = new Set<string>();
  let pinnedCredits = 0;
  for (const group of groups) {
    const pinned = pinnedByCourse.get(group.courseId);
    if (pinned) {
      pinnedList.push(pinned);
      pinnedCourseIds.add(group.courseId);
      pinnedCredits += group.units;
    }
  }

  for (let i = 0; i < pinnedList.length; i++) {
    for (let j = i + 1; j < pinnedList.length; j++) {
      if (sectionsConflict(pinnedList[i], pinnedList[j])) {
        return {
          combinations: [],
          truncated: false,
          conflictingPins: true,
          effectiveCredits: 0,
          requestedCredits,
          requestedMinCredits
        };
      }
    }
  }

  if (pinnedCredits > requestedCredits + FLOAT_EPS) {
    return {
      combinations: [],
      truncated: false,
      conflictingPins: true,
      effectiveCredits: 0,
      requestedCredits,
      requestedMinCredits
    };
  }

  const freeGroups = groups.filter((g) => !pinnedCourseIds.has(g.courseId));
  const pinnedUnitsByCourse = new Map<string, number>();
  for (const group of groups) {
    if (pinnedCourseIds.has(group.courseId)) {
      pinnedUnitsByCourse.set(group.courseId, group.units);
    }
  }

  const all = enumerateAll({
    pinnedList,
    pinnedCredits,
    freeGroups,
    maxCredits: requestedCredits,
    cap
  });

  if (all.combinations.length === 0) {
    return {
      combinations: [],
      truncated: all.truncated,
      conflictingPins: false,
      effectiveCredits: 0,
      requestedCredits,
      requestedMinCredits
    };
  }

  // Return EVERY combo whose total credits land in the [min, max] window.
  // Earlier versions filtered down to the highest-credit class only,
  // but that hid the very combos a user wants when they widen the range
  // (lowering min from 3 to 2 should *add* 2-credit options, not no-op
  // because the 5-credit class still dominates). Sort modes still drive
  // the cycle order, so the "best" surfaces first regardless.
  const inWindow = all.combinations.filter(
    (c) => c.totalUnits + FLOAT_EPS >= requestedMinCredits
  );

  if (inWindow.length === 0) {
    return {
      combinations: [],
      truncated: all.truncated,
      conflictingPins: false,
      effectiveCredits: 0,
      requestedCredits,
      requestedMinCredits
    };
  }

  let highest = 0;
  for (const combo of inWindow) {
    if (combo.totalUnits > highest) highest = combo.totalUnits;
  }

  return {
    combinations: inWindow,
    truncated: all.truncated,
    conflictingPins: false,
    effectiveCredits: highest,
    requestedCredits,
    requestedMinCredits
  };
}

type EnumerateAllArgs = {
  pinnedList: ComboSection[];
  pinnedCredits: number;
  freeGroups: CourseGroup[];
  maxCredits: number;
  cap: number;
};

type EnumerateAllResult = {
  combinations: Combination[];
  truncated: boolean;
};

// Backtracking over free groups. At each group we try (a) skipping it
// or (b) adding any of its sections that doesn't conflict with the
// current selection AND keeps total units within the budget. Pinned
// sections are always present in `current` from the start; we never
// drop them. Emits every valid combo (size ≥ pinnedList.length) that
// fits the budget; the caller filters down to the maximum-credits set.
function enumerateAll({
  pinnedList,
  pinnedCredits,
  freeGroups,
  maxCredits,
  cap
}: EnumerateAllArgs): EnumerateAllResult {
  const combinations: Combination[] = [];
  let truncated = false;

  const current: ComboSection[] = [...pinnedList];
  // Per-section units snapshot mirrors `current` indices so we can pop
  // both arrays together as recursion unwinds.
  const currentUnits: number[] = [];
  // Pinned sections inherit their group's units. We need group lookup,
  // not section lookup; pull from the group order to be consistent.
  // (We don't have direct group access here, but pinnedCredits is the
  // running total at start.)
  let runningCredits = pinnedCredits;

  const emit = (): boolean => {
    if (current.length === 0) return true;
    if (combinations.length >= cap) {
      truncated = true;
      return false;
    }
    combinations.push({
      sectionIds: current.map((s) => s.sectionId),
      sections: [...current],
      score: 0,
      ratedCount: 0,
      totalUnits: runningCredits
    });
    return true;
  };

  const backtrack = (idx: number): boolean => {
    if (truncated) return false;
    if (combinations.length >= cap) {
      truncated = true;
      return false;
    }
    if (idx >= freeGroups.length) {
      return emit();
    }

    const group = freeGroups[idx];

    // Branch 1: skip this group.
    if (!backtrack(idx + 1)) return false;

    // Branch 2: try every section in this group, skipping conflicts.
    if (runningCredits + group.units <= maxCredits + FLOAT_EPS) {
      for (const section of group.sections) {
        let conflict = false;
        for (const c of current) {
          if (sectionsConflict(c, section)) {
            conflict = true;
            break;
          }
        }
        if (conflict) continue;
        current.push(section);
        currentUnits.push(group.units);
        runningCredits += group.units;
        const ok = backtrack(idx + 1);
        current.pop();
        const unit = currentUnits.pop() ?? 0;
        runningCredits -= unit;
        if (!ok) return false;
      }
    }

    return true;
  };

  backtrack(0);
  return { combinations, truncated };
}
