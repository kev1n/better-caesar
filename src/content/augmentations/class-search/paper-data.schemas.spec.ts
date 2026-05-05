import { describe, expect, it } from "vitest";

import {
  DataMapInfoSchema,
  PaperTermCourseSchema,
  SubjectInfoMapSchema,
  SubjectInfoSchema
} from "./paper-data.schemas";

describe("DataMapInfoSchema (Wave 9)", () => {
  it("accepts a plausible plan.json info shape", () => {
    const result = DataMapInfoSchema.safeParse({
      latest: "4750",
      subjects: "2026-01-01",
      plan: "2026-01-02",
      terms: {
        "4750": { name: "Spring 2026", updated: "2026-01-03", start: "2026-03-30" }
      }
    });
    expect(result.success).toBe(true);
  });

  it("rejects when terms is an array instead of a record", () => {
    const result = DataMapInfoSchema.safeParse({
      latest: "4750",
      subjects: "x",
      plan: "y",
      terms: []
    });
    expect(result.success).toBe(false);
  });

  it("rejects when latest is missing", () => {
    const result = DataMapInfoSchema.safeParse({
      subjects: "x",
      plan: "y",
      terms: {}
    });
    expect(result.success).toBe(false);
  });
});

describe("SubjectInfoMapSchema (Wave 9)", () => {
  it("accepts a populated subjects map", () => {
    const result = SubjectInfoMapSchema.safeParse({
      COMP_SCI: { symbol: "COMP_SCI", display: "Computer Science", color: "blue" }
    });
    expect(result.success).toBe(true);
  });

  it("rejects a single SubjectInfo missing display", () => {
    const result = SubjectInfoSchema.safeParse({ symbol: "COMP_SCI" });
    expect(result.success).toBe(false);
  });

  it("rejects when schools is a string instead of array", () => {
    const result = SubjectInfoSchema.safeParse({
      symbol: "COMP_SCI",
      display: "CS",
      schools: "MEAS"
    });
    expect(result.success).toBe(false);
  });
});

describe("PaperTermCourseSchema (Wave 9)", () => {
  it("accepts a course with a fully populated section", () => {
    const result = PaperTermCourseSchema.safeParse({
      course_id: "COMP_SCI;111-0",
      subject: "COMP_SCI",
      catalog: "111-0",
      title: "Fundamentals of Computer Programming",
      sections: [
        {
          section_id: "COMP_SCI;abc",
          course_id: "COMP_SCI;111-0",
          subject: "COMP_SCI",
          catalog: "111-0",
          title: "Fundamentals of Computer Programming",
          section: "1",
          component: "LEC",
          meeting_days: ["MoWeFr", null],
          start_time: [{ h: 13, m: 0 }, null],
          end_time: [{ h: 13, m: 50 }, null],
          room: ["Tech LR2", null]
        }
      ]
    });
    expect(result.success).toBe(true);
  });

  it("rejects a section that's missing required fields", () => {
    const result = PaperTermCourseSchema.safeParse({
      course_id: "COMP_SCI;111-0",
      subject: "COMP_SCI",
      catalog: "111-0",
      title: "x",
      sections: [{ section_id: "x" }]
    });
    expect(result.success).toBe(false);
  });

  it("rejects when sections is not an array", () => {
    const result = PaperTermCourseSchema.safeParse({
      course_id: "x",
      subject: "x",
      catalog: "x",
      title: "x",
      sections: "no"
    });
    expect(result.success).toBe(false);
  });
});
