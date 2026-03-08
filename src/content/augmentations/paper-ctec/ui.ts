import type {
  CtecAggregateMetric,
  CtecCourseAnalytics,
  CtecCourseAnalyticsEntry
} from "../ctec-links/reports";
import type { CtecReportChart } from "../ctec-navigation/types";
import { isFeatureEnabled } from "../../settings";
import { PAPER_CTEC_CONFIG } from "./config";
import {
  COMPACT_CARD_STARS_FEATURE_ID,
  SIDECARD_ANALYTICS_PANEL_CLASS,
  SIDECARD_TABS_CLASS,
  STATUS_BAR_ID,
  STYLE_ID,
  WIDGET_CLASS
} from "./constants";
import type {
  PaperCtecSideCardContext,
  PaperCtecStatusBarData,
  PaperCtecWidgetData
} from "./types";

type SideCardAnalyticsRenderData = {
  selectedTab: "paper" | "analytics";
  selectedEntryId: string | null;
  recentTerms: number;
  snapshot: CtecCourseAnalytics | null;
  loading: boolean;
  expandedChartKeys: string[];
  commentQuery: string;
  authUrl?: string;
  awaitingAuthRetry?: boolean;
  errorMessage?: string;
};

type CompactChipTone = {
  lightBackground: string;
  darkBackground: string;
  lightBorder: string;
  darkBorder: string;
  lightText: string;
  darkText: string;
};

type AnalyticsMetricKind =
  | "instruction"
  | "course"
  | "learned"
  | "challenging"
  | "stimulating"
  | "hours";

