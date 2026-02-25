import type { Augmentation } from "../../framework";
import { acquirePeopleSoftLock, releasePeopleSoftLock } from "../../peoplesoft";

type EnrollmentContext = {
  ACAD_CAREER: string;
  INSTITUTION: string;
  STRM: string;
  EMPLID?: string;
};

type TermOption = {
  value: string;
  term: string;
  career: string;
  label: string;
};

type TermPickerState = {
  termSelectorUrl: string;
  options: TermOption[];
};

const TERM_PAGE_ID = "SSR_SSENRL_TERM";

const CONTEXT_STORAGE_KEY = "better-caesar:enrollment-context:v1";
const TARGET_TERM_VALUE_KEY = "better-caesar:target-term-value";

const CART_LINK_SELECTOR = "a[href*='SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A']";
const TERM_RADIO_SELECTOR =
  "#SSR_DUMMY_RECV1\\$scroll\\$0 input[type='radio'][name^='SSR_DUMMY_RECV1$sels$']";
const CONTINUE_BUTTON_SELECTOR = "#DERIVED_SSS_SCT_SSR_PB_GO";

const STYLE_ID = "better-caesar-enrollment-nav-style";
const TERM_SWITCHER_ID = "better-caesar-term-switcher";
const SPINNER_OVERLAY_ID = "better-caesar-term-spinner-overlay";
const DIRECT_HREF_DATASET_KEY = "betterCaesarDirectHref";
const NAV_LOCK_OWNER = "enrollment-navigation";

export class EnrollmentNavigationAugmentation implements Augmentation {
  readonly id = "enrollment-navigation";

  private clickInterceptorInstalled = false;
  private autoSubmitTriggered = false;
  private termStateCache: { fetchedAt: number; promise: Promise<TermPickerState | null> } | null = null;
  private navigationInFlight = false;

  run(doc: Document = document): void {
    injectStyles(doc);
    this.persistContextFromKnownSources(doc);
    this.rewriteEnrollmentLinks(doc);
    this.installClickInterceptor();

    const pageId = getPageId(doc);
    if (isEnrollmentWorkflowPage(doc, pageId)) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      this.injectTermSwitcher(doc);
    }

