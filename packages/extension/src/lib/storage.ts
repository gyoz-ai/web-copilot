export interface ExtensionSettings {
  mode: "byok" | "managed";
  provider: "claude" | "openai" | "gemini";
  apiKey: string;
  model: string;
  managedToken?: string;
  yoloMode: boolean;
  autoImportRecipes: boolean;
  theme: "dark" | "light";
  language: string; // locale code or "auto" for browser detection
  agentSize: "small" | "medium" | "big";
  typingSound: boolean;
  /** Opacity of chat speech bubbles (0.0–1.0). */
  bubbleOpacity: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  mode: "byok",
  provider: "claude",
  apiKey: "",
  model: "claude-haiku-4-5-20251001",
  yoloMode: false,
  autoImportRecipes: true,
  theme: "dark",
  language: "auto",
  agentSize: "medium",
  typingSound: true,
  bubbleOpacity: 0.85,
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get("gyozai_settings");
  return { ...DEFAULT_SETTINGS, ...result.gyozai_settings };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ gyozai_settings: settings });
}

// ─── Conversation-based storage ─────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  domain: string;
  messageCount: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  domain: string;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  llmHistory: Array<{ role: string; content: string }>;
  pendingClarify?: { message: string; options: string[] } | null;
}

const CONV_INDEX_KEY = "gyozai_conv_index";
function convKey(id: string) {
  return `gyozai_conv_${id}`;
}

export async function getConversationIndex(): Promise<ConversationSummary[]> {
  const result = await chrome.storage.local.get(CONV_INDEX_KEY);
  const index: ConversationSummary[] = result[CONV_INDEX_KEY] || [];
  // Return sorted by most recent first
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(
  id: string,
): Promise<Conversation | null> {
  const result = await chrome.storage.local.get(convKey(id));
  return result[convKey(id)] || null;
}

export async function saveConversation(conv: Conversation): Promise<void> {
  // Save full conversation data
  await chrome.storage.local.set({ [convKey(conv.id)]: conv });

  // Update index
  const index = await getConversationIndex();
  const existing = index.findIndex((c) => c.id === conv.id);
  const summary: ConversationSummary = {
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    domain: conv.domain,
    messageCount: conv.messages.length,
  };

  if (existing >= 0) {
    index[existing] = summary;
  } else {
    index.unshift(summary);
  }

  // Cap at 50 conversations — remove oldest beyond limit
  if (index.length > 50) {
    const removed = index.splice(50);
    for (const r of removed) {
      await chrome.storage.local.remove(convKey(r.id));
    }
  }

  await chrome.storage.local.set({ [CONV_INDEX_KEY]: index });
}

export async function deleteConversation(id: string): Promise<void> {
  await chrome.storage.local.remove(convKey(id));
  const index = await getConversationIndex();
  const filtered = index.filter((c) => c.id !== id);
  await chrome.storage.local.set({ [CONV_INDEX_KEY]: filtered });
}

export async function getConversationLlmHistory(
  conversationId: string,
): Promise<Array<{ role: string; content: string }>> {
  const conv = await getConversation(conversationId);
  return conv?.llmHistory || [];
}

export async function saveConversationLlmHistory(
  conversationId: string,
  history: Array<{ role: string; content: string }>,
): Promise<void> {
  const conv = await getConversation(conversationId);
  if (!conv) return;
  conv.llmHistory = history.slice(-20);
  conv.updatedAt = Date.now();
  await chrome.storage.local.set({ [convKey(conversationId)]: conv });
}