const STATUS_STACK_CLASS = "bc-paper-ctec-status-stack";
const STATUS_LEGEND_ID = "bc-paper-ctec-status-legend";

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${WIDGET_CLASS} {
      margin-top: 3px;
      padding-top: 3px;
      border-top: 1px solid rgba(17, 24, 39, 0.12);
      min-height: 14px;
      color: #4b5563;
      pointer-events: auto;
    }
    .dark .${WIDGET_CLASS} {
      border-top-color: rgba(255, 255, 255, 0.14);
      color: #d1d5db;
    }
    .bc-paper-ctec-dense-card {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden !important;
      min-height: 0;
      padding-bottom: 18px;
    }
    .bc-paper-ctec-dense-card > .${WIDGET_CLASS} {
      margin-top: auto;
    }
    .bc-paper-ctec-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-width: 0;
    }
    .bc-paper-ctec-course-line {
      flex: 0 1 auto;
      min-width: 0;
      font-size: 11px !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .bc-paper-ctec-title-line {
      font-size: 11px !important;
      line-height: 1.2 !important;
      font-weight: 600;
      color: #111827;
      display: -webkit-box;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
    }
    .dark .bc-paper-ctec-title-line {
      color: #f9fafb;
    }
    .bc-paper-ctec-instructor-line {
      flex: 0 0 auto;
      max-width: 44%;
      margin-left: auto !important;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(17, 24, 39, 0.06);
      font-size: 10px !important;
      font-weight: 600 !important;
      line-height: 1.15 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 1 !important;
      color: #4b5563 !important;
    }
    .dark .bc-paper-ctec-instructor-line {
      background: rgba(255, 255, 255, 0.08);
      color: #e5e7eb !important;
    }
    .${WIDGET_CLASS}-summary {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      min-width: 0;
      font-size: 10px;
      line-height: 1.1;
    }
    .${WIDGET_CLASS}-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-width: 0;
      max-width: 100%;
      padding: 1px 4px;
      border-radius: 999px;
      border: 1px solid var(--bc-paper-ctec-chip-border, transparent);
      background: var(--bc-paper-ctec-chip-bg, rgba(255, 255, 255, 0.56));
      color: var(--bc-paper-ctec-chip-fg, #374151);
      white-space: nowrap;
      font-weight: 600;
    }
    .${WIDGET_CLASS}-chip-label {
      opacity: 0.72;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .${WIDGET_CLASS}-chip-value {
      font-size: 10px;
      font-weight: 800;
    }
    .${WIDGET_CLASS}-chip-stars {
      display: inline-flex;
      align-items: center;
      margin-left: 1px;
    }
    .${WIDGET_CLASS}-chip-stars .bc-paper-ctec-stars {
      gap: ${PAPER_CTEC_CONFIG.ui.summaryChipStarGapPx}px;
    }
    .${WIDGET_CLASS}-chip-stars .bc-paper-ctec-star {
      width: ${PAPER_CTEC_CONFIG.ui.summaryChipStarSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.summaryChipStarSizePx}px;
    }
    .dark .${WIDGET_CLASS}-chip {
      border-color: var(--bc-paper-ctec-chip-border-dark, transparent);
      background: var(--bc-paper-ctec-chip-bg-dark, rgba(17, 24, 39, 0.54));
      color: var(--bc-paper-ctec-chip-fg-dark, #e5e7eb);
    }
    .${WIDGET_CLASS}-chip svg {
      width: ${PAPER_CTEC_CONFIG.ui.summaryChipIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.summaryChipIconSizePx}px;
      flex: 0 0 auto;
      stroke-width: ${PAPER_CTEC_CONFIG.ui.summaryChipStrokeWidth};
    }
    .${WIDGET_CLASS}-chip.is-muted {
      font-weight: 500;
      color: #6b7280;
    }
    .dark .${WIDGET_CLASS}-chip.is-muted {
      color: #cbd5e1;
    }
    .${WIDGET_CLASS}-chip.is-warn {
      background: rgba(190, 24, 93, 0.12);
      color: #9f1239;
    }
    .dark .${WIDGET_CLASS}-chip.is-warn {
      background: rgba(251, 113, 133, 0.14);
      color: #fecdd3;
    }
    #${STATUS_BAR_ID} {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      width: auto;
      max-width: none;
      min-height: ${PAPER_CTEC_CONFIG.ui.statusBarMinHeightPx}px;
      padding: 4px 10px;
      border: 1px solid rgba(102, 2, 60, 0.18);
      border-radius: 8px;
      background: rgba(102, 2, 60, 0.08);
      color: #66023c;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      flex: 1 1 auto;
      box-sizing: border-box;
      overflow: hidden;
    }
    #${STATUS_BAR_ID}.is-loading {
      background: rgba(102, 2, 60, 0.08);
    }
    #${STATUS_BAR_ID}.is-auth {
      border-color: rgba(102, 2, 60, 0.28);
      background: rgba(102, 2, 60, 0.12);
    }
    #${STATUS_BAR_ID}.is-ready {
      border-color: rgba(102, 2, 60, 0.14);
      background: rgba(102, 2, 60, 0.05);
    }
    #${STATUS_BAR_ID} svg {
      width: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.statusIconSizePx}px;
      flex: 0 0 auto;
      stroke-width: ${PAPER_CTEC_CONFIG.ui.statusIconStrokeWidth};
    }
    .dark #${STATUS_BAR_ID} {
      border-color: rgba(252, 165, 207, 0.2);
      background: rgba(157, 23, 77, 0.18);
      color: #fbcfe8;
    }
    .dark #${STATUS_BAR_ID}.is-auth {
      border-color: rgba(252, 165, 207, 0.34);
      background: rgba(157, 23, 77, 0.26);
    }
    .${STATUS_STACK_CLASS} {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .bc-paper-ctec-status-mark {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex-shrink: 0;
    }
    .bc-paper-ctec-status-brand {
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-copy {
      min-width: 0;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      opacity: 0.95;
    }
    .bc-paper-ctec-status-action {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      margin-left: auto;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid rgba(102, 2, 60, 0.24);
      background: rgba(255, 255, 255, 0.72);
      color: inherit;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-decoration: none;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .bc-paper-ctec-status-action:hover {
      background: rgba(255, 255, 255, 0.92);
    }
    .dark .bc-paper-ctec-status-action {
      border-color: rgba(252, 165, 207, 0.26);
      background: rgba(17, 24, 39, 0.28);
    }
    .dark .bc-paper-ctec-status-action:hover {
      background: rgba(17, 24, 39, 0.4);
    }
    #${STATUS_LEGEND_ID} {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
      font-size: 10px;
      line-height: 1.2;
      color: #6b5a65;
    }
    .dark #${STATUS_LEGEND_ID} {
      color: #d8c7d0;
    }
    .bc-paper-ctec-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(102, 2, 60, 0.06);
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-legend-item {
      background: rgba(252, 165, 207, 0.08);
    }
    .bc-paper-ctec-legend-key {
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #66023c;
    }
    .dark .bc-paper-ctec-legend-key {
      color: #fbcfe8;
    }
    .${SIDECARD_TABS_CLASS} {
      display: flex;
      gap: 8px;
      margin: 0 0 14px;
      padding: 4px;
      border-radius: 12px;
      background: rgba(102, 2, 60, 0.06);
      position: relative;
      z-index: 2;
      pointer-events: auto;
    }
    .dark .${SIDECARD_TABS_CLASS} {
      background: rgba(252, 165, 207, 0.08);
    }
    .bc-paper-ctec-side-tab {
      flex: 1 1 0;
      min-width: 0;
      padding: 8px 10px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #6b5a65;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
      position: relative;
      z-index: 1;
      pointer-events: auto;
    }
    .bc-paper-ctec-side-tab:hover {
      background: rgba(102, 2, 60, 0.08);
    }
    .bc-paper-ctec-side-tab.is-active {
      background: rgba(102, 2, 60, 0.15);
      color: #66023c;
    }
    .dark .bc-paper-ctec-side-tab {
      color: #d8c7d0;
    }
    .dark .bc-paper-ctec-side-tab:hover {
      background: rgba(252, 165, 207, 0.08);
    }
    .dark .bc-paper-ctec-side-tab.is-active {
      background: rgba(252, 165, 207, 0.16);
      color: #fbcfe8;
    }
    .${SIDECARD_ANALYTICS_PANEL_CLASS} {
      margin: 0 0 12px;
      border: 1px solid rgba(102, 2, 60, 0.12);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255, 250, 252, 0.98), rgba(255, 255, 255, 0.98));
      color: #3f3340;
      overflow: hidden;
      box-shadow: 0 10px 28px rgba(102, 2, 60, 0.08);
    }
    .dark .${SIDECARD_ANALYTICS_PANEL_CLASS} {
      border-color: rgba(252, 165, 207, 0.14);
      background: linear-gradient(180deg, rgba(31, 24, 29, 0.98), rgba(23, 18, 22, 0.98));
      color: #f5e7ee;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    }
    .bc-paper-ctec-analytics-body {
      padding: 14px;
    }
    .bc-paper-ctec-analytics-head {
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      margin-bottom: 12px;
    }
    .bc-paper-ctec-analytics-title {
      font-size: 15px;
      font-weight: 800;
      color: #66023c;
    }
    .dark .bc-paper-ctec-analytics-title {
      color: #fbcfe8;
    }
    .bc-paper-ctec-analytics-subtitle {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.4;
      color: #6b5a65;
    }
    .dark .bc-paper-ctec-analytics-subtitle {
      color: #d8c7d0;
    }
    .bc-paper-ctec-analytics-callout {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(102, 2, 60, 0.06);
      font-size: 12px;
      line-height: 1.45;
    }
    .bc-paper-ctec-analytics-callout.is-warn {
      background: rgba(190, 24, 93, 0.1);
      color: #881337;
    }
    .bc-paper-ctec-analytics-callout.is-muted {
      color: #6b7280;
    }
    .dark .bc-paper-ctec-analytics-callout {
      background: rgba(252, 165, 207, 0.08);
    }
    .dark .bc-paper-ctec-analytics-callout.is-warn {
      background: rgba(251, 113, 133, 0.12);
      color: #fecdd3;
    }
    .dark .bc-paper-ctec-analytics-callout.is-muted {
      color: #d1d5db;
    }
    .bc-paper-ctec-analytics-callout a {
      flex-shrink: 0;
      color: inherit;
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .bc-paper-ctec-analytics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(${PAPER_CTEC_CONFIG.ui.analyticsMetricMinWidthPx}px, 1fr));
      gap: 8px;
      margin-bottom: 0;
    }
    .bc-paper-ctec-analytics-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
      padding: 12px;
      border: 1px solid rgba(102, 2, 60, 0.1);
      border-radius: 14px;
      background: rgba(255, 251, 253, 0.86);
    }
    .bc-paper-ctec-analytics-group-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7a596a;
    }
    .dark .bc-paper-ctec-analytics-group {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(17, 24, 39, 0.26);
    }
    .dark .bc-paper-ctec-analytics-group-title {
      color: #d4b9c5;
    }
    .bc-paper-ctec-analytics-card {
      border-radius: 12px;
      border: 1px solid rgba(102, 2, 60, 0.1);
      background: rgba(255, 255, 255, 0.72);
      padding: 10px;
    }
    .dark .bc-paper-ctec-analytics-card {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(17, 24, 39, 0.3);
    }
    .bc-paper-ctec-analytics-card-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #7a596a;
    }
    .dark .bc-paper-ctec-analytics-card-label {
      color: #d4b9c5;
    }
    .bc-paper-ctec-analytics-card-rating {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .bc-paper-ctec-analytics-card-value {
      font-size: 14px;
      font-weight: 800;
      color: #2f1f29;
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-analytics-card-value {
      color: #fff6fb;
    }
    .bc-paper-ctec-analytics-card-hours {
      margin-top: 8px;
      font-size: 15px;
      font-weight: 800;
      color: #2f1f29;
    }
    .dark .bc-paper-ctec-analytics-card-hours {
      color: #fff6fb;
    }
    .bc-paper-ctec-stars {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .bc-paper-ctec-star {
      position: relative;
      display: inline-flex;
      width: ${PAPER_CTEC_CONFIG.ui.analyticsStarSizePx}px;
      height: ${PAPER_CTEC_CONFIG.ui.analyticsStarSizePx}px;
      flex: 0 0 auto;
    }
    .bc-paper-ctec-star svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      stroke-width: 1.7;
    }
    .bc-paper-ctec-star-base {
      color: #c9b4bf;
    }
    .bc-paper-ctec-star-fill {
      position: absolute;
      inset: 0 auto 0 0;
      overflow: hidden;
      color: #d97706;
    }
    .dark .bc-paper-ctec-star-base {
      color: rgba(255, 227, 238, 0.36);
    }
    .dark .bc-paper-ctec-star-fill {
      color: #fbbf24;
    }
    .bc-paper-ctec-hours-track {
      margin-top: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(102, 2, 60, 0.12);
      overflow: hidden;
    }
    .bc-paper-ctec-hours-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #a21caf, #db2777);
    }
    .dark .bc-paper-ctec-hours-track {
      background: rgba(252, 165, 207, 0.16);
    }
    .bc-paper-ctec-hours-meta {
      margin-top: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      line-height: 1.35;
      color: #6b7280;
    }
    .dark .bc-paper-ctec-hours-meta {
      color: #cbd5e1;
    }
    .bc-paper-ctec-analytics-section-title {
      margin: 16px 0 8px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #7a596a;
    }
    .dark .bc-paper-ctec-analytics-section-title {
      color: #d4b9c5;
    }
    .bc-paper-ctec-analytics-term-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
    }
    .bc-paper-ctec-analytics-term-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .bc-paper-ctec-analytics-term-selector label {
      font-size: 12px;
      font-weight: 700;
      color: #6b5a65;
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-analytics-term-selector label {
      color: #d8c7d0;
    }
    .bc-paper-ctec-analytics-term-select {
      min-width: 0;
      flex: 1 1 auto;
      border: 1px solid rgba(102, 2, 60, 0.14);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.84);
      color: #2f1f29;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 10px;
    }
    .dark .bc-paper-ctec-analytics-term-select {
      border-color: rgba(252, 165, 207, 0.18);
      background: rgba(17, 24, 39, 0.35);
      color: #fff6fb;
    }
    .bc-paper-ctec-analytics-term-summary {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 10px;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(102, 2, 60, 0.08);
      background: rgba(255, 255, 255, 0.56);
    }
    .dark .bc-paper-ctec-analytics-term-summary {
      border-color: rgba(252, 165, 207, 0.12);
      background: rgba(17, 24, 39, 0.22);
    }
    .bc-paper-ctec-analytics-term-title {
      font-size: 14px;
      font-weight: 800;
      color: #2f1f29;
    }
    .dark .bc-paper-ctec-analytics-term-title {
      color: #fff6fb;
    }
    .bc-paper-ctec-analytics-term-meta {
      margin-top: 4px;
      font-size: 12px;
      line-height: 1.45;
      color: #6b7280;
    }
    .dark .bc-paper-ctec-analytics-term-meta {
      color: #cbd5e1;
    }
    .bc-paper-ctec-analytics-term-link {
      color: #66023c;
      font-size: 11px;
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 3px;
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-analytics-term-link {
      color: #fbcfe8;
    }
    .bc-paper-ctec-analytics-state-note {
      font-size: 12px;
      line-height: 1.5;
      color: #6b7280;
    }
    .dark .bc-paper-ctec-analytics-state-note {
      color: #cbd5e1;
    }
    .bc-paper-ctec-analytics-metric-stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-metric-card {
      border-radius: 12px;
      border: 1px solid rgba(102, 2, 60, 0.08);
      background: rgba(255, 255, 255, 0.62);
      padding: 12px;
    }
    .dark .bc-paper-ctec-analytics-metric-card {
      border-color: rgba(252, 165, 207, 0.12);
      background: rgba(17, 24, 39, 0.22);
    }
    .bc-paper-ctec-analytics-metric-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-metric-chart-btn {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(102, 2, 60, 0.12);
      border-radius: 999px;
      background: rgba(102, 2, 60, 0.05);
      color: #66023c;
      cursor: pointer;
    }
    .bc-paper-ctec-analytics-metric-chart-btn svg {
      width: 14px;
      height: 14px;
      stroke-width: 1.9;
    }
    .bc-paper-ctec-analytics-metric-chart-btn:hover {
      background: rgba(102, 2, 60, 0.1);
    }
    .dark .bc-paper-ctec-analytics-metric-chart-btn {
      border-color: rgba(252, 165, 207, 0.14);
      background: rgba(252, 165, 207, 0.1);
      color: #fbcfe8;
    }
    .dark .bc-paper-ctec-analytics-metric-chart-btn:hover {
      background: rgba(252, 165, 207, 0.16);
    }
    .bc-paper-ctec-analytics-inline-chart {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(102, 2, 60, 0.08);
    }
    .dark .bc-paper-ctec-analytics-inline-chart {
      border-top-color: rgba(252, 165, 207, 0.12);
    }
    .bc-paper-ctec-analytics-inline-chart-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bc-paper-ctec-analytics-chart-title {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
    }
    .bc-paper-ctec-analytics-chart-image {
      width: 100%;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.88);
    }
    .bc-paper-ctec-analytics-comments-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
    }
    .bc-paper-ctec-analytics-comments-search {
      width: 100%;
      border: 1px solid rgba(102, 2, 60, 0.14);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.84);
      color: #2f1f29;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 10px;
    }
    .dark .bc-paper-ctec-analytics-comments-search {
      border-color: rgba(252, 165, 207, 0.18);
      background: rgba(17, 24, 39, 0.35);
      color: #fff6fb;
    }
    .bc-paper-ctec-analytics-comments-count {
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 700;
      color: #6b5a65;
      white-space: nowrap;
    }
    .dark .bc-paper-ctec-analytics-comments-count {
      color: #d8c7d0;
    }
    .bc-paper-ctec-analytics-comments {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 10px;
    }
    .bc-paper-ctec-analytics-comment-group {
      border-radius: 12px;
      border: 1px solid rgba(102, 2, 60, 0.08);
      background: rgba(255, 255, 255, 0.56);
      padding: 12px;
    }
    .dark .bc-paper-ctec-analytics-comment-group {
      border-color: rgba(252, 165, 207, 0.12);
      background: rgba(17, 24, 39, 0.22);
    }
    .bc-paper-ctec-analytics-comment-prompt {
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.45;
      color: #5b4451;
    }
    .dark .bc-paper-ctec-analytics-comment-prompt {
      color: #f3e5ed;
    }
    .bc-paper-ctec-analytics-comment-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bc-paper-ctec-analytics-comment-card {
      padding: 10px;
      border-radius: 10px;
      background: rgba(102, 2, 60, 0.05);
      font-size: 12px;
      line-height: 1.5;
      color: #4b5563;
      white-space: pre-wrap;
    }
    .dark .bc-paper-ctec-analytics-comment-card {
      background: rgba(252, 165, 207, 0.08);
      color: #e5e7eb;
    }
    .bc-paper-ctec-comment-highlight {
      background: rgba(250, 204, 21, 0.38);
      color: inherit;
      border-radius: 2px;
      padding: 0 1px;
    }
    .dark .bc-paper-ctec-comment-highlight {
      background: rgba(250, 204, 21, 0.24);
    }
    @media (max-width: 900px) {
      .bc-paper-ctec-status-brand {
        display: none;
      }
      .bc-paper-ctec-instructor-line {
        max-width: 50%;
      }
    }
  `;

  (document.head ?? document.documentElement).appendChild(style);
}

export function renderLoading(widget: HTMLElement, message = "CTEC…"): void {
  const signature = `loading|${message}`;
  if (widget.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  widget.textContent = "";
  widget.title = "Better CAESAR is loading Northwestern CTEC data for this class.";

  const summary = document.createElement("div");
  summary.className = `${WIDGET_CLASS}-summary`;
  summary.appendChild(makeChip("spark", message, "is-muted"));
  widget.appendChild(summary);
  widget.dataset.bcPaperCtecSignature = signature;
}

export function renderWidget(widget: HTMLElement, data: PaperCtecWidgetData): void {
  const signature = buildWidgetSignature(data);
  if (widget.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  widget.textContent = "";
  widget.removeAttribute("title");

  const summary = document.createElement("div");
  summary.className = `${WIDGET_CLASS}-summary`;
  widget.appendChild(summary);

  if (data.state === "not-found") {
    summary.appendChild(makeChip("spark", "No CTEC", "is-muted"));
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  if (data.state === "auth-required") {
    widget.title = "CTEC data requires a Northwestern login before the reports can be read.";
    summary.appendChild(makeChip("lock", "Login needed", "is-warn"));
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  if (data.state === "error") {
    widget.title = data.message;
    summary.appendChild(makeChip("spark", "CTEC unavailable", "is-muted"));
    widget.dataset.bcPaperCtecSignature = signature;
    return;
  }

  const { aggregate } = data;
  widget.title = buildTooltip(aggregate);

  const chips = [
    metricChip("Inst", "Instruction", aggregate.metrics.instruction, aggregate, "rating"),
    metricChip("Course", "Course", aggregate.metrics.course, aggregate, "rating"),
    metricChip("Learn", "Learned", aggregate.metrics.learned, aggregate, "rating"),
    metricChip("Hrs", "Hours", aggregate.metrics.hours, aggregate, "hours")
  ].filter((chip): chip is HTMLElement => !!chip);

  if (chips.length === 0) {
    summary.appendChild(makeChip("spark", "CTEC loaded", "is-muted"));
  } else {
    chips.forEach((chip) => summary.appendChild(chip));
  }
  widget.dataset.bcPaperCtecSignature = signature;
}

export function renderStatusBar(doc: Document, data: PaperCtecStatusBarData, onLogin: () => void): void {
  const host = findActionHost(doc);
  if (!host) return;
  ensureActionHostLayout(host);

  const stack = ensureStatusStack(doc, host);

  let bar = doc.getElementById(STATUS_BAR_ID) as HTMLDivElement | null;
  if (!bar) {
    bar = doc.createElement("div");
    bar.id = STATUS_BAR_ID;
    bar.setAttribute("aria-live", "polite");
  }

  if (bar.parentElement !== stack || stack.firstElementChild !== bar) {
    stack.prepend(bar);
  }

  renderStatusLegend(doc, stack);

  const signature = buildStatusSignature(data);
  if (bar.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  const nextClassName = data.state === "auth-required"
    ? "is-auth"
    : data.state === "ready"
      ? "is-ready"
      : "is-loading";

  bar.className = nextClassName;
  bar.replaceChildren();
  bar.title = buildStatusTitle(data);

  const mark = doc.createElement("div");
  mark.className = "bc-paper-ctec-status-mark";
  mark.append(createIcon(statusIcon(data.state)));

  const brand = doc.createElement("span");
  brand.className = "bc-paper-ctec-status-brand";
  brand.textContent = "Better CAESAR";
  mark.append(brand);

  const copy = doc.createElement("div");
  copy.className = "bc-paper-ctec-status-copy";
  copy.textContent = buildStatusCopy(data);

  bar.append(mark, copy);

  if (data.state === "auth-required" && data.loginUrl) {
    const action = doc.createElement("a");
    action.className = "bc-paper-ctec-status-action";
    action.href = data.loginUrl;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = data.awaitingAuthRetry ? "Open again" : "Open login";
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      onLogin();
    });
    bar.append(action);
  }

  bar.dataset.bcPaperCtecSignature = signature;
}

export function hideStatusBar(doc: Document): void {
  doc.getElementById(STATUS_BAR_ID)?.remove();
  doc.getElementById(STATUS_LEGEND_ID)?.remove();
  doc.querySelector<HTMLElement>(`.${STATUS_STACK_CLASS}`)?.remove();
}

function findActionHost(doc: Document): HTMLElement | null {
  const exact = Array.from(
    doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.actionHostExact)
  ).find((candidate) => hasPaperActions(candidate));
  if (exact) return exact;

  return Array.from(
    doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.actionHostFallback)
  ).find((candidate) => hasPaperActions(candidate)) ?? null;
}

function ensureActionHostLayout(host: HTMLElement): void {
  if (host.dataset.bcPaperCtecExpanded === "1") return;

  host.style.left = `${PAPER_CTEC_CONFIG.layout.actionHostInsetRem}rem`;
  host.style.right = `${PAPER_CTEC_CONFIG.layout.actionHostInsetRem}rem`;
  host.style.justifyContent = "flex-end";
  host.style.alignItems = "flex-start";
  host.style.minWidth = "0";
  host.dataset.bcPaperCtecExpanded = "1";
}

function ensureStatusStack(doc: Document, host: HTMLElement): HTMLElement {
  let stack = host.querySelector<HTMLElement>(`.${STATUS_STACK_CLASS}`);
  if (!stack) {
    stack = doc.createElement("div");
    stack.className = STATUS_STACK_CLASS;
  }

  if (stack.parentElement !== host || host.firstElementChild !== stack) {
    host.prepend(stack);
  }

  return stack;
}

function renderStatusLegend(doc: Document, stack: HTMLElement): void {
  let legend = doc.getElementById(STATUS_LEGEND_ID) as HTMLDivElement | null;
  if (!legend) {
    legend = doc.createElement("div");
    legend.id = STATUS_LEGEND_ID;
  }

  if (legend.parentElement !== stack) {
    stack.append(legend);
  }

  const signature = "inst|course|learn|hrs";
  if (legend.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  legend.replaceChildren(
    makeLegendItem(doc, "Inst", "instruction rating"),
    makeLegendItem(doc, "Course", "course rating"),
    makeLegendItem(doc, "Learn", "amount learned"),
    makeLegendItem(doc, "Hrs", "avg hours / week")
  );
  legend.dataset.bcPaperCtecSignature = signature;
}

function makeLegendItem(doc: Document, key: string, description: string): HTMLElement {
  const item = doc.createElement("div");
  item.className = "bc-paper-ctec-legend-item";

  const legendKey = doc.createElement("span");
  legendKey.className = "bc-paper-ctec-legend-key";
  legendKey.textContent = key;

  const legendText = doc.createElement("span");
  legendText.textContent = description;

  item.append(legendKey, legendText);
  return item;
}

function buildStatusSignature(data: PaperCtecStatusBarData): string {
  return [
    data.state,
    data.totalCount,
    data.resolvedCount,
    data.activeCount,
    data.foundCount,
    data.notFoundCount,
    data.errorCount,
    data.authCount,
    data.latestMessage ?? "",
    data.loginUrl ?? "",
    data.awaitingAuthRetry ? "1" : "0"
  ].join("|");
}

function hasPaperActions(candidate: HTMLElement): boolean {
  const labels = Array.from(candidate.querySelectorAll("button")).map((button) =>
    (button.textContent ?? "").trim().toLowerCase()
  );

  return labels.some((label) => label.includes("custom")) &&
    labels.some((label) => label.includes("export")) &&
    labels.some((label) => label.includes("clear"));
}

function buildStatusCopy(data: PaperCtecStatusBarData): string {
  if (data.state === "auth-required") {
    const prefix = data.awaitingAuthRetry
      ? "Waiting for Northwestern login to resume CTECs on Paper"
      : "Northwestern login required to continue CTECs on Paper";
    return `${prefix} · ${data.resolvedCount}/${data.totalCount} classes checked`;
  }

  if (data.state === "loading") {
    const detail = data.latestMessage
      ? ` · ${data.latestMessage}`
      : data.activeCount > 0
        ? ` · ${data.activeCount} active`
        : "";
    return `Loading CTECs into Paper · ${data.resolvedCount}/${data.totalCount} classes checked${detail}`;
  }

  const parts = [];
  if (data.foundCount > 0) parts.push(`${data.foundCount} enriched`);
  if (data.notFoundCount > 0) parts.push(`${data.notFoundCount} no CTEC`);
  if (data.errorCount > 0) parts.push(`${data.errorCount} unavailable`);
  if (parts.length === 0) parts.push("no visible classes");
  return `CTEC sync complete on Paper · ${parts.join(" · ")}`;
}

function buildStatusTitle(data: PaperCtecStatusBarData): string {
  if (data.state === "auth-required") {
    return "Better CAESAR needs one Northwestern login before it can keep reading CTEC reports for this Paper schedule.";
  }

  if (data.state === "loading") {
    return "Better CAESAR is reading Northwestern CTEC data and attaching summaries to the current Paper schedule.";
  }

  return "Better CAESAR finished syncing Northwestern CTEC summaries into the current Paper schedule.";
}

function statusIcon(state: PaperCtecStatusBarData["state"]): IconName {
  if (state === "auth-required") return "lock";
  if (state === "ready") return "stack";
  return "spark";
}

function metricChip(
  shortLabel: string,
  label: string,
  metric: CtecAggregateMetric | undefined,
  aggregate: Extract<PaperCtecWidgetData, { state: "found" }>["aggregate"],
  scale: "rating" | "hours"
): HTMLElement | null {
  if (!metric) return null;

  const starMode = isFeatureEnabled(COMPACT_CARD_STARS_FEATURE_ID);
  if (scale === "rating" && starMode) {
    return makeMetricStarsChip(
      shortLabel,
      metric.mean,
      buildMetricChipTooltip(label, metric, aggregate)
    );
  }

  const tone = !starMode
    ? scale === "hours"
      ? buildCompactChipTone(metric.mean, PAPER_CTEC_CONFIG.aggregate.hoursGraphMax, true)
      : buildCompactChipTone(metric.mean, PAPER_CTEC_CONFIG.aggregate.ratingScaleMax, false)
    : undefined;

  return makeMetricValueChip(
    shortLabel,
    metric.mean.toFixed(1),
    "",
    buildMetricChipTooltip(label, metric, aggregate),
    tone
  );
}

function buildWidgetSignature(data: PaperCtecWidgetData): string {
  if (data.state !== "found") {
    return data.state === "error" ? `${data.state}|${data.message}` : data.state;
  }

  const { aggregate } = data;
  const metricSignature = [
    aggregate.metrics.instruction?.mean ?? "",
    aggregate.metrics.course?.mean ?? "",
    aggregate.metrics.learned?.mean ?? "",
    aggregate.metrics.hours?.mean ?? ""
  ].join(",");

  return [
    data.state,
    isFeatureEnabled(COMPACT_CARD_STARS_FEATURE_ID) ? "stars" : "values",
    aggregate.evaluationCount,
    aggregate.aggregateEvaluationCount,
    aggregate.partial ? "1" : "0",
    aggregate.latestTerm ?? "",
    aggregate.windowTerms.join(","),
    aggregate.maxEntriesUsed ?? "",
    metricSignature
  ].join("|");
}

function makeChip(icon: IconName, text: string, extraClass = "", title?: string): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip${extraClass ? ` ${extraClass}` : ""}`;
  if (title) chip.title = title;
  chip.append(createIcon(icon), document.createTextNode(text));
  return chip;
}

