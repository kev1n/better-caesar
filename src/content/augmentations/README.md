# Augmentation Plugins

Each CAESAR enhancement should live in its own folder under `src/content/augmentations/` and follow the template-method lifecycle:

1. `appliesToPage` - decide if this page should be modified.
2. `collectTargets` - find the exact DOM nodes/rows to enhance.
3. `fetchData` - load any remote/stateful data needed for those targets.
4. `renderSuccess`/`renderError` - apply the UI changes.

## Wire-up steps

1. Create a new folder, e.g. `src/content/augmentations/my-feature/`.
2. Export a plugin instance from `index.ts`.
3. Add it to `src/content/augmentations/registry.ts`.

The shared runner in `src/content/framework/runner.ts` executes all registered plugins on initial load and after PeopleSoft AJAX DOM mutations.
