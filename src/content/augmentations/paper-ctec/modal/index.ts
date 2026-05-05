// Modal subsystem barrel.
//
// Public API re-exports:
//  - ModalView (createModalView): orchestrator for the rendered modal.
//  - ModalDataController (createModalDataController): owns CTEC fetch loops
//    and the refresh-flash auto-dismiss timer.
//  - Section: uniform render contract every section file follows.
//  - Section components: HeaderSection, OverviewSection, CommentsSection,
//    HeatmapSection, TermsSection.
//  - Types: AnalyticsModalCallbacks, AnalyticsModalInput, AnalyticsModalState,
//    ModalActiveView, ModalCommentSentimentFilter, ModalCommentSort,
//    ModalRefreshFlash, ModalTab, COMMENTS_PAGE_SIZE.

export { createModalView } from "./view";
export type { ModalView, ModalViewDeps } from "./view";

export { createModalDataController } from "./data-controller";
export type {
  ModalDataController,
  ModalDataControllerDeps
} from "./data-controller";

export type { Section } from "./section";

export { HeaderSection } from "./header";
export { OverviewSection } from "./overview";
export { CommentsSection } from "./comments";
export { HeatmapSection } from "./heatmap";
export { TermsSection } from "./terms";

export {
  COMMENTS_PAGE_SIZE,
  TONE_META,
  TOPIC_TONE_COLORS,
  TOPIC_TONE_LABELS
} from "./types";
export type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState,
  ModalActiveView,
  ModalCommentSentimentFilter,
  ModalCommentSort,
  ModalRefreshFlash,
  ModalTab
} from "./types";
