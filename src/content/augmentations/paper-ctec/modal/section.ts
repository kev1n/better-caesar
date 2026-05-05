import type { TemplateResult } from "lit-html";

// Uniform contract every modal section follows. lit-html does its own
// template-result diffing across renders, so most sections leave
// `signature` undefined; the few that pre-compute heavy derived data
// (charts, heatmap shaders) can opt in to coarse short-circuiting.
//
// Sections are pure functions of `props` — handler invocations live on
// the props' callback bag, ModalView re-renders when state changes, and
// no section keeps its own DOM-attached state across renders. State that
// must persist (commentsVisibleCount, heatmapExpanded, …) lives on
// AnalyticsModalState which is part of the props.
export interface Section<TProps> {
  render(props: TProps): TemplateResult;
  signature?(props: TProps): string;
}
