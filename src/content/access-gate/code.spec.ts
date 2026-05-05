import { describe, expect, it } from "vitest";

import {
  CODE_CHARS,
  canonicalizeCodeInput,
  computeCodeForLastName,
  formatCode,
  isCodeValidForLastName
} from "./code";

describe("canonicalizeCodeInput", () => {
  it("uppercases and strips whitespace + dashes", () => {
    expect(canonicalizeCodeInput("abc-def")).toBe("ABCDEF");
    expect(canonicalizeCodeInput("  ab  cd ")).toBe("ABCD");
    expect(canonicalizeCodeInput("a-b-c")).toBe("ABC");
  });

  it("remaps Crockford-confused letters: I/L → 1, O → 0", () => {
    expect(canonicalizeCodeInput("Il1")).toBe("111");
    expect(canonicalizeCodeInput("O0o")).toBe("000");
    expect(canonicalizeCodeInput("LIOL")).toBe("1101");
  });

  it("does NOT remap U (not implemented in this codebase)", () => {
    // Crockford-the-spec maps U→V but code.ts deliberately leaves it alone.
    expect(canonicalizeCodeInput("U")).toBe("U");
  });

  it("is idempotent", () => {
    const samples = ["abc-def", "Il1-O0o", "  Smith  ", "ABC-DEF"];
    for (const s of samples) {
      const once = canonicalizeCodeInput(s);
      const twice = canonicalizeCodeInput(once);
      expect(twice).toBe(once);
    }
  });
});

describe("formatCode", () => {
  it("formats 6-char canonical inputs as XXX-XXX", () => {
    expect(formatCode("abcdef")).toBe("ABC-DEF");
    expect(formatCode("ABC-DEF")).toBe("ABC-DEF");
  });

  it("returns the cleaned input when not exactly CODE_CHARS long", () => {
    expect(formatCode("abc")).toBe("ABC");
    expect(formatCode("abcdefg")).toBe("ABCDEFG");
  });
});

describe("computeCodeForLastName / isCodeValidForLastName", () => {
  const NAMES = ["Smith", "Wang", "Garcia", "OBrien"];

  it("round-trips: a freshly-computed code validates against its name", async () => {
    for (const name of NAMES) {
      const code = await computeCodeForLastName(name);
      const ok = await isCodeValidForLastName(code, name);
      expect(ok).toBe(true);
    }
  });

  it("emits a CODE_CHARS-long canonical code wrapped as XXX-XXX", async () => {
    const code = await computeCodeForLastName("Smith");
    expect(code).toMatch(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/);
    expect(canonicalizeCodeInput(code)).toHaveLength(CODE_CHARS);
  });

  it("normalizes last-name casing (Smith / SMITH / smith all match)", async () => {
    const code = await computeCodeForLastName("Smith");
    expect(await isCodeValidForLastName(code, "SMITH")).toBe(true);
    expect(await isCodeValidForLastName(code, "smith")).toBe(true);
    expect(await isCodeValidForLastName(code, "  smith  ")).toBe(true);
  });

  it("strips accents on the last name (NFD then a-z filter)", async () => {
    // normalizeLastName does NFD + strip non-a-z. "Béyoncé" decomposes into
    // "Béyoncé" → after lowercase + non-a-z strip becomes
    // "beyonce", which therefore matches the un-accented "Beyonce".
    const accented = await computeCodeForLastName("Béyoncé");
    const plain = await computeCodeForLastName("Beyonce");
    expect(accented).toBe(plain);

    // Also: hyphens, apostrophes, and digits are stripped, so "O'Brien"
    // and "OBrien" hash to the same code.
    expect(await computeCodeForLastName("O'Brien")).toBe(
      await computeCodeForLastName("OBrien")
    );
  });

  it("rejects codes shorter than CODE_CHARS", async () => {
    expect(await isCodeValidForLastName("ABC", "Smith")).toBe(false);
    expect(await isCodeValidForLastName("AB-CD", "Smith")).toBe(false);
    expect(await isCodeValidForLastName("", "Smith")).toBe(false);
  });

  it("rejects codes longer than CODE_CHARS", async () => {
    expect(await isCodeValidForLastName("ABCDEFG", "Smith")).toBe(false);
    expect(await isCodeValidForLastName("ABC-DEFG", "Smith")).toBe(false);
  });

  it("rejects a wrong code for a given last name", async () => {
    const smithCode = await computeCodeForLastName("Smith");
    expect(await isCodeValidForLastName(smithCode, "Wang")).toBe(false);

    // A canonical-shaped code that almost certainly isn't Smith's:
    const fake = "AAA-AAA";
    expect(fake).not.toBe(smithCode);
    expect(await isCodeValidForLastName(fake, "Smith")).toBe(false);
  });

  it("accepts the code in any presentation: dashed, undashed, mixed-case", async () => {
    const code = await computeCodeForLastName("Wang"); // "ABC-DEF" shape
    const stripped = code.replace(/-/g, "");
    expect(await isCodeValidForLastName(stripped, "Wang")).toBe(true);
    expect(await isCodeValidForLastName(stripped.toLowerCase(), "Wang")).toBe(true);
    // Same code with an ambiguous-letter swap should still validate, since
    // canonicalizeCodeInput remaps I→1, L→1, O→0 before comparison.
    const ambiguousized = stripped
      .replace(/1/g, "I")
      .replace(/0/g, "O");
    expect(await isCodeValidForLastName(ambiguousized, "Wang")).toBe(true);
  });

  it("produces different codes for different last names", async () => {
    const a = await computeCodeForLastName("Smith");
    const b = await computeCodeForLastName("Wang");
    expect(a).not.toBe(b);
  });
});
