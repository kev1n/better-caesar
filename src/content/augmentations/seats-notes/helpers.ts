// Pure helpers shared across the seats-notes augmentation. The grid-level
// `queryTargetTables` from the pre-Wave-4 codebase is gone — the runtime now
// finds rows directly via `gridRowSelector`.

export function extractClassNumber(rawText: string): string | null {
  const match = rawText.match(/\((\d{4,10})\)/);
  if (match) return match[1];
  const digits = rawText.replace(/\D+/g, "");
  return digits.length >= 4 ? digits : null;
}

export function extractCareerHint(text: string): "UGRD" | "TGS" | undefined {
  const catalog = text.match(/\b(\d{3})-\d\b/)?.[1];
  if (!catalog) return undefined;
  const value = Number(catalog);
  if (!Number.isFinite(value)) return undefined;
  return value >= 400 ? "TGS" : "UGRD";
}
