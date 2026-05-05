// Minimal DOM building primitives shared across augmentations.
//
// `el()` covers the recurring `createElement → set className → set
// textContent → setAttribute → addEventListener → append children`
// scaffold that every augmentation reinvents. `ensureStyle()` collapses the
// "look up by id, otherwise create + append once" pattern used by every
// `injectStyles` site.
//
// These are intentionally tiny — no idempotent-render, no keyed-store
// abstractions. Bigger primitives are deferred to later waves.

export type ElProps = {
  class?: string;
  /** textContent. Mutually exclusive with `html`. */
  text?: string;
  /**
   * innerHTML. Use sparingly — only for static markup the caller fully
   * controls. Throws if combined with `text`.
   */
  html?: string;
  /** dataset entries. Keys whose value is `undefined` are skipped. */
  dataset?: Record<string, string | undefined>;
  /** Style declarations applied via `element.style[key] = value`. */
  style?: Partial<CSSStyleDeclaration>;
  /** setAttribute() pairs. Keys whose value is `undefined` are skipped. */
  attrs?: Record<string, string | undefined>;
  /** Event listeners registered via addEventListener. */
  on?: { [K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void };
};

export type ElChild = string | Node | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  props?: ElProps,
  children?: ElChild[]
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);

  if (props) {
    if (props.text !== undefined && props.html !== undefined) {
      throw new Error("el(): cannot provide both `text` and `html`");
    }
    if (props.class !== undefined) {
      element.className = props.class;
    }
    if (props.text !== undefined) {
      element.textContent = props.text;
    }
    if (props.html !== undefined) {
      element.innerHTML = props.html;
    }
    if (props.dataset) {
      for (const [key, value] of Object.entries(props.dataset)) {
        if (value === undefined) continue;
        element.dataset[key] = value;
      }
    }
    if (props.style) {
      for (const [key, value] of Object.entries(props.style)) {
        if (value === undefined) continue;
        (element.style as unknown as Record<string, string>)[key] = value as string;
      }
    }
    if (props.attrs) {
      for (const [key, value] of Object.entries(props.attrs)) {
        if (value === undefined) continue;
        element.setAttribute(key, value);
      }
    }
    if (props.on) {
      for (const [type, handler] of Object.entries(props.on)) {
        if (!handler) continue;
        element.addEventListener(type, handler as EventListener);
      }
    }
  }

  if (children) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      if (typeof child === "string") {
        element.appendChild(doc.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }

  return element;
}

export function ensureStyle(doc: Document, id: string, css: string): HTMLStyleElement {
  const existing = doc.getElementById(id);
  if (existing instanceof HTMLStyleElement) {
    if (existing.textContent !== css) {
      existing.textContent = css;
    }
    return existing;
  }

  const style = doc.createElement("style");
  style.id = id;
  style.textContent = css;
  const host = doc.head ?? doc.documentElement;
  host.appendChild(style);
  return style;
}
