import type { Augmentation } from "../framework";
import { seatsNotesAugmentation } from "./seats-notes";

export const augmentationRegistry: Augmentation[] = [seatsNotesAugmentation];
