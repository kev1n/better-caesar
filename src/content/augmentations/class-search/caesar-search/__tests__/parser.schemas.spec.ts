import { describe, expect, it } from "vitest";
import { z } from "zod/mini";

import {
  CaesarCourseGroupSchema,
  CaesarSectionSchema,
  RelatedSectionOptionSchema
} from "../parser.schemas";
import { parseAjaxFragment } from "../parser";
import {
  parseCaesarGroupsSafe,
  parseRelatedComponentOptionsSafe,
  parseSectionRowSafe
} from "../parser.safe";
import { RELATED_COMPONENT_HTML } from "../__fixtures__/related-component";
import { SEARCH_RESULTS_HTML } from "../__fixtures__/search-results";

describe("parseCaesarGroupsSafe (Wave 9)", () => {
  it("returns ok=true with validated groups for golden fixture", () => {
    const result = parseCaesarGroupsSafe(SEARCH_RESULTS_HTML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.title).toBe("Fundamentals of Computer Programming");
    expect(result.value[0]?.sections[0]?.classNumber).toBe("12345");
    expect(result.value[0]?.sections[0]?.status).toBe("Open");
  });

  it("rejects a section that's missing a required field", () => {
    const bogus = { courseId: "x", catalog: "y", title: "z", sections: [{}] };
    const result = z.array(CaesarCourseGroupSchema).safeParse([bogus]);
    expect(result.success).toBe(false);
  });

  it("rejects a section with a wrong-typed status", () => {
    const result = CaesarSectionSchema.safeParse({
      classNumber: "1",
      sectionLabel: "1-LEC",
      sectionNumber: "1",
      component: "LEC",
      daysTime: "",
      room: "",
      instructor: "",
      meetingDates: "",
      grading: "",
      status: "TotallyMadeUp",
      selectActionId: "x",
      selectAvailable: true
    });
    expect(result.success).toBe(false);
  });

  it("rejects a section whose selectAvailable is wrong type", () => {
    const result = CaesarSectionSchema.safeParse({
      classNumber: "1",
      sectionLabel: "1-LEC",
      sectionNumber: "1",
      component: "LEC",
      daysTime: "",
      room: "",
      instructor: "",
      meetingDates: "",
      grading: "",
      status: "Open",
      selectActionId: "x",
      selectAvailable: "yes"
    });
    expect(result.success).toBe(false);
  });
});

describe("parseSectionRowSafe (Wave 9)", () => {
  it("returns ok=true with the parsed section for a valid row", () => {
    const doc = parseAjaxFragment(SEARCH_RESULTS_HTML);
    const result = parseSectionRowSafe(doc, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.classNumber).toBe("12345");
    expect(result.value?.component).toBe("LEC");
  });

  it("returns ok=true value=null when row doesn't exist", () => {
    const doc = parseAjaxFragment(SEARCH_RESULTS_HTML);
    const result = parseSectionRowSafe(doc, 999);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });
});

describe("parseRelatedComponentOptionsSafe (Wave 9)", () => {
  it("returns ok=true with validated options for golden fixture", () => {
    const result = parseRelatedComponentOptionsSafe(RELATED_COMPONENT_HTML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBeNull();
    expect(result.value).toHaveLength(2);
    expect(result.value?.[0]?.classNumber).toBe("34601");
    expect(result.value?.[1]?.status).toBe("Wait List");
  });

  it("rejects an option whose rowIndex is a string", () => {
    const result = RelatedSectionOptionSchema.safeParse({
      rowIndex: "0",
      classNumber: "1",
      section: "",
      schedule: "",
      room: "",
      instructor: "",
      status: "Open"
    });
    expect(result.success).toBe(false);
  });

  it("returns ok=true value=null when no picker is present", () => {
    const result = parseRelatedComponentOptionsSafe(SEARCH_RESULTS_HTML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });
});
