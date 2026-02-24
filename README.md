# Better CAESER Extension (Dual Target: Chrome + Firefox)

This repo now has a single TypeScript WebExtension codebase that builds for both browsers:

- `dist/chrome` for Chrome/Chromium (MV3 service worker)
- `dist/firefox` for Firefox (MV3 background scripts fallback)

## Recommended stack

- TypeScript: strict typing for brittle PeopleSoft form/state fields.
- Esbuild: fast local iteration and simple multi-target output.
- Manifest generation per target: one shared base manifest + browser-specific background config.
- Content-script-first CAESAR client: requests run in page context with user session cookies.

This is the best pragmatic setup here because CAESAR is stateful (`ICSID`, `ICStateNum`, `ICAction`) and same-origin requests from an active authenticated tab are the least fragile pattern.

## Project structure

- `src/content/framework/*`: reusable augmentation template + runner
- `src/content/augmentations/*`: independent page enhancements (plugin-style)
- `src/content/peoplesoft/*`: PeopleSoft request + parse logic
- `src/popup/*`: UI for class number lookup
- `src/shared/*`: typed message contracts
- `src/manifest.base.json`: shared manifest fields
- `scripts/build.mjs`: emits browser-specific bundles/manifests

## Augmentation architecture

Each enhancement follows a template pattern:

1. identify applicable pages
2. collect target DOM nodes
3. fetch any required data
4. render the UI change

Register plugins in `src/content/augmentations/registry.ts` so you can add many independent improvements without coupling them together.

Boundary rule:
- `src/content/peoplesoft/*` should stay generic (request orchestration + generic search/detail payloads).
- Feature-specific extraction/parsing (like seats + notes) belongs inside that feature folder under `src/content/augmentations/*`.

## Commands

```bash
npm install
npm run typecheck
npm run build
```

Target-specific builds:

```bash
npm run build:chrome
npm run build:firefox
```

Watch mode (Chrome target):

```bash
npm run dev
```

## Load extension

Chrome:
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked -> `dist/chrome`

Firefox:
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Choose `dist/firefox/manifest.json`

## Current behavior

- Enrollment navigation helper:
  - Intercepts Shopping Cart / Enroll clicks and acquires a PeopleSoft traffic lock (aborts in-flight seat/notes lookups, then waits for idle before navigating).
  - Applies an early term-page visual mask + spinner so the intermediate selector page is not shown during auto-continue.
  - Adds a Tyrian term-switch dropdown across enrollment workflow pages (`Shopping Cart`, `Drop`, `Update`, `Swap`); selecting a term routes through term selector with the chosen term pre-selected.
- Content script auto-detects shopping cart rows (`P_CLASS_NAME$N`) and injects a metadata card next to each class.
- For each class number, it performs a CAESAR class search request and displays parsed metadata inline.
- Responses are cached by class number to avoid duplicate requests in the same page session.
- Popup sends a class number to the content script on the active CAESAR tab.
- Content script serializes current `win0` form state.
- It posts a class-search action with your class number.
- It returns parsed summary values (criteria class number, first result class number/title/section, details action id).

## Notes

- Treat session cookies/tokens as sensitive credentials.
- If CAESAR changes field suffixes (like `$8`), this code tries prefix-based discovery first and falls back to known defaults.
