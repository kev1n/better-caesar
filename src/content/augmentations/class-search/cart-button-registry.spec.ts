import { describe, expect, it } from "vitest";

import { createCartButtonRegistry, type CartButtonState } from "./cart-button-registry";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function makeButton(doc: Document, sigKey?: string): HTMLButtonElement {
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.textContent = "Add to cart";
  if (sigKey) btn.dataset.sigKey = sigKey;
  doc.body.appendChild(btn);
  return btn;
}

describe("encodeSigKey / parseSigKey", () => {
  it("round-trips a sigKey through encode + parse", () => {
    const reg = createCartButtonRegistry();
    const parts = {
      termId: "4750",
      subject: "COMP_SCI",
      catalog: "111-0",
      sectionLabel: "1-LEC"
    };
    const key = reg.encodeSigKey(parts);
    expect(key).toContain("4750");
    expect(reg.parseSigKey(key)).toEqual(parts);
  });

  it("returns null for malformed sigKeys", () => {
    const reg = createCartButtonRegistry();
    expect(reg.parseSigKey("garbage")).toBeNull();
    expect(reg.parseSigKey("a|b|c")).toBeNull();
    expect(reg.parseSigKey("")).toBeNull();
  });

  it("uses the unit-separator (\\x1f) so subject/catalog with pipes survive", () => {
    const reg = createCartButtonRegistry();
    const parts = {
      termId: "4750",
      subject: "weird|subject",
      catalog: "111-0",
      sectionLabel: "1-LEC"
    };
    const key = reg.encodeSigKey(parts);
    expect(reg.parseSigKey(key)).toEqual(parts);
  });
});

describe("register / unregister / size", () => {
  it("register adds, unregister removes, size reflects state", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const a = makeButton(doc);
    const b = makeButton(doc);

    expect(reg.size()).toBe(0);
    reg.register("k1", a);
    reg.register("k2", b);
    expect(reg.size()).toBe(2);
    reg.unregister("k1");
    expect(reg.size()).toBe(1);
    reg.clear();
    expect(reg.size()).toBe(0);
  });

  it("re-register on the same key replaces the previous button", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const a = makeButton(doc);
    const b = makeButton(doc);
    reg.register("k1", a);
    reg.register("k1", b);
    expect(reg.size()).toBe(1);
    reg.applyCartStateBySigKey("k1", "in-cart");
    expect(b.dataset.state).toBe("in-cart");
    expect(a.dataset.state).toBeUndefined();
  });
});

describe("applyCartStateToButton — state machine", () => {
  it("paints 'in-cart' (disabled, label, title)", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const btn = makeButton(doc);
    reg.applyCartStateToButton(btn, "in-cart");
    expect(btn.dataset.state).toBe("in-cart");
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("In cart");
    expect(btn.title).toContain("shopping cart");
  });

  it("paints 'enrolled' (disabled, label, title)", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const btn = makeButton(doc);
    reg.applyCartStateToButton(btn, "enrolled");
    expect(btn.dataset.state).toBe("enrolled");
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe("Enrolled");
    expect(btn.title).toContain("enrolled");
  });

  it("null restores idle from a previously painted state", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const btn = makeButton(doc);
    reg.applyCartStateToButton(btn, "in-cart");
    expect(btn.disabled).toBe(true);
    reg.applyCartStateToButton(btn, null);
    expect(btn.dataset.state).toBe("");
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("Add to cart");
    expect(btn.title).toBe("");
  });

  it("null is a no-op when the button isn't already painted", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const btn = makeButton(doc);
    btn.dataset.state = "";
    btn.textContent = "Add to cart";
    reg.applyCartStateToButton(btn, null);
    expect(btn.dataset.state).toBe("");
    expect(btn.disabled).toBe(false);
  });

  it("skips buttons mid-flight (dataset.state === 'loading')", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const btn = makeButton(doc);
    btn.dataset.state = "loading";
    btn.disabled = true;
    btn.textContent = "Loading…";
    reg.applyCartStateToButton(btn, "in-cart");
    // Untouched.
    expect(btn.dataset.state).toBe("loading");
    expect(btn.textContent).toBe("Loading…");
  });
});

describe("applyCartStateBySigKey", () => {
  it("looks up by sigKey and applies", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const btn = makeButton(doc, "k1");
    reg.register("k1", btn);
    reg.applyCartStateBySigKey("k1", "enrolled");
    expect(btn.dataset.state).toBe("enrolled");
  });

  it("is a no-op when the sigKey isn't registered", () => {
    const reg = createCartButtonRegistry();
    expect(() => reg.applyCartStateBySigKey("missing", "in-cart")).not.toThrow();
  });
});

describe("repaintAll", () => {
  it("calls getCartState for every registered button and applies the result", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const a = makeButton(doc);
    const b = makeButton(doc);
    const c = makeButton(doc);
    reg.register("ka", a);
    reg.register("kb", b);
    reg.register("kc", c);

    const map: Record<string, CartButtonState> = {
      ka: "in-cart",
      kb: "enrolled",
      kc: null
    };
    reg.repaintAll((sigKey) => map[sigKey] ?? null);

    expect(a.dataset.state).toBe("in-cart");
    expect(b.dataset.state).toBe("enrolled");
    // c was never painted, so null leaves it idle.
    expect(c.disabled).toBe(false);
  });

  it("GCs detached buttons during repaint", () => {
    const doc = fresh();
    const reg = createCartButtonRegistry();
    const live = makeButton(doc);
    const dead = doc.createElement("button"); // never appended → !isConnected
    reg.register("live", live);
    reg.register("dead", dead);
    expect(reg.size()).toBe(2);

    reg.repaintAll(() => "in-cart");

    expect(reg.size()).toBe(1);
    expect(live.dataset.state).toBe("in-cart");
    expect(dead.dataset.state).toBeUndefined();
  });
});
