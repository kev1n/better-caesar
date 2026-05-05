import { describe, expect, it } from "vitest";

import { createRelatedPickerController } from "./related-picker";
import type { RelatedSectionOption } from "../caesar-search";
import type { ResultRow } from "../types";
import type { PaperSection, PaperTermCourse } from "../paper-data";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function makeOption(overrides: Partial<RelatedSectionOption> = {}): RelatedSectionOption {
  return {
    rowIndex: 0,
    classNumber: "12345",
    section: "20",
    schedule: "MoWeFr 9:00am-9:50am",
    room: "Tech L168",
    instructor: "Riesbeck",
    status: "Open",
    ...overrides
  };
}

function makeRow(overrides: Partial<PaperTermCourse> = {}): ResultRow {
  const course: PaperTermCourse = {
    subject: "COMP_SCI",
    catalog: "111-0",
    title: "Fundamentals",
    sections: [],
    ...overrides
  } as unknown as PaperTermCourse;
  return { course, sections: [] };
}

function makeSection(): PaperSection {
  return {
    section: "20",
    component: "LEC"
  } as unknown as PaperSection;
}

function setupAnchor(doc: Document): HTMLLIElement {
  const ul = doc.createElement("ul");
  doc.body.appendChild(ul);
  const li = doc.createElement("li");
  li.className = "bc-cs-section";
  ul.appendChild(li);
  return li;
}

describe("createRelatedPickerController — open()", () => {
  it("renders the picker with one row per option and a heading from the row's course", () => {
    const doc = fresh();
    const sectionLi = setupAnchor(doc);
    const ctrl = createRelatedPickerController({ doc });

    void ctrl.open(
      [makeOption({ rowIndex: 0, section: "21" }), makeOption({ rowIndex: 1, section: "22" })],
      { row: makeRow(), section: makeSection(), sectionLi }
    );

    const pickerLi = doc.querySelector<HTMLLIElement>("li.bc-cs-related-row");
    expect(pickerLi).not.toBeNull();
    const options = doc.querySelectorAll(".bc-cs-related-option");
    expect(options.length).toBe(2);
    const title = doc.querySelector(".bc-cs-related-title")?.textContent ?? "";
    expect(title).toContain("COMP_SCI 111");
    expect(title).toContain("needs a related section");
  });

  it("resolves with the picked option when a row is clicked", async () => {
    const doc = fresh();
    const sectionLi = setupAnchor(doc);
    const ctrl = createRelatedPickerController({ doc });

    const opt = makeOption({ rowIndex: 7, section: "30" });
    const promise = ctrl.open([opt, makeOption({ rowIndex: 8 })], {
      row: makeRow(),
      section: makeSection(),
      sectionLi
    });

    const buttons = doc.querySelectorAll<HTMLButtonElement>(".bc-cs-related-option");
    const target = Array.from(buttons).find((b) => b.dataset.rowIndex === "7");
    target?.click();
    const result = await promise;
    expect(result?.rowIndex).toBe(7);
    expect(result?.section).toBe("30");
  });

  it("resolves null when the user clicks Cancel and removes the picker DOM", async () => {
    const doc = fresh();
    const sectionLi = setupAnchor(doc);
    const ctrl = createRelatedPickerController({ doc });

    const promise = ctrl.open([makeOption()], {
      row: makeRow(),
      section: makeSection(),
      sectionLi
    });

    const cancel = doc.querySelector<HTMLButtonElement>(".bc-cs-related-cancel");
    cancel?.click();
    const result = await promise;
    expect(result).toBeNull();
    expect(doc.querySelector(".bc-cs-related-row")).toBeNull();
  });

  it("disables every option button after a click so the user can't double-fire", async () => {
    const doc = fresh();
    const sectionLi = setupAnchor(doc);
    const ctrl = createRelatedPickerController({ doc });

    const promise = ctrl.open(
      [makeOption({ rowIndex: 0 }), makeOption({ rowIndex: 1 }), makeOption({ rowIndex: 2 })],
      { row: makeRow(), section: makeSection(), sectionLi }
    );

    const buttons = Array.from(
      doc.querySelectorAll<HTMLButtonElement>(".bc-cs-related-option")
    );
    buttons[0]!.click();
    await promise;

    for (const b of buttons) {
      expect(b.disabled).toBe(true);
    }
    expect(buttons[0]!.dataset.picked).toBe("true");
    // The clicked option also gets a progress stamp.
    expect(buttons[0]!.querySelector(".bc-cs-related-option-progress")?.textContent).toBe(
      "Adding…"
    );
  });

  it("close() after an option-click tears down the picker DOM", async () => {
    // Regression: pre-fix, the option-click handler nulled `activePickerLi`
    // so a follow-up `close()` (the consumer's post-continuation cleanup
    // hook) silently no-op'd — leaving the picker stuck on "Adding…" forever.
    const doc = fresh();
    const sectionLi = setupAnchor(doc);
    const ctrl = createRelatedPickerController({ doc });

    const promise = ctrl.open([makeOption()], {
      row: makeRow(),
      section: makeSection(),
      sectionLi
    });
    const buttons = doc.querySelectorAll<HTMLButtonElement>(".bc-cs-related-option");
    buttons[0]!.click();
    await promise;

    // Picker `<li>` is still attached during the continuation window.
    expect(doc.querySelector(".bc-cs-related-row")).not.toBeNull();

    ctrl.close();
    expect(doc.querySelector(".bc-cs-related-row")).toBeNull();
  });

  it("close() removes the picker and resolves the in-flight open() with null", async () => {
    const doc = fresh();
    const sectionLi = setupAnchor(doc);
    const ctrl = createRelatedPickerController({ doc });

    const promise = ctrl.open([makeOption()], {
      row: makeRow(),
      section: makeSection(),
      sectionLi
    });
    expect(doc.querySelector(".bc-cs-related-row")).not.toBeNull();

    ctrl.close();
    const result = await promise;
    expect(result).toBeNull();
    expect(doc.querySelector(".bc-cs-related-row")).toBeNull();
  });

  it("re-opening replaces the existing picker DOM without stacking", async () => {
    const doc = fresh();
    const sectionLi = setupAnchor(doc);
    const ctrl = createRelatedPickerController({ doc });

    const first = ctrl.open([makeOption()], {
      row: makeRow(),
      section: makeSection(),
      sectionLi
    });

    // The first open() resolves null when superseded by a second open().
    const second = ctrl.open(
      [makeOption({ rowIndex: 99, section: "99" })],
      { row: makeRow(), section: makeSection(), sectionLi }
    );
    await expect(first).resolves.toBeNull();

    expect(doc.querySelectorAll(".bc-cs-related-row").length).toBe(1);
    const options = doc.querySelectorAll<HTMLButtonElement>(".bc-cs-related-option");
    expect(options.length).toBe(1);
    expect(options[0]!.dataset.rowIndex).toBe("99");

    // Tear down the lingering second picker so the test exits cleanly.
    ctrl.close();
    await second;
  });

  it("anchors the picker as a sibling immediately after the section <li>", async () => {
    const doc = fresh();
    const sectionLi = setupAnchor(doc);
    const promise = createRelatedPickerController({ doc }).open([makeOption()], {
      row: makeRow(),
      section: makeSection(),
      sectionLi
    });

    const next = sectionLi.nextElementSibling;
    expect(next).not.toBeNull();
    expect(next?.classList.contains("bc-cs-related-row")).toBe(true);

    // Cleanup.
    doc.querySelector<HTMLButtonElement>(".bc-cs-related-cancel")?.click();
    await promise;
  });
});
