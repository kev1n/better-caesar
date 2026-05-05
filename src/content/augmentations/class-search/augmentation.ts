import {
  initCartCache,
  lookupBySignature,
  lookupClassNumber,
  readTermCart,
  recordOptimisticAdd,
  subscribe as subscribeCartCache,
  type CartLookupHit
} from "../../cart-cache";
import type { Augmentation } from "../../framework";
import { isRetryablePeopleSoftTaskError, lookupClass } from "../../peoplesoft";
import {
  buildPeopleSoftCreditToast,
  formatPsCreditsWarning,
  initStorage as initSeatsNotesStorage,
  pruneEmptySeatsCache,
  readCachedEntry as readSeatsNotesCache,
  tryConsumePeopleSoftCredit,
  writeCachedEntry as writeSeatsNotesCache
} from "../seats-notes/storage";
import { toSeatsNotesResult, toFailure as seatsNotesFailure } from "../seats-notes/parser";
import { showToast } from "../../../shared/toast";

import {
  addSectionToCart,
  continueCartAddWithRelated,
  isCaesarAuthRequiredError,
  matchCaesarGroup,
  matchCaesarSection,
  searchCaesarCatalog,
  type CaesarSection,
  type CaesarSearchResult,
  type RelatedSectionOption
} from "./caesar-search";
import { createAuthRecovery, withAuthRecovery, type AuthRecovery } from "./auth-recovery";
import { createCartButtonRegistry } from "./cart-button-registry";
import {
  createAddToCartController,
  type AddToCartContext,
  type AddToCartController
} from "./controllers/add-to-cart";
import {
  createRelatedPickerController,
  type RelatedPickerController
} from "./controllers/related-picker";
import { createSearchOrchestrator } from "./controllers/search-orchestrator";
import { createTabController } from "./controllers/tab-controller";
import { createLiveDataStore, type LiveDataStore } from "./live-data-store";
import { bareCatalogNumber } from "./catalog-format";
import {
  initCatalogCache,
  readCatalogCache,
  writeCatalogCache
} from "./catalog-cache";
import {
  applyFilters,
  buildCatalogIndex
} from "./filter";
import {
  getDataMapInfo,
  getPlanCourses,
  getSubjects,
  getTermCourses,
  listTerms,
  pruneStalePaperCaches,
  type DataMapInfo,
  type PaperCourse,
  type PaperSection,
  type SubjectInfo
} from "./paper-data";
import {
  isSearchEntryPage,
  readCareerFromNativeForm,
  readInstitutionFromNativeForm,
  readTermFromNativeForm
} from "./page-detection";
import { STYLE_ID as CLASS_SEARCH_STYLE_ID, ensureStyles } from "./styles";
import {
  type MountedState,
  type ResultRow,
  type SearchFilters,
  type TabId
} from "./types";
import type { PaperTermCourse } from "./paper-data";
import { renderMyClassesView } from "./views/my-classes-view";
import { applyLiveDataToCard, renderCourseCard } from "./views/course-card";
import { renderSectionRow } from "./views/section-row";
import {
  renderSectionDetail,
  renderSectionDetailLoading,
  type SectionDetailData
} from "./views/section-detail";

const ROOT_ID = "better-caesar-class-search-root";
const TABS_ID = "better-caesar-class-search-tabs";

const INSTITUTION_DEFAULT = "NWUNV";

const CART_URL =
  "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A";

export class ClassSearchAugmentation implements Augmentation {
  readonly id = "class-search";

  private mounted: MountedState | null = null;
  private mountInProgress = false;
  // Mutex + handshake for the SSO popup re-auth flow. Lives at the
  // augmentation level (not per-mount) so a Load CAESAR + Add-to-cart
  // racing through `getEntryFormState()` from different DOM mount cycles
  // still coalesce onto a single popup.
  private authRecovery: AuthRecovery = createAuthRecovery({
    chromeRuntime: chrome.runtime,
    windowLocation: { assign: (url: string | URL) => window.location.assign(url) }
  });

  // Picker UI controller. Owns its own DOM (the inline <li> appended below
  // the section row). The cart-add controller resolves Promise<option | null>
  // through it so the cart-add wizard can run as one linear async flow.
  private relatedPicker: RelatedPickerController = createRelatedPickerController({
    doc: document
  });

  // Cart-add click handler. Talks to caesar-search/flow.ts under the hood,
  // drives the button state machine, and recurses through the picker on
  // needs-related results.
  private addToCartCtrl: AddToCartController = createAddToCartController({
    authRecovery: this.authRecovery,
    consumeCredit: (owner) => this.consumePsCredit(owner),
    formatPsWarning: () => formatPsCreditsWarning(),
    showToast,
    recordOptimisticAdd,
    addSectionToCart,
    continueCartAddWithRelated,
    openRelatedPicker: (button, options, ctx) =>
      this.openRelatedPickerForAdd(button, options, ctx),
    closeRelatedPicker: () => this.relatedPicker.close(),
    cartUrl: CART_URL
  });

