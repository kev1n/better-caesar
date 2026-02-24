import type { Augmentation } from "../framework";
import { enrollmentNavigationAugmentation } from "./enrollment-navigation";
import { seatsNotesAugmentation } from "./seats-notes";

export const augmentationRegistry: Augmentation[] = [
  enrollmentNavigationAugmentation,
  seatsNotesAugmentation
];