    if (pageId === TERM_PAGE_ID) {
      this.autoContinueTermPage(doc);
    }
  }

  private persistContextFromKnownSources(doc: Document): void {
    const candidates = [window.location.href, ...extractUrlsFromInlineScripts(doc)];

    for (const candidate of candidates) {
      const context = parseContext(candidate);
      if (!context) continue;
      persistContext(context);
      return;
    }
  }

  private rewriteEnrollmentLinks(doc: Document): void {
    const context = this.readStoredContext();
    const links = doc.querySelectorAll<HTMLAnchorElement>(CART_LINK_SELECTOR);

    for (const link of Array.from(links)) {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("javascript:")) continue;

      let targetUrl: URL;
      try {
        targetUrl = new URL(href, window.location.origin);
      } catch {
        continue;
      }

      if (context) {
        targetUrl = applyContextToCartUrl(targetUrl, context);
      }

      link.dataset[DIRECT_HREF_DATASET_KEY] = targetUrl.toString();

      const rewritten = isRelativeHref(href)
        ? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
        : targetUrl.toString();

      if (href !== rewritten) {
        link.setAttribute("href", rewritten);
      }
    }
  }

  private installClickInterceptor(): void {
    if (this.clickInterceptorInstalled) return;

    document.addEventListener(
      "click",
      (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.defaultPrevented) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const anchor = event.target.closest<HTMLAnchorElement>(CART_LINK_SELECTOR);
        if (!anchor) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        if (this.navigationInFlight) return;
        this.navigationInFlight = true;

        const directHref = anchor.dataset[DIRECT_HREF_DATASET_KEY];
        const termSelectorUrl = buildTermSelectorUrl(document);

        void this.startLockedNavigation(() => {
          clearTargetTermSelection();
          if (directHref) {
            window.location.assign(directHref);
            return;
          }

          if (termSelectorUrl) {
            window.location.assign(termSelectorUrl);
            return;
          }

          window.location.assign(anchor.href);
        }).finally(() => {
          this.navigationInFlight = false;
        });
      },
      true
    );

    this.clickInterceptorInstalled = true;
  }

  private injectTermSwitcher(doc: Document): void {
    if (doc.getElementById(TERM_SWITCHER_ID)) return;

    const anchor = resolveTermSwitcherAnchor(doc);
    if (!anchor) return;

    const wrapper = doc.createElement("div");
    wrapper.id = TERM_SWITCHER_ID;
    wrapper.className = "better-caesar-term-wrapper";

    const title = doc.createElement("div");
    title.className = "better-caesar-term-helper";
    title.textContent = "Better CAESAR Term Switcher";

    const select = doc.createElement("select");
    select.className = "better-caesar-term-select";
    select.disabled = true;

    const loadingOption = doc.createElement("option");
    loadingOption.value = "";
    loadingOption.textContent = "Loading terms...";
    select.appendChild(loadingOption);

    const status = doc.createElement("div");
    status.className = "better-caesar-term-status";
    status.textContent = "";

    wrapper.appendChild(title);
    wrapper.appendChild(select);
    wrapper.appendChild(status);
    anchor.insertAdjacentElement("afterend", wrapper);

    void this.getTermPickerState().then((state) => {
      select.textContent = "";

      if (!state || state.options.length === 0) {
        const option = doc.createElement("option");
        option.value = "";
        option.textContent = "No terms found";
        select.appendChild(option);
        status.textContent = "Term selector unavailable right now.";
        return;
      }

      for (const optionData of state.options) {
        const option = doc.createElement("option");
        option.value = optionData.value;
        option.textContent = optionData.label;
        select.appendChild(option);
      }

      const currentSignature = readCurrentTermSignature(doc);
      const matchedCurrent = currentSignature
        ? state.options.find(
            (option) =>
              normalizeText(option.term) === normalizeText(currentSignature.term) &&
              normalizeText(option.career) === normalizeText(currentSignature.career)
          )
        : null;

      if (matchedCurrent) {
        select.value = matchedCurrent.value;
      }

      select.disabled = false;
      select.addEventListener("change", () => {
        const selected = state.options.find((item) => item.value === select.value);
        if (!selected) return;

        status.textContent = "Switching term...";
        select.disabled = true;

        setTargetTermSelection(selected.value);

        void this.startLockedNavigation(() => {
          window.location.assign(state.termSelectorUrl);
        }).catch((error: unknown) => {
          const text = error instanceof Error ? error.message : "Unknown error.";
          status.textContent = `Switch failed: ${text}`;
          select.disabled = false;
        });
      });
    });
  }

  private async getTermPickerState(): Promise<TermPickerState | null> {
    const now = Date.now();
    if (this.termStateCache && now - this.termStateCache.fetchedAt < 30_000) {
      return this.termStateCache.promise;
    }

    const promise = this.fetchTermPickerState();
    this.termStateCache = { fetchedAt: now, promise };
    return promise;
  }

  private async fetchTermPickerState(): Promise<TermPickerState | null> {
    const termSelectorUrl = buildTermSelectorUrl(document);
    if (!termSelectorUrl) return null;

    const res = await fetch(termSelectorUrl, {
      method: "GET",
      credentials: "include"
    });

    if (!res.ok) return null;

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    if (getPageId(doc) !== TERM_PAGE_ID) {
      const context = extractContextFromHtml(html) ?? parseContext(res.url);
      if (context) persistContext(context);
      return null;
    }

    const radios = Array.from(doc.querySelectorAll<HTMLInputElement>(TERM_RADIO_SELECTOR)).filter(
      (radio) => !radio.disabled && radio.name
    );

    if (radios.length === 0) return null;

    const options: TermOption[] = [];
    for (const radio of radios) {
      const rowIndex = radio.id.match(/\$(\d+)\$\$0$/)?.[1] ?? radio.value;
      const term = textById(doc, `TERM_CAR$${rowIndex}`);
      const career = textById(doc, `CAREER$${rowIndex}`);
      const label = [term, career].filter(Boolean).join(" | ") || `Term ${radio.value}`;

      options.push({
        value: radio.value,
        term,
        career,
        label
      });
    }

    return { termSelectorUrl, options };
  }

  private autoContinueTermPage(doc: Document): void {
    if (this.autoSubmitTriggered) return;

    const radios = Array.from(doc.querySelectorAll<HTMLInputElement>(TERM_RADIO_SELECTOR)).filter(
      (radio) => !radio.disabled
    );
    const continueButton = doc.querySelector<HTMLInputElement>(CONTINUE_BUTTON_SELECTOR);
    if (radios.length === 0 || !continueButton || continueButton.disabled) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      return;
    }

    const targetValue = getTargetTermSelection();
    const selectedRadio =
      (targetValue ? radios.find((radio) => radio.value === targetValue) : null) ??
      radios[radios.length - 1] ??
      null;

    if (!selectedRadio) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      return;
    }

    this.autoSubmitTriggered = true;
    clearTargetTermSelection();
    showTermSpinnerOverlay(doc);

    selectedRadio.click();
    window.setTimeout(() => {
      continueButton.click();
    }, 40);

    // Safety release if CAESAR does not navigate away.
    window.setTimeout(() => {
      if (getPageId(document) === TERM_PAGE_ID) {
        releasePeopleSoftLock(NAV_LOCK_OWNER);
      }
    }, 10_000);
  }

  private async startLockedNavigation(navigate: () => void): Promise<void> {
    await acquirePeopleSoftLock(NAV_LOCK_OWNER, {
      waitForIdle: true,
      abortActive: true,
      ttlMs: 120_000
    });
    try {
      navigate();
    } catch (error) {
      releasePeopleSoftLock(NAV_LOCK_OWNER);
      throw error;
    }
  }

  private readStoredContext(): EnrollmentContext | null {
    try {
      const raw = window.localStorage.getItem(CONTEXT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<EnrollmentContext>;
      if (!parsed.ACAD_CAREER || !parsed.INSTITUTION || !parsed.STRM) return null;

      return {
        ACAD_CAREER: parsed.ACAD_CAREER,
        INSTITUTION: parsed.INSTITUTION,
        STRM: parsed.STRM,
        EMPLID: parsed.EMPLID
      };
    } catch {
      return null;
    }
  }
}

