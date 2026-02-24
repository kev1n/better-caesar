const LOCK_KEY = "better-caeser:peoplesoft-lock";
const DEFAULT_LOCK_TTL_MS = 120_000;

type LockState = {
  owner: string;
  expiresAt: number;
};

let activeRequestCount = 0;
let idleResolvers: Array<() => void> = [];
let activeControllers = new Set<AbortController>();

export async function acquirePeopleSoftLock(
  owner: string,
  options?: { ttlMs?: number; waitForIdle?: boolean; abortActive?: boolean }
): Promise<void> {
  const ttlMs = options?.ttlMs ?? DEFAULT_LOCK_TTL_MS;
  const waitForIdle = options?.waitForIdle ?? true;
  const abortActive = options?.abortActive ?? false;

  writeLock({
    owner,
    expiresAt: Date.now() + ttlMs
  });

  if (abortActive) {
    abortActivePeopleSoftRequests();
  }

  if (waitForIdle) {
    await waitForPeopleSoftIdle();
  }
}

export function releasePeopleSoftLock(owner: string): void {
  const lock = readLock();
  if (!lock) return;
  if (lock.owner !== owner) return;
  clearLock();
}

export function beginPeopleSoftRequest(owner?: string): {
  signal: AbortSignal;
  finish: () => void;
} {
  if (isPeopleSoftLockedFor(owner)) {
    throw new Error("PeopleSoft requests are paused while term navigation is in progress.");
  }

  const controller = new AbortController();
  activeControllers.add(controller);
  activeRequestCount += 1;
  let done = false;

  return {
    signal: controller.signal,
    finish: () => {
      if (done) return;
      done = true;

      activeControllers.delete(controller);
      activeRequestCount = Math.max(0, activeRequestCount - 1);
      if (activeRequestCount === 0) {
        const resolvers = idleResolvers;
        idleResolvers = [];
        for (const resolve of resolvers) {
          resolve();
        }
      }
    }
  };
}

export function abortActivePeopleSoftRequests(): void {
  if (activeControllers.size === 0) return;
  for (const controller of Array.from(activeControllers)) {
    controller.abort("PeopleSoft request aborted due to navigation lock.");
  }
}

export async function waitForPeopleSoftIdle(): Promise<void> {
  if (activeRequestCount === 0) return;
  await new Promise<void>((resolve) => {
    idleResolvers.push(resolve);
  });
}

export function isPeopleSoftLockedFor(owner?: string): boolean {
  const lock = readLock();
  if (!lock) return false;
  if (owner && lock.owner === owner) return false;
  return true;
}

function readLock(): LockState | null {
  try {
    const raw = window.sessionStorage.getItem(LOCK_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LockState>;
    if (!parsed.owner || typeof parsed.expiresAt !== "number") {
      clearLock();
      return null;
    }

    if (parsed.expiresAt < Date.now()) {
      clearLock();
      return null;
    }

    return { owner: parsed.owner, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeLock(lock: LockState): void {
  try {
    window.sessionStorage.setItem(LOCK_KEY, JSON.stringify(lock));
  } catch {
    // Ignore storage errors.
  }
}

function clearLock(): void {
  try {
    window.sessionStorage.removeItem(LOCK_KEY);
  } catch {
    // Ignore storage errors.
  }
}