function makeMetricValueChip(
  label: string,
  value: string,
  extraClass = "",
  title?: string,
  tone?: CompactChipTone
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip${extraClass ? ` ${extraClass}` : ""}`;
  if (title) chip.title = title;
  if (tone) applyCompactChipTone(chip, tone);

  const chipLabel = document.createElement("span");
  chipLabel.className = `${WIDGET_CLASS}-chip-label`;
  chipLabel.textContent = label;

  const chipValue = document.createElement("span");
  chipValue.className = `${WIDGET_CLASS}-chip-value`;
  chipValue.textContent = value;

  chip.append(chipLabel, chipValue);
  return chip;
}

function makeMetricStarsChip(
  label: string,
  value: number,
  title?: string
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = `${WIDGET_CLASS}-chip`;
  if (title) chip.title = title;

  const chipLabel = document.createElement("span");
  chipLabel.className = `${WIDGET_CLASS}-chip-label`;
  chipLabel.textContent = label;

  const chipStars = document.createElement("span");
  chipStars.className = `${WIDGET_CLASS}-chip-stars`;
  const stars = createRatingStars(document, value);
  chipStars.append(stars);

  chip.append(chipLabel, chipStars);
  return chip;
}

function applyCompactChipTone(chip: HTMLElement, tone: CompactChipTone): void {
  chip.style.setProperty("--bc-paper-ctec-chip-bg", tone.lightBackground);
  chip.style.setProperty("--bc-paper-ctec-chip-bg-dark", tone.darkBackground);
  chip.style.setProperty("--bc-paper-ctec-chip-border", tone.lightBorder);
  chip.style.setProperty("--bc-paper-ctec-chip-border-dark", tone.darkBorder);
  chip.style.setProperty("--bc-paper-ctec-chip-fg", tone.lightText);
  chip.style.setProperty("--bc-paper-ctec-chip-fg-dark", tone.darkText);
}

function buildCompactChipTone(
  value: number,
  max: number,
  invert: boolean
): CompactChipTone {
  const normalized = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const score = invert ? 1 - normalized : normalized;
  const hue =
    score >= 0.9 ? 116 :
      score >= 0.78 ? 92 :
        score >= 0.62 ? 58 :
          score >= 0.48 ? 34 :
            score >= 0.32 ? 18 : 4;

  return {
    lightBackground: `hsla(${hue}, 96%, 68%, 0.98)`,
    darkBackground: `hsla(${hue}, 78%, 32%, 0.94)`,
    lightBorder: `hsla(${hue}, 82%, 24%, 0.38)`,
    darkBorder: `hsla(${hue}, 90%, 78%, 0.28)`,
    lightText: `hsl(${hue}, 62%, 18%)`,
    darkText: "#f9fafb"
  };
}

function buildTooltip(data: Extract<PaperCtecWidgetData, { state: "found" }>["aggregate"]): string {
  const scope = buildAggregateScopeText(data);
  const parts = [
    `CTEC compact summary uses ${scope}. ${data.evaluationCount} matching evaluation${data.evaluationCount === 1 ? "" : "s"} found overall.`
  ];

  appendMetricTooltip(parts, "Instructor", data.metrics.instruction, data);
  appendMetricTooltip(parts, "Course", data.metrics.course, data);
  appendMetricTooltip(parts, "Learned", data.metrics.learned, data);
  appendMetricTooltip(parts, "Challenge", data.metrics.challenging, data);
  appendMetricTooltip(parts, "Interest", data.metrics.stimulating, data);
  if (data.metrics.hours) {
    parts.push(
      `Hours ${data.metrics.hours.mean.toFixed(1)}/week across ${data.metrics.hours.evaluationCount} matching term${
        data.metrics.hours.evaluationCount === 1 ? "" : "s"
      } in ${scope}.`
    );
  }
  if (data.latestTerm) parts.push(`Latest ${data.latestTerm}.`);
  if (data.partial) parts.push("Some linked evaluations were available but not fully parsed.");

  return parts.join(" ");
}

function appendMetricTooltip(
  parts: string[],
  label: string,
  metric: CtecAggregateMetric | undefined,
  aggregate: Extract<PaperCtecWidgetData, { state: "found" }>["aggregate"]
): void {
  if (!metric) return;
  parts.push(buildMetricChipTooltip(label, metric, aggregate));
}

export function renderSideCardAnalytics(
  context: PaperCtecSideCardContext,
  data: SideCardAnalyticsRenderData,
  onSelectTab: (tab: "paper" | "analytics") => void,
  onSelectTerm: (term: string) => void,
  onToggleChart: (chartKey: string) => void,
  onLogin: () => void
): void {
  const header = ensureSideCardHeader(context.panel);
  const tabsRoot = ensureSideCardTabs(context.panel, header);
  const panelRoot = ensureSideCardAnalyticsPanel(context.panel, tabsRoot);

  renderSideCardTabs(tabsRoot, data.selectedTab, onSelectTab);
  applySideCardMode(context.panel, header, tabsRoot, panelRoot, data.selectedTab);

  const signature = buildSideCardAnalyticsSignature(data);
  if (panelRoot.dataset.bcPaperCtecSignature === signature) {
    return;
  }

  panelRoot.replaceChildren();
  if (data.selectedTab !== "analytics") {
    panelRoot.dataset.bcPaperCtecSignature = signature;
    return;
  }

  const body = context.panel.ownerDocument.createElement("div");
  body.className = "bc-paper-ctec-analytics-body";

  const head = context.panel.ownerDocument.createElement("div");
  head.className = "bc-paper-ctec-analytics-head";

  const title = context.panel.ownerDocument.createElement("div");
  title.className = "bc-paper-ctec-analytics-title";
  title.textContent = "Better CAESAR CTEC Analytics";
  head.append(title);
  body.append(head);

  if (data.authUrl) {
    body.append(
      makeAnalyticsCallout(
        context.panel.ownerDocument,
        data.awaitingAuthRetry
          ? "Waiting for Northwestern login to resume the remaining CTEC history."
          : "Northwestern login is required to finish loading older CTEC terms.",
        "is-warn",
        data.authUrl,
        data.awaitingAuthRetry ? "Open again" : "Open login",
        onLogin
      )
    );
  } else if (data.errorMessage) {
    body.append(
      makeAnalyticsCallout(
        context.panel.ownerDocument,
        data.errorMessage,
        "is-warn"
      )
    );
  } else if (data.loading && !data.snapshot?.allFetched) {
    body.append(
      makeAnalyticsCallout(
        context.panel.ownerDocument,
        "Loading the remaining CTEC terms…",
        "is-muted"
      )
    );
  }

  if (!data.snapshot) {
    body.append(
      makeAnalyticsCallout(
        context.panel.ownerDocument,
        data.loading
          ? "Reading CTEC reports for this course…"
          : "No CTEC analytics are available for this section yet.",
        "is-muted"
      )
    );
    panelRoot.append(body);
    panelRoot.dataset.bcPaperCtecSignature = signature;
    return;
  }

  body.append(renderAnalyticsAggregate(context.panel.ownerDocument, data.snapshot));
  body.append(
    renderSelectedTermAnalytics(
      context.panel.ownerDocument,
      data.snapshot,
      data.selectedEntryId,
      data.expandedChartKeys,
      data.commentQuery,
      onSelectTerm,
      onToggleChart
    )
  );

  panelRoot.append(body);
  panelRoot.dataset.bcPaperCtecSignature = signature;
}

function buildAggregateScopeText(
  aggregate: Extract<PaperCtecWidgetData, { state: "found" }>["aggregate"]
): string {
  if (!aggregate.maxEntriesUsed || aggregate.aggregateEvaluationCount >= aggregate.evaluationCount) {
    return "all matching evaluations";
  }

  return `the latest ${aggregate.aggregateEvaluationCount} matching evaluation${
    aggregate.aggregateEvaluationCount === 1 ? "" : "s"
  }`;
}

function buildMetricChipTooltip(
  label: string,
  metric: CtecAggregateMetric,
  aggregate: Extract<PaperCtecWidgetData, { state: "found" }>["aggregate"]
): string {
  const scope = buildAggregateScopeText(aggregate);
  return `${label} ${metric.mean.toFixed(2)} across ${metric.evaluationCount} matching term${
    metric.evaluationCount === 1 ? "" : "s"
  } in ${scope}.`;
}

function ensureSideCardHeader(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardHeader);
}

function ensureSideCardTabs(panel: HTMLElement, header: HTMLElement | null): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`.${SIDECARD_TABS_CLASS}`);
  if (existing) {
    insertAfter(panel, existing, header);
    return existing;
  }

  const tabsRoot = panel.ownerDocument.createElement("div");
  tabsRoot.className = SIDECARD_TABS_CLASS;
  tabsRoot.setAttribute("role", "tablist");

  insertAfter(panel, tabsRoot, header);
  return tabsRoot;
}

function ensureSideCardAnalyticsPanel(panel: HTMLElement, tabsRoot: HTMLElement): HTMLElement {
  const existing = panel.querySelector<HTMLElement>(`.${SIDECARD_ANALYTICS_PANEL_CLASS}`);
  if (existing) {
    insertAfter(panel, existing, tabsRoot);
    return existing;
  }

  const root = panel.ownerDocument.createElement("section");
  root.className = SIDECARD_ANALYTICS_PANEL_CLASS;
  insertAfter(panel, root, tabsRoot);
  return root;
}

function insertAfter(panel: HTMLElement, node: HTMLElement, reference: HTMLElement | null): void {
  if (!reference || reference.parentElement !== panel) {
    if (node.parentElement === panel && panel.firstElementChild === node) {
      return;
    }
    panel.prepend(node);
    return;
  }

  if (node.parentElement === panel && reference.nextSibling === node) {
    return;
  }

  panel.insertBefore(node, reference.nextSibling);
}

function buildSideCardAnalyticsSignature(data: SideCardAnalyticsRenderData): string {
  const snapshot = data.snapshot;
  const entrySignature = snapshot
    ? snapshot.entries
        .map((entry) => {
          const metrics = buildMetricSignature(entry);
          const charts = entry.charts.map((chart) => chart.imageUrl).join(",");
          const comments = entry.commentGroups
            .map((group) => `${group.prompt}:${group.comments.length}`)
            .join(",");
          return [
            entry.term,
            entry.status,
            entry.url ?? "",
            metrics,
            charts,
            comments
          ].join(":");
        })
        .join("|")
    : "";

  return [
    data.selectedTab,
    data.selectedEntryId ?? "",
    data.recentTerms,
    data.loading ? "1" : "0",
    data.expandedChartKeys.join(","),
    data.authUrl ?? "",
    data.awaitingAuthRetry ? "1" : "0",
    data.errorMessage ?? "",
    snapshot?.allFetched ? "1" : "0",
    snapshot?.recentAggregate.evaluationCount ?? 0,
    snapshot?.recentAggregate.aggregateEvaluationCount ?? 0,
    snapshot?.recentAggregate.windowTerms.join(",") ?? "",
    entrySignature
  ].join("||");
}

function buildMetricSignature(entry: CtecCourseAnalyticsEntry): string {
  return [
    entry.metrics.instruction?.mean,
    entry.metrics.instruction?.responseCount,
    entry.metrics.course?.mean,
    entry.metrics.course?.responseCount,
    entry.metrics.learned?.mean,
    entry.metrics.learned?.responseCount,
    entry.metrics.challenging?.mean,
    entry.metrics.challenging?.responseCount,
    entry.metrics.stimulating?.mean,
    entry.metrics.stimulating?.responseCount,
    entry.metrics.hours?.mean,
    entry.metrics.hours?.responseCount
  ]
    .map((value) => value ?? "")
    .join(",");
}

function renderSideCardTabs(
  tabsRoot: HTMLElement,
  selectedTab: "paper" | "analytics",
  onSelectTab: (tab: "paper" | "analytics") => void
): void {
  if (tabsRoot.dataset.bcPaperCtecSelectedTab === selectedTab && tabsRoot.childElementCount === 2) {
    return;
  }

  tabsRoot.replaceChildren();

  const tabs: Array<{ key: "paper" | "analytics"; label: string }> = [
    { key: "paper", label: "Paper.nu" },
    { key: "analytics", label: "CTEC Analytics" }
  ];

  for (const tab of tabs) {
    const button = tabsRoot.ownerDocument.createElement("button");
    button.type = "button";
    button.className = `bc-paper-ctec-side-tab${tab.key === selectedTab ? " is-active" : ""}`;
    button.textContent = tab.label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", tab.key === selectedTab ? "true" : "false");
    const activateTab = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectTab(tab.key);
    };
    button.addEventListener("pointerdown", activateTab);
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      activateTab(event);
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    tabsRoot.append(button);
  }

  tabsRoot.dataset.bcPaperCtecSelectedTab = selectedTab;
}

function applySideCardMode(
  panel: HTMLElement,
  header: HTMLElement | null,
  tabsRoot: HTMLElement,
  analyticsRoot: HTMLElement,
  selectedTab: "paper" | "analytics"
): void {
  analyticsRoot.hidden = selectedTab !== "analytics";

  for (const child of Array.from(panel.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child === header || child === tabsRoot || child === analyticsRoot) continue;

    const shouldHide = selectedTab === "analytics";
    if (child.hidden !== shouldHide) {
      child.hidden = shouldHide;
    }
  }
}

function makeAnalyticsCallout(
  doc: Document,
  message: string,
  tone: "is-warn" | "is-muted",
  href?: string,
  actionLabel?: string,
  onAction?: () => void
): HTMLElement {
  const callout = doc.createElement("div");
  callout.className = `bc-paper-ctec-analytics-callout ${tone}`;

  const copy = doc.createElement("div");
  copy.textContent = message;
  callout.append(copy);

  if (href && actionLabel) {
    const action = doc.createElement("a");
    action.href = href;
    action.target = "_blank";
    action.rel = "noopener noreferrer";
    action.textContent = actionLabel;
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      onAction?.();
    });
    callout.append(action);
  }

  return callout;
}

function renderAnalyticsAggregate(doc: Document, snapshot: CtecCourseAnalytics): HTMLElement {
  const section = doc.createElement("section");
  const terms = snapshot.recentAggregate.windowTerms;

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-section-title";
  title.textContent = terms.length > 0 ? `AGGREGATE (${terms.join(", ")})` : "AGGREGATE";
  section.append(title);

  const teachingCards = [
    analyticsAggregateScalarCard(doc, "Instruction", snapshot.recentAggregate.metrics.instruction),
    analyticsAggregateScalarCard(doc, "Course", snapshot.recentAggregate.metrics.course)
  ].filter((card): card is HTMLElement => !!card);

  const learningCards = [
    analyticsAggregateScalarCard(doc, "Learned", snapshot.recentAggregate.metrics.learned),
    analyticsAggregateScalarCard(doc, "Challenge", snapshot.recentAggregate.metrics.challenging),
    analyticsAggregateScalarCard(doc, "Interest", snapshot.recentAggregate.metrics.stimulating)
  ].filter((card): card is HTMLElement => !!card);

  const hoursCard = analyticsAggregateHoursCard(doc, snapshot.recentAggregate.metrics.hours);

  if (teachingCards.length === 0 && learningCards.length === 0 && !hoursCard) {
    section.append(
      makeAnalyticsCallout(
        doc,
        "No parsed summary metrics are available yet for the recent CTEC window.",
        "is-muted"
      )
    );
    return section;
  }

  if (teachingCards.length > 0) {
    section.append(renderMetricGroup(doc, "Teaching", teachingCards));
  }
  if (learningCards.length > 0) {
    section.append(renderMetricGroup(doc, "Learning", learningCards));
  }
  if (hoursCard) {
    section.append(renderMetricGroup(doc, "Workload", [hoursCard]));
  }
  return section;
}

function analyticsAggregateScalarCard(
  doc: Document,
  label: string,
  metric?: CtecAggregateMetric
): HTMLElement | null {
  if (!metric) return null;

  return createScalarMetricCard(
    doc,
    label,
    metric.mean,
    `${label} ${metric.mean.toFixed(2)} across ${metric.evaluationCount} recent term${
      metric.evaluationCount === 1 ? "" : "s"
    }.`
  );
}

function analyticsAggregateHoursCard(
  doc: Document,
  metric?: CtecAggregateMetric
): HTMLElement | null {
  if (!metric) return null;
  return createHoursMetricCard(
    doc,
    "Hours / week",
    metric.mean,
    `${metric.mean.toFixed(1)} average hours per week across ${metric.evaluationCount} recent term${
      metric.evaluationCount === 1 ? "" : "s"
    }.`
  );
}

function renderSelectedTermAnalytics(
  doc: Document,
  snapshot: CtecCourseAnalytics,
  selectedEntryId: string | null,
  expandedChartKeys: string[],
  commentQuery: string,
  onSelectTerm: (entryId: string) => void,
  onToggleChart: (chartKey: string) => void
): HTMLElement {
  const section = doc.createElement("section");

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-section-title";
  title.textContent = "SELECTED TERM";
  section.append(title);

  if (snapshot.entries.length === 0) {
    section.append(
      makeAnalyticsCallout(
        doc,
        "No term-level CTEC records are available for this section.",
        "is-muted"
      )
    );
    return section;
  }

  const selectedEntry = snapshot.entries.find((entry) => buildAnalyticsEntryValue(entry) === selectedEntryId) ?? snapshot.entries[0]!;

  const toolbar = doc.createElement("div");
  toolbar.className = "bc-paper-ctec-analytics-term-toolbar";

  const selector = doc.createElement("div");
  selector.className = "bc-paper-ctec-analytics-term-selector";

  const selectorLabel = doc.createElement("label");
  selectorLabel.textContent = "Term";

  const select = doc.createElement("select");
  select.className = "bc-paper-ctec-analytics-term-select";
  select.title = "Switch the currently displayed CTEC term.";
  select.addEventListener("pointerdown", (event) => event.stopPropagation());
  select.addEventListener("click", (event) => event.stopPropagation());
  select.addEventListener("keydown", (event) => event.stopPropagation());

  for (const entry of snapshot.entries) {
    const option = doc.createElement("option");
    option.value = buildAnalyticsEntryValue(entry);
    option.textContent = buildTermSelectorLabel(entry);
    option.selected = buildAnalyticsEntryValue(entry) === buildAnalyticsEntryValue(selectedEntry);
    select.append(option);
  }

  select.onchange = (event) => {
    event.stopPropagation();
    onSelectTerm(select.value);
  };

  selector.append(selectorLabel, select);
  toolbar.append(selector);
  section.append(toolbar);

  const summary = doc.createElement("div");
  summary.className = "bc-paper-ctec-analytics-term-summary";

  const summaryText = doc.createElement("div");
  const summaryTitle = doc.createElement("div");
  summaryTitle.className = "bc-paper-ctec-analytics-term-title";
  summaryTitle.textContent = selectedEntry.term;
  summaryText.append(summaryTitle);

  const summaryMeta = doc.createElement("div");
  summaryMeta.className = "bc-paper-ctec-analytics-term-meta";
  summaryMeta.textContent = buildTermMeta(selectedEntry);
  summaryText.append(summaryMeta);

  summary.append(summaryText);

  if (selectedEntry.url) {
    const link = doc.createElement("a");
    link.className = "bc-paper-ctec-analytics-term-link";
    link.href = selectedEntry.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open report";
    link.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    summary.append(link);
  }

  section.append(summary);

  if (selectedEntry.status === "pending") {
    const note = doc.createElement("div");
    note.className = "bc-paper-ctec-analytics-state-note";
    note.textContent = "Full details for this term are still loading.";
    section.append(note);
    return section;
  }

  if (selectedEntry.status === "unavailable") {
    const note = doc.createElement("div");
    note.className = "bc-paper-ctec-analytics-state-note";
    note.textContent = "No parsed CTEC details were available for this term.";
    section.append(note);
    return section;
  }

  const metricGrid = renderTermMetricGrid(
    doc,
    selectedEntry,
    new Set(expandedChartKeys),
    onToggleChart
  );
  if (metricGrid) {
    section.append(metricGrid);
  }

  if (!hasTermMetrics(selectedEntry) && selectedEntry.charts.length === 0 && selectedEntry.commentGroups.length === 0) {
    const note = doc.createElement("div");
    note.className = "bc-paper-ctec-analytics-state-note";
    note.textContent = "No parsed CTEC details were available for this term.";
    section.append(note);
    return section;
  }

  if (selectedEntry.commentGroups.length > 0) {
    section.append(renderTermComments(doc, selectedEntry, commentQuery));
  }

  return section;
}

function buildTermSelectorLabel(entry: CtecCourseAnalyticsEntry): string {
  return entry.instructor ? `${entry.term} · ${entry.instructor}` : entry.term;
}

function buildAnalyticsEntryValue(entry: CtecCourseAnalyticsEntry): string {
  return [entry.term, entry.instructor, entry.url ?? entry.description].join("::");
}

function buildTermMeta(entry: CtecCourseAnalyticsEntry): string {
  const parts = [entry.description];
  if (entry.instructor) parts.push(entry.instructor);
  return parts.filter(Boolean).join(" · ");
}

function renderTermMetricGrid(
  doc: Document,
  entry: CtecCourseAnalyticsEntry,
  expandedChartKeys: Set<string>,
  onToggleChart: (chartKey: string) => void
): HTMLElement | null {
  const teachingCards = [
    analyticsTermScalarCard(doc, entry, "instruction", "Instruction", entry.metrics.instruction, expandedChartKeys, onToggleChart),
    analyticsTermScalarCard(doc, entry, "course", "Course", entry.metrics.course, expandedChartKeys, onToggleChart)
  ].filter((card): card is HTMLElement => !!card);

  const learningCards = [
    analyticsTermScalarCard(doc, entry, "learned", "Learned", entry.metrics.learned, expandedChartKeys, onToggleChart),
    analyticsTermScalarCard(doc, entry, "challenging", "Challenge", entry.metrics.challenging, expandedChartKeys, onToggleChart),
    analyticsTermScalarCard(doc, entry, "stimulating", "Interest", entry.metrics.stimulating, expandedChartKeys, onToggleChart)
  ].filter((card): card is HTMLElement => !!card);

  const hoursCard = analyticsTermHoursCard(
    doc,
    entry,
    entry.metrics.hours,
    expandedChartKeys,
    onToggleChart
  );

  if (teachingCards.length === 0 && learningCards.length === 0 && !hoursCard) {
    return null;
  }

  const wrapper = doc.createElement("div");
  if (teachingCards.length > 0) {
    wrapper.append(renderSelectedMetricGroup(doc, "Teaching", teachingCards));
  }
  if (learningCards.length > 0) {
    wrapper.append(renderSelectedMetricGroup(doc, "Learning", learningCards));
  }
  if (hoursCard) {
    wrapper.append(renderSelectedMetricGroup(doc, "Workload", [hoursCard]));
  }
  return wrapper;
}

function analyticsTermScalarCard(
  doc: Document,
  entry: CtecCourseAnalyticsEntry,
  kind: AnalyticsMetricKind,
  label: string,
  metric: { mean: number; responseCount: number } | undefined,
  expandedChartKeys: Set<string>,
  onToggleChart: (chartKey: string) => void
): HTMLElement | null {
  if (!metric) return null;

  const chart = findMetricChart(entry, kind);
  const chartKey = buildExpandedChartKey(entry, kind);
  const action = chart
    ? createMetricChartButton(doc, expandedChartKeys.has(chartKey), () => onToggleChart(chartKey))
    : undefined;

  const card = createScalarMetricCard(
    doc,
    label,
    metric.mean,
    `${label} ${metric.mean.toFixed(2)} in this term.`,
    action
  );

  if (chart && expandedChartKeys.has(chartKey)) {
    card.append(renderInlineChart(doc, chart));
  }

  return card;
}

function analyticsTermHoursCard(
  doc: Document,
  entry: CtecCourseAnalyticsEntry,
  metric: { mean: number; responseCount: number } | undefined,
  expandedChartKeys: Set<string>,
  onToggleChart: (chartKey: string) => void
): HTMLElement | null {
  if (!metric) return null;

  const chart = findMetricChart(entry, "hours");
  const chartKey = buildExpandedChartKey(entry, "hours");
  const action = chart
    ? createMetricChartButton(doc, expandedChartKeys.has(chartKey), () => onToggleChart(chartKey))
    : undefined;

  const card = createHoursMetricCard(
    doc,
    "Hours / week",
    metric.mean,
    `${metric.mean.toFixed(1)} average hours per week in this term.`,
    action
  );

  if (chart && expandedChartKeys.has(chartKey)) {
    card.append(renderInlineChart(doc, chart));
  }

  return card;
}

function renderMetricGroup(doc: Document, titleText: string, cards: HTMLElement[]): HTMLElement {
  const group = doc.createElement("section");
  group.className = "bc-paper-ctec-analytics-group";

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-group-title";
  title.textContent = titleText;

  const grid = doc.createElement("div");
  grid.className = "bc-paper-ctec-analytics-grid";
  cards.forEach((card) => grid.append(card));

  group.append(title, grid);
  return group;
}

function renderSelectedMetricGroup(doc: Document, titleText: string, cards: HTMLElement[]): HTMLElement {
  const group = doc.createElement("section");
  group.className = "bc-paper-ctec-analytics-group";

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-group-title";
  title.textContent = titleText;

  const stack = doc.createElement("div");
  stack.className = "bc-paper-ctec-analytics-metric-stack";
  cards.forEach((card) => stack.append(card));

  group.append(title, stack);
  return group;
}

function createScalarMetricCard(
  doc: Document,
  label: string,
  mean: number,
  tooltip: string,
  action?: HTMLElement
): HTMLElement {
  const card = doc.createElement("div");
  card.className = action ? "bc-paper-ctec-analytics-metric-card" : "bc-paper-ctec-analytics-card";
  card.title = tooltip;

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-card-label";
  title.textContent = label;

  if (action) {
    const top = doc.createElement("div");
    top.className = "bc-paper-ctec-analytics-metric-card-top";
    top.append(title, action);
    card.append(top);
  } else {
    card.append(title);
  }

  const rating = doc.createElement("div");
  rating.className = "bc-paper-ctec-analytics-card-rating";
  rating.append(createRatingStars(doc, mean));

  const value = doc.createElement("div");
  value.className = "bc-paper-ctec-analytics-card-value";
  value.textContent = mean.toFixed(2);
  rating.append(value);

  card.append(rating);
  return card;
}

function createHoursMetricCard(
  doc: Document,
  label: string,
  mean: number,
  tooltip: string,
  action?: HTMLElement
): HTMLElement {
  const card = doc.createElement("div");
  card.className = action ? "bc-paper-ctec-analytics-metric-card" : "bc-paper-ctec-analytics-card";
  card.title = tooltip;

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-card-label";
  title.textContent = label;

  if (action) {
    const top = doc.createElement("div");
    top.className = "bc-paper-ctec-analytics-metric-card-top";
    top.append(title, action);
    card.append(top);
  } else {
    card.append(title);
  }

  const value = doc.createElement("div");
  value.className = "bc-paper-ctec-analytics-card-hours";
  value.textContent = `${mean.toFixed(1)} h`;

  const track = doc.createElement("div");
  track.className = "bc-paper-ctec-hours-track";

  const fill = doc.createElement("div");
  fill.className = "bc-paper-ctec-hours-fill";
  fill.style.width = `${Math.max(0, Math.min(100, (mean / PAPER_CTEC_CONFIG.aggregate.hoursGraphMax) * 100))}%`;
  track.append(fill);

  const meta = doc.createElement("div");
  meta.className = "bc-paper-ctec-hours-meta";
  const minLabel = doc.createElement("span");
  minLabel.textContent = "0h";
  const maxLabel = doc.createElement("span");
  maxLabel.textContent = `${PAPER_CTEC_CONFIG.aggregate.hoursGraphMax}h+`;
  meta.append(minLabel, maxLabel);

  card.append(value, track, meta);
  return card;
}

function buildExpandedChartKey(entry: CtecCourseAnalyticsEntry, kind: AnalyticsMetricKind): string {
  return `${buildAnalyticsEntryValue(entry)}::${kind}`;
}

function findMetricChart(
  entry: CtecCourseAnalyticsEntry,
  kind: AnalyticsMetricKind
): CtecReportChart | undefined {
  return entry.charts.find((chart) => classifyChartQuestion(chart.question) === kind);
}

function classifyChartQuestion(question: string): AnalyticsMetricKind | null {
  const normalized = question.toLowerCase();
  if (normalized.includes("overall rating of the instruction")) return "instruction";
  if (normalized.includes("overall rating of the course")) return "course";
  if (normalized.includes("estimate how much you learned")) return "learned";
  if (normalized.includes("challenging you intellectually")) return "challenging";
  if (normalized.includes("stimulating your interest in the subject")) return "stimulating";
  if (normalized.includes("average number of hours per week")) return "hours";
  return null;
}

function createMetricChartButton(
  doc: Document,
  expanded: boolean,
  onToggle: () => void
): HTMLElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "bc-paper-ctec-analytics-metric-chart-btn";
  button.title = expanded ? "Hide chart" : "Show chart";
  button.setAttribute("aria-label", expanded ? "Hide chart" : "Show chart");
  button.append(createIcon("chart"));
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggle();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  return button;
}

function renderInlineChart(doc: Document, chart: CtecReportChart): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "bc-paper-ctec-analytics-inline-chart";

  const head = doc.createElement("div");
  head.className = "bc-paper-ctec-analytics-inline-chart-head";

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-chart-title";
  title.textContent = chart.question;

  head.append(title);

  const image = doc.createElement("img");
  image.className = "bc-paper-ctec-analytics-chart-image";
  image.src = chart.imageUrl;
  image.alt = chart.alt || chart.question;
  image.loading = "lazy";

  wrapper.append(head, image);
  return wrapper;
}

function renderTermComments(
  doc: Document,
  entry: CtecCourseAnalyticsEntry,
  initialQuery: string
): HTMLElement {
  const section = doc.createElement("section");

  const title = doc.createElement("div");
  title.className = "bc-paper-ctec-analytics-section-title";
  title.textContent = "Student Comments";
  section.append(title);

  const toolbar = doc.createElement("div");
  toolbar.className = "bc-paper-ctec-analytics-comments-toolbar";

  const input = doc.createElement("input");
  input.type = "search";
  input.className = "bc-paper-ctec-analytics-comments-search";
  input.placeholder = "Search student comments";
  input.value = initialQuery;
  input.dataset.bcPaperCtecCommentSearch = "1";
  input.addEventListener("pointerdown", (event) => event.stopPropagation());
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => event.stopPropagation());

  const count = doc.createElement("div");
  count.className = "bc-paper-ctec-analytics-comments-count";

  const groups = doc.createElement("div");
  groups.className = "bc-paper-ctec-analytics-comments";

  const renderComments = (query: string) => {
    groups.replaceChildren();

    const filteredGroups = filterCommentGroups(entry.commentGroups, query);
    const totalMatches = filteredGroups.reduce((sum, group) => sum + group.comments.length, 0);
    count.textContent = query.trim()
      ? `${totalMatches} match${totalMatches === 1 ? "" : "es"}`
      : `${entry.commentGroups.reduce((sum, group) => sum + group.comments.length, 0)} comments`;

    if (filteredGroups.length === 0) {
      const empty = doc.createElement("div");
      empty.className = "bc-paper-ctec-analytics-state-note";
      empty.textContent = "No comments matched that search.";
      groups.append(empty);
      return;
    }

    for (const group of filteredGroups) {
      const wrapper = doc.createElement("div");
      wrapper.className = "bc-paper-ctec-analytics-comment-group";

      const prompt = doc.createElement("div");
      prompt.className = "bc-paper-ctec-analytics-comment-prompt";
      prompt.textContent = group.prompt;
      wrapper.append(prompt);

      const list = doc.createElement("div");
      list.className = "bc-paper-ctec-analytics-comment-list";

      for (const comment of group.comments) {
        const card = doc.createElement("div");
        card.className = "bc-paper-ctec-analytics-comment-card";
        appendHighlightedComment(card, comment, query);
        list.append(card);
      }

      wrapper.append(list);
      groups.append(wrapper);
    }
  };

  input.addEventListener("input", () => {
    renderComments(input.value);
  });

  toolbar.append(input, count);
  section.append(toolbar, groups);
  renderComments(initialQuery);
  return section;
}

function filterCommentGroups(
  groups: CtecCourseAnalyticsEntry["commentGroups"],
  query: string
): CtecCourseAnalyticsEntry["commentGroups"] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return groups;

  return groups
    .map((group) => ({
      ...group,
      comments: group.comments.filter((comment) =>
        comment.toLowerCase().includes(normalizedQuery)
      )
    }))
    .filter((group) => group.comments.length > 0);
}

function appendHighlightedComment(container: HTMLElement, text: string, query: string): void {
  container.replaceChildren();

  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (index > 0) container.append(container.ownerDocument.createElement("br"));
    appendHighlightedInline(container, lines[index] ?? "", query);
  }
}

function appendHighlightedInline(container: HTMLElement, text: string, query: string): void {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    container.append(text);
    return;
  }

  const haystack = text.toLowerCase();
  let start = 0;

  while (start < text.length) {
    const matchIndex = haystack.indexOf(normalizedQuery, start);
    if (matchIndex < 0) {
      container.append(text.slice(start));
      return;
    }

    if (matchIndex > start) {
      container.append(text.slice(start, matchIndex));
    }

    const mark = container.ownerDocument.createElement("mark");
    mark.className = "bc-paper-ctec-comment-highlight";
    mark.textContent = text.slice(matchIndex, matchIndex + normalizedQuery.length);
    container.append(mark);
    start = matchIndex + normalizedQuery.length;
  }
}

function hasTermMetrics(entry: CtecCourseAnalyticsEntry): boolean {
  return Object.values(entry.metrics).some((metric) => !!metric);
}

function createRatingStars(doc: Document, value: number): HTMLElement {
  const stars = doc.createElement("div");
  stars.className = "bc-paper-ctec-stars";
  stars.title = `${value.toFixed(2)} / ${PAPER_CTEC_CONFIG.aggregate.ratingScaleMax}`;

  const normalized = Math.max(
    0,
    Math.min(PAPER_CTEC_CONFIG.aggregate.ratingScaleMax, value)
  );

  for (let index = 0; index < PAPER_CTEC_CONFIG.aggregate.ratingScaleMax; index++) {
    const star = doc.createElement("span");
    star.className = "bc-paper-ctec-star";

    const base = createIcon("star", { filled: true });
    base.classList.add("bc-paper-ctec-star-base");

    const fill = doc.createElement("span");
    fill.className = "bc-paper-ctec-star-fill";
    fill.style.width = `${Math.max(0, Math.min(1, normalized - index)) * 100}%`;
    fill.append(createIcon("star", { filled: true }));

    star.append(base, fill);
    stars.append(star);
  }

  return stars;
}

type IconName = "book" | "cap" | "chart" | "clock" | "lock" | "spark" | "stack" | "star" | "user";

function createIcon(name: IconName, options?: { filled?: boolean }): SVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", options?.filled ? "currentColor" : "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const addPath = (d: string) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  };

  if (name === "book") {
    addPath("M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 0 4 22z");
    addPath("M8 4v16");
    return svg;
  }

  if (name === "cap") {
    addPath("m3 10 9-4 9 4-9 4-9-4Z");
    addPath("M7 12v4.5c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5V12");
    addPath("M21 10v6");
    return svg;
  }

  if (name === "chart") {
    addPath("M4 19h16");
    addPath("M7 16V9");
    addPath("M12 16V5");
    addPath("M17 16v-4");
    return svg;
  }

  if (name === "clock") {
    addPath("M12 6v6l4 2");
    addPath("M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z");
    return svg;
  }

  if (name === "lock") {
    addPath("M7 11V8a5 5 0 0 1 10 0v3");
    addPath("M5 11h14v10H5z");
    return svg;
  }

  if (name === "spark") {
    addPath("m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z");
    return svg;
  }

  if (name === "stack") {
    addPath("m12 4 8 4-8 4-8-4 8-4Z");
    addPath("m4 12 8 4 8-4");
    addPath("m4 16 8 4 8-4");
    return svg;
  }

  if (name === "star") {
    addPath("m12 3.5 2.7 5.47 6.03.88-4.36 4.25 1.03 6.01L12 17.9l-5.4 2.84 1.03-6.01L3.27 9.85l6.03-.88Z");
    return svg;
  }

  addPath("M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z");
  addPath("M5 20a7 7 0 0 1 14 0");
  return svg;
}
