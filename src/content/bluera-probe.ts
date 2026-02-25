// Injected into northwestern.bluera.com iframes.
// Reads the CTEC report data from the DOM and sends it back
// to the parent extension context via chrome.runtime messaging.

const doc = document;
const title = doc.title;
const blocks = doc.querySelectorAll<HTMLElement>(".ReportBlockTitle span");
const tables = doc.querySelectorAll<HTMLTableElement>("table.block-table");

console.log("[bluera-probe] Injected into Bluera page. Title:", title);
console.log("[bluera-probe] Found", blocks.length, "report blocks");
console.log("[bluera-probe] Found", tables.length, "data tables");

// Extract all question blocks with their stats
type BlockData = {
  question: string;
  stats: Record<string, string>;
};

const data: BlockData[] = [];

blocks.forEach((block) => {
  const question = block.textContent?.trim() ?? "";
  const blockContainer = block.closest(".report-block");
  if (!blockContainer) return;

  const stats: Record<string, string> = {};
  const rows = blockContainer.querySelectorAll("table.block-table tbody tr");
  rows.forEach((row) => {
    const label = row.querySelector("th")?.textContent?.trim() ?? "";
    const value = row.querySelector("td")?.textContent?.trim() ?? "";
    if (label && value) {
      stats[label] = value;
    }
  });

  data.push({ question, stats });
});

console.log("[bluera-probe] Extracted data:", JSON.stringify(data, null, 2));

// Send back to the extension
chrome.runtime.sendMessage({
  type: "bluera-probe-result",
  url: window.location.href,
  title,
  blockCount: blocks.length,
  tableCount: tables.length,
  data
});
