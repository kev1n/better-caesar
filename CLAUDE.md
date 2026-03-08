# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome/Firefox extension (Manifest V3) that augments Northwestern University's CAESAR course registration system. It adds faster class-level lookups, seat/notes display, enrollment navigation, CTEC rating navigation, and per-class CTEC evaluation links directly in the CAESAR UI.

## Commands

```bash
npm run build          # Build for both Chrome and Firefox (output: dist/chrome, dist/firefox)
npm run build:chrome   # Build for Chrome only
npm run build:firefox  # Build for Firefox only
npm run dev            # Watch mode for Chrome (single target only)
npm run typecheck      # Type-check without emitting (tsc --noEmit)
```

**Always run `npm run build:chrome` after every change** and confirm it passes before considering a task done. There are no tests.

Build output goes to `dist/<target>/`. Load `dist/chrome` as an unpacked extension in Chrome for development.

## Architecture

### Entry points (bundled by esbuild as IIFE)

- `src/background.ts` — Service worker (Chrome) / background script (Firefox).
- `src/content/index.ts` — Main content script injected into `caesar.ent.northwestern.edu`. Registers message handler and starts the augmentation runner.
- `src/content/bluera-probe.ts` — Content script injected into `northwestern.bluera.com` (CTEC evaluation pages).
- `src/popup/popup.ts` — Extension popup UI: on/off toggle switches for each augmentation feature.

### Augmentation plugin system

Each augmentation lives in `src/content/augmentations/<name>/`. Two patterns exist:

**`TemplateAugmentation<TTarget, TData>`** (`src/content/framework/template.ts`) — preferred for simple augmentations. Implement:
- `appliesToPage(doc)`, `collectTargets(doc)`, `targetKey(target)`, `shouldProcessTarget(target, key)`, `markLoading`, `fetchData`, `renderSuccess`, `renderError`

**Direct `Augmentation` interface** — used by `ctec-links` which needs retry-on-demand behavior and explicit in-flight tracking via a `Set<string>`.

`AugmentationRunner` (`src/content/framework/runner.ts`) runs all augmentations on load and re-runs on every DOM mutation (debounced via `requestAnimationFrame`) to handle PeopleSoft's AJAX navigation. It checks `isFeatureEnabled(augmentation.id)` (from `src/content/settings.ts`) before running each augmentation.

### Adding a new augmentation

1. Create `src/content/augmentations/<name>/` with an `index.ts` exporting a plugin instance.
2. Add it to `src/content/augmentations/registry.ts`.
3. Add it to the `FEATURES` list in `src/popup/popup.ts`.

### Feature toggles

`src/content/settings.ts` reads `better-caesar:features:v1` from `chrome.storage.local`. All features are **on by default** (`settings[id] !== false`). The popup renders toggle switches that write to this key.

### PeopleSoft layer (`src/content/peoplesoft/`)

- `context.ts` — reads session tokens and term/career codes from the live DOM
- `http.ts` — `fetchPeopleSoft` (POST) and `fetchPeopleSoftGet` (GET) for PeopleSoft AJAX requests
- `params.ts` — builds search and detail form parameters
- `parsers.ts` — parses PeopleSoft HTML responses into structured data
- `lookup.ts` — orchestrates a full class lookup (search → detail)
- `traffic.ts` — mutex to serialize PeopleSoft requests

### CTEC navigation storage

`src/content/augmentations/ctec-navigation/storage.ts` uses `chrome.storage.local` with an **in-memory write-through cache**. On startup, data is loaded once into `memoryStore`. All reads are synchronous (from memory); writes update memory immediately and persist async. Storage key: `better-caesar:ctec-index:v1`. Both `ctec-navigation` and `ctec-links` share this index.

### CTEC links augmentation (`src/content/augmentations/ctec-links/`)

Adds a per-class CTEC evaluation history widget to the shopping cart (`SSR_SSENRL_CART`).

**Key DOM selectors for shopping cart rows:**
- Class rows: `tr[bufnum]`
- Class name link: `a[id^='P_CLASS_NAME$']` or `a[id^='E_CLASS_NAME$']`
- Instructor: `[id^='DERIVED_REGFRM1_SSR_INSTR_LONG$']` (NOT `MTG_INSTR` — that's wrong)

**Flow:**
1. Cache hit via `readSubjectIndex(subject)` → filter by `entryMatchesCourse` → render immediately (no button)
2. No cache → render "CTEC" fetch button → on click, `fetchCourseEntries` navigates the CTEC results page, filters class rows by instructor before fetching Bluera URLs, writes partial index, returns results
3. Results sorted newest-first by `termToSortKey`. CTEC terms use "2016 Summer" (year-first) format.

**Instructor matching:** `entryMatchesCourse` tokenizes the query instructor name (tokens > 2 chars) and checks if any token appears in `entry.instructor`. The pre-filter in `fetchCourseEntries` uses the same logic to avoid fetching Bluera URLs for non-matching rows.

**Catalog number matching:** Uses a token regex `(?:^|\s)395(?:\s|$)` to match standalone catalog numbers — prevents "395" from matching "3950" and handles "395-0-21" style descriptions.

### PeopleSoft CTEC page navigation

The fetcher navigates: `buildSubjectResultsUrl` → GET subject results → find course row → POST `buildActionParams` → collect class rows via `collectClassRowsFromText` (reads `CTEC_INSTRUCTOR$N`, `MYDESCR2$N`, `MYDESCR$N`) → POST each class row → `extractBlueraUrl` from response.

State between requests is maintained via `ICStateNum` (extracted by `applyResponseState`) and hidden form inputs.

### Messaging (`src/shared/messages.ts`)

Typed Chrome message types shared between content scripts, background, and popup.

### Manifest

`src/manifest.base.json` is the shared base; `scripts/build.mjs` patches it per-target. Required permissions include `storage` (for `chrome.storage.local`).

## User preferences

- Build after every change — always run `npm run build:chrome` and verify it passes.
- Keep solutions minimal — don't add abstractions, error handling, or features beyond what's asked.
- No time estimates.
