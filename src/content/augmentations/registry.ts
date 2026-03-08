import type { Augmentation } from "../framework";
import { ctecLinksAugmentation } from "./ctec-links";
import { ctecNavigationAugmentation } from "./ctec-navigation";
import { enrollmentNavigationAugmentation } from "./enrollment-navigation";
import { seatsNotesAugmentation } from "./seats-notes";

export const augmentationRegistry: Augmentation[] = [
  enrollmentNavigationAugmentation,
  ctecLinksAugmentation,
  ctecNavigationAugmentation,
  seatsNotesAugmentation
];
