import { afterEach, describe, expect, it } from "vitest";

import {
  runPeopleSoftTask,
  snapshotTraffic,
  subscribeTraffic,
  waitForPeopleSoftIdle,
  type TrafficSnapshot
} from "./traffic";

// Helper: a "task" that hangs until we resolve it from the test, so we
// can pin the active slot and observe the queue without racing the
// microtask scheduler.
function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(async () => {
  // Drain any in-flight tasks so each test starts clean.
  await waitForPeopleSoftIdle();
});

describe("traffic snapshot + subscription", () => {
  it("starts empty", () => {
    const snapshot = snapshotTraffic();
    expect(snapshot.active).toBeNull();
    expect(snapshot.pending).toEqual([]);
    expect(snapshot.depth).toBe(0);
  });

  it("counts active + pending in depth", async () => {
    const first = deferred();
    const second = deferred();

    const firstResult = runPeopleSoftTask("user", () => first.promise, {
      owner: "alpha",
      label: "First task"
    });
    const secondResult = runPeopleSoftTask("user", () => second.promise, {
      owner: "beta",
      label: "Second task"
    });

    // Yield so pumpQueue has a turn to mark the first task active.
    await Promise.resolve();

    const mid = snapshotTraffic();
    expect(mid.active?.owner).toBe("alpha");
    expect(mid.active?.label).toBe("First task");
    expect(mid.pending).toHaveLength(1);
    expect(mid.pending[0]?.owner).toBe("beta");
    expect(mid.depth).toBe(2);

    first.resolve();
    await firstResult;
    second.resolve();
    await secondResult;

    expect(snapshotTraffic().depth).toBe(0);
  });

  it("notifies subscribers on enqueue and on completion", async () => {
    const snapshots: TrafficSnapshot[] = [];
    const unsubscribe = subscribeTraffic((snapshot) => {
      snapshots.push(snapshot);
    });
    const initialCount = snapshots.length;
    expect(initialCount).toBeGreaterThanOrEqual(1);
    expect(snapshots[0]?.depth).toBe(0);

    const gate = deferred();
    const finished = runPeopleSoftTask("user", () => gate.promise, {
      owner: "subscriber-test",
      label: "Watched task"
    });

    // Enqueue tick should have fired at least one notification.
    expect(snapshots.length).toBeGreaterThan(initialCount);
    const peakDepth = Math.max(...snapshots.map((s) => s.depth));
    expect(peakDepth).toBeGreaterThanOrEqual(1);

    gate.resolve();
    await finished;

    // Final snapshot is empty.
    expect(snapshots[snapshots.length - 1]?.depth).toBe(0);

    unsubscribe();
  });

  it("unsubscribe stops further notifications", async () => {
    let calls = 0;
    const unsubscribe = subscribeTraffic(() => {
      calls += 1;
    });
    const baseline = calls;
    unsubscribe();

    const gate = deferred();
    const finished = runPeopleSoftTask("user", () => gate.promise, {
      owner: "unsub"
    });
    gate.resolve();
    await finished;

    expect(calls).toBe(baseline);
  });

  it("threads label through into the snapshot", async () => {
    const gate = deferred();
    const finished = runPeopleSoftTask("user", () => gate.promise, {
      owner: "labeller",
      label: "Load CTEC for COMP_SCI 211"
    });

    await Promise.resolve();

    const snapshot = snapshotTraffic();
    expect(snapshot.active?.label).toBe("Load CTEC for COMP_SCI 211");
    expect(typeof snapshot.active?.queuedAt).toBe("number");

    gate.resolve();
    await finished;
  });

  it("notifies when a pending background task is cancelled", async () => {
    // Active slot held by a user-priority task; queue another user task
    // and a background task behind it. A second user-priority enqueue
    // displaces the queued background task (per `prepareQueueForTask`).
    const active = deferred();
    const activePromise = runPeopleSoftTask("user", () => active.promise, {
      owner: "active"
    });
    await Promise.resolve();

    const queuedBg = runPeopleSoftTask("background", () => Promise.resolve(), {
      owner: "queued-bg"
    }).catch(() => "cancelled");

    const snapshots: TrafficSnapshot[] = [];
    const unsubscribe = subscribeTraffic((s) => snapshots.push(s));
    const baseline = snapshots.length;

    // Newer user task — this triggers `prepareQueueForTask` to cancel
    // the queued background task.
    const followup = deferred();
    const followupPromise = runPeopleSoftTask("user", () => followup.promise, {
      owner: "followup"
    });

    expect(snapshots.length).toBeGreaterThan(baseline);
    expect(await queuedBg).toBe("cancelled");

    active.resolve();
    await activePromise;
    followup.resolve();
    await followupPromise;

    unsubscribe();
  });
});
