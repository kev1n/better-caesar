export const FEATURE_ID = "paper-hide-taken";
// Augmentation id is intentionally distinct from FEATURE_ID so the
// AugmentationRunner doesn't tear the switch down when the user flips
// the feature off. Behavior gating lives inside run() — when the
// feature is off we keep mounting the switch (so the user can flip it
// back on inline) but skip the filtering work and clear any markers.
export const MOUNT_ID = "paper-hide-taken-mount";

export const STYLE_ID = "bc-paper-hide-taken-style";
export const TOGGLE_BTN_ID = "bc-paper-hide-taken-toggle";

export const HIDDEN_CARD_ATTR = "data-bc-hide-taken-hidden";
// Records the (course-id, on/off) signature we last applied to a card so
// repeated runs over an unchanged DOM are cheap no-ops.
export const STATE_ATTR = "data-bc-hide-taken-state";
