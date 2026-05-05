import { describe, expect, it, vi } from "vitest";

import { el, ensureStyle } from "./dom";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

describe("el()", () => {
  it("creates an empty element of the requested tag", () => {
    const doc = fresh();
    const node = el(doc, "div");
    expect(node.tagName).toBe("DIV");
    expect(node.className).toBe("");
    expect(node.textContent).toBe("");
    expect(node.children.length).toBe(0);
  });

  it("sets className from `class`", () => {
    const doc = fresh();
    const node = el(doc, "span", { class: "x y" });
    expect(node.className).toBe("x y");
  });

  it("sets textContent from `text` without using innerHTML", () => {
    const doc = fresh();
    const node = el(doc, "p", { text: "<b>literal</b>" });
    expect(node.textContent).toBe("<b>literal</b>");
    // Confirm it's a text node, not parsed markup.
    expect(node.children.length).toBe(0);
    expect(node.firstChild?.nodeType).toBe(doc.TEXT_NODE);
  });

  it("sets innerHTML from `html` and parses children", () => {
    const doc = fresh();
    const node = el(doc, "div", { html: "<i>x</i>" });
    expect(node.children.length).toBe(1);
    expect(node.children[0].tagName).toBe("I");
    expect(node.textContent).toBe("x");
  });

  it("throws when both `text` and `html` are provided", () => {
    const doc = fresh();
    expect(() => el(doc, "div", { text: "a", html: "<b>b</b>" })).toThrow();
  });

  it("applies dataset and skips undefined values", () => {
    const doc = fresh();
    const node = el(doc, "div", { dataset: { foo: "bar", baz: undefined } });
    expect(node.dataset.foo).toBe("bar");
    expect(node.dataset.baz).toBeUndefined();
    expect(node.getAttribute("data-baz")).toBeNull();
  });

  it("sets attrs via setAttribute and skips undefined values", () => {
    const doc = fresh();
    const node = el(doc, "div", {
      attrs: { "aria-label": "hi", role: "button", title: undefined }
    });
    expect(node.getAttribute("aria-label")).toBe("hi");
    expect(node.getAttribute("role")).toBe("button");
    expect(node.hasAttribute("title")).toBe(false);
  });

  it("registers event listeners via `on`", () => {
    const handler = vi.fn();
    const node = el(document, "button", { on: { click: handler } });
    node.dispatchEvent(new Event("click"));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("applies style declarations", () => {
    const doc = fresh();
    const node = el(doc, "div", { style: { color: "red", marginTop: "4px" } });
    expect(node.style.color).toBe("red");
    expect(node.style.marginTop).toBe("4px");
  });

  it("appends children — strings become text nodes; falsy entries are skipped; order preserved", () => {
    const doc = fresh();
    const inner = doc.createElement("span");
    inner.textContent = "B";
    const node = el(doc, "div", undefined, ["A", inner, null, undefined, false, "C"]);
    expect(node.childNodes.length).toBe(3);
    expect(node.childNodes[0].nodeType).toBe(doc.TEXT_NODE);
    expect(node.childNodes[0].textContent).toBe("A");
    expect(node.childNodes[1]).toBe(inner);
    expect(node.childNodes[2].textContent).toBe("C");
    expect(node.textContent).toBe("ABC");
  });

  it("combines class + text + children + listeners cleanly", () => {
    const handler = vi.fn();
    const node = el(
      document,
      "button",
      { class: "btn", on: { click: handler } },
      ["press"]
    );
    expect(node.className).toBe("btn");
    expect(node.textContent).toBe("press");
    node.dispatchEvent(new Event("click"));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("ensureStyle()", () => {
  it("creates a <style> with the given id and css on first call", () => {
    const doc = fresh();
    const style = ensureStyle(doc, "bc-test-1", "body { color: red }");
    expect(style.tagName).toBe("STYLE");
    expect(style.id).toBe("bc-test-1");
    expect(style.textContent).toBe("body { color: red }");
    expect(doc.head?.contains(style)).toBe(true);
  });

  it("returns the existing element on the second call and does not duplicate", () => {
    const doc = fresh();
    const a = ensureStyle(doc, "bc-test-2", "body { color: red }");
    const b = ensureStyle(doc, "bc-test-2", "body { color: red }");
    expect(b).toBe(a);
    expect(doc.querySelectorAll("style#bc-test-2").length).toBe(1);
  });

  it("updates textContent when called again with different css", () => {
    const doc = fresh();
    const first = ensureStyle(doc, "bc-test-3", "a { color: red }");
    const second = ensureStyle(doc, "bc-test-3", "a { color: blue }");
    expect(second).toBe(first);
    expect(second.textContent).toBe("a { color: blue }");
    expect(doc.querySelectorAll("style#bc-test-3").length).toBe(1);
  });

  it("falls back to documentElement when head is unavailable", () => {
    const doc = fresh();
    doc.head?.remove();
    const style = ensureStyle(doc, "bc-test-4", "x { }");
    expect(doc.documentElement.contains(style)).toBe(true);
  });
});
