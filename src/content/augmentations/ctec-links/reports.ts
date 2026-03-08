import { normalizeSearch } from "../ctec-navigation/helpers";
import { readSubjectIndex, writeSubjectIndex } from "../ctec-navigation/storage";
import type {
  CtecIndexedEntry,
  CtecReportHoursMetric,
  CtecReportScalarMetric,
  CtecReportSummary
} from "../ctec-navigation/types";
import { fetchTextResultViaBackground } from "../../remote-fetch";
import { fetchCtecLinksBackground } from "./fetcher";
import { entryMatchesCourse, isAuthResponse, termToSortKey } from "./helpers";
import type { CtecLinkParams } from "./types";

const NOT_FOUND_ACTION_ID = "BC_NOT_FOUND";

export type CtecAggregateMetric = {
  mean: number;
  totalResponses: number;
  evaluationCount: number;
};

export type CtecReportAggregate = {
  evaluationCount: number;
  parsedCount: number;
  latestTerm: string | null;
  latestUrl: string | null;
  partial: boolean;
  metrics: {
    instruction?: CtecAggregateMetric;
    course?: CtecAggregateMetric;
    learned?: CtecAggregateMetric;
    challenging?: CtecAggregateMetric;
    stimulating?: CtecAggregateMetric;
    hours?: CtecAggregateMetric;
  };
};

export type CtecReportAggregateResult =
  | { state: "found"; aggregate: CtecReportAggregate }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export async function fetchCtecReportAggregate(
  params: CtecLinkParams,
  titleHint?: string,
  onProgress?: (message: string) => void
): Promise<CtecReportAggregateResult> {
  const links = await fetchCtecLinksBackground(params, false, onProgress);
  if (links.state !== "found") return links;

  let entries = getIndexedEntriesForCourse(params, titleHint);
  if (entries.length === 0) {
    return { state: "not-found" };
  }

  const missing = entries.filter((entry) => entry.blueraUrl && entry.reportSummary === undefined);

  for (let index = 0; index < missing.length; index++) {
    const entry = missing[index]!;
    const url = entry.blueraUrl;
    if (!url) continue;

    onProgress?.(`Reading evaluation ${index + 1}/${missing.length}…`);

    const response = await fetchTextResultViaBackground(url, { method: "GET" });
    if (isAuthResponse(response.text)) {
      return { state: "auth-required", loginUrl: response.finalUrl || url };
    }

    const summary = parseCtecReportHtml(response.text, url);
    cacheReportSummary(params.subject, entry.actionId, summary);
  }

  entries = getIndexedEntriesForCourse(params, titleHint);
  return {
    state: "found",
    aggregate: buildReportAggregate(entries)
  };
}

export function parseCtecReportHtml(
  html: string,
  url: string
): CtecReportSummary | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(doc.querySelectorAll<HTMLElement>(".report-block"));
  if (blocks.length === 0) return null;

  const metrics: CtecReportSummary["metrics"] = {};

  for (const block of blocks) {
    const question = cleanText(
      block.querySelector<HTMLElement>(".ReportBlockTitle")?.textContent
    );
    if (!question) continue;

    const kind = classifyQuestion(question);
    if (!kind) continue;

    if (kind === "hours") {
      const hoursMetric = parseHoursMetric(block);
      if (hoursMetric) metrics.hours = hoursMetric;
      continue;
    }

    const scalarMetric = parseScalarMetric(block);
    if (!scalarMetric) continue;

    if (kind === "instruction") metrics.instruction = scalarMetric;
    if (kind === "course") metrics.course = scalarMetric;
    if (kind === "learned") metrics.learned = scalarMetric;
    if (kind === "challenging") metrics.challenging = scalarMetric;
    if (kind === "stimulating") metrics.stimulating = scalarMetric;
  }

  if (!hasAnyMetrics(metrics)) return null;

  return {
    url,
    parsedAt: Date.now(),
    metrics
  };
}

function getIndexedEntriesForCourse(
  params: CtecLinkParams,
  titleHint?: string
): CtecIndexedEntry[] {
  const index = readSubjectIndex(params.subject);
  if (!index) return [];

  const baseEntries = index.entries.filter((entry) =>
    entry.actionId !== NOT_FOUND_ACTION_ID &&
    entry.blueraUrl &&
    entryMatchesCourse(entry, params.subject, params.catalogNumber, params.instructor)
  );

  return selectEntriesForTitle(baseEntries, titleHint);
}

function selectEntriesForTitle(
  entries: CtecIndexedEntry[],
  titleHint?: string
): CtecIndexedEntry[] {
  const normalizedHint = normalizeSearch(titleHint ?? "");
  if (!normalizedHint) return entries;

  const distinctTitles = new Set(entries.map((entry) => extractShortTitle(entry.description)));
  if (distinctTitles.size <= 1) return entries;

  const tokens = normalizedHint.split(" ").filter((token) => token.length >= 4);
  if (tokens.length === 0) return entries;

  const filtered = entries.filter((entry) => {
    const haystack = normalizeSearch(`${entry.description} ${extractShortTitle(entry.description)}`);
    const overlap = tokens.filter((token) => haystack.includes(token)).length;
    return overlap >= Math.min(2, tokens.length);
  });

  return filtered.length > 0 ? filtered : entries;
}

function cacheReportSummary(
  subjectCode: string,
  actionId: string,
  reportSummary: CtecReportSummary | null
): void {
  const index = readSubjectIndex(subjectCode);
  if (!index) return;

  let changed = false;
  const nextEntries = index.entries.map((entry) => {
    if (entry.actionId !== actionId) return entry;
    changed = true;
    return { ...entry, reportSummary };
  });

  if (!changed) return;
  writeSubjectIndex(subjectCode, {
    ...index,
    entries: nextEntries
  });
}