function persistContext(context: EnrollmentContext): void {
  try {
    window.localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage errors.
  }
}

function parseContext(pathOrUrl: string): EnrollmentContext | null {
  let url: URL;
  try {
    url = new URL(pathOrUrl, window.location.origin);
  } catch {
    return null;
  }

  const ACAD_CAREER = url.searchParams.get("ACAD_CAREER") ?? "";
  const INSTITUTION = url.searchParams.get("INSTITUTION") ?? "";
  const STRM = url.searchParams.get("STRM") ?? "";
  const EMPLID = url.searchParams.get("EMPLID") ?? "";

  if (!ACAD_CAREER || !INSTITUTION || !STRM) return null;
  return {
    ACAD_CAREER,
    INSTITUTION,
    STRM,
    ...(EMPLID ? { EMPLID } : {})
  };
}

function extractContextFromHtml(html: string): EnrollmentContext | null {
  const pattern = /(?:strCurrUrl|sHistURL|refererURL)\s*=\s*['\"]([^'\"]+)['\"]/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const candidate = match[1]?.trim();
    if (!candidate) continue;
    const context = parseContext(candidate);
    if (context) return context;
  }

  return null;
}

function getPageId(doc: Document): string | null {
  const pageInfo = doc.querySelector<HTMLElement>("#pt_pageinfo_win0");
  return pageInfo?.getAttribute("Page") ?? null;
}

function getComponentId(doc: Document): string | null {
  const pageInfo = doc.querySelector<HTMLElement>("#pt_pageinfo_win0");
  return pageInfo?.getAttribute("Component") ?? null;
}

function isEnrollmentWorkflowPage(doc: Document, pageId: string | null): boolean {
  if (pageId === TERM_PAGE_ID) return false;
  const component = getComponentId(doc);
  const value = (component ?? pageId ?? "").toUpperCase();
  if (!value.startsWith("SSR_SSENRL_")) return false;

  return (
    value === "SSR_SSENRL_CART" ||
    value === "SSR_SSENRL_DROP" ||
    value === "SSR_SSENRL_SWAP" ||
    value === "SSR_SSENRL_EDIT" ||
    value === "SSR_SSENRL_UPDT"
  );
}

function extractUrlsFromInlineScripts(doc: Document): string[] {
  const urls = new Set<string>();
  const scriptEls = doc.querySelectorAll("script:not([src])");
  const pattern = /(?:strCurrUrl|sHistURL|refererURL)\s*=\s*['\"]([^'\"]+)['\"]/g;

  for (const script of Array.from(scriptEls)) {
    const source = script.textContent ?? "";
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const value = match[1]?.trim();
      if (!value) continue;
      urls.add(value);
    }
  }

  return Array.from(urls);
}

