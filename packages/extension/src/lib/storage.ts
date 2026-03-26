export interface ExtensionSettings {
  mode: "byok" | "managed";
  provider: "claude" | "openai" | "gemini";
  apiKey: string;
  model: string;
  managedToken?: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  mode: "byok",
  provider: "claude",
  apiKey: "",
  model: "claude-haiku-4-5-20251001",
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get("gyozai_settings");
  return { ...DEFAULT_SETTINGS, ...result.gyozai_settings };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ gyozai_settings: settings });
}

export async function getConversationHistory(
  tabId: number,
): Promise<Array<{ role: string; content: string }>> {
  const key = `gyozai_history_${tabId}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || [];
}

export async function saveConversationHistory(
  tabId: number,
  history: Array<{ role: string; content: string }>,
): Promise<void> {
  const key = `gyozai_history_${tabId}`;
  const capped = history.slice(-20);
  await chrome.storage.local.set({ [key]: capped });
}

export async function clearConversationHistory(tabId: number): Promise<void> {
  const key = `gyozai_history_${tabId}`;
  await chrome.storage.local.remove(key);
}
