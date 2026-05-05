import { html, render } from "lit-html";
import { describe, expect, it } from "vitest";

import type { Section } from "./section";

// Section is a structural type — these tests just verify that anything
// matching the contract can be rendered + plugged into lit-html, and that
// the optional `signature` slot does what the comment promises (lets a
// section opt in to coarse short-circuiting on top of lit-html's diffing).

describe("Section interface", () => {
  it("a minimal Section { render } can be constructed and produce a TemplateResult", () => {
    type Props = { label: string };
    const Trivial: Section<Props> = {
      render({ label }) {
        return html`<span>${label}</span>`;
      }
    };

    const root = document.createElement("div");
    render(Trivial.render({ label: "hello" }), root);
    expect(root.querySelector("span")?.textContent).toBe("hello");
  });

  it("renders update via lit-html diffing without rebuilding the host element", () => {
    type Props = { count: number };
    const Counter: Section<Props> = {
      render({ count }) {
        return html`<button>${count}</button>`;
      }
    };

    const root = document.createElement("div");
    render(Counter.render({ count: 1 }), root);
    const btn1 = root.querySelector("button")!;
    expect(btn1.textContent).toBe("1");

    render(Counter.render({ count: 2 }), root);
    const btn2 = root.querySelector("button")!;
    // Same element instance — lit-html updated the text without
    // recreating the node. This is the property that makes
    // dataset.bcPaperCtecSignature obsolete.
    expect(btn2).toBe(btn1);
    expect(btn2.textContent).toBe("2");
  });

  it("a Section may declare a signature() helper for coarse-grained skip checks", () => {
    type Props = { id: string; payload: number };
    const WithSig: Section<Props> = {
      render({ id, payload }) {
        return html`<i data-id=${id}>${payload}</i>`;
      },
      signature({ id, payload }) {
        return `${id}:${payload}`;
      }
    };

    expect(WithSig.signature?.({ id: "a", payload: 1 })).toBe("a:1");
    expect(WithSig.signature?.({ id: "a", payload: 2 })).toBe("a:2");
    // Different props → different signature so callers can detect change.
    expect(WithSig.signature?.({ id: "a", payload: 1 })).not.toBe(
      WithSig.signature?.({ id: "a", payload: 2 })
    );
  });

  it("Section composition: a parent Section can splat children Section results", () => {
    type LeafProps = { text: string };
    const Leaf: Section<LeafProps> = {
      render({ text }) {
        return html`<em>${text}</em>`;
      }
    };

    type ParentProps = { items: string[] };
    const Parent: Section<ParentProps> = {
      render({ items }) {
        return html`<ul>${items.map((text) => Leaf.render({ text }))}</ul>`;
      }
    };

    const root = document.createElement("div");
    render(Parent.render({ items: ["a", "b", "c"] }), root);
    const ems = Array.from(root.querySelectorAll("em"));
    expect(ems).toHaveLength(3);
    expect(ems.map((el) => el.textContent)).toEqual(["a", "b", "c"]);
  });

  it("Section without signature is still a valid Section", () => {
    type Props = { label: string };
    const NoSig: Section<Props> = {
      render({ label }) {
        return html`<span>${label}</span>`;
      }
    };
    expect(NoSig.signature).toBeUndefined();
    expect(typeof NoSig.render).toBe("function");
  });
});
