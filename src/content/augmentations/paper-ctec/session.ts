import type {
  PaperCtecAnalyticsState,
  PaperCtecStatusBarData,
  PaperCtecWidgetData
} from "./types";

type ProgressMessage = { message: string; updatedAt: number };

type BuildStatusBarDataArgs = {
  visibleKeys: Set<string>;
  resolved: Map<string, PaperCtecWidgetData>;
  analyticsResolved: Map<string, PaperCtecAnalyticsState>;
  inFlight: Map<string, unknown>;
  analyticsInFlight: Map<string, unknown>;
  loadingMessages: Map<string, ProgressMessage>;
  awaitingAuthRetry: boolean;
};

export function buildStatusBarData(args: BuildStatusBarDataArgs): PaperCtecStatusBarData | null {
  if (args.visibleKeys.size === 0) return null;

  let foundCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  let frontAuthCount = 0;
  const authKeys = new Set<string>();
  let loginUrl: string | undefined;
  let activeCount = 0;

  for (const key of args.visibleKeys) {
    if (args.inFlight.has(key) || args.analyticsInFlight.has(key)) {
      activeCount += 1;
    }

    const value = args.resolved.get(key);
    if (value?.state === "found") foundCount += 1;
    if (value?.state === "not-found") notFoundCount += 1;
    if (value?.state === "error") errorCount += 1;
    if (value?.state === "auth-required") {
      frontAuthCount += 1;
      authKeys.add(key);
      loginUrl ||= value.loginUrl;
    }

    const analytics = args.analyticsResolved.get(key);
    if (analytics?.state === "auth-required") {
      authKeys.add(key);
      loginUrl ||= analytics.loginUrl;
    }
  }

  const totalCount = args.visibleKeys.size;
  const authCount = authKeys.size;
  const resolvedCount = foundCount + notFoundCount + errorCount + frontAuthCount;
  const latestMessage = getLatestProgressMessage(args.visibleKeys, args.loadingMessages);

  if (authCount > 0) {
    return {
      state: "auth-required",
      totalCount,
      resolvedCount,
      activeCount,
      foundCount,
      notFoundCount,
      errorCount,
      authCount,
      latestMessage,
      loginUrl,
      awaitingAuthRetry: args.awaitingAuthRetry
    };
  }

  // Suppress the loading bar entirely until we have at least one verified
  // resolution. Otherwise a brief race during syncTargets — setProgress runs
  // before inFlight.set, so activeCount is momentarily 0 — flashes a
  // "Loading CTECs · 0/N classes checked" bar that's gone milliseconds later.
  const verifiedResolvedCount = foundCount + notFoundCount + errorCount;
  if (verifiedResolvedCount === 0) {
    return null;
  }

  if (activeCount > 0 || resolvedCount < totalCount) {
    return {
      state: "loading",
      totalCount,
      resolvedCount,
      activeCount,
      foundCount,
      notFoundCount,
      errorCount,
      authCount,
      latestMessage
    };
  }

  return {
    state: "ready",
    totalCount,
    resolvedCount,
    activeCount,
    foundCount,
    notFoundCount,
    errorCount,
    authCount
  };
}

export function clearAuthRequiredStates(
  resolved: Map<string, PaperCtecWidgetData>,
  analyticsResolved: Map<string, PaperCtecAnalyticsState>
): void {
  for (const [key, value] of Array.from(resolved.entries())) {
    if (value.state === "auth-required") {
      resolved.delete(key);
    }
  }

  for (const [key, value] of Array.from(analyticsResolved.entries())) {
    if (value.state === "auth-required") {
      analyticsResolved.delete(key);
    }
  }
}

function getLatestProgressMessage(
  visibleKeys: Set<string>,
  loadingMessages: Map<string, ProgressMessage>
): string | undefined {
  let latest: ProgressMessage | undefined;

  for (const key of visibleKeys) {
    const progress = loadingMessages.get(key);
    if (!progress) continue;
    if (!latest || progress.updatedAt > latest.updatedAt) {
      latest = progress;
    }
  }

  return latest?.message;
}
