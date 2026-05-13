import { describe, expect, it, vi } from "vitest";

import { WIDGET_CLASS } from "./constants";
import { attachCartAnchor } from "./schedule-ui";

function makeWidgetOnScheduleCard(): HTMLElement {
  document.body.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "schedule-grid-cols";

  const card = document.createElement("div");
  card.className = "absolute z-10 rounded-lg";

  const widget = document.createElement("div");
  widget.className = WIDGET_CLASS;

  card.append(widget);
  grid.append(card);
  document.body.append(grid);

  return widget;
}

describe("paper-ctec schedule cart anchor", () => {
  it("uses a checkbox icon for enrolled cart-cache hits", () => {
    const widget = makeWidgetOnScheduleCard();

    attachCartAnchor(
      widget,
      { kind: "enrolled", classNumber: "44444" },
      vi.fn()
    );

    const button = document.querySelector<HTMLButtonElement>(
      "button.bc-paper-ctec-cart-btn"
    );

    expect(button?.dataset.cartState).toBe("enrolled");
    expect(button?.querySelector('path[d="M5 5h14v14H5z"]')).not.toBeNull();
    expect(
      button?.querySelector('path[d="M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6.5"]')
    ).toBeNull();
  });
});
