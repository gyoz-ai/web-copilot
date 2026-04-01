import type { SnapshotType } from "@gyoz-ai/engine";
import type { Conversation, ConversationSummary } from "../../lib/storage";

// ─── Snapshot helpers ──────────────────────────────────────────────────────

export function mapExtraRequests(extraRequests: string[]): SnapshotType[] {
  const map: Record<string, SnapshotType> = {
    buttonsSnapshot: "buttons",
    linksSnapshot: "links",
    formsSnapshot: "forms",
    inputsSnapshot: "inputs",
    textContentSnapshot: "textContent",
    fullPageSnapshot: "all",
  };
  return extraRequests.map((r) => map[r] || "all");
}

export function sanitizeError(error: string): string {
  const firstLine = error.split("\n")[0];
  return firstLine.length > 200 ? firstLine.slice(0, 200) + "..." : firstLine;
}

// ─── Pending navigation state (per-tab, for cross-page auto-resume) ─────────

export interface PendingNavState {
  snapshotTypes: SnapshotType[];
  originalQuery: string;
  conversationId: string;
  tabId: number;
  timestamp: number;
  /** Number of messages the model showed before navigating */
  preNavMessageCount?: number;
}

function pendingNavKey(tabId: number) {
  return `gyozai_pending_nav_${tabId}`;
}

export async function savePendingNav(state: PendingNavState) {
  await chrome.storage.local.set({ [pendingNavKey(state.tabId)]: state });
}

// Guard against duplicate content script instances racing to consume the same pending-nav
let _pendingNavConsumed = false;

export async function loadAndClearPendingNav(
  tabId: number,
): Promise<PendingNavState | null> {
  // Synchronous check — prevents the second content script instance
  // from reading the same pending-nav before the first one deletes it
  if (_pendingNavConsumed) return null;
  _pendingNavConsumed = true;

  const key = pendingNavKey(tabId);
  try {
    const result = await chrome.storage.local.get(key);
    const state = result[key] as PendingNavState | undefined;
    if (state) {
      await chrome.storage.local.remove(key);
      // Expire after 30s (in case of stale state)
      if (Date.now() - state.timestamp > 30000) return null;
      return state;
    }
    _pendingNavConsumed = false; // Reset if nothing was found
    return null;
  } catch {
    _pendingNavConsumed = false;
    return null;
  }
}

export async function getTabId(): Promise<number | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "gyozai_get_tab_id",
    });
    return response?.tabId ?? null;
  } catch {
    return null;
  }
}

// ─── Conversation storage helpers (talk to chrome.storage.local) ────────────

export async function loadConversationIndex(): Promise<ConversationSummary[]> {
  const result = await chrome.storage.local.get("gyozai_conv_index");
  const index: ConversationSummary[] = result.gyozai_conv_index || [];
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadConversation(
  id: string,
): Promise<Conversation | null> {
  const key = `gyozai_conv_${id}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

export async function persistConversation(conv: Conversation): Promise<void> {
  const key = `gyozai_conv_${conv.id}`;
  await chrome.storage.local.set({ [key]: conv });

  // Update index
  const index = await loadConversationIndex();
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

  // Cap at 50 conversations
  if (index.length > 50) {
    const removed = index.splice(50);
    for (const r of removed) {
      await chrome.storage.local.remove(`gyozai_conv_${r.id}`);
    }
  }

  await chrome.storage.local.set({ gyozai_conv_index: index });
}

export async function removeConversation(id: string): Promise<void> {
  await chrome.storage.local.remove(`gyozai_conv_${id}`);
  const index = await loadConversationIndex();
  const filtered = index.filter((c) => c.id !== id);
  await chrome.storage.local.set({ gyozai_conv_index: filtered });
}
