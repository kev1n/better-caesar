export const FEATURE_ID = "paper-brand";

export const STYLE_ID = "bc-paper-brand-style";
export const MODAL_ID = "bc-paper-brand-modal";

// Stamped on paper.nu's logo button once we've grafted the "and pencil"
// mark into it. Keeps run() idempotent across the AugmentationRunner's
// mutation-driven re-ticks and lets cleanup() find the host node again
// even if React swapped surrounding elements.
export const HOST_MARKER_ATTR = "data-bc-pencil-brand";

// Stamped on the mark element itself so cleanup() can locate and remove
// it without re-querying by class name (defends against CSS-class drift
// inside the mark's own subtree).
export const MARK_MARKER_ATTR = "data-bc-pencil-brand-mark";

export const LANDING_URL = "https://pencil.nu";

export const KEVIN_LINKEDIN_URL = "https://www.linkedin.com/in/kevin-wang-08836a175/";
export const JASON_LINKEDIN_URL = "https://linkedin.com/in/jasonlatz";
