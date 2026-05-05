// Augmentation interface — implemented by every plugin in
// `src/content/augmentations/`. The legacy `TemplateAugmentation` abstract
// class lived here too; it was removed in Wave 4 because no remaining plugin
// extended it (every plugin needed richer state than the base class
// provided, and the new `createPsCellGridRuntime` covers the
// duplication that motivated the abstract base in the first place).

export interface Augmentation {
  readonly id: string;
  run(doc?: Document): void;
  // Called when the user toggles this augmentation off (or any sub-flag
  // change that needs a full re-render). Must remove every DOM node, class,
  // or dataset marker the augmentation ever added so the host page is
  // visually indistinguishable from the never-installed state.
  cleanup?(doc?: Document): void;
}
