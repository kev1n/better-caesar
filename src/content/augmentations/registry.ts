import type { Augmentation } from "../framework";
import { classSearchAugmentation } from "./class-search";
import { ctecLinksAugmentation } from "./ctec-links";
import { enrollmentNavigationAugmentation } from "./enrollment-navigation";
import { paperCtecAugmentation } from "./paper-ctec";
import { seatsNotesAugmentation } from "./seats-notes";

export const augmentationRegistry: Augmentation[] = [
  enrollmentNavigationAugmentation,
  classSearchAugmentation,
  ctecLinksAugmentation,
  paperCtecAugmentation,
  seatsNotesAugmentation
];
