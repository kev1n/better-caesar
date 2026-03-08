import type { FetchTextMessage, FetchTextResponse } from "../shared/messages";

type FetchTextOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
};

export async function fetchTextResultViaBackground(
  url: string,
  options?: FetchTextOptions
): Promise<Extract<FetchTextResponse, { ok: true }>> {
  const response = await chrome.runtime.sendMessage({
    type: "fetch-text",
    url,
    method: options?.method,
    headers: options?.headers,
    body: options?.body
  } satisfies FetchTextMessage) as FetchTextResponse;

  if (!response?.ok) {
    throw new Error(response?.error || "Background fetch failed.");
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Request failed (${response.status}).`);
  }

  return response;
}

export async function fetchTextViaBackground(
  url: string,
  options?: FetchTextOptions
): Promise<string> {
  const response = await fetchTextResultViaBackground(url, options);
  return response.text;
}
