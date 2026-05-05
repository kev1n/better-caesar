import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPsCellGridRuntime, type PsCellGridConfig } from "./ps-cell-grid";

// jsdom-friendly synthesis. The runtime walks `closest("table")` from each
// row, so wrap rows in a table+thead+tbody. The header row is the first <tr>.
function buildGrid(
  doc: Document,
  options: { pageId?: string; rowKeys: string[] } = { rowKeys: [] }
): { table: HTMLTableElement; rows: HTMLTableRowElement[] } {
  if (options.pageId !== undefined) {
    const marker = doc.createElement("div");
    marker.id = "pt_pageinfo_win0";
    marker.setAttribute("Page", options.pageId);
    doc.body.appendChild(marker);
  }
  const table = doc.createElement("table");
  const thead = doc.createElement("thead");
  const headerRow = doc.createElement("tr");
  const baseHeader = doc.createElement("th");
  baseHeader.textContent = "Class";
  headerRow.appendChild(baseHeader);
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = doc.createElement("tbody");
  const rows: HTMLTableRowElement[] = [];
  for (const key of options.rowKeys) {
    const row = doc.createElement("tr");
    row.setAttribute("bufnum", "1");
    row.dataset.key = key;
    const cell = doc.createElement("td");
    cell.className = "PSLEVEL1GRIDODDROW";
    cell.textContent = key;
    row.appendChild(cell);
    tbody.appendChild(row);
    rows.push(row);
  }
  table.appendChild(tbody);
  doc.body.appendChild(table);
  return { table, rows };
}

const STYLES = `.bc-test-cell { padding: 1px; }`;

type Data = { value: string };

function makeConfig(
  overrides: Partial<PsCellGridConfig<Data, string>> = {}
): PsCellGridConfig<Data, string> {
  return {
    id: "test-grid",
    pageId: "TEST_PAGE",
    gridRowSelector: "tr[bufnum]",
    columns: [{ cellClass: "bc-test-cell", label: "Test" }],
    styleId: "bc-test-grid-style",
    styles: STYLES,
    keyForRow: (row) => row.dataset.key ?? null,
    render: {
      idle: (ctx, controls) => {
        const cell = ctx.cells[0]!;
        cell.innerHTML = "";
        const btn = ctx.doc.createElement("button");
        btn.textContent = "Load";
        btn.className = "bc-test-load";
        btn.addEventListener("click", () => controls.fetch());
        cell.appendChild(btn);
      },
      loading: (ctx) => {
        ctx.cells[0]!.textContent = "loading";
      },
      success: (ctx, data) => {
        ctx.cells[0]!.textContent = `ok:${data.value}`;
      },
      error: (ctx, err) => {
        ctx.cells[0]!.textContent = `err:${(err as Error).message}`;
      }
    },
    fetch: vi.fn(async ({ key }) => ({ value: key })),
    ...overrides
  };
}

beforeEach(() => {
  // Each test runs against a fresh doc, but vi mock state needs clearing
  // when tests within a describe share fetcher closures.
  vi.clearAllMocks();
});

afterEach(() => {
  // jsdom carries body across tests in the same file — flush.
  document.body.innerHTML = "";
  document.head
    .querySelectorAll("style[id^=bc-test-grid-style]")
    .forEach((el) => el.remove());
});

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

describe("createPsCellGridRuntime — page-id gate", () => {
  it("no-ops when the page-id marker is missing", () => {
    const doc = fresh();
    buildGrid(doc, { rowKeys: ["111"] }); // no pt_pageinfo_win0
    const fetchFn = vi.fn();
    const runtime = createPsCellGridRuntime(makeConfig({ fetch: fetchFn }));
    runtime.run(doc);
    expect(doc.querySelectorAll(".bc-test-cell").length).toBe(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("no-ops when the page-id is wrong", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "OTHER_PAGE", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(makeConfig());
    runtime.run(doc);
    expect(doc.querySelectorAll(".bc-test-cell").length).toBe(0);
  });

  it("accepts an array of allowed page ids", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "B", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(
      makeConfig({ pageId: ["A", "B"] })
    );
    runtime.run(doc);
    expect(doc.querySelectorAll("th.bc-test-cell").length).toBe(1);
    expect(doc.querySelectorAll("td.bc-test-cell").length).toBe(1);
  });

  it("accepts a custom predicate", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "WHATEVER", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(
      makeConfig({ pageId: () => true })
    );
    runtime.run(doc);
    expect(doc.querySelectorAll("td.bc-test-cell").length).toBe(1);
  });
});

