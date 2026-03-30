/** Widget injection helpers — extracted for testability.
 *
 *  Key design: the host element + shadow DOM + React root are created ONCE.
 *  If the host gets detached (SPA body swap, framework cleanup, etc.) we
 *  simply re-append the *same* element to document.body — the React tree
 *  stays alive with all its state intact.
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
  // Remove stale host if it exists (leftover from a previous content script)
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

/** Re-attach a detached host element to document.body.
 *  The React tree inside the shadow DOM stays alive — no state loss. */
function reattachHost(host: HTMLDivElement): boolean {
  if (!document.body) return false;
  document.body.appendChild(host);
  return host.isConnected;
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

/** Watch for host element detachment and re-attach it (preserving React state).
 *
 *  Uses three complementary strategies:
 *  1. MutationObserver on body — catches direct child removal
 *  2. MAIN-world history patch — catches SPA pushState/replaceState
 *  3. Periodic liveness check — catches anything else (2s interval)
 *
 *  Returns a cleanup function (used in tests). */
export function watchForRemoval(host: HTMLDivElement): () => void {
  function check() {
    if (host.isConnected) return;
    // Re-attach the SAME host element — React tree stays alive
    if (document.body) {
      document.body.appendChild(host);
      reobserve();
    }
  }

  function reobserve() {
    observer.disconnect();
    if (host.parentElement) {
      observer.observe(host.parentElement, { childList: true });
    }
  }

  // 1. MutationObserver on the parent — catches direct child removal
  const observer = new MutationObserver(check);
  reobserve();

  // 2. SPA navigation hooks via MAIN world script injection
  patchMainWorldHistory();
  const onNavChange = () => setTimeout(check, 50);
  window.addEventListener("popstate", onNavChange);
  window.addEventListener("gyozai:navchange", onNavChange);

  // 3. Periodic liveness check — fallback for edge cases
  const intervalId = setInterval(check, 2000);

  return () => {
    observer.disconnect();
    clearInterval(intervalId);
    window.removeEventListener("popstate", onNavChange);
    window.removeEventListener("gyozai:navchange", onNavChange);
  };
}
