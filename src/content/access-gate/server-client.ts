import { fetchTextResultViaBackground } from "../remote-fetch";
import { FALLBACK_BUCKET_RELEASE_TIMESTAMPS } from "./constants";

// TODO: replace with the production schedule URL once the server is deployed,
// and add the host to `host_permissions` in src/manifest.base.json.
export const BUCKET_SCHEDULE_URL =
  "https://better-caesar.example.com/bucket-schedule.json";

const SCHEDULE_REFETCH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const SCHEDULE_STORAGE_KEY = "better-caesar:access-gate:bucket-schedule:v1";

// Wire format the schedule server must return:
//
//   {
//     "releases": [
//       "2026-06-01T17:00:00Z",
//       "2026-06-08T17:00:00Z",
//       "2026-06-15T17:00:00Z"
//     ]
//   }
//
// `releases` is exactly three ISO-8601 timestamps, ordered:
//   [0] Class of 2027 and earlier
//   [1] Class of 2028
//   [2] Class of 2029 and later (open release)
// Bucket N unlocks once Date.now() >= Date.parse(releases[N]).
//
// The server should serve this with permissive CORS (the extension fetches
// via the background worker, so any 200 response is fine) and a short
// cache-control max-age — the extension also caches client-side for 30 min.
export type BucketScheduleResponse = {
  releases: [string, string, string];
};

type CachedSchedule = {
  releaseAt: [number, number, number];
  fetchedAt: number;
};

export async function getBucketReleaseTimestamps(): Promise<readonly [number, number, number]> {
  const cached = await readCachedSchedule();
  if (cached && Date.now() - cached.fetchedAt < SCHEDULE_REFETCH_INTERVAL_MS) {
    return cached.releaseAt;
  }
  const fresh = await fetchSchedule();
  if (fresh) {
    await writeCachedSchedule({ releaseAt: fresh, fetchedAt: Date.now() });
    return fresh;
  }
  if (cached) return cached.releaseAt;
  return FALLBACK_BUCKET_RELEASE_TIMESTAMPS;
}

async function fetchSchedule(): Promise<[number, number, number] | null> {
  try {
    const response = await fetchTextResultViaBackground(BUCKET_SCHEDULE_URL);
    if (response.status < 200 || response.status >= 300) return null;
    const parsed = JSON.parse(response.text) as Partial<BucketScheduleResponse>;
    if (!Array.isArray(parsed.releases) || parsed.releases.length !== 3) return null;
    const out: number[] = [];
    for (const iso of parsed.releases) {
      const ms = typeof iso === "string" ? Date.parse(iso) : NaN;
      if (Number.isNaN(ms)) return null;
      out.push(ms);
    }
    return [out[0], out[1], out[2]];
  } catch {
    return null;
  }
}

async function readCachedSchedule(): Promise<CachedSchedule | null> {
  const result = (await chrome.storage.local.get(SCHEDULE_STORAGE_KEY)) as Record<string, unknown>;
  const raw = result[SCHEDULE_STORAGE_KEY];
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<CachedSchedule>;
  if (
    !Array.isArray(candidate.releaseAt) ||
    candidate.releaseAt.length !== 3 ||
    candidate.releaseAt.some((n) => typeof n !== "number")
  ) return null;
  return {
    releaseAt: candidate.releaseAt as [number, number, number],
    fetchedAt: typeof candidate.fetchedAt === "number" ? candidate.fetchedAt : 0
  };
}

async function writeCachedSchedule(value: CachedSchedule): Promise<void> {
  await chrome.storage.local.set({ [SCHEDULE_STORAGE_KEY]: value });
}
