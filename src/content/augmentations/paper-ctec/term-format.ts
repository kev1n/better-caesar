// Compact term label used across analytics widgets ("Fall 2024" or
// "2024 Fall" → "F'24"). CTEC reports use year-first format; paper.nu
// surfaces use season-first — handle both.
const SEASON_ABBR: Record<string, string> = {
  Fall: "F",
  Winter: "W",
  Spring: "Sp",
  Summer: "Su"
};

export function abbrTerm(term: string): string {
  if (!term) return "";
  let season = "";
  let year = "";
  for (const part of term.trim().split(/\s+/)) {
    if (/^\d{4}$/.test(part)) {
      year = `'${part.slice(2)}`;
    } else if (part in SEASON_ABBR) {
      season = SEASON_ABBR[part]!;
    }
  }
  if (!season && !year) return term;
  return `${season}${year}`;
}
