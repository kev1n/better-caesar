import type { Augmentation } from "../framework";
import { ctecNavigationAugmentation } from "./ctec-navigation";
import { enrollmentNavigationAugmentation } from "./enrollment-navigation";
import { seatsNotesAugmentation } from "./seats-notes";

export const augmentationRegistry: Augmentation[] = [
  ctecNavigationAugmentation,
  enrollmentNavigationAugmentation,
  seatsNotesAugmentation
];
