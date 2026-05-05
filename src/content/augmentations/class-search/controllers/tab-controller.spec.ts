import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTabController } from "./tab-controller";

const HIDE_NATIVE_STYLE_ID = "better-caesar-class-search-hide-native";
const TAB_STORAGE_KEY = "better-caesar:class-search:active-tab";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  window.sessionStorage.clear();
});

describe("createTabController — getActive / setActive", () => {
  it("defaults to 'better' when nothing is persisted", () => {
    const ctrl = createTabController({ doc: fresh() });
    expect(ctrl.getActive()).toBe("better");
  });

  it("hydrates 'classic' from session storage", () => {
    window.sessionStorage.setItem(TAB_STORAGE_KEY, "classic");
    const ctrl = createTabController({ doc: fresh() });
    expect(ctrl.getActive()).toBe("classic");
  });

  it("setActive persists the change to session storage", () => {
    const ctrl = createTabController({ doc: fresh() });
    ctrl.setActive("classic");
    expect(ctrl.getActive()).toBe("classic");
    expect(window.sessionStorage.getItem(TAB_STORAGE_KEY)).toBe("classic");
  });

  it("setActive fires onTabChange only on actual change", () => {
    const seen: string[] = [];
    const ctrl = createTabController({
      doc: fresh(),
      onTabChange: (t) => seen.push(t)
    });
    ctrl.setActive("better"); // already "better" — no fire
    ctrl.setActive("classic"); // fire
    ctrl.setActive("classic"); // duplicate — no fire
    expect(seen).toEqual(["classic"]);
  });
});

describe("createTabController — applyVisibility", () => {
  it("installs the native-hider <style> and clears panel.display when active='better'", () => {
    const doc = fresh();
    const panel = doc.createElement("div");
    panel.style.display = "none";
    const ctrl = createTabController({ doc });
    // default active is "better"
    ctrl.applyVisibility(panel);
    expect(doc.getElementById(HIDE_NATIVE_STYLE_ID)).not.toBeNull();
    expect(panel.style.display).toBe("");
  });

  it("removes the native-hider and hides the panel when active='classic'", () => {
    const doc = fresh();
    const panel = doc.createElement("div");
    const ctrl = createTabController({ doc });
    // First apply better — installs hider.
    ctrl.applyVisibility(panel);
    expect(doc.getElementById(HIDE_NATIVE_STYLE_ID)).not.toBeNull();

    ctrl.setActive("classic");
    ctrl.applyVisibility(panel);
    expect(doc.getElementById(HIDE_NATIVE_STYLE_ID)).toBeNull();
    expect(panel.style.display).toBe("none");
  });

  it("is idempotent: re-applying the same active tab is a no-op", () => {
    const doc = fresh();
    const panel = doc.createElement("div");
    const ctrl = createTabController({ doc });
    ctrl.applyVisibility(panel);
    const firstStyle = doc.getElementById(HIDE_NATIVE_STYLE_ID);
    expect(firstStyle).not.toBeNull();
    // Drop the style under it; a no-op apply must NOT re-add it.
    firstStyle?.remove();
    ctrl.applyVisibility(panel);
    expect(doc.getElementById(HIDE_NATIVE_STYLE_ID)).toBeNull();
  });

  it("tolerates a null panel — only the hider style is touched", () => {
    const doc = fresh();
    const ctrl = createTabController({ doc });
    expect(() => ctrl.applyVisibility(null)).not.toThrow();
    expect(doc.getElementById(HIDE_NATIVE_STYLE_ID)).not.toBeNull();
  });
});

describe("createTabController — installNativeHider / cleanup", () => {
  it("installNativeHider adds the style only once", () => {
    const doc = fresh();
    const ctrl = createTabController({ doc });
    ctrl.installNativeHider(doc);
    ctrl.installNativeHider(doc);
    const styles = doc.querySelectorAll(`#${HIDE_NATIVE_STYLE_ID}`);
    expect(styles.length).toBe(1);
  });

  it("cleanup removes the native-hider style and resets the appliedTab tracker", () => {
    const doc = fresh();
    const panel = doc.createElement("div");
    const ctrl = createTabController({ doc });
    ctrl.applyVisibility(panel);
    expect(doc.getElementById(HIDE_NATIVE_STYLE_ID)).not.toBeNull();

    ctrl.cleanup(doc);
    expect(doc.getElementById(HIDE_NATIVE_STYLE_ID)).toBeNull();

    // After cleanup, applyVisibility must re-apply (not short-circuit).
    ctrl.applyVisibility(panel);
    expect(doc.getElementById(HIDE_NATIVE_STYLE_ID)).not.toBeNull();
  });
});
