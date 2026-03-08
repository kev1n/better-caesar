import type { Augmentation } from "../../framework";
import { isFeatureEnabled } from "../../settings";
import {
  fetchCtecCourseAnalytics,
  fetchCtecReportAggregate,
  getCtecCourseAnalyticsSnapshot
} from "../ctec-links/reports";
import { extractSubjectAndCatalog } from "../ctec-links/helpers";
import {
  COMPACT_CARD_FEATURE_ID,
  SINGLE_SUMMARY_CARD_FEATURE_ID,
  WIDGET_CLASS
} from "./constants";
import { PAPER_CTEC_CONFIG } from "./config";
import type {
  PaperCtecAnalyticsState,
  PaperCtecSideCardContext,
  PaperCtecStatusBarData,
  PaperCtecTarget,
  PaperCtecWidgetData
} from "./types";
import {
  hideStatusBar,
  injectStyles,
  renderLoading,
  renderSideCardAnalytics,
  renderStatusBar,
  renderWidget
} from "./ui";

type PaperCtecCandidate = Omit<PaperCtecTarget, "widget"> & {
  content: HTMLElement;
};

export class PaperCtecAugmentation implements Augmentation {
  readonly id = "paper-ctec";

  private readonly inFlight = new Map<string, Promise<PaperCtecWidgetData>>();
  private readonly resolved = new Map<string, PaperCtecWidgetData>();
  private readonly analyticsInFlight = new Map<string, Promise<PaperCtecAnalyticsState>>();
  private readonly analyticsResolved = new Map<string, PaperCtecAnalyticsState>();
  private readonly loadingMessages = new Map<string, { message: string; updatedAt: number }>();

  private visibleKeys = new Set<string>();
  private readonly selectedTabs = new Map<string, "paper" | "analytics">();
  private readonly selectedAnalyticsEntries = new Map<string, string>();
  private readonly expandedCharts = new Map<string, Set<string>>();
  private readonly commentQueries = new Map<string, string>();
  private awaitingAuthRetry = false;
  private focusListenerAttached = false;

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;

    injectStyles();
    this.ensureFocusRetry();

    const targets = this.collectTargets(doc);
    this.visibleKeys = new Set(targets.map((target) => target.key));

    for (const target of targets) {
      target.widget.dataset.bcPaperCtecKey = target.key;

      const resolved = this.resolved.get(target.key);
      if (resolved) {
        renderWidget(target.widget, resolved);
      } else if (!this.inFlight.has(target.key)) {
        this.setProgress(target.key, "Connecting to Northwestern CTEC…");
        renderLoading(target.widget);
        const job = this.loadTarget(target);
        this.inFlight.set(target.key, job);
        void job.finally(() => {
          this.inFlight.delete(target.key);
          if (!this.analyticsInFlight.has(target.key)) {
            this.loadingMessages.delete(target.key);
          }
          this.syncStatusBar(document);
          this.syncSideCard(document);
        });
      } else if (!target.widget.textContent?.trim()) {
        renderLoading(target.widget);
      }
    }

