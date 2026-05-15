# OAuth + Google Calendar setup — handoff

## For [collaborator]

Hey — I need you to do the Google Cloud Console + OAuth-verification side
of the "push schedule directly to Google Calendar" feature for pencil.nu.
The code work I'll handle. You won't touch any code. Steps are below.

If you want help, paste the rest of this file into a Claude Code session
inside the pencil.nu repo and ask it to walk you through whichever step
you're on — the "For Claude" sections give it everything it needs to be
useful.

Branch with the type contract: `claude/oauth-gcal-push`
Files to look at: `src/content/augmentations/paper-export-helper/oauth/`

---

## For Claude — what we're building

pencil.nu is a Chrome/Firefox extension that augments paper.nu and
CAESAR for Northwestern students. Version 0.9.3 just shipped a
"walkthrough modal for calendar export" — when a user clicks
paper.nu's `EXPORT → Export to calendar` button, our extension
intercepts and shows step-by-step instructions for importing the
generated `.ics` file into Google Calendar, Apple Calendar, or
Outlook.

The current flow still requires the user to download a `.ics` file
and import it manually. The next iteration: a "Sign in with Google"
button on the Google Calendar tab of the walkthrough modal, which
on first click runs an OAuth consent flow and on subsequent clicks
pushes the user's schedule directly into their Google Calendar — no
file, no drag-and-drop, no tab switching.

For Apple Calendar and Outlook there's no equivalent native API
flow, so those tabs stay as the existing `.ics`-download path.

## For Claude — what already exists

On the `claude/oauth-gcal-push` branch (off `main`):

- `src/content/augmentations/paper-export-helper/oauth/types.ts`
  Architectural decisions captured as types:
  - `AuthState` — discriminated union for the auth state machine
    (`unknown` / `unauthenticated` / `authenticating` /
    `authenticated` / `error`).
  - `GCalEvent` — the subset of Google Calendar API event shape we
    actually set: summary, location, start/end times, recurrence
    array (RFC 5545), iCalUID for idempotent re-imports.
  - `ScheduleSnapshot` — input shape adapter from paper-combos's
    `ComboSection` to what `scheduleToEvents()` will consume.
  - Constants: `GCAL_SCOPES = ["…/auth/calendar.events"]`,
    `NU_TIMEZONE = "America/Chicago"`.
- `src/content/augmentations/paper-export-helper/oauth/HANDOFF.md`
  This file.

Nothing wired up yet. No imports of `oauth/types.ts` from elsewhere
in the codebase. No manifest changes.

## For Claude — Google Cloud Console steps the collaborator is doing

1. Create a new Google Cloud project named **Pencil.nu Extension**.
   - Use a Northwestern-affiliated Google Workspace account if
     possible (cleaner trust signal during verification).
   - Note the Project ID — it'll be needed in the manifest.

2. Enable the **Google Calendar API** in the project (APIs &
   Services → Library → search "Google Calendar API" → Enable).

3. Configure the **OAuth consent screen** (APIs & Services → OAuth
   consent screen):
   - User type: **External** (Northwestern Google Workspace doesn't
     let us scope to "Internal" since we want personal Gmail users
     too).
   - App name: `Pencil.nu`
   - User support email: jason's email
   - App logo: pencil-128.png from `src/assets/icons/`
   - Developer contact: jason's email
   - **Scopes**: add only `.../auth/calendar.events` — narrowest
     possible. Do NOT add `calendar` (full calendar read/write) —
     that triggers a stricter review tier without unlocking
     anything we need.
   - **Test users**: add jason's email + 1-2 NU emails for early
     testing. Stay under 100 test users while in "Testing" mode —
     verification not required for that mode.

4. **Register a Chrome extension OAuth client** (APIs & Services →
   Credentials → Create credentials → OAuth client ID):
   - Application type: **Chrome Extension** (not Web Application —
     this is critical; the wrong type breaks `chrome.identity`).
   - Application name: `Pencil.nu Extension`
   - Application ID: the extension's published ID from the Chrome
     Web Store listing. Get this from the CWS Developer Dashboard
     under the extension's "Package" section.
   - The Client ID Google generates needs to land in
     `src/manifest.base.json` under an `oauth2` block:
     ```json
     "oauth2": {
       "client_id": "<paste here>",
       "scopes": ["https://www.googleapis.com/auth/calendar.events"]
     }
     ```
     Send the Client ID to jason — don't commit it directly unless
     coordinating, since it's a public value but should land in one
     intentional commit.

## For Claude — OAuth verification (separate from CWS review)

The Chrome Web Store extension review is fast (hours, sometimes
minutes for established apps). It's NOT what we're talking about
here. Google Cloud's OAuth verification is a completely separate
process run by a different team. It gates user-facing OAuth flows
to "sensitive" scopes like `calendar.events`.

