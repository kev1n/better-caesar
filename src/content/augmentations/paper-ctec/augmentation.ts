import type { Augmentation } from "../../framework";
import { extractSubjectAndCatalog } from "../ctec-links/helpers";
import { fetchCtecReportAggregate } from "../ctec-links/reports";
import { WIDGET_CLASS } from "./constants";
import type { PaperCtecStatusBarData, PaperCtecTarget, PaperCtecWidgetData } from "./types";
import { hideStatusBar, injectStyles, renderLoading, renderStatusBar, renderWidget } from "./ui";

export class PaperCtecAugmentation implements Augmentation {
  readonly id = "paper-ctec";

  private readonly inFlight = new Map<string, Promise<PaperCtecWidgetData>>();
  private readonly resolved = new Map<string, PaperCtecWidgetData>();
  private readonly loadingMessages = new Map<string, { message: string; updatedAt: number }>();
  private visibleKeys = new Set<string>();
  private awaitingAuthRetry = false;
  private focusListenerAttached = false;

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;

    injectStyles();
    this.ensureFocusRetry();

    const targets = this.collectTargets(doc);
    this.visibleKeys = new Set(targets.map((target) => this.targetKey(target)));

    for (const target of targets) {
      const key = this.targetKey(target);
      target.widget.dataset.bcPaperCtecKey = key;

      const resolved = this.resolved.get(key);
      if (resolved) {
        renderWidget(target.widget, resolved);
        continue;
      }

      if (!this.inFlight.has(key)) {
        this.setProgress(key, "Connecting to Northwestern CTEC…");
        renderLoading(target.widget);
        const job = this.loadTarget(target, key);
        this.inFlight.set(key, job);
        void job.finally(() => {
          this.inFlight.delete(key);
          this.loadingMessages.delete(key);
          this.syncStatusBar(document);
        });
        continue;
      }

      if (!target.widget.textContent?.trim()) {
        renderLoading(target.widget);
      }
    }

    this.syncStatusBar(doc);
  }

  private appliesToPage(doc: Document): boolean {
    const host = window.location.hostname;
    if (host !== "www.paper.nu" && host !== "paper.nu") return false;
    return !!doc.querySelector(".schedule-grid-cols");
  }

  private collectTargets(doc: Document): PaperCtecTarget[] {
    const targets: PaperCtecTarget[] = [];

    for (const card of Array.from(
      doc.querySelectorAll<HTMLElement>(".schedule-grid-cols div.absolute.z-10.rounded-lg")
    )) {
      const target = this.parseTarget(card);
      if (target) targets.push(target);
    }

    return targets;
  }

  private parseTarget(card: HTMLElement): PaperCtecTarget | null {
    const content = this.findCardContent(card);
    if (!content) return null;

    const paragraphs = Array.from(content.children).filter(
      (child): child is HTMLParagraphElement => child instanceof HTMLParagraphElement
    );
    const courseLine = paragraphs[0];
    const titleLine = paragraphs[1];
    const instructorLine = paragraphs[2];

    if (!courseLine || !instructorLine) return null;

    const parsed = extractSubjectAndCatalog(courseLine.textContent ?? "");
    if (!parsed) return null;

    const instructor = instructorLine.textContent?.trim() ?? "";
    if (!instructor) return null;

    const catalogNumber = parsed.catalogNumber;
    const widget = this.ensureWidget(content);

    return {
      card,
      widget,
      titleHint: titleLine?.textContent?.trim() ?? "",
      params: {
        classNumber: "",
        subject: parsed.subject,
        catalogNumber,
        instructor,
        career: parseInt(catalogNumber, 10) >= 500 ? "TGS" : "UGRD"
      }
    };
  }

  private findCardContent(card: HTMLElement): HTMLElement | null {
    const relative = Array.from(card.children).find(
      (child): child is HTMLDivElement =>
        child instanceof HTMLDivElement && child.classList.contains("relative")
    );
    if (!relative) return null;

    return Array.from(relative.children).find(
      (child): child is HTMLDivElement => child instanceof HTMLDivElement
    ) ?? null;
  }

  private ensureWidget(content: HTMLElement): HTMLElement {
    const existing = content.querySelector<HTMLElement>(`.${WIDGET_CLASS}`);
    if (existing) return existing;

    const widget = document.createElement("div");
    widget.className = WIDGET_CLASS;
    content.appendChild(widget);
    return widget;
  }

  private targetKey(target: PaperCtecTarget): string {
    const { subject, catalogNumber, instructor } = target.params;
    const title = target.titleHint.toLowerCase().replace(/\s+/g, " ").trim();
    return `${subject}:${catalogNumber}:${instructor.toLowerCase().trim()}:${title}`;
  }

  private async loadTarget(
    target: PaperCtecTarget,
    key: string
  ): Promise<PaperCtecWidgetData> {
    try {
      const data = await fetchCtecReportAggregate(
        target.params,
        target.titleHint,
        (message) => {
          this.renderLoadingForKey(key, message);
        }
      );

      const widgetData: PaperCtecWidgetData =
        data.state === "found"
          ? { state: "found", aggregate: data.aggregate }
          : data;

      this.loadingMessages.delete(key);
      this.resolved.set(key, widgetData);
      this.renderForKey(key, widgetData);
      return widgetData;
    } catch (error) {
      const widgetData: PaperCtecWidgetData = {
        state: "error",
        message: error instanceof Error ? error.message : String(error)
      };
      this.loadingMessages.delete(key);
      this.resolved.set(key, widgetData);
      this.renderForKey(key, widgetData);
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

  private retryAuthRequired(doc: Document): void {
    for (const [key, value] of Array.from(this.resolved.entries())) {
      if (value.state === "auth-required") {
        this.resolved.delete(key);
      }
    }

    this.awaitingAuthRetry = false;
    hideStatusBar(doc);
    this.run(doc);
  }

  private getStatusBarData(): PaperCtecStatusBarData | null {
    if (this.visibleKeys.size === 0) return null;

    let foundCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    let authCount = 0;
    let activeCount = 0;
    let loginUrl: string | undefined;

    for (const key of this.visibleKeys) {
      if (this.inFlight.has(key)) activeCount += 1;

      const value = this.resolved.get(key);
      if (!value) continue;

      if (value.state === "found") {
        foundCount += 1;
        continue;
      }

      if (value.state === "not-found") {
        notFoundCount += 1;
        continue;
      }

      if (value.state === "error") {
        errorCount += 1;
        continue;
      }

      authCount += 1;
      loginUrl ||= value.loginUrl;
    }

    const totalCount = this.visibleKeys.size;
    const resolvedCount = foundCount + notFoundCount + errorCount + authCount;
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
