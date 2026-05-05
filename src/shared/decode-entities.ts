// Pure HTML-entity decoder. No DOM dependency, no whitespace normalization
// — callers that want trim / collapse-runs handle that themselves.
//
// Covers the named entities actually present in CAESAR/Bluera HTML
// (&amp; &lt; &gt; &quot; &apos; &nbsp;), the "&#39;" alias for the
// apostrophe, and any decimal/hex numeric entity. Malformed inputs
// (`&;`, `&amp` with no semicolon, partial `&#x;`) pass through
// unchanged so the function is safe on already-decoded or partially
// hand-rolled strings.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

const ENTITY_PATTERN = /&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);/g;

export function decodeEntities(input: string): string {
  if (!input) return input;
  return input.replace(ENTITY_PATTERN, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      if (!Number.isFinite(code)) return match;
      return safeFromCodePoint(code, match);
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code)) return match;
      return safeFromCodePoint(code, match);
    }
    const named = NAMED[body];
    return named ?? match;
  });
}

function safeFromCodePoint(code: number, fallback: string): string {
  if (code < 0 || code > 0x10ffff) return fallback;
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}
