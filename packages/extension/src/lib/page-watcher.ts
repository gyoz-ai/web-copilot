export interface PageWatcher {
  id: string;
  description: string; // Natural language condition
  checkScript: string; // JS code that returns boolean
  url: string; // Page to watch
  intervalMs: number; // Poll interval (default: 60_000)
  createdAt: number;
  lastCheckedAt: number | null;
  triggered: boolean;
}

const STORAGE_KEY = "gyozai_watchers";

export async function getWatchers(): Promise<PageWatcher[]> {
  const { [STORAGE_KEY]: watchers } =
    await chrome.storage.local.get(STORAGE_KEY);
  return watchers || [];
}

export async function addWatcher(
  watcher: Omit<
    PageWatcher,
    "id" | "createdAt" | "lastCheckedAt" | "triggered"
  >,
): Promise<string> {
  const watchers = await getWatchers();
  const id = `watcher_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  watchers.push({
    ...watcher,
    id,
    createdAt: Date.now(),
    lastCheckedAt: null,
    triggered: false,
  });
  await chrome.storage.local.set({ [STORAGE_KEY]: watchers });
  return id;
}

export async function removeWatcher(id: string): Promise<void> {
  const watchers = await getWatchers();
  await chrome.storage.local.set({
    [STORAGE_KEY]: watchers.filter((w) => w.id !== id),
  });
}

export async function updateWatcher(
  id: string,
  update: Partial<PageWatcher>,
): Promise<void> {
  const watchers = await getWatchers();
  const idx = watchers.findIndex((w) => w.id === id);
  if (idx >= 0) {
    watchers[idx] = { ...watchers[idx], ...update };
    await chrome.storage.local.set({ [STORAGE_KEY]: watchers });
  }
}

export async function checkWatcher(
  watcher: PageWatcher,
  tabId: number,
): Promise<boolean> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (script: string) => {
        try {
          return new Function(script)();
        } catch {
          return false;
        }
      },
      args: [watcher.checkScript],
    });
    return !!results?.[0]?.result;
  } catch {
    return false;
  }
}
