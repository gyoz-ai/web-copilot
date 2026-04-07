import { browser } from "wxt/browser";
/** Widget injection helpers — extracted for testability.
 *
 *  Key design: the host element + shadow DOM + React root are created ONCE.
 *  If the host gets detached (SPA body swap, framework cleanup, etc.) we
 *  simply re-append the *same* element to document.body — the React tree
 *  stays alive with all its state intact.
 */

export const HOST_ID = "gyozai-extension-root";

const S = "color: #E8950A; font-weight: bold";
function log(...args: unknown[]) {
  console.log("%c[gyoza:inject]", S, ...args);
}

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

/** Patch history.pushState/replaceState in the MAIN world to dispatch
 *  a 'gyozai:navchange' DOM event.  Uses browser.scripting.executeScript
 *  via the background worker (bypasses page CSP entirely).
 *  Falls back to inline <script> injection if messaging fails. */
let _historyPatchRequested = false;
function patchMainWorldHistory() {
  if (_historyPatchRequested) return;
  _historyPatchRequested = true;
  // Ask background worker to inject into MAIN world (CSP-proof)
  // Guard: browser.runtime may not exist in test environments
  if (typeof chrome === "undefined" || !browser.runtime?.sendMessage) {
    inlineHistoryPatch();
    return;
  }
  browser.runtime
    .sendMessage({ type: "gyozai_patch_history" })
    .then((r) => {
      if (r?.ok) {
        log("MAIN-world history patch injected via browser.scripting");
      } else {
        log("browser.scripting patch failed, trying inline fallback");
        inlineHistoryPatch();
      }
    })
    .catch(() => {
      inlineHistoryPatch();
    });
}

/** Inline <script> fallback — works on pages without strict CSP. */
function inlineHistoryPatch() {
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
  log("MAIN-world history patch injected via inline script");
}

/** Watch for host element detachment and re-attach it (preserving React state).
 *
 *  Uses three complementary strategies:
 *  1. MutationObserver on body — catches direct child removal
 *  2. MAIN-world history patch — catches SPA pushState/replaceState
 *  3. Periodic liveness check — catches anything else (300ms interval)
 *
 *  Returns a cleanup function (used in tests). */
export function watchForRemoval(host: HTMLDivElement): () => void {
  function reattach(source: string) {
    if (host.isConnected) return;
    if (!document.body) {
      log(`[${source}] host detached but document.body missing — waiting`);
      return;
    }
    log(`[${source}] host detached — re-attaching to body`);
    document.body.appendChild(host);
    reobserve();
    // Re-inject the MAIN-world patch too (SPA may have wiped the <script>)
    _historyPatchRequested = false;
    patchMainWorldHistory();
    // Notify widget so it can restore scroll position after reattachment
    window.dispatchEvent(new Event("gyozai:reattached"));
  }

  function reobserve() {
    observer.disconnect();
    if (host.parentElement) {
      observer.observe(host.parentElement, { childList: true });
    }
  }

  // 1. MutationObserver on the parent — catches direct child removal
  const observer = new MutationObserver(() => reattach("MutationObserver"));
  reobserve();
  log("MutationObserver watching body for child removal");

  // 2. SPA navigation hooks via MAIN world script injection
  patchMainWorldHistory();
  const onNavChange = () => setTimeout(() => reattach("navchange-event"), 50);
  window.addEventListener("popstate", onNavChange);
  window.addEventListener("gyozai:navchange", onNavChange);
  log("Listening for popstate + gyozai:navchange events");

  // 3. Periodic liveness check — fast fallback (300ms)
  const intervalId = setInterval(() => reattach("periodic-300ms"), 300);

  return () => {
    observer.disconnect();
    clearInterval(intervalId);
    window.removeEventListener("popstate", onNavChange);
    window.removeEventListener("gyozai:navchange", onNavChange);
  };
}

/** Hide the widget host element (for clean screenshots).
 *  Returns the previous visibility value for restoration. */
export function hideWidgetHost(): string {
  const host = document.getElementById(HOST_ID);
  if (!host) return "";
  const prev = host.style.visibility;
  host.style.visibility = "hidden";
  return prev;
}

/** Restore the widget host element visibility. */
export function showWidgetHost(prev = ""): void {
  const host = document.getElementById(HOST_ID);
  if (!host) return;
  host.style.visibility = prev;
}
