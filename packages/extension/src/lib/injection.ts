/** Widget injection helpers — extracted for testability.
 *
 *  These functions handle injecting the gyoza bubble widget into the page DOM
 *  with resilience against: missing document.body, SPA body replacement,
 *  and host element removal by third-party scripts.
 */

const HOST_ID = "gyozai-extension-root";

/** Wait for document.body to be available (handles edge cases where
 *  document_idle fires before body exists, e.g. about:blank → real page). */
export function waitForBody(timeoutMs = 2000): Promise<HTMLElement> {
  if (document.body) return Promise.resolve(document.body);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error("document.body not available within timeout"));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(document.body);
      }
    });
    observer.observe(document.documentElement, { childList: true });
  });
}

/** Create the host div and shadow DOM, append to the given body element.
 *  Calls `renderWidget` to mount the UI into the shadow container.
 *  Returns the host element so callers can observe it. */
export function injectWidget(
  body: HTMLElement,
  styles: string,
  renderWidget: (container: HTMLDivElement) => void,
): HTMLDivElement {
  // Remove stale host if it exists (e.g. SPA body replacement left an orphan)
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = styles;
  shadow.appendChild(style);

  const container = document.createElement("div");
  shadow.appendChild(container);

  renderWidget(container);
  return host;
}

/** Ensure the widget is in the DOM; re-inject if missing.
 *  Returns the (possibly new) host element, or null if body is unavailable. */
export function ensureWidget(
  styles: string,
  renderWidget: (container: HTMLDivElement) => void,
): HTMLDivElement | null {
  const existing = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (existing?.isConnected) return existing;
  if (!document.body) return null;
  return injectWidget(document.body, styles, renderWidget);
}

/** Watch for host element removal (SPA frameworks replacing body contents)
 *  and re-inject the widget when that happens.  Also hooks into SPA
 *  navigation events (pushState / replaceState / popstate) as a safety net.
 *
 *  `onReinject` is called with the new host element whenever re-injection
 *  occurs, so callers can update their references. */
export function watchForRemoval(
  host: HTMLDivElement,
  styles: string,
  renderWidget: (container: HTMLDivElement) => void,
) {
  // 1. MutationObserver on the parent — catches direct child removal
  const observer = new MutationObserver(() => {
    if (!host.isConnected) {
      observer.disconnect();
      const newHost = ensureWidget(styles, renderWidget);
      if (newHost) watchForRemoval(newHost, styles, renderWidget);
    }
  });
  if (host.parentElement) {
    observer.observe(host.parentElement, { childList: true });
  }

  // 2. SPA navigation hooks — verify widget after pushState / replaceState
  const onNavChange = () => {
    // Small delay so the SPA has time to update the DOM
    setTimeout(() => {
      if (!document.getElementById(HOST_ID)?.isConnected) {
        observer.disconnect();
        const newHost = ensureWidget(styles, renderWidget);
        if (newHost) watchForRemoval(newHost, styles, renderWidget);
      }
    }, 50);
  };

  // Monkey-patch history methods once per content script lifetime
  if (!(window as any).__gyozai_nav_patched__) {
    (window as any).__gyozai_nav_patched__ = true;
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = function (...args: Parameters<typeof origPush>) {
      const result = origPush(...args);
      window.dispatchEvent(new Event("gyozai:navchange"));
      return result;
    };
    history.replaceState = function (...args: Parameters<typeof origReplace>) {
      const result = origReplace(...args);
      window.dispatchEvent(new Event("gyozai:navchange"));
      return result;
    };
  }

  window.addEventListener("popstate", onNavChange);
  window.addEventListener("gyozai:navchange", onNavChange);
}
