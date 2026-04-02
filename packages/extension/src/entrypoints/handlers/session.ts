import { loadWidgetSession, saveWidgetSession } from "../../lib/session";

export function handleLoadSession(
  message: { tabId?: number },
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
): void {
  const tabId = message.tabId ?? sender.tab?.id;
  if (tabId != null) {
    loadWidgetSession(tabId)
      .then(sendResponse)
      .catch(() => sendResponse(null));
  } else {
    sendResponse(null);
  }
}

export function handleSaveSession(
  message: { tabId?: number; session: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
): void {
  const tabId = sender.tab?.id ?? message.tabId;
  if (tabId != null) {
    saveWidgetSession(
      tabId,
      message.session as Parameters<typeof saveWidgetSession>[1],
    )
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
  } else {
    sendResponse({ ok: false });
  }
}
