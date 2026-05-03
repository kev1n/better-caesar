// Frequent-topic extraction (TF-IDF-ish bigram/trigram surface).
//
// For each loaded course, we extract the phrases that recur across multiple
// student comments and surface them in the modal's filter rail. This replaces
// a previous static keyword map ("Tough exams" etc.) that produced a lot of
// false positives — every mention of "exam" was tagged as Tough Exams.
//
// Properties of a good extracted phrase:
//   - 2 or 3 content tokens (no stopwords on either end)
//   - appears in at least MIN_DF distinct comments
//   - not nearly universal (≤ MAX_DF_FRAC of comments) — drops course-title
//     filler like "comp sci 211"
//   - not redundant with another extracted phrase that's a strict superset
//   - not part of the course identity (subject/catalog/title) we already show
//
// Per-comment topics are then just the subset of that list that the comment
// contains — no semantic matching, just substring.

import type { CtecLinkParams } from "../ctec-links/types";
import type { ModalComment, ModalCommentTone, ModalTopicEntry } from "./modal-data";

const MIN_TOPIC_DF = 2;
const MAX_TOPIC_DF_FRACTION = 0.7;
const MAX_TOPICS = 12;

const STOPWORDS = new Set<string>([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by", "can",
  "did", "do", "does", "doing", "for", "from", "get", "got", "had", "has",
  "have", "having", "he", "her", "him", "his", "how", "i", "if", "in",
  "into", "is", "it", "its", "just", "like", "me", "much", "my", "no", "nor",
  "not", "of", "on", "one", "or", "our", "out", "over", "she", "so", "some",
  "such", "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "this", "those", "to", "too", "up", "us", "very", "was", "we",
  "were", "what", "when", "where", "which", "while", "who", "why", "will",
  "with", "would", "you", "your", "im", "ive", "id", "youre", "youll",
  "youve", "dont", "didnt", "doesnt", "wasnt", "werent", "isnt", "arent",
  "havent", "hasnt", "wont", "cant", "couldnt", "shouldnt", "wouldnt", "lot",
  "lots", "thing", "things", "way", "ways", "really", "also", "even"
]);

export function buildSuppressionTokens(
  params: CtecLinkParams,
  titleHint: string,
  raw: { instructor: string; prompt: string; term: string }[]
): Set<string> {
  const out = new Set<string>();
  // Course identity tokens — appear in nearly every comment by virtue of the
  // page they came from, so they don't add information.
  const identity = `${params.subject} ${params.catalogNumber} ${titleHint} ${params.instructor}`;
  for (const tok of tokenize(identity)) out.add(tok);

  // Instructors and prompt keywords — if the prompt is "What did you like
  // most about the course", the words "like" and "course" recur in a way
  // that's an artifact of the prompt, not a course-specific topic.
  for (const r of raw) {
    for (const tok of tokenize(r.instructor)) out.add(tok);
    for (const tok of tokenize(r.prompt)) out.add(tok);
  }
  return out;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function extractFrequentTopics(
  texts: string[],
  suppress: Set<string>
): string[] {
  if (texts.length === 0) return [];

  // Document-frequency map of phrases (bigrams + trigrams).
  const df = new Map<string, number>();
  for (const text of texts) {
    const tokens = tokenize(text);
    const seen = new Set<string>();
    for (const phrase of generatePhrases(tokens, suppress)) {
      if (seen.has(phrase)) continue;
      seen.add(phrase);
      df.set(phrase, (df.get(phrase) ?? 0) + 1);
    }
  }

  const maxDf = Math.max(MIN_TOPIC_DF, Math.floor(texts.length * MAX_TOPIC_DF_FRACTION));

  // Rank: higher df first; tiebreak prefers longer (more specific) phrases.
  const ranked = Array.from(df.entries())
    .filter(([, count]) => count >= MIN_TOPIC_DF && count <= maxDf)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].length - a[0].length;
    })
    .map(([phrase]) => phrase);

  // Dedupe nested phrases: drop any phrase that's a substring of a
  // better-ranked phrase already kept ("hours were" once we have "office
  // hours"); also drop any phrase that's a strict superset of a
  // better-ranked phrase (keep the shorter, more general one).
  const kept: string[] = [];
  for (const phrase of ranked) {
    const overlap = kept.find((k) => phrase.includes(k) || k.includes(phrase));
    if (overlap) continue;
    kept.push(phrase);
    if (kept.length >= MAX_TOPICS) break;
  }
  return kept;
}

function generatePhrases(tokens: string[], suppress: Set<string>): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const len of [2, 3]) {
      if (i + len > tokens.length) continue;
      const slice = tokens.slice(i, i + len);
      // Edges must be content words; interior may pass through.
      const first = slice[0]!;
      const last = slice[slice.length - 1]!;
      if (STOPWORDS.has(first) || STOPWORDS.has(last)) continue;
      if (suppress.has(first) || suppress.has(last)) continue;
      if (slice.some((tok) => tok.length < 3 && !/^\d/.test(tok))) continue;
      // Skip phrases that are entirely numbers ("20 hours").
      if (slice.every((tok) => /^\d+$/.test(tok))) continue;
      out.push(slice.join(" "));
    }
  }
  return out;
}

export function matchTopics(text: string, topics: string[]): string[] {
  if (topics.length === 0) return [];
  const haystack = ` ${tokenize(text).join(" ")} `;
  return topics.filter((topic) => haystack.includes(` ${topic} `));
}

export function aggregateTopics(comments: ModalComment[]): ModalTopicEntry[] {
  const map = new Map<string, ModalTopicEntry>();
  for (const comment of comments) {
    for (const topic of comment.topics) {
      let entry = map.get(topic);
      if (!entry) {
        entry = {
          label: topic,
          count: 0,
          sentiments: { pos: 0, neu: 0, mix: 0, neg: 0 }
        };
        map.set(topic, entry);
      }
      entry.count += 1;
      entry.sentiments[comment.tone] += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function countSentiment(
  comments: ModalComment[]
): Record<ModalCommentTone, number> {
  const out: Record<ModalCommentTone, number> = {
    pos: 0,
    neu: 0,
    mix: 0,
    neg: 0
  };
  for (const comment of comments) out[comment.tone]++;
  return out;
}
