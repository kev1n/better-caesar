import { describe, expect, it, vi } from "vitest";

import { createAuthRecovery, type AuthRecoveryDeps } from "./auth-recovery";

type Listener = (message: unknown) => void;

function makeRuntimeStub(): {
  runtime: typeof chrome.runtime;
  fireMessage: (message: unknown) => void;
  listeners: Set<Listener>;
  sendMessageMock: ReturnType<typeof vi.fn>;
} {
  const listeners = new Set<Listener>();
  const sendMessageMock = vi.fn().mockResolvedValue({ ok: true, tabId: 1 });
  const runtime = {
    onMessage: {
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l)
    },
    sendMessage: sendMessageMock
  } as unknown as typeof chrome.runtime;

  return {
    runtime,
    listeners,
    sendMessageMock,
    fireMessage(message: unknown) {
      // Iterate over a snapshot since listeners may self-remove during dispatch.
      for (const l of [...listeners]) l(message);
    }
  };
}

function makeDeps(): {
  deps: AuthRecoveryDeps;
  fireMessage: (m: unknown) => void;
  listeners: Set<Listener>;
  sendMessageMock: ReturnType<typeof vi.fn>;
} {
  const stub = makeRuntimeStub();
  return {
    deps: {
      chromeRuntime: stub.runtime,
      windowLocation: { assign: vi.fn() }
    },
    fireMessage: stub.fireMessage,
    listeners: stub.listeners,
    sendMessageMock: stub.sendMessageMock
  };
}

describe("createAuthRecovery — mutex", () => {
  it("concurrent ensure() calls share one Promise and open one popup", async () => {
    const { deps, fireMessage, sendMessageMock } = makeDeps();
    const recovery = createAuthRecovery(deps);

    const a = recovery.ensure("https://example.org/login");
    const b = recovery.ensure("https://example.org/login");
    expect(a).toBe(b);

    fireMessage({ type: "auth-popup-closed", reason: "succeeded" });
    await Promise.all([a, b]);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
  });

  it("a second ensure() after the first resolves opens a fresh popup", async () => {
    const { deps, fireMessage, sendMessageMock } = makeDeps();
    const recovery = createAuthRecovery(deps);

    const first = recovery.ensure("https://example.org/login");
    fireMessage({ type: "auth-popup-closed", reason: "succeeded" });
    await first;
    expect(sendMessageMock).toHaveBeenCalledTimes(1);

    const second = recovery.ensure("https://example.org/login");
    fireMessage({ type: "auth-popup-closed", reason: "succeeded" });
    await second;
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });
});

describe("createAuthRecovery — listener cleanup", () => {
  it("removes the onMessage listener after a successful handshake", async () => {
    const { deps, fireMessage, listeners } = makeDeps();
    const recovery = createAuthRecovery(deps);

    const job = recovery.ensure("https://example.org/login");
    expect(listeners.size).toBe(1);
    fireMessage({ type: "auth-popup-closed", reason: "succeeded" });
    await job;
    expect(listeners.size).toBe(0);
  });

  it("dispose() removes the listener and resets the mutex", async () => {
    const { deps, listeners } = makeDeps();
    const recovery = createAuthRecovery(deps);

    // Kick off an ensure() that we never resolve via fireMessage.
    void recovery.ensure("https://example.org/login");
    expect(listeners.size).toBe(1);

    recovery.dispose();
    expect(listeners.size).toBe(0);

    // After dispose, a new ensure() spins up a fresh listener.
    void recovery.ensure("https://example.org/login");
    expect(listeners.size).toBe(1);
    recovery.dispose();
  });

  it("rejects when the popup couldn't open and clears the listener", async () => {
    const { deps, listeners, sendMessageMock } = makeDeps();
    sendMessageMock.mockResolvedValueOnce({ ok: false, error: "no-tab" });
    const recovery = createAuthRecovery(deps);

    await expect(recovery.ensure("https://example.org/login")).rejects.toThrow(/sign-in tab/i);
    expect(listeners.size).toBe(0);
  });

  it("rejects when the user cancels (user-closed) and clears the listener", async () => {
    const { deps, listeners, fireMessage } = makeDeps();
    const recovery = createAuthRecovery(deps);

    const job = recovery.ensure("https://example.org/login");
    fireMessage({ type: "auth-popup-closed", reason: "user-closed" });
    await expect(job).rejects.toThrow(/canceled/i);
    expect(listeners.size).toBe(0);
  });

  it("forwards the loginUrl into the open-auth-popup message", async () => {
    const { deps, fireMessage, sendMessageMock } = makeDeps();
    const recovery = createAuthRecovery(deps);

    const job = recovery.ensure("https://login.example.org/sso");
    fireMessage({ type: "auth-popup-closed", reason: "succeeded" });
    await job;

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: "open-auth-popup",
      loginUrl: "https://login.example.org/sso"
    });
  });

  it("ignores unrelated runtime messages", async () => {
    const { deps, fireMessage, listeners } = makeDeps();
    const recovery = createAuthRecovery(deps);

    const job = recovery.ensure("https://example.org/login");
    fireMessage({ type: "something-else" });
    expect(listeners.size).toBe(1); // still waiting

    fireMessage({ type: "auth-popup-closed", reason: "succeeded" });
    await job;
    expect(listeners.size).toBe(0);
  });
});
