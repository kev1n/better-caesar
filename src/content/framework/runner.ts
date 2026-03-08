import { isFeatureEnabled } from "../settings";
import type { Augmentation } from "./template";

export class AugmentationRunner {
  private readonly augmentations: Augmentation[];

  constructor(augmentations: Augmentation[]) {
    this.augmentations = augmentations;
  }

  start(): void {
    this.runAll();
    this.observeMutations();
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
}
