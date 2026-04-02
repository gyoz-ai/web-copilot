import { browser } from "wxt/browser";
import { storageGet } from "./storage";
export async function appendTranscript(
  convId: string,
  entry: { role: string; content: string; timestamp: number },
): Promise<void> {
  const key = `gyozai_transcript_${convId}`;
  const { [key]: existing } = await storageGet(key);
  const entries = existing || [];
  entries.push(entry);
  // Cap at 200 entries
  if (entries.length > 200) entries.splice(0, entries.length - 200);
  await browser.storage.local.set({ [key]: entries });
}

export async function getTranscript(
  convId: string,
): Promise<Array<{ role: string; content: string; timestamp: number }>> {
  const key = `gyozai_transcript_${convId}`;
  const { [key]: entries } = await storageGet(key);
  return entries || [];
}

export async function clearTranscript(convId: string): Promise<void> {
  const key = `gyozai_transcript_${convId}`;
  await browser.storage.local.remove(key);
}
