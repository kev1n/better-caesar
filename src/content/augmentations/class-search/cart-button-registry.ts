// Per-section Add-to-cart button registry. Holds the live `<button>` refs
// keyed by signature so a cart-cache change subscription can repaint every
// mounted button without walking the DOM, and centralizes the
// "in-cart" / "enrolled" / idle state machine that previously lived in two
// near-identical helper functions on the augmentation.
//
// The signature key is `${termId}|${subject}|${catalog}|${sectionLabel}`
// joined with the unit-separator byte (\x1f) — same shape the cart cache
// already uses, so a subscribe-driven repaint can resolve cache state from
// the dataset alone.

const SEPARATOR = "\x1f";

export type CartButtonState = "in-cart" | "enrolled" | null;

export type SignatureParts = {
  termId: string;
  subject: string;
  catalog: string;
  sectionLabel: string;
};

export interface CartButtonRegistry {
  /** Stash a button so a cache change can repaint it. */
  register(sigKey: string, button: HTMLButtonElement): void;

  /** Drop the button from the registry. */
  unregister(sigKey: string): void;

  /**
   * Find the button registered under `sigKey` and apply `state`. No-op when
   * the button isn't registered or has already detached from the DOM.
   */
  applyCartStateBySigKey(sigKey: string, state: CartButtonState): void;

  /**
   * Apply `state` to a specific button. Skips buttons mid-flight
   * (`dataset.state === "loading"`) so cache-driven repaints don't
   * stomp an in-progress add.
   */
  applyCartStateToButton(button: HTMLButtonElement, state: CartButtonState): void;

  /**
   * Walk the registry, GC any detached buttons, and ask `getCartState` for
   * the latest state of each remaining button (resolved from the sigKey).
   */
  repaintAll(getCartState: (sigKey: string) => CartButtonState): void;

  /** Encode parts into a sigKey. */
  encodeSigKey(parts: SignatureParts): string;

  /** Decode a sigKey back to parts, or `null` when malformed. */
  parseSigKey(sigKey: string): SignatureParts | null;

  /** For tests / explicit teardown. */
  clear(): void;

  /** For diagnostics / tests — current registry size. */
  size(): number;
}

export function createCartButtonRegistry(): CartButtonRegistry {
  const buttons = new Map<string, HTMLButtonElement>();

  function applyCartStateToButton(
    button: HTMLButtonElement,
    state: CartButtonState
  ): void {
    if (button.dataset.state === "loading") return;

    if (state === null) {
      // Cache miss — restore idle if we previously painted a cached state.
      if (button.dataset.state === "in-cart" || button.dataset.state === "enrolled") {
        button.dataset.state = "";
        button.disabled = false;
        button.textContent = "Add to cart";
        button.title = "";
      }
      return;
    }

    if (state === "enrolled") {
      button.dataset.state = "enrolled";
      button.disabled = true;
      button.textContent = "Enrolled";
      button.title = "You're enrolled in this class.";
    } else {
      button.dataset.state = "in-cart";
      button.disabled = true;
      button.textContent = "In cart";
      button.title = "This class is in your shopping cart.";
    }
  }

  function applyCartStateBySigKey(sigKey: string, state: CartButtonState): void {
    const button = buttons.get(sigKey);
    if (!button) return;
    applyCartStateToButton(button, state);
  }

  return {
    register(sigKey, button) {
      buttons.set(sigKey, button);
    },

    unregister(sigKey) {
      buttons.delete(sigKey);
    },

    applyCartStateBySigKey,
    applyCartStateToButton,

    repaintAll(getCartState) {
      for (const [key, button] of buttons) {
        if (!button.isConnected) {
          buttons.delete(key);
          continue;
        }
        const state = getCartState(key);
        applyCartStateToButton(button, state);
      }
    },

    encodeSigKey(parts) {
      return [parts.termId, parts.subject, parts.catalog, parts.sectionLabel].join(
        SEPARATOR
      );
    },

    parseSigKey(sigKey) {
      const parts = sigKey.split(SEPARATOR);
      if (parts.length !== 4) return null;
      return {
        termId: parts[0]!,
        subject: parts[1]!,
        catalog: parts[2]!,
        sectionLabel: parts[3]!
      };
    },

    clear() {
      buttons.clear();
    },

    size() {
      return buttons.size;
    }
  };
}
