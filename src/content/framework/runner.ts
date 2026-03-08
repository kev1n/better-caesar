import { FEATURES_STORAGE_KEY, isFeatureEnabled } from "../settings";
import type { Augmentation } from "./template";

export class AugmentationRunner {
  private readonly augmentations: Augmentation[];

  constructor(augmentations: Augmentation[]) {
    this.augmentations = augmentations;
  }

  start(): void {
    this.runAll();
    this.observeMutations();
    this.observeSettings();
  }

  private runAll(): void {
    for (const augmentation of this.augmentations) {
      if (!isFeatureEnabled(augmentation.id)) continue;
      augmentation.run(document);
    }
  }

  private observeMutations(): void {
    const root = document.body ?? document.documentElement;
    if (!root) return;

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;

      requestAnimationFrame(() => {
        scheduled = false;
        this.runAll();
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true
    });
  }

  private observeSettings(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes[FEATURES_STORAGE_KEY]) return;
      this.runAll();
    });
  }
}