function buildTermSelectorUrl(doc: Document): string | null {
  const pageInfo = doc.querySelector<HTMLElement>("#pt_pageinfo_win0");
  const currentPage = pageInfo?.getAttribute("Page") ?? "";

  if (currentPage === TERM_PAGE_ID) {
    return window.location.href;
  }

  // Prefer term selection within the current enrollment workflow page so
  // continue returns to the same flow (Drop/Swap/Edit/Cart), not always Cart.
  if (isEnrollmentWorkflowPage(doc, currentPage)) {
    try {
      const currentUrl = new URL(window.location.href);
      if (/SSR_SSENRL_[^.]+\.GBL/i.test(currentUrl.pathname)) {
        currentUrl.searchParams.set("Page", currentPage);
        if (!currentUrl.searchParams.get("Action")) {
          currentUrl.searchParams.set("Action", "A");
        }
        if (!currentUrl.searchParams.get("NavColl")) {
          currentUrl.searchParams.set("NavColl", "true");
        }
        if (!currentUrl.searchParams.get("ICAGTarget")) {
          currentUrl.searchParams.set("ICAGTarget", "start");
        }
        if (!currentUrl.searchParams.get("ICAJAXTrf")) {
          currentUrl.searchParams.set("ICAJAXTrf", "true");
        }
        currentUrl.searchParams.set("PAGE", TERM_PAGE_ID);
        return currentUrl.toString();
      }
    } catch {
      // Fall through to alternate discovery paths.
    }
  }

  const breadcrumbHref = doc.querySelector<HTMLAnchorElement>("#pthnavbccrefanc_SSR_SSENRL_CART_GBL")?.href;
  const cartNavHrefs = Array.from(
    doc.querySelectorAll<HTMLAnchorElement>("a[href*='SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART']")
  ).map((link) => link.href);
  const formAction = doc.querySelector<HTMLFormElement>("form[name='win0']")?.action;
  const candidates = Array.from(
    new Set([breadcrumbHref, ...cartNavHrefs, window.location.href, formAction].filter(Boolean))
  ) as string[];

  for (const candidate of candidates) {
    let url: URL;
    try {
      url = new URL(candidate, window.location.origin);
    } catch {
      continue;
    }

    if (!/SSR_SSENRL_CART\.GBL/i.test(url.pathname)) continue;

    if (!url.searchParams.get("Page")) {
      url.searchParams.set("Page", "SSR_SSENRL_CART");
    }
    if (!url.searchParams.get("NavColl")) {
      url.searchParams.set("NavColl", "true");
    }
    if (!url.searchParams.get("ICAGTarget")) {
      url.searchParams.set("ICAGTarget", "start");
    }
    if (!url.searchParams.get("ICAJAXTrf")) {
      url.searchParams.set("ICAJAXTrf", "true");
    }

    url.searchParams.set("PAGE", TERM_PAGE_ID);
    return url.toString();
  }

  const context = readContextFromCandidates([window.location.href, formAction, ...candidates]);
  if (!context) return null;

  const baseCandidate = candidates[0] ?? window.location.href;
  let fallbackUrl: URL;
  try {
    fallbackUrl = new URL(baseCandidate, window.location.origin);
  } catch {
    return null;
  }

  if (/SA_LEARNER_SERVICES(?:_2)?\.[^.]+\.GBL/i.test(fallbackUrl.pathname)) {
    fallbackUrl.pathname = fallbackUrl.pathname.replace(
      /SA_LEARNER_SERVICES(?:_2)?\.[^.]+\.GBL/i,
      "SA_LEARNER_SERVICES_2.SSR_SSENRL_CART.GBL"
    );
  }

  fallbackUrl.searchParams.set("Page", "SSR_SSENRL_CART");
  fallbackUrl.searchParams.set("Action", "A");
  fallbackUrl.searchParams.set("ACAD_CAREER", context.ACAD_CAREER);
  fallbackUrl.searchParams.set("INSTITUTION", context.INSTITUTION);
  fallbackUrl.searchParams.set("STRM", context.STRM);
  if (context.EMPLID) {
    fallbackUrl.searchParams.set("EMPLID", context.EMPLID);
  }
  fallbackUrl.searchParams.set("NavColl", "true");
  fallbackUrl.searchParams.set("ICAGTarget", "start");
  fallbackUrl.searchParams.set("ICAJAXTrf", "true");
  fallbackUrl.searchParams.set("PAGE", TERM_PAGE_ID);
  return fallbackUrl.toString();

  return null;
}

function readContextFromCandidates(candidates: Array<string | null | undefined>): EnrollmentContext | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const context = parseContext(candidate);
    if (context) return context;
  }
  return null;
}

