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

export async function getConversationHistory(): Promise<
  Array<{ role: string; content: string }>
> {
  const result = await chrome.storage.session.get("gyozai_history");
  return result.gyozai_history || [];
}

export async function saveConversationHistory(
  history: Array<{ role: string; content: string }>,
): Promise<void> {
  const capped = history.slice(-20);
  await chrome.storage.session.set({ gyozai_history: capped });
}

export async function clearConversationHistory(): Promise<void> {
  await chrome.storage.session.remove("gyozai_history");
}
