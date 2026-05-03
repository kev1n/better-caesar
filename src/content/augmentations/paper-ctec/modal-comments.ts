import type { CtecCourseAnalyticsEntry } from "../ctec-links/reports";
import type { CtecLinkParams } from "../ctec-links/types";
import type { ModalComment } from "./modal-data";
import {
  buildSuppressionTokens,
  extractFrequentTopics,
  matchTopics
} from "./modal-topics";
import { classifySentiment } from "./sentiment";

// Comment-group prompts we skip wholesale because their text is duplicated by
// other prompts (CTEC sometimes asks the same thing twice with different
// wording) or otherwise carries no signal worth showing.
//
// Stored as normalized strings (see normalizePrompt). Match against incoming
// prompts after the same normalization so PeopleSoft drift in casing,
// whitespace, or trailing punctuation doesn't reopen the filter.
const IGNORED_PROMPTS = new Set<string>([
  normalizePrompt(
    "Please summarize your reaction to this course focusing on the aspects that were most important to you."
  )
]);

export function collectComments(
  entries: CtecCourseAnalyticsEntry[],
  params: CtecLinkParams,
  titleHint: string
): ModalComment[] {
  // The IGNORED_PROMPTS filter suppresses prompts whose content duplicates
  // other prompts in the same course. But some courses *only* have an
  // ignored prompt — in that case dropping it would leave the modal with
  // zero comments, which is worse than showing the redundant prompt. So
  // only honor the filter when at least one non-ignored prompt has comments.
  const hasOtherPrompts = entries.some((entry) =>
    entry.commentGroups.some(
      (group) => !isIgnoredPrompt(group.prompt) && group.comments.length > 0
    )
  );

  // Pass 1: collect raw comments with text + identity.
  type RawComment = Omit<ModalComment, "topics">;
  const raw: RawComment[] = [];
  for (const entry of entries) {
    for (const group of entry.commentGroups) {
      if (hasOtherPrompts && isIgnoredPrompt(group.prompt)) continue;
      for (const comment of group.comments) {
        const text = comment.trim();
        if (!text) continue;
        raw.push({
          term: entry.term,
          instructor: entry.instructor,
          prompt: group.prompt,
          text,
          tone: classifySentiment(text),
          length: text.length
        });
      }
    }
  }

  // Pass 2: extract a course-specific phrase list once across all comments,
  // then per-comment topic membership is just "which phrases does this comment
  // contain". This is the "Frequent topics" rail — phrases the corpus
  // surfaces, not a static keyword map.
  const suppress = buildSuppressionTokens(params, titleHint, raw);
  const frequentTopics = extractFrequentTopics(raw.map((r) => r.text), suppress);

  return raw.map((r) => ({ ...r, topics: matchTopics(r.text, frequentTopics) }));
}

function isIgnoredPrompt(prompt: string): boolean {
  return IGNORED_PROMPTS.has(normalizePrompt(prompt));
}

function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?;:,]+$/u, "")
    .trim();
}