function textById(doc: Document, id: string): string {
  const element = doc.getElementById(id);
  if (!element) return "";
  return normalizeText(element.textContent ?? "");
}

function readCurrentTermSignature(doc: Document): {
  term: string;
  career: string;
} | null {
  const text = textById(doc, "DERIVED_REGFRM1_SSR_STDNTKEY_DESCR$11$");
  if (!text) return null;

  const [term = "", career = ""] = text.split("|").map((part) => part.trim());
  if (!term || !career) return null;

  return { term, career };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function applyContextToCartUrl(baseUrl: URL, context: EnrollmentContext): URL {
  const url = new URL(baseUrl.toString());
  if (!/SSR_SSENRL_CART\.GBL/i.test(url.pathname)) return url;

  url.searchParams.set("Page", "SSR_SSENRL_CART");
  url.searchParams.set("Action", "A");
  url.searchParams.set("ACAD_CAREER", context.ACAD_CAREER);
  url.searchParams.set("INSTITUTION", context.INSTITUTION);
  url.searchParams.set("STRM", context.STRM);
  if (context.EMPLID) {
    url.searchParams.set("EMPLID", context.EMPLID);
  }

  return url;
}

function isRelativeHref(href: string): boolean {
  return href.startsWith("/") || href.startsWith("?") || !/^https?:\/\//i.test(href);
}

function setTargetTermSelection(value: string): void {
  try {
    window.sessionStorage.setItem(TARGET_TERM_VALUE_KEY, value);
  } catch {
    // Ignore storage errors.
  }
}

function getTargetTermSelection(): string | null {
  try {
    return window.sessionStorage.getItem(TARGET_TERM_VALUE_KEY);
  } catch {
    return null;
  }
}

function clearTargetTermSelection(): void {
  try {
    window.sessionStorage.removeItem(TARGET_TERM_VALUE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function showTermSpinnerOverlay(doc: Document): void {
  if (doc.getElementById(SPINNER_OVERLAY_ID)) return;

  const overlay = doc.createElement("div");
  overlay.id = SPINNER_OVERLAY_ID;
  overlay.className = "better-caesar-term-overlay";

  const spinner = doc.createElement("div");
  spinner.className = "better-caesar-term-spinner";

  const text = doc.createElement("div");
  text.className = "better-caesar-term-overlay-text";
  text.textContent = "Switching term...";

  overlay.appendChild(spinner);
  overlay.appendChild(text);
  const host = doc.body ?? doc.documentElement;
  if (!host) return;
  host.appendChild(overlay);
}

function resolveTermSwitcherAnchor(doc: Document): Element | null {
  const changeTermButton = doc.querySelector<HTMLInputElement>("#DERIVED_SSS_SCT_SSS_TERM_LINK");
  if (changeTermButton) {
    return (
      changeTermButton.closest("div[id^='win0divDERIVED_SSS_SCT_SSS_TERM_LINK']") ??
      changeTermButton.parentElement
    );
  }

  return (
    doc.querySelector("#win0divDERIVED_REGFRM1_SSR_STDNTKEY_DESCR") ??
    doc.querySelector("#win0divDERIVED_REGFRM1_TITLE1") ??
    doc.querySelector(".PAPAGETITLE")?.parentElement ??
    null
  );
}

function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .better-caesar-term-wrapper {
      margin-top: 6px;
      display: grid;
      gap: 4px;
      justify-items: start;
      max-width: 320px;
    }
    .better-caesar-term-helper {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      color: #66023c;
    }
    .better-caesar-term-select {
      width: 100%;
      background: #ffffff;
      color: #3f0126;
      border: 1px solid #66023c;
      border-radius: 6px;
      font-size: 12px;
      padding: 6px 8px;
    }
    .better-caesar-term-select:focus-visible {
      outline: 2px solid #8a2f5b;
      outline-offset: 2px;
    }
    .better-caesar-term-status {
      min-height: 14px;
      font-size: 10px;
      color: #66023c;
    }
    .better-caesar-term-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.98);
    }
    .better-caesar-term-spinner {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid #e1c7d5;
      border-top-color: #66023c;
      animation: better-caesar-spin 0.8s linear infinite;
    }
    .better-caesar-term-overlay-text {
      color: #66023c;
      font-size: 14px;
      font-weight: 700;
    }
    @keyframes better-caesar-spin {
      to { transform: rotate(360deg); }
    }
  `;

  const host = doc.head ?? doc.documentElement ?? doc.body;
  if (!host) return;
  host.appendChild(style);
}
