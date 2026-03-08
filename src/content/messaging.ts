import type { LookupClassMessage, LookupClassResponse } from "../shared/messages";
import { lookupClass } from "./peoplesoft/index";

export function registerLookupMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (
      message: LookupClassMessage,
      _sender,
      sendResponse: (response: LookupClassResponse) => void
    ) => {
      if (!message || message.type !== "lookup-class") return;

      void lookupClass(message, { priority: "user", owner: "popup-lookup" })
        .then((response) => sendResponse(response))
        .catch((error: unknown) => {
          const text = error instanceof Error ? error.message : "Unknown error.";
          sendResponse({ ok: false, error: text });
        });

      return true;
    }
  );
}
