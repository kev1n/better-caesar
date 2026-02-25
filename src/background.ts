chrome.runtime.onInstalled.addListener(() => {
  console.log("Better CAESAR extension installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "bluera-probe-result") {
    console.log("[probe] Bluera content script result:", message);
    return;
  }

  // Test 1: fetch from background (no credentials flag — host_permissions should handle cookies)
  if (message.type === "probe-bluera-tab") {
    const url = message.url as string;

    console.log("[probe] Trying background fetch WITHOUT credentials flag...");
    fetch(url)
      .then(async (res) => {
        const text = await res.text();
        console.log("[probe] Background fetch status:", res.status, "length:", text.length);
        const hasData = text.includes("ReportBlockTitle");
        const isLogin = text.includes("Northwestern SSO") || text.includes("Sign In");
        console.log("[probe] Has CTEC data:", hasData, "Is login:", isLogin);

        if (hasData) {
          // Parse the HTML in the service worker
          // Service workers don't have DOMParser, so use regex
          const data = parseCtecHtml(text);
          console.log("[probe] Parsed data:", data);
          sendResponse({ ok: true, method: "background-fetch", data });
        } else {
          // Fall back to tab approach
          console.log("[probe] Background fetch didn't get data, falling back to tab...");
          scrapeViaTab(url, sendResponse);
        }
      })
      .catch((err) => {
        console.log("[probe] Background fetch failed, falling back to tab:", String(err));
        scrapeViaTab(url, sendResponse);
      });

    return true;
  }
});

function scrapeViaTab(url: string, sendResponse: (response: unknown) => void): void {
  console.log("[probe-tab] Opening Bluera in background tab:", url);

  chrome.tabs.create({ url, active: false }, (tab) => {
    if (!tab?.id) {
      sendResponse({ ok: false, error: "Failed to create tab" });
      return;
    }
    const tabId = tab.id;

    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(onUpdated);

      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const blocks = document.querySelectorAll<HTMLElement>(".ReportBlockTitle span");
          const title = document.title;
          const isLogin = title.includes("SSO") || document.body?.innerHTML?.includes("Sign In");

          const data: Array<{ question: string; stats: Record<string, string> }> = [];
          blocks.forEach((block) => {
            const question = block.textContent?.trim() ?? "";
            const container = block.closest(".report-block");
            if (!container) return;
            const stats: Record<string, string> = {};
            // Grab ALL tables in this block, not just the first
            container.querySelectorAll("table.block-table").forEach((table) => {
              table.querySelectorAll("tbody tr").forEach((row) => {
                const cells = row.querySelectorAll("th, td");
                if (cells.length >= 2) {
                  const label = cells[0]?.textContent?.trim() ?? "";
                  const value = cells[1]?.textContent?.trim() ?? "";
                  if (label && value) stats[label] = value;
                }
              });
            });
            data.push({ question, stats });
          });

          return { title, isLogin, blockCount: blocks.length, data };
        }
      }).then((results) => {
        const result = results?.[0]?.result;
        console.log("[probe-tab] Scrape result:", result);
        chrome.tabs.remove(tabId);
        sendResponse({ ok: true, method: "tab", ...result });
      }).catch((err) => {
        console.error("[probe-tab] Scrape error:", err);
        chrome.tabs.remove(tabId);
        sendResponse({ ok: false, error: String(err) });
      });
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

// Regex-based parser for service worker (no DOM access)
function parseCtecHtml(html: string): Array<{ question: string; stats: Record<string, string> }> {
  const data: Array<{ question: string; stats: Record<string, string> }> = [];

  const blockTitleRegex = /class="ReportBlockTitle"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span/gi;
  let match: RegExpExecArray | null;
  const questions: string[] = [];

  while ((match = blockTitleRegex.exec(html)) !== null) {
    questions.push((match[1] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  }

  // For each question, find the next block-table and extract rows
  for (const question of questions) {
    const stats: Record<string, string> = {};
    const escapedQ = question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 40);
    const afterQuestion = html.slice(html.indexOf(question.slice(0, 40)));
    const tableMatch = afterQuestion.match(/block-table[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
    if (tableMatch) {
      const rowRegex = /<tr[^>]*>[\s\S]*?<th[^>]*>([\s\S]*?)<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(tableMatch[1])) !== null) {
        const label = (rowMatch[1] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const value = (rowMatch[2] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (label && value) stats[label] = value;
      }
    }
    data.push({ question, stats });
  }

  return data;
}
