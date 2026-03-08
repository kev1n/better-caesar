import type { FetchTextMessage } from "./shared/messages";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Better CAESAR extension installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "fetch-text") {
    void handleFetchText(message as FetchTextMessage, sendResponse);
    return true;
  }
});

async function handleFetchText(
  message: FetchTextMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const res = await fetch(message.url, {
      method: message.method ?? "GET",
      headers: message.headers,
      body: message.body,
      credentials: "include",
      redirect: "follow"
    });

    const text = await res.text();

    sendResponse({
      ok: true,
      status: res.status,
      text,
      finalUrl: res.url
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