  constructor() {
    void initSeatsNotesStorage().then(() => pruneEmptySeatsCache());
    void pruneStalePaperCaches();
    void initCartCache();
    void initCatalogCache();
  }

  cleanup(doc: Document = document): void {
    this.unmount(doc);
    this.authRecovery.dispose();
  }

  // Build a LiveDataStore wired to the catalog disk cache and the CAESAR
  // fetch path. The store keys on `${termId}|${subject}|${bareCatalog}` —
  // the fetch dep splits the key back into search params, so the store
  // itself stays generic.
  private createMountLiveDataStore(institution: string): LiveDataStore {
    return createLiveDataStore({
      diskRead: (key) => {
        const parts = parseLiveCacheKey(key);
        if (!parts) return null;
        const hit = readCatalogCache(parts.termId, parts.subject, parts.bareCatalog);
        return hit ? { status: "ready", result: hit.result } : null;
      },
      diskWrite: (key, cache) => {
        if (cache.status !== "ready" || !cache.result) return;
        const parts = parseLiveCacheKey(key);
        if (!parts) return;
        writeCatalogCache(parts.termId, parts.subject, parts.bareCatalog, cache.result);
      },
      fetch: async (key) => {
        const parts = parseLiveCacheKey(key);
        if (!parts) return null;
        return await withAuthRecovery(this.authRecovery, isCaesarAuthRequiredError, () =>
          searchCaesarCatalog({
            termId: parts.termId,
            institution,
            subject: parts.subject,
            bareCatalog: parts.bareCatalog
          })
        );
      }
    });
  }

