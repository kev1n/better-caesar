// `PAPER_COMBOS_FEATURE_ID` is the popup-level toggle (controls whether
// the bar mounts at all on paper.nu). `PAPER_COMBOS_ACTIVE_ID` is the
// in-page on/off state controlled by the bar's switch.
export const PAPER_COMBOS_FEATURE_ID = "paper-combos";
export const PAPER_COMBOS_ACTIVE_ID = "paper-combos-active";

export const TOP_BAR_ID = "bc-paper-combos-bar";
export const STYLE_ID = "bc-paper-combos-style";
export const ROOT_ATTR = "data-bc-paper-combos-active";
export const REAL_CARD_HIDE_ATTR = "data-bc-paper-combos-hidden";
export const CARD_PIN_BUTTON_CLASS = "bc-paper-combos-card-pin";
// Inline-style overrides + originals stored on cards we widen back to
// full size after paper.nu's split layout shrinks them. Cleared when the
// card is no longer visible in the active combo.
export const ORIGINAL_LEFT_ATTR = "data-bc-paper-combos-orig-left";
export const ORIGINAL_WIDTH_ATTR = "data-bc-paper-combos-orig-width";
export const COURSE_ID_DATASET_ATTR = "data-bc-paper-combos-course";

// Northwestern uses "units" (1.0 ~= one normal course); copy reads
// "credits" because that's what users say. Default budget = 5 units,
// matching a typical full-time courseload with a buffer.
export const DEFAULT_MAX_CREDITS = 5;
export const DEFAULT_MIN_CREDITS = 0;
export const DEFAULT_UNITS = 1;
export const COMBO_HARD_CAP = 5000;
export const NEUTRAL_RATING_MIDPOINT = 3;
export const FEATURE_TOGGLE_CLASS = "bc-paper-combos-toggle";