describe("createPsCellGridRuntime — header injection", () => {
  it("injects one <th> per column on first run", () => {
    const doc = fresh();
    const { table } = buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(
      makeConfig({
        columns: [
          { cellClass: "bc-c1", label: "A" },
          { cellClass: "bc-c2", label: "B" }
        ]
      })
    );
    runtime.run(doc);
    const headerThs = table.querySelectorAll("thead th");
    expect(headerThs.length).toBe(3); // base + 2 injected
    expect(table.querySelector("th.bc-c1")?.textContent).toBe("A");
    expect(table.querySelector("th.bc-c2")?.textContent).toBe("B");
  });

  it("uses headerClass when provided so header and cell can have distinct CSS hooks", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(
      makeConfig({
        columns: [
          { cellClass: "bc-cell", headerClass: "bc-head", label: "X" }
        ]
      })
    );
    runtime.run(doc);
    expect(doc.querySelector("th.bc-head")).not.toBeNull();
    expect(doc.querySelector("th.bc-cell")).toBeNull();
    expect(doc.querySelectorAll("td.bc-cell").length).toBe(1);
  });

  it("does not duplicate headers across re-runs (idempotent)", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(makeConfig());
    runtime.run(doc);
    runtime.run(doc);
    runtime.run(doc);
    expect(doc.querySelectorAll("th.bc-test-cell").length).toBe(1);
  });
});

describe("createPsCellGridRuntime — cell injection", () => {
  it("injects one <td> per row and renders idle into it", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111", "222"] });
    const runtime = createPsCellGridRuntime(makeConfig());
    runtime.run(doc);
    const cells = doc.querySelectorAll<HTMLTableCellElement>("td.bc-test-cell");
    expect(cells.length).toBe(2);
    expect(cells[0].querySelector(".bc-test-load")?.textContent).toBe("Load");
    expect(cells[1].querySelector(".bc-test-load")?.textContent).toBe("Load");
  });

  it("does not duplicate cells when run repeatedly without state change (idempotent)", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(makeConfig());
    runtime.run(doc);
    runtime.run(doc);
    runtime.run(doc);
    expect(doc.querySelectorAll("td.bc-test-cell").length).toBe(1);
  });

  it("re-paints idle when PeopleSoft wipes a previously-mounted cell", () => {
    const doc = fresh();
    const { rows } = buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(makeConfig());
    runtime.run(doc);
    expect(rows[0].querySelectorAll(".bc-test-cell").length).toBe(1);
    // Simulate PS swapping in a fresh row scaffold — wipe our injected td.
    const ourCell = rows[0].querySelector(".bc-test-cell");
    ourCell?.remove();
    runtime.run(doc);
    // Re-painted with fresh idle button, not left empty.
    expect(rows[0].querySelectorAll(".bc-test-cell").length).toBe(1);
    expect(rows[0].querySelector(".bc-test-load")).not.toBeNull();
  });

  it("skips rows whose keyForRow returns null", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["good", "skip-me"] });
    const runtime = createPsCellGridRuntime(
      makeConfig({
        keyForRow: (row) =>
          row.dataset.key === "skip-me" ? null : row.dataset.key ?? null
      })
    );
    runtime.run(doc);
    expect(doc.querySelectorAll("td.bc-test-cell").length).toBe(1);
  });
});