  // Shared CAESAR PS rate gate. Each user-initiated PS chain (Load CAESAR,
  // Details, Add to cart, related-section pick, detail Refresh) consumes
  // one credit from the seats-notes pool so a single-cap budget covers
  // every CAESAR PS surface in the extension. `owner` is just for the
  // background worker's credit-usage log.
  private consumePsCredit(owner: string): boolean {
    const credit = tryConsumePeopleSoftCredit(Date.now(), `class-search-${owner}`);
    if (!credit.ok) {
      showToast(buildPeopleSoftCreditToast(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return false;
    }
    return true;
  }

  run(doc: Document = document): void {
    if (!isSearchEntryPage(doc)) {
      this.unmount(doc);
      return;
    }

    if (this.mounted && this.mounted.doc === doc && doc.getElementById(ROOT_ID) && doc.getElementById(TABS_ID)) {
      // Re-apply visibility in case PeopleSoft swapped DOM under us.
      this.mounted.tabs.applyVisibility(this.mounted.panelEl);
      return;
    }

    if (this.mountInProgress) return;
    void this.mount(doc);
  }

  private async mount(doc: Document): Promise<void> {
    this.mountInProgress = true;
    try {
      ensureStyles(doc);

      const placeholder = ensureRoot(doc);
      placeholder.innerHTML = "";
      placeholder.appendChild(buildLoadingShell(doc));

      let info: DataMapInfo;
      let subjects: Record<string, SubjectInfo>;
      let planCourses: PaperCourse[];
      try {
        [info, subjects, planCourses] = await Promise.all([
          getDataMapInfo(),
          getSubjects(),
          getPlanCourses()
        ]);
      } catch (error) {
        if (doc.getElementById(ROOT_ID)) {
          renderFatalError(
            placeholder,
            doc,
            error instanceof Error ? error.message : String(error)
          );
        }
        return;
      }

      if (!doc.getElementById(ROOT_ID) || !isSearchEntryPage(doc)) {
        return;
      }

      const career = readCareerFromNativeForm(doc) ?? "UGRD";
      const institution = readInstitutionFromNativeForm(doc) ?? INSTITUTION_DEFAULT;
      const initialTerm = readTermFromNativeForm(doc) ?? info.latest;

      const liveData = this.createMountLiveDataStore(institution);
      const tabs = createTabController({ doc });
      const searchOrchestrator = createSearchOrchestrator<PaperTermCourse[]>({
        getActiveTerm: () => this.mounted?.filters.termId ?? initialTerm,
        fetchTermCourses: (termId) => getTermCourses(termId),
        formatTermName: (termId) => info.terms[termId]?.name ?? termId,
        onSearchReady: (termId, courses) => {
          if (this.mounted) this.runSearchWithCourses(this.mounted, termId, courses);
        },
        onStatus: (status, message) => {
          if (this.mounted) this.setStatus(this.mounted, status, message);
        }
      });
      const state: MountedState = {
        doc,
        root: placeholder,
        panelEl: doc.createElement("div"),
        resultsEl: doc.createElement("div"),
        statusEl: doc.createElement("div"),
        filters: {
          termId: initialTerm,
          query: ""
        },
        info,
        subjects,
        catalogIndex: buildCatalogIndex(planCourses),
        career,
        institution,
        searchOrchestrator,
        liveData,
        tabs,
        cartButtons: createCartButtonRegistry(),
        cartUnsubscribe: null
      };
      this.mounted = state;
      // Cart cache pushes here when CAESAR cart-page reconcile lands or
      // another tab made an optimistic add. Repaint Add-button badges and
      // re-render the empty-state "Your classes" cards if showing.
      state.cartUnsubscribe = subscribeCartCache(() => {
        this.repaintAllCartButtons(state);
        if (!hasAnyFilter(state.filters)) {
          this.renderMyClassesView(state);
        }
      });

      placeholder.innerHTML = "";
      placeholder.appendChild(this.buildTabs(state));
      state.panelEl.id = "better-caesar-class-search-panel";
      state.panelEl.appendChild(this.buildShell(state));
      placeholder.appendChild(state.panelEl);

      state.tabs.applyVisibility(state.panelEl);

      void state.searchOrchestrator.loadTermData(state.filters.termId);
    } finally {
      this.mountInProgress = false;
    }
  }

  private unmount(doc: Document): void {
    this.mounted?.searchOrchestrator.cancelPending();
    this.mounted?.cartUnsubscribe?.();
    this.mounted?.cartButtons.clear();
    this.mounted?.liveData.clear();
    this.mounted?.tabs.cleanup(doc);
    const root = doc.getElementById(ROOT_ID);
    if (root) root.remove();
    doc.getElementById(CLASS_SEARCH_STYLE_ID)?.remove();
    this.mounted = null;
  }

  // ── Tab bar ───────────────────────────────────────────────────────────────

  private buildTabs(state: MountedState): HTMLElement {
    const { doc } = state;
    const wrap = doc.createElement("div");
    wrap.id = TABS_ID;
    wrap.className = "bc-cs-tabs";

    const better = this.buildTabButton(state, "better", "Sharper Search");
    const classic = this.buildTabButton(state, "classic", "Classic CAESAR");
    wrap.append(better, classic);
    return wrap;
  }

  private buildTabButton(state: MountedState, id: TabId, label: string): HTMLButtonElement {
    const { doc } = state;
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "bc-cs-tab";
    btn.dataset.tab = id;
    btn.textContent = label;
    btn.dataset.active = state.tabs.getActive() === id ? "true" : "false";
    btn.addEventListener("click", () => {
      if (state.tabs.getActive() === id) return;
      this.switchTab(state, id);
    });
    return btn;
  }

  // Single source of truth for tab switching: flips controller state, syncs
  // the button data-active attributes, then re-applies panel visibility.
  // Used by both the tab button click handlers and the cart-add controller's
  // `openClassicTab` callback.
  private switchTab(state: MountedState, id: TabId): void {
    state.tabs.setActive(id);
    const tabsEl = state.doc.getElementById(TABS_ID);
    tabsEl?.querySelectorAll<HTMLButtonElement>("button.bc-cs-tab").forEach((el) => {
      el.dataset.active = el.dataset.tab === id ? "true" : "false";
    });
    state.tabs.applyVisibility(state.panelEl);
  }

  // ── Shell ─────────────────────────────────────────────────────────────────

  private buildShell(state: MountedState): HTMLElement {
    const { doc } = state;

    const root = doc.createElement("div");
    root.className = "bc-cs-shell";

    const header = doc.createElement("div");
    header.className = "bc-cs-header";
    const title = doc.createElement("h1");
    title.className = "bc-cs-title";
    title.textContent = "Search for Classes";
    const subtitle = doc.createElement("div");
    subtitle.className = "bc-cs-subtitle";
    subtitle.innerHTML = `Catalog from <a href="https://paper.nu" target="_blank" rel="noopener">paper.nu</a> · live status fetched from CAESAR on demand`;
    header.append(title, subtitle);

    const card = doc.createElement("div");
    card.className = "bc-cs-card";

    const form = doc.createElement("div");
    form.className = "bc-cs-form";
    form.append(this.buildQueryField(state), this.buildTermField(state));

    state.statusEl.className = "bc-cs-status";
    state.statusEl.textContent = "";

    state.resultsEl.className = "bc-cs-results";

    card.append(form, state.statusEl);

    root.append(header, card, state.resultsEl);
    return root;
  }

  // ── Form fields ───────────────────────────────────────────────────────────

  private buildQueryField(state: MountedState): HTMLDivElement {
    const { doc } = state;
    const field = doc.createElement("div");
    field.className = "bc-cs-field bc-cs-field-query";
    const label = doc.createElement("label");
    label.htmlFor = "bc-cs-query";
    label.textContent = "Search";
    const input = doc.createElement("input");
    input.id = "bc-cs-query";
    input.className = "bc-cs-input bc-cs-input-query";
    input.placeholder = "comp_sci 111, machine learning, stat 21x, …";
    input.autocomplete = "off";
    input.addEventListener("input", () => {
      state.filters.query = input.value;
      state.searchOrchestrator.scheduleSearch();
    });
    field.append(label, input);
    return field;
  }

  private buildTermField(state: MountedState): HTMLDivElement {
    const { doc } = state;
    const field = doc.createElement("div");
    field.className = "bc-cs-field";
    const label = doc.createElement("label");
    label.htmlFor = "bc-cs-term";
    label.textContent = "Term";
    const select = doc.createElement("select");
    select.id = "bc-cs-term";
    select.className = "bc-cs-select";

    const terms = listTerms(state.info);
    for (const term of terms) {
      const option = doc.createElement("option");
      option.value = term.id;
      option.textContent = term.name;
      if (term.id === state.filters.termId) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener("change", () => {
      state.filters.termId = select.value;
      void state.searchOrchestrator.loadTermData(state.filters.termId);
    });

    field.append(label, select);
    return field;
  }

  // ── Search execution ──────────────────────────────────────────────────────
  //
  // Debounce + per-term paper-data cache live in
  // `controllers/search-orchestrator.ts`. The orchestrator's `onSearchReady`
  // callback routes back here for the actual filter + render step, which is
  // the only part that needs class-search-specific knowledge (the paper
  // catalog index, subjects, the `applyFilters` shape).

  private runSearchWithCourses(
    state: MountedState,
    termId: string,
    courses: PaperTermCourse[]
  ): void {
    if (state.filters.termId !== termId) return;
    const rows = applyFilters(courses, state.catalogIndex, state.subjects, state.filters, state.career);
    this.renderResults(state, rows);
  }

  private renderResults(state: MountedState, rows: ResultRow[]): void {
    const { doc } = state;
    state.resultsEl.innerHTML = "";

    if (!hasAnyFilter(state.filters)) {
      this.renderMyClassesView(state);
      return;
    }

    if (rows.length === 0) {
      const empty = doc.createElement("div");
      empty.className = "bc-cs-empty";
      empty.textContent = "No matches. Try loosening filters or switching terms.";
      state.resultsEl.appendChild(empty);
      this.setStatus(state, "ok", "0 results");
      return;
    }

    let totalSections = 0;
    for (const row of rows) {
      totalSections += row.sections.length;
      state.resultsEl.appendChild(this.buildCourseCard(state, row));
    }
    this.setStatus(
      state,
      "ok",
      `${rows.length} course${rows.length === 1 ? "" : "s"} · ${totalSections} section${totalSections === 1 ? "" : "s"}`
    );
  }

  // ── Empty-state "Your classes" view ──────────────────────────────────────

  // Renders compact cards for everything in the user's CAESAR cart +
  // current enrollment for the active term, surfaced when the search
  // box is empty so the user lands on a useful overview instead of a
  // hint string. The cards disappear automatically once a query starts
  // matching — `renderResults` re-routes to the search results path.
  private renderMyClassesView(state: MountedState): void {
    const { doc } = state;
    state.resultsEl.innerHTML = "";

    const termCart = readTermCart(state.filters.termId);
    const enrolled = termCart ? Object.values(termCart.enrolled) : [];
    const inCart = termCart ? Object.values(termCart.cart) : [];
    const courses = state.searchOrchestrator.getTerm(state.filters.termId);
    const totalCourses = courses?.length ?? 0;

    if (enrolled.length === 0 && inCart.length === 0) {
      const hint = doc.createElement("div");
      hint.className = "bc-cs-empty";
      hint.textContent =
        'Start typing — try "comp_sci 111", "econ 21x", or "machine learning". Classes you add will show up here for quick reference.';
      state.resultsEl.appendChild(hint);
      this.setStatus(state, "ok", `Term loaded · ${totalCourses.toLocaleString()} courses available`);
      return;
    }

    state.resultsEl.appendChild(
      renderMyClassesView(doc, {
        paperCourses: courses ?? [],
        enrolled,
        inCart
      })
    );

    const total = enrolled.length + inCart.length;
    this.setStatus(
      state,
      "ok",
      `${total} class${total === 1 ? "" : "es"} on file · ${totalCourses.toLocaleString()} courses searchable`
    );
  }

  // ── Course card ──────────────────────────────────────────────────────────

  private buildCourseCard(state: MountedState, row: ResultRow): HTMLElement {
    const { doc } = state;
    const planEntry = state.catalogIndex.get(`${row.course.subject} ${row.course.catalog}`) ?? null;

    const sectionRows: HTMLLIElement[] = [];
    for (const section of row.sections) {
      sectionRows.push(this.buildSectionRow(state, row, section));
    }

    // Holder pattern: `onRefresh` closes over `cardRef.el` so it can resolve
    // the card after `renderCourseCard` returns. The callback only fires on
    // user click, by which point we've populated cardRef.el.
    const cardRef: { el: HTMLElement | null } = { el: null };
    const onRefresh = (): void => {
      if (!cardRef.el) return;
      if (!this.consumePsCredit("refresh-live")) return;
      const refreshBtn = cardRef.el.querySelector<HTMLButtonElement>(".bc-cs-refresh-btn");
      if (!refreshBtn) return;
      void this.refreshLiveData(state, row, cardRef.el, refreshBtn);
    };
    const card = renderCourseCard(doc, {
      row,
      planEntry,
      sectionRows,
      onRefresh
    });
    cardRef.el = card;

    // Eagerly paint live data on render. Try the in-memory cache first
    // (warmed by an earlier action this session), then fall back to the
    // persistent catalog cache (15-min TTL across sessions). Only on a
    // cold cache do section rows render without status badges, and the
    // first Details/Add click on the course populates them.
    const liveKey = liveCacheKey(state, row);
    const memHit = state.liveData.get(liveKey);
    if (memHit?.status === "ready" && memHit.result) {
      this.applyLiveDataToCard(state, row, card, memHit.result);
    } else {
      const diskHit = readCatalogCache(
        state.filters.termId,
        row.course.subject,
        bareCatalogNumber(row.course.catalog)
      );
      if (diskHit) {
        state.liveData.mergeLiveCache(liveKey, diskHit.result.groups);
        this.applyLiveDataToCard(state, row, card, diskHit.result);
      }
    }

    return card;
  }

  // ── Section row ──────────────────────────────────────────────────────────

  private buildSectionRow(
    state: MountedState,
    row: ResultRow,
    section: PaperSection
  ): HTMLLIElement {
    const { doc } = state;
    const sigKey = state.cartButtons.encodeSigKey({
      termId: state.filters.termId,
      subject: row.course.subject,
      catalog: row.course.catalog,
      sectionLabel: `${section.section}-${section.component}`
    });

    // Holder so the click callbacks can find their own row after render —
    // the row needs its own ref to pass to `toggleSectionDetails`.
    const liRef: { el: HTMLLIElement | null } = { el: null };
    const li = renderSectionRow(doc, {
      section,
      sigKey,
      registerAddButton: (button) => {
        state.cartButtons.register(sigKey, button);
        this.applyCartStateToButton(state, row, section, button);
      },
      onAddToCart: () => {
        if (!liRef.el) return;
        const addBtn = liRef.el.querySelector<HTMLButtonElement>(".bc-cs-add");
        if (addBtn) void this.handleAdd(state, row, section, addBtn);
      },
      onToggleDetails: () => {
        if (!liRef.el) return;
        const detailsBtn = liRef.el.querySelector<HTMLButtonElement>(".bc-cs-details-btn");
        if (detailsBtn) {
          void this.toggleSectionDetails(state, row, section, liRef.el, detailsBtn);
        }
      }
    });
    liRef.el = li;
    return li;
  }

  // Resolve the cart-cache state for this section and apply it via the
  // registry. Class-number-keyed lookup is preferred (we can resolve once
  // we've loaded the live CAESAR data); if not yet known, fall back to the
  // (subject, catalog, sectionLabel) signature.
  private applyCartStateToButton(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): void {
    const hit = this.lookupCacheForSection(state, row, section);
    state.cartButtons.applyCartStateToButton(button, hit ? hit.status : null);
  }

  private lookupCacheForSection(
    state: MountedState,
    row: ResultRow,
    section: PaperSection
  ): CartLookupHit | null {
    // Prefer the resolved CAESAR class number (live data), since it's the
    // canonical key the cache uses. If we haven't loaded live data yet,
    // fall back to a paper.nu-derived signature.
    const live = state.liveData.get(liveCacheKey(state, row));
    if (live?.status === "ready" && live.result) {
      const group = matchCaesarGroup(live.result.groups, row.course.catalog);
      const caesarSection = group
        ? matchCaesarSection(group, section.section, section.component)
        : null;
      if (caesarSection) {
        return lookupClassNumber(state.filters.termId, caesarSection.classNumber);
      }
    }
    return lookupBySignature(
      state.filters.termId,
      row.course.subject,
      row.course.catalog,
      `${section.section}-${section.component}`
    );
  }

  private repaintAllCartButtons(state: MountedState): void {
    state.cartButtons.repaintAll((sigKey) => {
      const parsed = state.cartButtons.parseSigKey(sigKey);
      if (!parsed) return null;
      const hit = lookupBySignature(
        parsed.termId,
        parsed.subject,
        parsed.catalog,
        parsed.sectionLabel
      );
      return hit ? hit.status : null;
    });
  }

  private applyCartStateBySigKey(state: MountedState, button: HTMLButtonElement): void {
    const sigKey = button.dataset.sigKey ?? "";
    const parsed = state.cartButtons.parseSigKey(sigKey);
    if (!parsed) return;
    const hit = lookupBySignature(
      parsed.termId,
      parsed.subject,
      parsed.catalog,
      parsed.sectionLabel
    );
    state.cartButtons.applyCartStateToButton(button, hit ? hit.status : null);
  }

  // ── Live CAESAR data: per-course search ──────────────────────────────────

  // Returns the catalog search groups for this course. The store handles
  // memory → disk → CAESAR fetch and in-flight dedupe; this wrapper paints
  // live cells on the card and toasts on hard errors. The PS credit is
  // consumed by the parent action (Details / Add to cart / refresh), not
  // here. `force` skips both caches for an explicit user refresh.
  private async ensureLiveData(
    state: MountedState,
    row: ResultRow,
    card: HTMLElement | null,
    options: { force?: boolean } = {}
  ): Promise<CaesarSearchResult | null> {
    const key = liveCacheKey(state, row);
    try {
      const cache = await state.liveData.ensureLiveData(key, options);
      if (cache.status !== "ready" || !cache.result) return null;
      if (card) this.applyLiveDataToCard(state, row, card, cache.result);
      return cache.result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showToast(`Couldn't load CAESAR data: ${msg}`, { tone: "error", durationMs: 5000 });
      return null;
    }
  }

  // Force-refresh the per-course catalog data, bypassing both caches, and
  // also invalidate any per-section seat caches the user has expanded so
  // the detail panel re-fetches with the same click.
  private async refreshLiveData(
    state: MountedState,
    row: ResultRow,
    card: HTMLElement,
    button: HTMLButtonElement
  ): Promise<void> {
    button.disabled = true;
    button.dataset.state = "loading";
    button.classList.add("is-spinning");

    const result = await this.ensureLiveData(state, row, card, { force: true });

    button.disabled = false;
    button.classList.remove("is-spinning");
    button.dataset.state = result ? "ready" : "error";

    if (!result) return;

    // Refresh any open detail panels in this card so seat counts also
    // update — the per-section seats-notes cache is keyed on classNumber
    // and outlives the catalog cache, so we explicitly invalidate the
    // sections we know about and re-render their open panels.
    const matchingGroup = matchCaesarGroup(result.groups, row.course.catalog);
    if (!matchingGroup) return;
    const detailRows = card.querySelectorAll<HTMLLIElement>("li.bc-cs-detail-row");
    for (const detailRow of Array.from(detailRows)) {
      const sectionLi = detailRow.previousElementSibling;
      if (!(sectionLi instanceof HTMLLIElement)) continue;
      const sectionNumber = sectionLi.dataset.sectionNumber ?? "";
      const component = sectionLi.dataset.component ?? "";
      const caesar = matchCaesarSection(matchingGroup, sectionNumber, component);
      if (!caesar) continue;
      const bareCatalog = bareCatalogNumber(row.course.catalog);
      void this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
    }
    showToast("Refreshed seat status from CAESAR.", { tone: "success", durationMs: 3000 });
  }

  private applyLiveDataToCard(
    state: MountedState,
    row: ResultRow,
    card: HTMLElement,
    result: CaesarSearchResult
  ): void {
    const touched = applyLiveDataToCard(card, result, row.course.catalog);
    // Live data resolved each touched section's class number — re-evaluate
    // its cart-cache state with the canonical key so the badge reflects
    // any hits that signature-only matching missed.
    for (const li of touched) {
      const addBtn = li.querySelector<HTMLButtonElement>(".bc-cs-add");
      if (addBtn) this.applyCartStateBySigKey(state, addBtn);
    }
  }

  // ── Per-section detail (seats / notes / requirements) ────────────────────

  private async toggleSectionDetails(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): Promise<void> {
    const { doc } = state;
    let detailRow = li.nextElementSibling instanceof HTMLLIElement && li.nextElementSibling.classList.contains("bc-cs-detail-row")
      ? (li.nextElementSibling as HTMLLIElement)
      : null;

    if (detailRow) {
      detailRow.remove();
      button.dataset.expanded = "false";
      button.textContent = "Details";
      return;
    }

    // Expansion is the entry point for one or more PS chains (live load +
    // detail lookup). One credit covers the whole click; the helpers below
    // run ungated.
    if (!this.consumePsCredit("details")) return;

    // Resolve the catalog search via cache (memory → disk → fetch).
    const card = li.closest<HTMLElement>(".bc-cs-course");
    const liveResult = await this.ensureLiveData(state, row, card);
    if (!liveResult) {
      showToast("Could not load CAESAR data for this course.", { tone: "error" });
      return;
    }

    const matchingGroup = matchCaesarGroup(liveResult.groups, row.course.catalog);
    const caesar = matchingGroup
      ? matchCaesarSection(matchingGroup, section.section, section.component)
      : null;
    if (!caesar) {
      showToast("No matching CAESAR section found.", { tone: "error" });
      return;
    }

    detailRow = doc.createElement("li");
    detailRow.className = "bc-cs-detail-row";
    li.parentElement?.insertBefore(detailRow, li.nextSibling);

    const bareCatalog = bareCatalogNumber(row.course.catalog);
    const cachedDisk = readSeatsNotesCache(caesar.classNumber);
    if (cachedDisk?.result) {
      this.renderDetailRow(state, detailRow, caesar, cachedDisk.result, cachedDisk.fetchedAt, () => {
        if (!this.consumePsCredit("refresh-detail")) return;
        void this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
      });
    } else {
      await this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
    }

    button.dataset.expanded = "true";
    button.textContent = "Hide";
  }

  private async fetchAndRenderDetail(
    state: MountedState,
    detailRow: HTMLLIElement,
    caesar: CaesarSection,
    bareCatalog: string
  ): Promise<void> {
    if (!detailRow.isConnected) return;
    this.renderDetailLoading(state, detailRow);
    try {
      // Hint TGS first for 4xx so lookupClass's career fallback list
      // doesn't waste a request trying UGRD on grad-only classes.
      const careerHint = isGradCatalog(bareCatalog) ? "TGS" : "UGRD";
      const lookupResponse = await lookupClass(
        {
          type: "lookup-class",
          classNumber: caesar.classNumber,
          careerHint
        },
        { priority: "background", owner: "class-search-detail" }
      );
      const result = toSeatsNotesResult(lookupResponse);
      const fetchedAt = Date.now();
      writeSeatsNotesCache(caesar.classNumber, { result, fetchedAt });
      if (detailRow.isConnected) {
        this.renderDetailRow(state, detailRow, caesar, result, fetchedAt, () => {
          if (!this.consumePsCredit("refresh-detail")) return;
          void this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
        });
      }
      const warning = formatPsCreditsWarning(fetchedAt);
      if (warning) {
        const verb = result.ok ? "Loaded" : "Tried";
        showToast(`${verb} section detail. ${warning}.`, { tone: "warn", durationMs: 5000 });
      }
    } catch (error) {
      if (isRetryablePeopleSoftTaskError(error)) return;
      const failure = seatsNotesFailure(error);
      if (detailRow.isConnected) {
        this.renderDetailRow(state, detailRow, caesar, failure, Date.now(), () => {
          if (!this.consumePsCredit("refresh-detail")) return;
          void this.fetchAndRenderDetail(state, detailRow, caesar, bareCatalog);
        });
      }
    }
  }

  private renderDetailLoading(state: MountedState, detailRow: HTMLLIElement): void {
    detailRow.innerHTML = "";
    detailRow.appendChild(renderSectionDetailLoading(state.doc));
  }

  private renderDetailRow(
    state: MountedState,
    detailRow: HTMLLIElement,
    caesar: CaesarSection,
    result: SectionDetailData,
    fetchedAt: number,
    onRefresh: () => void
  ): void {
    detailRow.innerHTML = "";
    detailRow.appendChild(
      renderSectionDetail(state.doc, {
        header: {
          sectionLabel: caesar.sectionLabel,
          daysTime: caesar.daysTime,
          room: caesar.room
        },
        detail: result,
        fetchedAt,
        onRefresh
      })
    );
  }

  // ── Add to cart ──────────────────────────────────────────────────────────
  //
  // Wizard UI orchestration (button state machine, optimistic cart-cache
  // writes, toasts, picker recursion) lives in `controllers/add-to-cart.ts` +
  // `controllers/related-picker.ts`. The augmentation only supplies the
  // mount-scoped context (term, institution, live-data lookup, repaint).

  private async handleAdd(
    state: MountedState,
    row: ResultRow,
    section: PaperSection,
    button: HTMLButtonElement
  ): Promise<void> {
    const ctx: AddToCartContext = {
      termId: state.filters.termId,
      institution: state.institution,
      row,
      section,
      resolveClassNumber: async () => {
        // We need the 5-digit CAESAR class number for the cart-add chain.
        // Resolve via cache (memory → disk → fetch).
        const card = button.closest<HTMLElement>(".bc-cs-course");
        const liveResult = await this.ensureLiveData(state, row, card);
        if (!liveResult) return null;
        const group = matchCaesarGroup(liveResult.groups, row.course.catalog);
        if (!group) return null;
        return matchCaesarSection(group, section.section, section.component)?.classNumber ?? null;
      },
      mergeAndRepaint: (searchGroups) => {
        state.liveData.mergeLiveCache(liveCacheKey(state, row), searchGroups);
        const card = button.closest<HTMLElement>(".bc-cs-course");
        const merged = state.liveData.get(liveCacheKey(state, row));
        if (card && merged?.status === "ready" && merged.result) {
          this.applyLiveDataToCard(state, row, card, merged.result);
        }
      },
      openClassicTab: () => this.switchTab(state, "classic")
    };
    await this.addToCartCtrl.onClick(button, ctx);
  }

  // ── Related-component picker (lab/discussion required) ──────────────────
  //
  // Bridge between the cart-add controller and the picker controller. The
  // controller deps need a Promise-returning function, while the picker owns
  // its own DOM lifecycle — this thin wrapper resolves the section <li>
  // anchor from the button and delegates.

  private openRelatedPickerForAdd(
    button: HTMLButtonElement,
    options: RelatedSectionOption[],
    ctx: AddToCartContext
  ): Promise<RelatedSectionOption | null> {
    const sectionLi = button.closest<HTMLLIElement>("li.bc-cs-section");
    if (!sectionLi) return Promise.resolve(null);
    return this.relatedPicker.open(options, {
      row: ctx.row,
      section: ctx.section,
      sectionLi
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  private setStatus(state: MountedState, kind: "loading" | "ok" | "error", message: string): void {
    const { statusEl, doc } = state;
    statusEl.innerHTML = "";
    statusEl.dataset.state = kind;
    if (kind === "loading") {
      const spinner = doc.createElement("span");
      spinner.className = "bc-cs-spinner";
      statusEl.appendChild(spinner);
    }
    const text = doc.createElement("span");
    text.textContent = message;
    statusEl.appendChild(text);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Module helpers (no `this` access)

function liveCacheKey(state: MountedState, row: ResultRow): string {
  return `${state.filters.termId}|${row.course.subject}|${bareCatalogNumber(row.course.catalog)}`;
}

// 4xx classes live under TGS even when undergrads can take them; this
// matches the heuristic in caesar-search.ts and ctec-links/subject-careers.
function isGradCatalog(bareCatalog: string): boolean {
  const num = parseInt(bareCatalog, 10);
  return Number.isFinite(num) && num >= 400;
}

// Decodes a `${termId}|${subject}|${bareCatalog}` live-cache key — the
// inverse of `liveCacheKey`. Used by the LiveDataStore deps so the store
// itself can stay generic.
function parseLiveCacheKey(
  key: string
): { termId: string; subject: string; bareCatalog: string } | null {
  const parts = key.split("|");
  if (parts.length !== 3) return null;
  return {
    termId: parts[0]!,
    subject: parts[1]!,
    bareCatalog: parts[2]!
  };
}

function ensureRoot(doc: Document): HTMLDivElement {
  const existing = doc.getElementById(ROOT_ID) as HTMLDivElement | null;
  if (existing) return existing;
  const root = doc.createElement("div");
  root.id = ROOT_ID;
  // .bc-cs-root carries every CSS custom property; nothing renders without it.
  root.className = "bc-cs-root";
  const anchor =
    doc.getElementById("win0divPAGECONTAINER") ??
    doc.querySelector(".PSPAGECONTAINER")?.closest("td") ??
    doc.body;
  const parent = anchor.parentElement ?? doc.body;
  parent.insertBefore(root, anchor);
  return root;
}

function renderFatalError(root: HTMLElement, doc: Document, message: string): void {
  root.innerHTML = "";
  const wrap = doc.createElement("div");
  wrap.className = "bc-cs-root";
  const card = doc.createElement("div");
  card.className = "bc-cs-card";
  card.style.borderColor = "var(--bc-color-danger-border)";
  card.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;font-size:var(--bc-font-13);color:var(--bc-color-danger);">
      <strong>Couldn't load paper.nu catalog data.</strong>
      <span style="color:var(--bc-color-text-muted);">${escapeHtml(message)}</span>
      <span style="color:var(--bc-color-text-muted);font-size:var(--bc-font-12);">Reload the page to try again, or switch to Classic CAESAR using the tab above.</span>
    </div>
  `;
  wrap.appendChild(card);
  root.appendChild(wrap);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLoadingShell(doc: Document): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "bc-cs-root";
  const card = doc.createElement("div");
  card.className = "bc-cs-card";
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;color:var(--bc-color-text-muted);font-size:var(--bc-font-13);">
      <span class="bc-cs-spinner"></span>
      <span>Loading paper.nu catalog data…</span>
    </div>
  `;
  wrap.appendChild(card);
  return wrap;
}

function hasAnyFilter(filters: SearchFilters): boolean {
  return filters.query.trim().length > 0;
}

