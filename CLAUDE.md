# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome/Firefox extension (Manifest V3) that augments Northwestern University's CAESAR course registration system. It adds faster class-level lookups, seat/notes display, enrollment navigation, and CTEC rating navigation directly in the CAESAR UI.

## Commands

```bash
npm run build          # Build for both Chrome and Firefox (output: dist/chrome, dist/firefox)
npm run build:chrome   # Build for Chrome only
npm run build:firefox  # Build for Firefox only
npm run dev            # Watch mode for Chrome (single target only)
npm run typecheck      # Type-check without emitting (tsc --noEmit)
```

After any changes, run `npm run build` to build the extension.

Build output goes to `dist/<target>/`. Load `dist/chrome` as an unpacked extension in Chrome for development.

There are no tests.

## Architecture

### Entry points (bundled by esbuild as IIFE)

- `src/background.ts` — Service worker (Chrome) / background script (Firefox). Handles CTEC data fetching via background fetch or tab scraping.
- `src/content/index.ts` — Main content script injected into `caesar.ent.northwestern.edu`. Registers message handler and starts the augmentation runner.
- `src/content/bluera-probe.ts` — Content script injected into `northwestern.bluera.com` (CTEC evaluation pages).
- `src/popup/popup.ts` — Extension popup UI.

### Augmentation plugin system

The core pattern is a **template method** in `src/content/framework/template.ts`. Each augmentation extends `TemplateAugmentation<TTarget, TData>` and implements:

- `appliesToPage(doc)` — guard: does this augmentation apply to the current page?
- `collectTargets(doc)` — find DOM nodes to enhance
- `targetKey(target)` — deduplicate targets (results are cached by key)
- `shouldProcessTarget(target, key)` — skip already-processed targets
- `markLoading(target, key)` — inject loading state UI
- `fetchData(target, key, doc)` — async data fetch (queued serially, cached)
- `renderSuccess(target, data, key)` / `renderError(target, error, key)` — apply UI

`AugmentationRunner` (`src/content/framework/runner.ts`) runs all augmentations on load and re-runs them on every DOM mutation (debounced via `requestAnimationFrame`) to handle PeopleSoft's AJAX navigation.

### Adding a new augmentation

1. Create `src/content/augmentations/<name>/` with an `index.ts` exporting a plugin instance.
2. Add it to `src/content/augmentations/registry.ts`.

### PeopleSoft layer (`src/content/peoplesoft/`)

Handles authenticated interaction with the PeopleSoft backend underlying CAESAR:

- `context.ts` — reads session tokens and term/career codes from the live DOM
- `http.ts` — posts form data to PeopleSoft action URLs
- `params.ts` — builds search and detail form parameters
- `parsers.ts` — parses PeopleSoft HTML responses into structured data
- `lookup.ts` — orchestrates a full class lookup (search → detail)
- `traffic.ts` — mutex to serialize PeopleSoft requests

### Messaging (`src/shared/messages.ts`)

Typed Chrome message types shared between content scripts, background, and popup. The content script registers a `lookup-class` message handler that drives PeopleSoft lookups on behalf of the popup.

### Manifest

`src/manifest.base.json` is the shared base; `scripts/build.mjs` patches it per-target (adds `service_worker` for Chrome, `scripts` + `browser_specific_settings` for Firefox).