function buildReportAggregate(entries: CtecIndexedEntry[]): CtecReportAggregate {
  const sorted = [...entries].sort((left, right) => termToSortKey(right.term) - termToSortKey(left.term));
  const summaries = sorted
    .map((entry) => entry.reportSummary)
    .filter((summary): summary is CtecReportSummary => !!summary && hasAnyMetrics(summary.metrics));

  return {
    evaluationCount: sorted.length,
    parsedCount: summaries.length,
    latestTerm: sorted[0]?.term ?? null,
    latestUrl: sorted[0]?.blueraUrl ?? null,
    partial: summaries.length < sorted.length,
    metrics: {
      instruction: aggregateMetric(summaries, (summary) => summary.metrics.instruction),
      course: aggregateMetric(summaries, (summary) => summary.metrics.course),
      learned: aggregateMetric(summaries, (summary) => summary.metrics.learned),
      challenging: aggregateMetric(summaries, (summary) => summary.metrics.challenging),
      stimulating: aggregateMetric(summaries, (summary) => summary.metrics.stimulating),
      hours: aggregateMetric(summaries, (summary) => summary.metrics.hours)
    }
  };
}

function aggregateMetric(
  summaries: CtecReportSummary[],
  pick: (
    summary: CtecReportSummary
  ) => CtecReportScalarMetric | CtecReportHoursMetric | undefined
): CtecAggregateMetric | undefined {
  let weightedTotal = 0;
  let totalResponses = 0;
  let evaluationCount = 0;

  for (const summary of summaries) {
    const metric = pick(summary);
    if (!metric) continue;
    weightedTotal += metric.mean * metric.responseCount;
    totalResponses += metric.responseCount;
    evaluationCount += 1;
  }

  if (totalResponses <= 0 || evaluationCount <= 0) return undefined;
  return {
    mean: weightedTotal / totalResponses,
    totalResponses,
    evaluationCount
  };
}

function parseScalarMetric(block: HTMLElement): CtecReportScalarMetric | undefined {
  let mean: number | null = null;
  let responseCount: number | null = null;

  for (const row of Array.from(block.querySelectorAll<HTMLTableRowElement>("table.block-table tbody tr"))) {
    const label = cleanText(row.querySelector("th")?.textContent);
    const value = cleanText(row.querySelector("td")?.textContent);
    if (!label || !value) continue;

    if (normalizeSearch(label) === "response count") {
      responseCount = parseNumber(value);
      continue;
    }

    if (normalizeSearch(label) === "mean") {
      mean = parseNumber(value);
    }
  }

  if (mean === null || responseCount === null) return undefined;
  return { mean, responseCount };
}

function parseHoursMetric(block: HTMLElement): CtecReportHoursMetric | undefined {
  let weightedTotal = 0;
  let responseCount = 0;

  for (const row of Array.from(block.querySelectorAll<HTMLTableRowElement>("table.block-table tbody tr"))) {
    const option = cleanText(row.querySelector("th")?.textContent);
    const value = cleanText(row.querySelector("td")?.textContent);
    if (!option || !value) continue;
    if (normalizeSearch(option).includes("respondent")) continue;

    const count = parseNumber(value);
    const representativeHours = estimateHoursForOption(option);
    if (count === null || representativeHours === null) continue;

    weightedTotal += representativeHours * count;
    responseCount += count;
  }

  if (responseCount <= 0) return undefined;
  return {
    mean: weightedTotal / responseCount,
    responseCount
  };
}

function classifyQuestion(
  question: string
): "instruction" | "course" | "learned" | "challenging" | "stimulating" | "hours" | null {
  const normalized = normalizeSearch(question);

  if (normalized.includes("overall rating of the instruction")) return "instruction";
  if (normalized.includes("overall rating of the course")) return "course";
  if (normalized.includes("estimate how much you learned")) return "learned";
  if (normalized.includes("challenging you intellectually")) return "challenging";
  if (normalized.includes("stimulating your interest in the subject")) return "stimulating";
  if (normalized.includes("average number of hours per week")) return "hours";
  return null;
}

function estimateHoursForOption(option: string): number | null {
  const normalized = cleanText(option).replace(/[–—]/g, "-");
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const start = parseFloat(rangeMatch[1] ?? "");
    const end = parseFloat(rangeMatch[2] ?? "");
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return (start + end) / 2;
    }
  }

  const fewerMatch = normalized.match(/(\d+(?:\.\d+)?)\s+or\s+fewer/i);
  if (fewerMatch) {
    const end = parseFloat(fewerMatch[1] ?? "");
    if (Number.isFinite(end)) return end / 2;
  }

  const moreMatch = normalized.match(/(\d+(?:\.\d+)?)\s+or\s+more/i);
  if (moreMatch) {
    const start = parseFloat(moreMatch[1] ?? "");
    if (Number.isFinite(start)) return start;
  }

  return null;
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? null;
  if (!normalized) return null;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function extractShortTitle(description: string): string {
  const stripped = description.replace(/^\S+\s+[\d][\d-]*\s*/, "").trim();
  const colonIndex = stripped.lastIndexOf(":");
  return colonIndex >= 0 ? stripped.slice(colonIndex + 1).trim() : stripped;
}

function hasAnyMetrics(metrics: CtecReportSummary["metrics"]): boolean {
  return Object.values(metrics).some((value) => !!value);
}
