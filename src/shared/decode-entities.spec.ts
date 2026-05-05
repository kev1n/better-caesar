import { describe, expect, it } from "vitest";

import { decodeEntities } from "./decode-entities";

const NBSP = " ";

describe("decodeEntities", () => {
  describe("named entities", () => {
    const cases: Array<[string, string]> = [
      ["&amp;", "&"],
      ["&lt;", "<"],
      ["&gt;", ">"],
      ["&quot;", '"'],
      ["&apos;", "'"],
      // &nbsp; → U+00A0 (matches textarea-based decoding). The
      // peoplesoft/shared.ts wrapper folds it into a regular space via
      // `.replace(/\s+/g, " ")`.
      ["&nbsp;", NBSP]
    ];
    it.each(cases)("decodes %j", (input, expected) => {
      expect(decodeEntities(input)).toBe(expected);
    });
  });

  describe("decimal numeric entities", () => {
    const cases: Array<[string, string]> = [
      ["&#39;", "'"],
      ["&#65;", "A"],
      ["&#9731;", "☃"], // snowman
      ["&#160;", NBSP]
    ];
    it.each(cases)("decodes %j", (input, expected) => {
      expect(decodeEntities(input)).toBe(expected);
    });
  });

  describe("hex numeric entities", () => {
    const cases: Array<[string, string]> = [
      ["&#x27;", "'"],
      ["&#x2F;", "/"],
      ["&#x41;", "A"],
      ["&#xa0;", NBSP]
    ];
    it.each(cases)("decodes %j", (input, expected) => {
      expect(decodeEntities(input)).toBe(expected);
    });
  });

  it("decodes mixed strings with multiple entity types", () => {
    expect(decodeEntities("Tom &amp; Jerry &lt;3 &#39;hi&#39; &#x27;bye&#x27;")).toBe(
      "Tom & Jerry <3 'hi' 'bye'"
    );
  });

  it("is a no-op on plain text", () => {
    expect(decodeEntities("just some text 1234")).toBe("just some text 1234");
    expect(decodeEntities("")).toBe("");
  });

  it("is idempotent on already-decoded text", () => {
    const decoded = decodeEntities("Tom &amp; Jerry");
    expect(decodeEntities(decoded)).toBe(decoded);
    expect(decodeEntities("'apostrophe'")).toBe("'apostrophe'");
  });

  describe("malformed entities pass through untouched", () => {
    const cases = ["&;", "&amp", "&#x;", "&#;", "&unknownEntity;", "&"];
    it.each(cases)("leaves %j unchanged", (input) => {
      expect(decodeEntities(input)).toBe(input);
    });
  });

  it("handles a real CAESAR class-notes blob", () => {
    // Approximates the kind of fragment seats-notes/parser.ts feeds in:
    // notes containing the apostrophe alias, an ampersand, and a quote.
    const raw =
      "Instructor&#39;s consent required. CS &amp; ECE only. See &quot;Course Notes&quot; for details.";
    expect(decodeEntities(raw)).toBe(
      "Instructor's consent required. CS & ECE only. See \"Course Notes\" for details."
    );
  });

  it("preserves U+00A0 from &nbsp; (textarea-decode-compatible)", () => {
    expect(decodeEntities("a&nbsp;b")).toBe(`a${NBSP}b`);
  });

  it("ignores invalid hex code points by leaving them as-is", () => {
    // Beyond U+10FFFF — must not throw, must not invent a replacement char.
    expect(decodeEntities("&#x110000;")).toBe("&#x110000;");
  });
});