describe("createPsCellGridRuntime — fetch + state transitions", () => {
  it("transitions idle -> loading -> success when the user clicks fetch", async () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const fetchFn = vi.fn(async ({ key }: { key: string }) => ({ value: key }));
    const runtime = createPsCellGridRuntime(makeConfig({ fetch: fetchFn }));
    runtime.run(doc);
    const btn = doc.querySelector<HTMLButtonElement>(".bc-test-load")!;
    btn.click();
    // After click but before microtask flush, cell shows "loading".
    expect(doc.querySelector("td.bc-test-cell")?.textContent).toBe("loading");
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.querySelector("td.bc-test-cell")?.textContent).toBe("ok:111");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent fetches against the in-flight set", async () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    let resolveFetch: (data: Data) => void = () => {
      throw new Error("resolveFetch unset");
    };
    const fetchFn = vi.fn(
      () =>
        new Promise<Data>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const runtime = createPsCellGridRuntime(makeConfig({ fetch: fetchFn }));
    runtime.run(doc);
    const btn = doc.querySelector<HTMLButtonElement>(".bc-test-load")!;
    btn.click();
    btn.click(); // second click while in-flight
    btn.click(); // third click while in-flight
    expect(fetchFn).toHaveBeenCalledTimes(1);
    resolveFetch({ value: "111" });
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.querySelector("td.bc-test-cell")?.textContent).toBe("ok:111");
  });

  it("renders error and offers retry when fetch rejects with a non-retryable error", async () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    let attempt = 0;
    const fetchFn = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("boom");
      return { value: "111" };
    });
    const runtime = createPsCellGridRuntime(
      makeConfig({
        fetch: fetchFn,
        render: {
          idle: (ctx, controls) => {
            ctx.cells[0]!.innerHTML = "";
            const b = ctx.doc.createElement("button");
            b.className = "bc-test-load";
            b.textContent = "Load";
            b.addEventListener("click", () => controls.fetch());
            ctx.cells[0]!.appendChild(b);
          },
          loading: (ctx) => {
            ctx.cells[0]!.textContent = "loading";
          },
          success: (ctx, data) => {
            ctx.cells[0]!.textContent = `ok:${data.value}`;
          },
          error: (ctx, err, controls) => {
            ctx.cells[0]!.innerHTML = "";
            const span = ctx.doc.createElement("span");
            span.textContent = `err:${(err as Error).message}`;
            ctx.cells[0]!.appendChild(span);
            const retry = ctx.doc.createElement("button");
            retry.className = "bc-test-retry";
            retry.textContent = "retry";
            retry.addEventListener("click", () => controls.fetch());
            ctx.cells[0]!.appendChild(retry);
          }
        }
      })
    );
    runtime.run(doc);
    doc.querySelector<HTMLButtonElement>(".bc-test-load")!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.querySelector("td.bc-test-cell")?.textContent).toContain("err:boom");
    const retry = doc.querySelector<HTMLButtonElement>(".bc-test-retry")!;
    expect(retry).not.toBeNull();
    retry.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(doc.querySelector("td.bc-test-cell")?.textContent).toBe("ok:111");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("treats retryable errors as transient — drops back to idle without painting error", async () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const transient = new Error("transient");
    const fetchFn = vi.fn(async () => {
      throw transient;
    });
    const runtime = createPsCellGridRuntime(
      makeConfig({
        fetch: fetchFn,
        retryable: (e) => e === transient
      })
    );
    runtime.run(doc);
    doc.querySelector<HTMLButtonElement>(".bc-test-load")!.click();
    await Promise.resolve();
    await Promise.resolve();
    // Idle re-painted — load button is back, no error text.
    expect(doc.querySelector(".bc-test-load")?.textContent).toBe("Load");
    expect(doc.querySelector("td.bc-test-cell")?.textContent).not.toContain("err:");
  });
});

describe("createPsCellGridRuntime — cleanup", () => {
  it("removes all injected <th>, <td>, and <style> nodes", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111", "222"] });
    const runtime = createPsCellGridRuntime(makeConfig());
    runtime.run(doc);
    expect(doc.querySelectorAll(".bc-test-cell").length).toBeGreaterThan(0);
    expect(doc.getElementById("bc-test-grid-style")).not.toBeNull();
    runtime.cleanup(doc);
    expect(doc.querySelectorAll(".bc-test-cell").length).toBe(0);
    expect(doc.getElementById("bc-test-grid-style")).toBeNull();
  });

  it("clears the row-state dataset markers so a re-enable starts fresh", () => {
    const doc = fresh();
    const { rows } = buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const runtime = createPsCellGridRuntime(makeConfig());
    runtime.run(doc);
    expect(rows[0].dataset.bcCellGridKey).toBe("111");
    runtime.cleanup(doc);
    expect(rows[0].dataset.bcCellGridKey).toBeUndefined();
    expect(rows[0].dataset.bcCellGridState).toBeUndefined();
  });
});

describe("createPsCellGridRuntime — setupTickers lifecycle", () => {
  it("invokes setupTickers once per mount and the returned stop function on cleanup", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const stop = vi.fn();
    const setup = vi.fn(() => stop);
    const runtime = createPsCellGridRuntime(
      makeConfig({ setupTickers: setup })
    );
    runtime.run(doc);
    runtime.run(doc); // re-run shouldn't re-setup
    runtime.run(doc);
    expect(setup).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    runtime.cleanup(doc);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("re-setups after cleanup so a re-enable starts a fresh ticker (no leak)", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "TEST_PAGE", rowKeys: ["111"] });
    const stops: Array<ReturnType<typeof vi.fn>> = [];
    const setup = vi.fn(() => {
      const stop = vi.fn();
      stops.push(stop);
      return stop;
    });
    const runtime = createPsCellGridRuntime(
      makeConfig({ setupTickers: setup })
    );
    runtime.run(doc);
    runtime.cleanup(doc);
    runtime.run(doc);
    runtime.cleanup(doc);
    expect(setup).toHaveBeenCalledTimes(2);
    // The first ticker's stop was called during the first cleanup — the
    // setInterval-leak fix verification.
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(stops[1]).toHaveBeenCalledTimes(1);
  });

  it("does not invoke setupTickers when the page-id check fails", () => {
    const doc = fresh();
    buildGrid(doc, { pageId: "OTHER_PAGE", rowKeys: ["111"] });
    const stop = vi.fn();
    const setup = vi.fn(() => stop);
    const runtime = createPsCellGridRuntime(
      makeConfig({ setupTickers: setup })
    );
    runtime.run(doc);
    expect(setup).not.toHaveBeenCalled();
  });
});
