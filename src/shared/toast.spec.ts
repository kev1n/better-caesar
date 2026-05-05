import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { showToast } from "./toast";

const TOAST_HOST_ID = "bc-seats-toast-host";
const TOAST_STYLE_ID = "bc-seats-toast-style";

describe("showToast()", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.querySelector(`#${TOAST_STYLE_ID}`)?.remove();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts the toast inside the host on document.body", () => {
    showToast("hello");
    const host = document.getElementById(TOAST_HOST_ID);
    expect(host).not.toBeNull();
    expect(host?.parentElement).toBe(document.body);
    const toast = host?.querySelector(".bc-toast");
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain("hello");
  });

  it("injects the toast styles once and reuses them across calls", () => {
    showToast("a");
    showToast("b");
    showToast("c");
    expect(document.querySelectorAll(`#${TOAST_STYLE_ID}`).length).toBe(1);
    expect(document.querySelectorAll(`#${TOAST_HOST_ID}`).length).toBe(1);
  });

  it("applies the tone-specific class", () => {
    showToast("warn me", { tone: "warn" });
    showToast("err me", { tone: "error" });
    const host = document.getElementById(TOAST_HOST_ID);
    expect(host?.querySelector(".bc-toast-warn")).not.toBeNull();
    expect(host?.querySelector(".bc-toast-error")).not.toBeNull();
  });

  it("defaults to info tone when no tone is provided", () => {
    showToast("default");
    const host = document.getElementById(TOAST_HOST_ID);
    expect(host?.querySelector(".bc-toast-info")).not.toBeNull();
  });

  it("auto-dismisses after the duration", () => {
    vi.useFakeTimers();
    showToast("bye", { durationMs: 1000 });
    const host = document.getElementById(TOAST_HOST_ID);
    expect(host?.querySelectorAll(".bc-toast").length).toBe(1);

    // Trigger the dismiss timer; toast should add the leaving class.
    vi.advanceTimersByTime(1000);
    const toast = host?.querySelector(".bc-toast");
    expect(toast?.classList.contains("bc-toast-leaving")).toBe(true);

    // 200ms later the toast removes itself from the DOM.
    vi.advanceTimersByTime(200);
    expect(host?.querySelectorAll(".bc-toast").length).toBe(0);
  });

  it("renders the action button and runs the callback on click", () => {
    const run = vi.fn();
    showToast("with action", {
      action: { label: "Retry", run }
    });
    const host = document.getElementById(TOAST_HOST_ID);
    const btn = host?.querySelector<HTMLButtonElement>(".bc-toast-action");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe("Retry");
    btn?.click();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("supports multiple toasts coexisting", () => {
    showToast("first");
    showToast("second");
    showToast("third");
    const host = document.getElementById(TOAST_HOST_ID);
    const toasts = host?.querySelectorAll(".bc-toast") ?? [];
    expect(toasts.length).toBe(3);
    const texts = Array.from(toasts).map((n) => n.textContent);
    expect(texts).toEqual(["first", "second", "third"]);
  });

  it("dismisses when the toast itself is clicked", () => {
    vi.useFakeTimers();
    showToast("click me");
    const host = document.getElementById(TOAST_HOST_ID);
    const toast = host?.querySelector<HTMLElement>(".bc-toast");
    expect(toast).not.toBeNull();
    toast?.click();
    expect(toast?.classList.contains("bc-toast-leaving")).toBe(true);
    vi.advanceTimersByTime(200);
    expect(host?.querySelectorAll(".bc-toast").length).toBe(0);
  });
});
