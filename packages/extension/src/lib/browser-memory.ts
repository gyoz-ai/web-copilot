import { browser } from "wxt/browser";
import { storageGet } from "./storage";
export interface MemoryEntry {
  key: string;
  value: string;
  source: "user-stated" | "inferred-from-usage" | "pattern";
  createdAt: number;
}

const STORAGE_KEY = "gyozai_browser_memory";
const MAX_ENTRIES = 50;

export async function getMemories(): Promise<MemoryEntry[]> {
  const { [STORAGE_KEY]: entries } = await storageGet(STORAGE_KEY);
  return entries || [];
}

export async function addMemory(
  entry: Omit<MemoryEntry, "createdAt">,
): Promise<void> {
  const entries = await getMemories();
  // Upsert by key
  const idx = entries.findIndex((e) => e.key === entry.key);
  const full = { ...entry, createdAt: Date.now() };
  if (idx >= 0) entries[idx] = full;
  else entries.push(full);
  // Cap
  if (entries.length > MAX_ENTRIES)
    entries.splice(0, entries.length - MAX_ENTRIES);
  await browser.storage.local.set({ [STORAGE_KEY]: entries });
}

export async function removeMemory(key: string): Promise<void> {
  const entries = await getMemories();
  await browser.storage.local.set({
    [STORAGE_KEY]: entries.filter((e) => e.key !== key),
  });
}

export function formatMemoriesForPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- ${e.key}: ${e.value}`);
  return `\n\n## User Preferences (remembered)\n${lines.join("\n")}`;
}
