import { augmentationRegistry } from "./augmentations/registry";
import { AugmentationRunner } from "./framework";
import { registerLookupMessageHandler } from "./messaging";

registerLookupMessageHandler();
new AugmentationRunner(augmentationRegistry).start();
