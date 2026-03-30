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

/** Inject a tiny script into the MAIN world that patches
 *  history.pushState / replaceState to dispatch a DOM event.
 *  Content scripts run in an isolated world — they can't intercept
 *  the page's history calls directly, but DOM events cross the boundary. */
function patchMainWorldHistory() {
  if (document.getElementById("gyozai-nav-patch")) return;
  const script = document.createElement("script");
  script.id = "gyozai-nav-patch";
  script.textContent = `(function(){
    if(window.__gyozai_nav_patched__)return;
    window.__gyozai_nav_patched__=true;
    var E="gyozai:navchange";
    var oP=history.pushState.bind(history);
    var oR=history.replaceState.bind(history);
    history.pushState=function(){var r=oP.apply(this,arguments);window.dispatchEvent(new Event(E));return r};
    history.replaceState=function(){var r=oR.apply(this,arguments);window.dispatchEvent(new Event(E));return r};
  })()`;
  (document.head || document.documentElement).appendChild(script);
}

/** Watch for host element removal (SPA frameworks replacing body contents)
 *  and re-inject the widget when that happens.  Also hooks into SPA
 *  navigation events (pushState / replaceState / popstate) as a safety net.
 *
 *  Uses three complementary strategies:
 *  1. MutationObserver on body — catches direct child removal
 *  2. MAIN-world history patch — catches SPA pushState/replaceState
 *  3. Periodic liveness check — catches anything else (2s interval) */
export function watchForRemoval(
  host: HTMLDivElement,
  styles: string,
  renderWidget: (container: HTMLDivElement) => void,
) {
  function check() {
    if (document.getElementById(HOST_ID)?.isConnected) return;
    observer.disconnect();
    const newHost = ensureWidget(styles, renderWidget);
    if (newHost && newHost !== host) {
      host = newHost;
      // Re-observe the new host's parent
      if (host.parentElement) {
        observer.observe(host.parentElement, { childList: true });
      }
    }
  }

  // 1. MutationObserver on the parent — catches direct child removal
  const observer = new MutationObserver(check);
  if (host.parentElement) {
    observer.observe(host.parentElement, { childList: true });
  }

  // 2. SPA navigation hooks via MAIN world script injection
  patchMainWorldHistory();
  const onNavChange = () => setTimeout(check, 50);
  window.addEventListener("popstate", onNavChange);
  window.addEventListener("gyozai:navchange", onNavChange);

  // 3. Periodic liveness check — fallback for edge cases
  setInterval(check, 2000);
}
