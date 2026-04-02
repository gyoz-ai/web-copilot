import { getSettings } from "../../lib/storage";

export function handleGetTabId(
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
): void {
  sendResponse({ tabId: sender.tab?.id ?? null });
}

export function handleGetSettings(
  sendResponse: (result: unknown) => void,
): void {
  getSettings()
    .then(sendResponse)
    .catch(() => sendResponse(null));
}
