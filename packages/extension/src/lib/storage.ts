import { browser } from "wxt/browser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

/**
 * Typed wrapper for browser.storage.local.get — WXT's browser API returns
 * Record<string, unknown> which requires casting at every call site.
 */
export async function storageGet(keys: string | string[]): Promise<AnyRecord> {
  return (await browser.storage.local.get(keys)) as AnyRecord;
}

export async function sessionGet(keys: string | string[]): Promise<AnyRecord> {
  return (await browser.storage.session.get(keys)) as AnyRecord;
}

export type ProviderKey = "claude" | "openai" | "gemini";

export interface ManagedUsage {
  used: number;
  limit: number;
  week: string;
}

export interface ExtensionSettings {
  mode: "byok" | "managed";
  provider: ProviderKey;
  apiKeys: Record<ProviderKey, string>;
  model: string;
  managedToken?: string;
  managedPlan?: string;
  managedUsage?: ManagedUsage;
  yoloMode: boolean;
  chatOnly: boolean;
  autoImportRecipes: boolean;
  theme: "dark" | "light";
  language: string; // locale code or "auto" for browser detection
  agentSize: "small" | "medium" | "big";
  typingAnimation: boolean;
  typingSound: boolean;
  /** Opacity of chat speech bubbles (0.0–1.0). */
  bubbleOpacity: number;
  /** Keep chatbox open regardless of cursor proximity. */
  stickyChat: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  mode: "managed",
  provider: "claude",
  apiKeys: { claude: "", openai: "", gemini: "" },
  model: "claude-haiku-4-5-20251001",
  yoloMode: false,
  chatOnly: false,
  autoImportRecipes: true,
  theme: "dark",
  language: "auto",
  agentSize: "medium",
  typingAnimation: true,
  typingSound: true,
  bubbleOpacity: 0.85,
  stickyChat: false,
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await storageGet("gyozai_settings");
  const raw = result.gyozai_settings || {};
  const settings = { ...DEFAULT_SETTINGS, ...raw };

  console.log(
    "[gyoza:storage] getSettings → provider:",
    settings.provider,
    "mode:",
    settings.mode,
    "hasApiKey:",
    !!settings.apiKeys[settings.provider],
    "hasManagedToken:",
    !!settings.managedToken,
  );

  // Migrate legacy single apiKey → per-provider apiKeys
  if (raw.apiKey && !raw.apiKeys) {
    const provider: ProviderKey = raw.provider || "claude";
    settings.apiKeys = {
      claude: "",
      openai: "",
      gemini: "",
      [provider]: raw.apiKey,
    };
    delete (settings as Record<string, unknown>).apiKey;
    await browser.storage.local.set({ gyozai_settings: settings });
  }

  return settings;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  console.log(
    "[gyoza:storage] saveSettings → provider:",
    settings.provider,
    "mode:",
    settings.mode,
    "hasApiKey:",
    !!settings.apiKeys[settings.provider],
    "apiKeyLen:",
    settings.apiKeys[settings.provider]?.length || 0,
    "hasManagedToken:",
    !!settings.managedToken,
  );
  await browser.storage.local.set({ gyozai_settings: settings });
  // Verify the write persisted
  const verify = await storageGet("gyozai_settings");
  const saved = verify.gyozai_settings as ExtensionSettings;
  console.log(
    "[gyoza:storage] saveSettings VERIFY → hasApiKey:",
    !!saved?.apiKeys?.[settings.provider],
    "apiKeyLen:",
    saved?.apiKeys?.[settings.provider]?.length || 0,
    "hasManagedToken:",
    !!saved?.managedToken,
  );
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
  const result = await storageGet(CONV_INDEX_KEY);
  const index: ConversationSummary[] = result[CONV_INDEX_KEY] || [];
  // Return sorted by most recent first
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getConversation(
  id: string,
): Promise<Conversation | null> {
  const result = await storageGet(convKey(id));
  return result[convKey(id)] || null;
}

export async function saveConversation(conv: Conversation): Promise<void> {
  // Save full conversation data
  await browser.storage.local.set({ [convKey(conv.id)]: conv });

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
      await browser.storage.local.remove(convKey(r.id));
    }
  }

  await browser.storage.local.set({ [CONV_INDEX_KEY]: index });
}

export async function deleteConversation(id: string): Promise<void> {
  await browser.storage.local.remove(convKey(id));
  const index = await getConversationIndex();
  const filtered = index.filter((c) => c.id !== id);
  await browser.storage.local.set({ [CONV_INDEX_KEY]: filtered });
}

export async function getConversationLlmHistory(
  conversationId: string,
): Promise<Array<{ role: string; content: string }>> {
  const conv = await getConversation(conversationId);
  return conv?.llmHistory || [];
}

/** Rough token estimate (same heuristic as Claude Code's fallback). */
function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

/**
 * Max estimated tokens for the entire LLM history.
 * Keeps plenty of headroom for the system prompt + current turn.
 */
const MAX_HISTORY_TOKENS = 30_000;

export async function saveConversationLlmHistory(
  conversationId: string,
  history: Array<{ role: string; content: string }>,
): Promise<void> {
  let conv = await getConversation(conversationId);
  if (!conv) {
    // Create a placeholder — saveCurrentConversation will fill in details later.
    // This allows the background worker to persist LLM history even before the
    // widget's useEffect creates the full conversation record.
    conv = {
      id: conversationId,
      title: "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      domain: "",
      messages: [],
      llmHistory: [],
    };
  }

  // Keep at most 50 messages
  const beforeCount = history.length;
  let trimmed = history.slice(-50);

  // If total estimated tokens exceed budget, drop oldest pairs until under limit
  let droppedPairs = 0;
  while (
    trimmed.length > 2 &&
    estimateTokens(trimmed.map((m) => m.content).join("")) > MAX_HISTORY_TOKENS
  ) {
    trimmed = trimmed.slice(2); // drop oldest user+assistant pair
    droppedPairs++;
  }

  if (beforeCount > trimmed.length) {
    console.log(
      `%c[gyoza:storage] LLM history trimmed: ${beforeCount} → ${trimmed.length} messages (dropped ${droppedPairs} pairs, ~${estimateTokens(history.map((m) => m.content).join(""))} → ~${estimateTokens(trimmed.map((m) => m.content).join(""))} tokens)`,
      "color: #f59e0b",
    );
  }

  conv.llmHistory = trimmed;
  conv.updatedAt = Date.now();
  await browser.storage.local.set({ [convKey(conversationId)]: conv });
}
