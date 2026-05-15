// OAuth + Google Calendar API push — type architecture.
//
// This file captures the architectural decisions for the "one-click push
// to Google Calendar" feature. Nothing here is wired up yet; the
// implementation lands in a follow-up PR. Treat the types as a contract
// the implementation should honor — changing them later means revisiting
// the dependents.
//
// ──────────────────────────────────────────────────────────────────────
// Implementation plan (high level)
// ──────────────────────────────────────────────────────────────────────
//
// 1. Google Cloud Console setup (one-time, ~1 hour):
//    - Create a new GCP project named "Pencil.nu Extension"
//    - Enable the Google Calendar API
//    - Configure the OAuth consent screen (external, name + privacy
//      policy link + scope justification)
//    - Register a Chrome extension OAuth client. The extension's
//      public ID goes in the client config; the client ID comes back
//      into `manifest.base.json` under "oauth2".
//    - Submit for verification once we cross 100 users (Google's
//      unverified-app cap). ~2 weeks of review.
//
// 2. Manifest changes (chrome target only — Firefox needs a separate
//    launchWebAuthFlow implementation, ship later):
//      "permissions": ["identity"],
//      "oauth2": {
//        "client_id": "<from GCP>",
//        "scopes": ["https://www.googleapis.com/auth/calendar.events"]
//      }
//
// 3. Auth flow:
//      chrome.identity.getAuthToken({ interactive: true })
//    grants a short-lived access token Chrome refreshes for us. Store
//    nothing — read on demand.
//
// 4. Event construction:
//    Read paper.nu's `data_schedule` from its localforage IndexedDB
//    (same path paper-combos uses). For each meeting block, build a
//    GCalEvent with:
//      - DTSTART/DTEND in America/Chicago (NU's timezone)
//      - RRULE for weekly recurrence (BYDAY, UNTIL=term end)
//      - EXDATE for break weeks (Thanksgiving, spring break, etc.) —
//        TODO: source term break dates from NU's academic calendar
//      - iCalUID = stable hash of (section_id, term) so re-imports
//        update events instead of duplicating them
//
// 5. Push:
//    POST each event to
//      https://www.googleapis.com/calendar/v3/calendars/primary/events
//    Use POST not PATCH because iCalUID-based upserts use the import
//    endpoint (`/calendars/primary/events/import`), which IS the right
//    one here — confirms the iCalUID dedupe.
//
// 6. UI surface:
//    Inside the existing walkthrough modal's Google tab, add a
//      [Sign in with Google] button (shown when state === "unauthenticated")
//    that becomes
//      [Add 4 classes to Google Calendar] (when "authenticated")
//    Result toast: "✓ 4 classes added — open Google Calendar →"

// Auth state machine. Lives in memory on the augmentation; nothing
// gets persisted (Chrome's identity API handles token caching).
export type AuthState =
  | { kind: "unknown" } // pre-check
  | { kind: "unauthenticated" }
  | { kind: "authenticating" }
  | { kind: "authenticated"; token: string }
  | { kind: "error"; message: string };

// Minimal Google Calendar API event shape — only the fields we actually
// set. Full schema:
//   https://developers.google.com/calendar/api/v3/reference/events
export interface GCalEvent {
  summary: string;
  location?: string;
  description?: string;
  start: GCalEventTime;
  end: GCalEventTime;
  // RFC 5545 recurrence rules — e.g.
  //   ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260606T235959Z"]
  recurrence?: string[];
  // Idempotency key — same UID across re-imports replaces the prior
  // event instead of creating a duplicate. Required for the dedupe
  // pattern in the implementation plan.
  iCalUID?: string;
}

export interface GCalEventTime {
  // ISO 8601, e.g. "2026-04-06T09:30:00"
  dateTime: string;
  // IANA zone, e.g. "America/Chicago"
  timeZone: string;
}

// Result of a batched push. Each failure carries the section title so
// the UI can show "Failed to add: COMP_SCI 211, MATH 220-2" without
// the user opening DevTools.
export interface PushResult {
  successful: number;
  failed: Array<{ title: string; reason: string }>;
}

// Input handed to scheduleToEvents() — already-decoded shape of what
// paper.nu stores in `data_schedule`. The implementation will adapt
// from paper-combos's `ComboSection` to this so we don't duplicate
// parsing logic.
export interface ScheduleSnapshot {
  termId: string;
  // ISO date of the term's first instruction day (Mon of week 1).
  termStart: string;
  // ISO date of the term's last instruction day.
  termEnd: string;
  // Break-week exclusion dates in ISO form — typically Thanksgiving
  // week (fall) or spring break (winter). Sourced from NU's academic
  // calendar; the implementation will hard-code each year's dates
  // until we have a real feed.
  termExclusions: string[];
  sections: ScheduleSection[];
}

export interface ScheduleSection {
  sectionId: string;
  subject: string; // "COMP_SCI"
  catalog: string; // "211-0"
  title: string; // "Fundamentals of Programming"
  section: string; // "20"
  instructor?: string;
  location?: string;
  meetings: ScheduleMeeting[];
}

export interface ScheduleMeeting {
  // 0 = Monday … 6 = Sunday. Paper.nu uses Mon=0; we keep that here
  // and translate to RFC 5545 BYDAY codes (MO, TU, ...) at emit time.
  days: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

// Calendar API scopes we'll request. `calendar.events` is the narrow
// one — lets us create events but NOT enumerate calendars or modify
// settings. Trades flexibility (can't auto-create a dedicated
// "Northwestern Classes" calendar) for a less alarming consent screen.
// Revisit if we want the dedicated-calendar UX later.
export const GCAL_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events"
] as const;

// Northwestern's quarter system runs in Central Time year-round. All
// event DTSTART/DTEND emit with this timezone tag; calendar apps
// handle DST transitions themselves.
export const NU_TIMEZONE = "America/Chicago";
