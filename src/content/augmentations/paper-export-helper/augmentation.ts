import type { Augmentation } from "../../framework";
import { FEATURE_ID } from "./constants";

function isPaperHost(): boolean {
  const host = window.location.hostname;
  return host === "paper.nu" || host === "www.paper.nu";
}

export class PaperExportHelperAugmentation implements Augmentation {
  readonly id = FEATURE_ID;

  run(_doc: Document = document): void {
    if (!isPaperHost()) return;
    // Subsequent commits wire up the button interception, modal, and
    // walkthrough content. This commit just registers the plugin so the
    // popup toggle has somewhere to flip to.
  }

  cleanup(_doc: Document = document): void {
    // No DOM footprint yet; later commits will tear down listeners and
    // injected styles here.
  }
}
