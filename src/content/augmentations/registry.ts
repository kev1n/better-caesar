import type { Augmentation } from "../framework";
import { ctecLinksAugmentation } from "./ctec-links";
import { ctecNavigationAugmentation } from "./ctec-navigation";
import { enrollmentNavigationAugmentation } from "./enrollment-navigation";
import { paperCtecAugmentation } from "./paper-ctec";
import { seatsNotesAugmentation } from "./seats-notes";

export const augmentationRegistry: Augmentation[] = [
  enrollmentNavigationAugmentation,
  ctecLinksAugmentation,
  ctecNavigationAugmentation,
  paperCtecAugmentation,
  seatsNotesAugmentation
];
