import type { CtecCourseAnalytics, CtecReportAggregate } from "../ctec-links/reports";
import type { CtecLinkParams } from "../ctec-links/types";

export type PaperCtecTarget = {
  card: HTMLElement;
  widget: HTMLElement;
  params: CtecLinkParams;
  titleHint: string;
  key: string;
};

export type PaperCtecWidgetData =
  | { state: "found"; aggregate: CtecReportAggregate }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export type PaperCtecStatusBarData = {
  state: "loading" | "auth-required" | "ready";
  totalCount: number;
  resolvedCount: number;
  activeCount: number;
  foundCount: number;
  notFoundCount: number;
  errorCount: number;
  authCount: number;
  latestMessage?: string;
  loginUrl?: string;
  awaitingAuthRetry?: boolean;
};

export type PaperCtecAnalyticsState =
  | { state: "found"; analytics: CtecCourseAnalytics }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export type PaperCtecSideCardContext = {
  panel: HTMLElement;
  key: string;
  params: CtecLinkParams;
  titleHint: string;
};
