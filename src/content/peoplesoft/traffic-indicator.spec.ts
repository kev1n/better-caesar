import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runPeopleSoftTask, waitForPeopleSoftIdle } from "./traffic";
import { mountTrafficIndicator, unmountTrafficIndicator } from "./traffic-indicator";

const HOST_ID = "bc-traffic-indicator";

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(async () => {
  unmountTrafficIndicator(document);
  await waitForPeopleSoftIdle();
  document.body.innerHTML = "";
});

describe("traffic indicator", () => {
  it("stays hidden when only one task is active", async () => {
    mountTrafficIndicator(document);

    const gate = deferred();
    const task = runPeopleSoftTask("user", () => gate.promise, {
      owner: "solo",
      label: "Solo task"
    });

    await Promise.resolve();

    const host = document.getElementById(HOST_ID);
    expect(host).not.toBeNull();
    expect(host?.classList.contains("is-visible")).toBe(false);

    gate.resolve();
    await task;
  });

  it("becomes visible and lists tasks when depth >= 2", async () => {
    mountTrafficIndicator(document);

    const a = deferred();
    const b = deferred();
    const tA = runPeopleSoftTask("user", () => a.promise, {
      owner: "alpha",
      label: "Load CTEC for COMP_SCI 211"
    });
    const tB = runPeopleSoftTask("user", () => b.promise, {
      owner: "beta",
      label: "Load seats/notes for class 12345"
    });

    await Promise.resolve();

    const host = document.getElementById(HOST_ID);
    expect(host?.classList.contains("is-visible")).toBe(true);
    const text = host?.textContent ?? "";
    expect(text).toContain("Load CTEC for COMP_SCI 211");
    expect(text).toContain("Load seats/notes for class 12345");
    expect(text.toLowerCase()).toContain("now:");
    expect(text.toLowerCase()).toContain("queued:");

    a.resolve();
    await tA;
    b.resolve();
    await tB;

    // After the queue empties, the host hides again.
    expect(document.getElementById(HOST_ID)?.classList.contains("is-visible")).toBe(false);
  });

  it("unmount removes the host node and stops responding", async () => {
    mountTrafficIndicator(document);
    const a = deferred();
    const b = deferred();
    const tA = runPeopleSoftTask("user", () => a.promise, { owner: "alpha" });
    const tB = runPeopleSoftTask("user", () => b.promise, { owner: "beta" });

    await Promise.resolve();
    expect(document.getElementById(HOST_ID)).not.toBeNull();

    unmountTrafficIndicator(document);
    expect(document.getElementById(HOST_ID)).toBeNull();

    a.resolve();
    await tA;
    b.resolve();
    await tB;

    // No remount happens after unsubscribing.
    expect(document.getElementById(HOST_ID)).toBeNull();
  });
});
