export const FEATURE_ID = "paper-export-helper";

export const STYLE_ID = "bc-paper-export-helper-style";
export const MODAL_ID = "bc-paper-export-helper-modal";

// Marker stamped on paper.nu's native "Export schedule to calendar"
// button once we've bound our interceptor — keeps run() idempotent
// across the AugmentationRunner's mutation-driven re-ticks.
export const BUTTON_BOUND_ATTR = "data-bc-export-helper-bound";