While the OAuth client is in **Testing mode**:
- Up to 100 explicitly-listed test users can sign in.
- No verification required.
- The consent screen shows an "unverified app" warning. Users have
  to click "Advanced → Go to Pencil.nu (unsafe)" to proceed.

To move to **Production mode** (any Google account can sign in,
warning gone):
- Submit for **OAuth verification** from the OAuth consent screen
  page → "Publish App" → "Prepare for verification".
- Materials needed:
  - Privacy Policy URL (hosted somewhere stable, e.g. a GitHub
    Pages site under the kev1n/pencil repo).
  - Terms of Service URL (same hosting).
  - App demo video (~2 min) showing the OAuth grant + the calendar
    write happening + the result in Google Calendar.
  - Scope justification: 1-2 paragraphs explaining why we need
    `calendar.events` (writing class schedule as recurring events
    to the user's primary calendar).
  - "How will users find your app" answer: link to the Chrome Web
    Store listing + the pencil.nu website if one exists.
- Review typical timeline for `calendar.events` (sensitive tier,
  not restricted): **2–6 weeks**. Google may come back with
  questions. Respond promptly to keep the queue position.

Strategy: submit verification BEFORE the implementation work
starts, so the review runs in parallel with the code. Worst case
the code lands while review is still pending — we ship to the 100
test-user beta whitelist first.

## For Claude — code path the agent (not the collaborator) will write

Once the Cloud Console side is done and the Client ID is in the
manifest, the work is roughly:

1. Add `"identity"` to the `permissions` array in
   `src/manifest.base.json`. Only landed in the chrome target —
   Firefox uses `browser.identity.launchWebAuthFlow` with a
   different signature, ship that later.

2. `oauth/auth.ts`: thin wrapper around
   `chrome.identity.getAuthToken({ interactive })`. Returns the
   `AuthState` discriminated union. Cache nothing — Chrome's
   identity API handles token refresh.

3. `oauth/event-builder.ts`: convert a `ScheduleSnapshot` to
   `GCalEvent[]`. Translate paper.nu's day-index → RFC 5545 BYDAY
   codes. Generate `RRULE:FREQ=WEEKLY;BYDAY=...;UNTIL=<termEnd>`
   per section. Add `EXDATE` entries for break-week exclusions
   (Thanksgiving, spring break — hard-coded per academic year
   until we have a real NU academic calendar feed).
   `iCalUID = hash(sectionId + termId)` so re-imports update events
   in place instead of duplicating.

4. `oauth/gcal-client.ts`: POST each event to
   `https://www.googleapis.com/calendar/v3/calendars/primary/events/import`
   (note: `import` endpoint, not `events` — required for the
   iCalUID-based upsert pattern). Batch in parallel, surface
   per-event failures back to the UI.

5. UI surface in `modal.ts`: on the Google Calendar tab, show
   - `[Sign in with Google]` when `AuthState.kind ===
     "unauthenticated"`
   - `[Add N classes to Google Calendar]` when `authenticated`
   - Result toast on success: "✓ N classes added — open Google
     Calendar →" with a deep link.

6. Tests in `oauth/`: unit-test `event-builder.ts` against fixture
   `ScheduleSnapshot`s and golden RFC 5545 strings.
   `auth.ts` + `gcal-client.ts` are thin enough that mocking
   `chrome.identity` + `fetch` is enough.

## For Claude — gotchas and decisions

- **Calendar choice**: events go to `primary` calendar, not a
  dedicated "Northwestern Classes" calendar. Creating a dedicated
  calendar would require the broader `calendar` scope (vs.
  `calendar.events`), triggering a stricter review tier. Revisit
  if users ask for separation.

- **Recurrence vs. one-event-per-meeting**: we emit `RRULE` for
  weekly recurrence. The alternative — N individual events per
  section — would blow up to ~150 events per typical schedule and
  make calendar updates much harder.

- **Timezone**: `America/Chicago` hard-coded. Northwestern's
  quarter system runs Central Time year-round; calendar apps
  handle DST transitions themselves. Do NOT emit UTC datetimes —
  they break when users travel between zones.

- **Duplicate handling**: `iCalUID` is the dedupe key. Same UID
  across re-imports = update, not duplicate. Implementation must
  use the `/events/import` endpoint, not `/events` — only `import`
  honors the supplied UID. This is poorly documented; the test
  suite must lock this in.

- **Firefox**: deliberately deferred. The `browser.identity.
  launchWebAuthFlow` API works but the flow is different enough
  (no token cache, manual refresh) that it deserves its own pass.
  Chrome-only for v1.
