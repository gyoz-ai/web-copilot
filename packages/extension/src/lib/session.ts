/** Per-tab widget session — survives full-page navigations within the same tab
 *  but is cleared when the tab closes (background worker handles cleanup).
 *
 *  Uses chrome.storage.session which is ephemeral (cleared on browser quit). */

export interface WidgetSession {
  expanded: boolean;
  activeConvId: string | null;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  input: string;
  viewMode: "chat" | "history";
}

const SESSION_PREFIX = "gyozai_tab_";

function sessionKey(tabId: number) {
  return `${SESSION_PREFIX}${tabId}`;
}

export async function saveWidgetSession(
  tabId: number,
  session: WidgetSession,
): Promise<void> {
  await chrome.storage.session.set({ [sessionKey(tabId)]: session });
}

export async function loadWidgetSession(
  tabId: number,
): Promise<WidgetSession | null> {
  const key = sessionKey(tabId);
  const result = await chrome.storage.session.get(key);
  return (result[key] as WidgetSession) ?? null;
}

export async function clearWidgetSession(tabId: number): Promise<void> {
  await chrome.storage.session.remove(sessionKey(tabId));
}