    this.syncStatusBar(doc);
    this.syncSideCard(doc);
  }

  private appliesToPage(doc: Document): boolean {
    const host = window.location.hostname;
    if (host !== "www.paper.nu" && host !== "paper.nu") return false;
    return !!doc.querySelector(PAPER_CTEC_CONFIG.selectors.scheduleGrid);
  }

  private collectTargets(doc: Document): PaperCtecTarget[] {
    const candidates: PaperCtecCandidate[] = [];

    for (const card of Array.from(
      doc.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.scheduleCard)
    )) {
      const target = this.parseTarget(card);
      if (target) {
        candidates.push(target);
      } else {
        this.cleanupCardWidget(card);
      }
    }

    if (isFeatureEnabled(SINGLE_SUMMARY_CARD_FEATURE_ID)) {
      const canonicalByKey = new Map<string, PaperCtecCandidate>();
      for (const candidate of candidates) {
        const existing = canonicalByKey.get(candidate.key);
        if (!existing || this.compareCardPriority(candidate, existing) < 0) {
          canonicalByKey.set(candidate.key, candidate);
        }
      }

      const selectedCards = new Set(
        Array.from(canonicalByKey.values(), (candidate) => candidate.card)
      );
      for (const candidate of candidates) {
        if (!selectedCards.has(candidate.card)) {
          this.cleanupCardWidget(candidate.card);
        }
      }

      return Array.from(canonicalByKey.values(), (candidate) => ({
        card: candidate.card,
        widget: this.ensureWidget(candidate.content),
        titleHint: candidate.titleHint,
        params: candidate.params,
        key: candidate.key
      }));
    }

    return candidates.map((candidate) => ({
      card: candidate.card,
      widget: this.ensureWidget(candidate.content),
      titleHint: candidate.titleHint,
      params: candidate.params,
      key: candidate.key
    }));
  }

  private parseTarget(card: HTMLElement): PaperCtecCandidate | null {
    if (this.isPreviewCard(card)) return null;

    const content = this.findCardContent(card);
    if (!content) return null;

    const paragraphs = Array.from(content.querySelectorAll<HTMLParagraphElement>("p"));
    const courseLine = content.querySelector<HTMLParagraphElement>('[data-bc-paper-role="course"]') ?? paragraphs[0];
    const titleLine = content.querySelector<HTMLParagraphElement>('[data-bc-paper-role="title"]') ?? paragraphs[1];
    const instructorLine = content.querySelector<HTMLParagraphElement>('[data-bc-paper-role="instructor"]') ?? paragraphs[2];

    if (!courseLine || !instructorLine) return null;

    courseLine.dataset.bcPaperRole = "course";
    if (titleLine) titleLine.dataset.bcPaperRole = "title";
    instructorLine.dataset.bcPaperRole = "instructor";

    this.applyCardLayout(content, courseLine, titleLine ?? null, instructorLine);

    const parsed = extractSubjectAndCatalog(courseLine.textContent ?? "");
    if (!parsed) return null;

    const instructor = instructorLine.textContent?.trim() ?? "";
    if (!instructor) return null;

    const catalogNumber = parsed.catalogNumber;
    const titleHint = titleLine?.textContent?.trim() ?? "";
    const params = {
      classNumber: "",
      subject: parsed.subject,
      catalogNumber,
      instructor,
      career: parseInt(catalogNumber, 10) >= 500 ? "TGS" : "UGRD"
    } as const;

    return {
      card,
      content,
      titleHint,
      params,
      key: this.buildCourseKey(params, titleHint)
    };
  }

  private isPreviewCard(card: HTMLElement): boolean {
    return card.classList.contains("opacity-60");
  }

  private findCardContent(card: HTMLElement): HTMLElement | null {
    const relative = Array.from(card.children).find(
      (child): child is HTMLDivElement =>
        child instanceof HTMLDivElement && child.classList.contains("relative")
    );
    if (!relative) return null;

    return (
      Array.from(relative.children).find(
        (child): child is HTMLDivElement => child instanceof HTMLDivElement
      ) ?? null
    );
  }

  private ensureWidget(content: HTMLElement): HTMLElement {
    const existing = content.querySelector<HTMLElement>(`.${WIDGET_CLASS}`);
    if (existing) return existing;

    const widget = document.createElement("div");
    widget.className = WIDGET_CLASS;
    content.appendChild(widget);
    return widget;
  }

  private cleanupCardWidget(card: HTMLElement): void {
    const content = this.findCardContent(card);
    if (!content) return;

    content.querySelector<HTMLElement>(`.${WIDGET_CLASS}`)?.remove();
  }

  private applyCardLayout(
    content: HTMLElement,
    courseLine: HTMLParagraphElement,
    titleLine: HTMLParagraphElement | null,
    instructorLine: HTMLParagraphElement
  ): void {
    const compact = isFeatureEnabled(COMPACT_CARD_FEATURE_ID);

    content.classList.toggle("bc-paper-ctec-dense-card", compact);
    courseLine.classList.toggle("bc-paper-ctec-course-line", compact);
    titleLine?.classList.toggle("bc-paper-ctec-title-line", compact);
    instructorLine.classList.toggle("bc-paper-ctec-instructor-line", compact);

    let head = content.querySelector<HTMLElement>('[data-bc-paper-role="header"]');
    if (compact) {
      if (!head) {
        head = content.ownerDocument.createElement("div");
        head.dataset.bcPaperRole = "header";
        head.className = "bc-paper-ctec-card-head";
      }

      if (head.parentElement !== content) {
        content.insertBefore(head, titleLine ?? courseLine);
      }

      if (courseLine.parentElement !== head) {
        head.append(courseLine);
      }
      if (instructorLine.parentElement !== head) {
        head.append(instructorLine);
      }

      if (titleLine && titleLine.parentElement !== content) {
        const existingWidget = content.querySelector<HTMLElement>(`.${WIDGET_CLASS}`);
        if (existingWidget) {
          content.insertBefore(titleLine, existingWidget);
        } else {
          content.append(titleLine);
        }
      }
      return;
    }

    if (head) {
      const anchor = head;
      content.insertBefore(courseLine, anchor);
      if (titleLine && titleLine.parentElement !== content) {
        content.insertBefore(titleLine, anchor);
      }
      content.insertBefore(instructorLine, anchor);
      head.remove();
    }
  }

  private buildCourseKey(
    params: PaperCtecTarget["params"] | PaperCtecSideCardContext["params"],
    titleHint: string
  ): string {
    const title = titleHint.toLowerCase().replace(/\s+/g, " ").trim();
    return `${params.subject}:${params.catalogNumber}:${params.instructor.toLowerCase().trim()}:${title}`;
  }

  private compareCardPriority(
    left: PaperCtecCandidate,
    right: PaperCtecCandidate
  ): number {
    const dayDiff = this.getCardDayRank(left.card) - this.getCardDayRank(right.card);
    if (dayDiff !== 0) return dayDiff;

    const topDiff = this.getCardTopRank(left.card) - this.getCardTopRank(right.card);
    if (topDiff !== 0) return topDiff;

    const relation = left.card.compareDocumentPosition(right.card);
    if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  private getCardDayRank(card: HTMLElement): number {
    const grid = card.closest<HTMLElement>(PAPER_CTEC_CONFIG.selectors.scheduleGrid);
    if (!grid) return Number.MAX_SAFE_INTEGER;

    let column: HTMLElement | null = card;
    while (column && column.parentElement !== grid) {
      column = column.parentElement;
    }
    if (!column) return Number.MAX_SAFE_INTEGER;

    const columnIndex = Array.from(grid.children).indexOf(column);
    if (columnIndex < 1) return Number.MAX_SAFE_INTEGER;
    return columnIndex - 1;
  }

  private getCardTopRank(card: HTMLElement): number {
    const top = Number.parseFloat(card.style.top);
    return Number.isFinite(top) ? top : Number.MAX_SAFE_INTEGER;
  }

  private async loadTarget(target: PaperCtecTarget): Promise<PaperCtecWidgetData> {
    try {
      const data = await fetchCtecReportAggregate(
        target.params,
        target.titleHint,
        (message) => {
          this.renderLoadingForKey(target.key, message);
        },
        {
          fetchLimit: PAPER_CTEC_CONFIG.aggregate.recentTerms,
          aggregateLimit: PAPER_CTEC_CONFIG.aggregate.recentTerms
        }
      );

      const widgetData: PaperCtecWidgetData =
        data.state === "found"
          ? { state: "found", aggregate: data.aggregate }
          : data;

      this.resolved.set(target.key, widgetData);
      this.renderForKey(target.key, widgetData);
      return widgetData;
    } catch (error) {
      const widgetData: PaperCtecWidgetData = {
        state: "error",
        message: error instanceof Error ? error.message : String(error)
      };
      this.resolved.set(target.key, widgetData);
      this.renderForKey(target.key, widgetData);
      return widgetData;
    }
  }

  private renderLoadingForKey(key: string, message: string): void {
    this.setProgress(key, message);
    for (const widget of this.findWidgetsByKey(document, key)) {
      renderLoading(widget, message);
    }
  }

  private renderForKey(key: string, data: PaperCtecWidgetData): void {
    for (const widget of this.findWidgetsByKey(document, key)) {
      renderWidget(widget, data);
    }
    this.syncStatusBar(document);
    this.syncSideCard(document);
  }

  private findWidgetsByKey(doc: Document, key: string): HTMLElement[] {
    return Array.from(
      doc.querySelectorAll<HTMLElement>(
        `.${WIDGET_CLASS}[data-bc-paper-ctec-key="${CSS.escape(key)}"]`
      )
    );
  }

  private syncStatusBar(doc: Document): void {
    const status = this.getStatusBarData();
    if (!status) {
      hideStatusBar(doc);
      return;
    }

    renderStatusBar(doc, status, () => {
      this.awaitingAuthRetry = true;
    });
  }

  private getStatusBarData(): PaperCtecStatusBarData | null {
    if (this.visibleKeys.size === 0) return null;

    let foundCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    let frontAuthCount = 0;
    const authKeys = new Set<string>();
    let loginUrl: string | undefined;
    let activeCount = 0;

    for (const key of this.visibleKeys) {
      if (this.inFlight.has(key) || this.analyticsInFlight.has(key)) {
        activeCount += 1;
      }

      const value = this.resolved.get(key);
      if (value?.state === "found") foundCount += 1;
      if (value?.state === "not-found") notFoundCount += 1;
      if (value?.state === "error") errorCount += 1;
      if (value?.state === "auth-required") {
        frontAuthCount += 1;
        authKeys.add(key);
        loginUrl ||= value.loginUrl;
      }

      const analytics = this.analyticsResolved.get(key);
      if (analytics?.state === "auth-required") {
        authKeys.add(key);
        loginUrl ||= analytics.loginUrl;
      }
    }

    const totalCount = this.visibleKeys.size;
    const authCount = authKeys.size;
    const resolvedCount = foundCount + notFoundCount + errorCount + frontAuthCount;
    const latestMessage = this.getLatestProgressMessage();

    if (authCount > 0) {
      return {
        state: "auth-required",
        totalCount,
        resolvedCount,
        activeCount,
        foundCount,
        notFoundCount,
        errorCount,
        authCount,
        latestMessage,
        loginUrl,
        awaitingAuthRetry: this.awaitingAuthRetry
      };
    }

    if (activeCount > 0 || resolvedCount < totalCount) {
      return {
        state: "loading",
        totalCount,
        resolvedCount,
        activeCount,
        foundCount,
        notFoundCount,
        errorCount,
        authCount,
        latestMessage
      };
    }

    return {
      state: "ready",
      totalCount,
      resolvedCount,
      activeCount,
      foundCount,
      notFoundCount,
      errorCount,
      authCount
    };
  }

  private syncSideCard(doc: Document): void {
    const context = this.extractSideCardContext(doc);
    if (!context) return;

    this.captureSideCardUiState(context);
    this.ensureAnalyticsWarmFetch(context);

    const snapshot = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    const analyticsState = this.analyticsResolved.get(context.key);

    renderSideCardAnalytics(
      context,
      {
        selectedTab: this.selectedTabs.get(context.key) ?? "paper",
        selectedEntryId: this.resolveSelectedEntryId(context.key, snapshot),
        recentTerms: PAPER_CTEC_CONFIG.aggregate.recentTerms,
        snapshot,
        loading: this.analyticsInFlight.has(context.key),
        expandedChartKeys: Array.from(this.expandedCharts.get(context.key) ?? []),
        commentQuery: this.commentQueries.get(context.key) ?? "",
        authUrl: analyticsState?.state === "auth-required" ? analyticsState.loginUrl : undefined,
        awaitingAuthRetry: this.awaitingAuthRetry,
        errorMessage: analyticsState?.state === "error" ? analyticsState.message : undefined
      },
      (tab) => {
        this.selectedTabs.set(context.key, tab);
        this.syncSideCard(document);
      },
      (entryId) => {
        this.selectedAnalyticsEntries.set(context.key, entryId);
        this.syncSideCard(document);
      },
      (chartKey) => {
        this.toggleExpandedChart(context.key, chartKey);
        this.syncSideCard(document);
      },
      () => {
        this.awaitingAuthRetry = true;
      }
    );
  }

  private captureSideCardUiState(context: PaperCtecSideCardContext): void {
    const input = context.panel.querySelector<HTMLInputElement>(
      'input[data-bc-paper-ctec-comment-search="1"]'
    );
    if (!input) return;

    const value = input.value.trim();
    if (!value) {
      this.commentQueries.delete(context.key);
      return;
    }

    this.commentQueries.set(context.key, value);
  }

  private toggleExpandedChart(key: string, chartKey: string): void {
    const next = new Set(this.expandedCharts.get(key) ?? []);
    if (next.has(chartKey)) {
      next.delete(chartKey);
    } else {
      next.add(chartKey);
    }

    if (next.size === 0) {
      this.expandedCharts.delete(key);
      return;
    }

    this.expandedCharts.set(key, next);
  }

  private ensureAnalyticsWarmFetch(context: PaperCtecSideCardContext): void {
    const existingState = this.analyticsResolved.get(context.key);
    if (existingState) {
      if (existingState.state === "found" && existingState.analytics.allFetched) {
        return;
      }
      if (existingState.state === "not-found" || existingState.state === "auth-required" || existingState.state === "error") {
        return;
      }
    }

    const frontPageState = this.resolved.get(context.key);
    if (frontPageState?.state === "not-found") {
      this.analyticsResolved.set(context.key, { state: "not-found" });
      return;
    }
    if (frontPageState?.state === "auth-required") {
      this.analyticsResolved.set(context.key, {
        state: "auth-required",
        loginUrl: frontPageState.loginUrl
      });
      return;
    }

    const cached = getCtecCourseAnalyticsSnapshot(
      context.params,
      context.titleHint,
      PAPER_CTEC_CONFIG.aggregate.recentTerms
    );
    if (cached?.allFetched) {
      this.analyticsResolved.set(context.key, { state: "found", analytics: cached });
      return;
    }

    if (this.analyticsInFlight.has(context.key)) return;

    const start = async (): Promise<PaperCtecAnalyticsState> => {
      const currentFrontPageJob = this.inFlight.get(context.key);
      if (currentFrontPageJob) {
        await currentFrontPageJob.catch(() => undefined);
      }

      const result = await fetchCtecCourseAnalytics(
        context.params,
        context.titleHint,
        PAPER_CTEC_CONFIG.aggregate.recentTerms,
        (message) => {
          this.setProgress(context.key, `Warming term history… ${message}`);
        }
      );

      return result.state === "found"
        ? { state: "found", analytics: result.analytics }
        : result;
    };

    const job = start()
      .then((state) => {
        this.analyticsResolved.set(context.key, state);
        return state;
      })
      .catch((error) => {
        const state: PaperCtecAnalyticsState = {
          state: "error",
          message: error instanceof Error ? error.message : String(error)
        };
        this.analyticsResolved.set(context.key, state);
        return state;
      })
      .finally(() => {
        this.analyticsInFlight.delete(context.key);
        if (!this.inFlight.has(context.key)) {
          this.loadingMessages.delete(context.key);
        }
        this.syncStatusBar(document);
        this.syncSideCard(document);
      });

    this.analyticsInFlight.set(context.key, job);
  }

  private extractSideCardContext(doc: Document): PaperCtecSideCardContext | null {
    const panel = doc.querySelector<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardPanel);
    if (!panel) return null;

    const typeText = panel.querySelector<HTMLElement>("p.flex-grow.text-sm.font-bold")
      ?.textContent?.trim() ?? "";
    if (!typeText.startsWith("SECTION INFO")) return null;

    const subjectLabel =
      panel.querySelector<HTMLElement>("p.text-2xl.font-bold")?.textContent?.trim() ?? "";
    const parsed = extractSubjectAndCatalog(subjectLabel);
    if (!parsed) return null;

    const instructorNames = this.getSideCardItemButtonTexts(panel, "INSTRUCTOR");
    const instructor = this.buildInstructorLastNameLabel(instructorNames);
    if (!instructor) return null;

    const subtitle =
      panel.querySelector<HTMLElement>("p.text-lg.font-light")?.textContent?.trim() ?? "";
    const topic = this.getSideCardItemText(panel, "TOPIC");
    const titleHint = topic && subtitle ? `${topic} - ${subtitle}` : subtitle || topic || "";
    const params = {
      classNumber: "",
      subject: parsed.subject,
      catalogNumber: parsed.catalogNumber,
      instructor,
      career: parseInt(parsed.catalogNumber, 10) >= 500 ? "TGS" : "UGRD"
    } as const;

    return {
      panel,
      key: this.buildCourseKey(params, titleHint),
      params,
      titleHint,
      subjectLabel
    };
  }

  private getSideCardItem(panel: HTMLElement, key: string): HTMLElement | null {
    return Array.from(
      panel.querySelectorAll<HTMLElement>(PAPER_CTEC_CONFIG.selectors.sideCardItems)
    ).find((item) => {
      const label = item.querySelector<HTMLElement>("p.tracking-wider")?.textContent?.trim();
      return label === key;
    }) ?? null;
  }

  private getSideCardItemText(panel: HTMLElement, key: string): string {
    const item = this.getSideCardItem(panel, key);
    const valueContainer = item?.children[1];
    return valueContainer instanceof HTMLElement
      ? valueContainer.textContent?.replace(/\s+/g, " ").trim() ?? ""
      : "";
  }

  private getSideCardItemButtonTexts(panel: HTMLElement, key: string): string[] {
    const item = this.getSideCardItem(panel, key);
    if (!item) return [];

    return Array.from(item.querySelectorAll<HTMLButtonElement>("button"))
      .map((button) => button.textContent?.trim() ?? "")
      .filter(Boolean);
  }

  private buildInstructorLastNameLabel(names: string[]): string {
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

  private retryAuthRequired(doc: Document): void {
    for (const [key, value] of Array.from(this.resolved.entries())) {
      if (value.state === "auth-required") {
        this.resolved.delete(key);
      }
    }

    for (const [key, value] of Array.from(this.analyticsResolved.entries())) {
      if (value.state === "auth-required") {
        this.analyticsResolved.delete(key);
      }
    }

    this.awaitingAuthRetry = false;
    hideStatusBar(doc);
    this.run(doc);
  }

  private getLatestProgressMessage(): string | undefined {
    let latest: { message: string; updatedAt: number } | undefined;

    for (const key of this.visibleKeys) {
      const progress = this.loadingMessages.get(key);
      if (!progress) continue;
      if (!latest || progress.updatedAt > latest.updatedAt) {
        latest = progress;
      }
    }

    return latest?.message;
  }

  private setProgress(key: string, message: string): void {
    this.loadingMessages.set(key, { message, updatedAt: Date.now() });
    this.syncStatusBar(document);
  }

  private resolveSelectedEntryId(
    key: string,
    snapshot: ReturnType<typeof getCtecCourseAnalyticsSnapshot>
  ): string | null {
    const availableEntryIds = snapshot?.entries.map((entry) => this.buildAnalyticsEntryId(entry)) ?? [];
    if (availableEntryIds.length === 0) {
      this.selectedAnalyticsEntries.delete(key);
      return null;
    }

    const current = this.selectedAnalyticsEntries.get(key);
    if (current && availableEntryIds.includes(current)) return current;

    const fallback = availableEntryIds[0] ?? null;
    if (fallback) {
      this.selectedAnalyticsEntries.set(key, fallback);
    }
    return fallback;
  }

  private buildAnalyticsEntryId(
    entry: NonNullable<ReturnType<typeof getCtecCourseAnalyticsSnapshot>>["entries"][number]
  ): string {
    return [entry.term, entry.instructor, entry.url ?? entry.description].join("::");
  }

  private ensureFocusRetry(): void {
    if (this.focusListenerAttached) return;

    const retryIfNeeded = () => {
      if (!this.awaitingAuthRetry) return;
      if (document.visibilityState === "hidden") return;
      this.retryAuthRequired(document);
    };

    window.addEventListener("focus", retryIfNeeded);
    document.addEventListener("visibilitychange", retryIfNeeded);
    this.focusListenerAttached = true;
  }
}
