import { describe, expect, it } from "vitest";

import { CartEntrySchema, ParsedCartPageSchema } from "./parse-cart-page.schemas";
import { parseCartPageSafe } from "./parse-cart-page.safe";

// Synthesized cart-page DOM mirroring what `parseCartPage` walks: SSR_REGFORM_VW
// holds the shopping-cart rows, STDNT_ENRL_SSVW holds enrolled rows. Each row
// carries a [bufnum] and a `${P|E}_CLASS_NAME$N` cell.
function buildCartPage(): Document {
  const doc = document.implementation.createHTMLDocument("t");
  doc.body.innerHTML = `
    <script>var PIA_KEYSTRUCT = { STRM: "4750" };</script>
    <div id="SSR_REGFORM_VW$scroll$0">
      <table>
        <tr bufnum="1">
          <td><div id="win0divP_CLASS_NAME$1">COMP_SCI 111-0-1 (12345)</div></td>
          <td><img alt="Open"/></td>
        </tr>
      </table>
    </div>
    <div id="STDNT_ENRL_SSVW$scroll$0">
      <table>
        <tr bufnum="0">
          <td><div id="win0divE_CLASS_NAME$0">MATH 230-1-1 (22222)</div></td>
          <td><div id="E_CLASS_DESCR$0">Multivariable Calc</div></td>
          <td><img alt="Enrolled"/></td>
        </tr>
      </table>
    </div>
  `;
  return doc;
}

describe("parseCartPageSafe (Wave 9)", () => {
  it("returns ok=true with validated cart + enrolled entries", () => {
    const doc = buildCartPage();
    const result = parseCartPageSafe(doc, doc.documentElement.outerHTML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBeNull();
    expect(result.value?.termId).toBe("4750");
    expect(result.value?.cart).toHaveLength(1);
    expect(result.value?.cart[0]?.classNumber).toBe("12345");
    expect(result.value?.enrolled).toHaveLength(1);
    expect(result.value?.enrolled[0]?.description).toBe("Multivariable Calc");
  });

  it("returns ok=true value=null when neither cart nor enrolled grids are present", () => {
    const doc = document.implementation.createHTMLDocument("t");
    const result = parseCartPageSafe(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });
});

describe("CartEntrySchema (Wave 9)", () => {
  it("rejects an entry missing classNumber", () => {
    const result = CartEntrySchema.safeParse({
      subject: "COMP_SCI",
      catalog: "111-0",
      sectionLabel: "1",
      capturedAt: 0
    });
    expect(result.success).toBe(false);
  });

  it("rejects an entry where capturedAt is a string", () => {
    const result = CartEntrySchema.safeParse({
      classNumber: "12345",
      subject: "COMP_SCI",
      catalog: "111-0",
      sectionLabel: "1",
      capturedAt: "now"
    });
    expect(result.success).toBe(false);
  });

  it("rejects an outer envelope where cart is missing", () => {
    const result = ParsedCartPageSchema.safeParse({
      termId: "4750",
      enrolled: []
    });
    expect(result.success).toBe(false);
  });
});
