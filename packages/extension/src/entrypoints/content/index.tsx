import React from "react";
import ReactDOM from "react-dom/client";
import {
  waitForBody,
  injectWidget,
  watchForRemoval,
} from "../../lib/injection";
import type { WidgetSession } from "../../lib/session";
import {
  detectBrowserLocale,
  resolveLocale,
  type LocaleCode,
} from "../../lib/i18n";
import { GyozaiWidget, setPreloadState } from "./GyozaiWidget";
import { WIDGET_STYLES } from "./styles";
import {
  capturePageContext,
  formatPageContext,
  captureCleanHtml,
} from "@gyoz-ai/engine";
import type { SnapshotType } from "@gyoz-ai/engine";

// ─── Module-level preload ────────────────────────────────────────────────────

let _preloadedTabId: number | null = null;
let _preloadedLocale: LocaleCode | null = null;
let _preloadedSession: WidgetSession | null = null;
let _preloadedAvatarPosition: { x: number; y: number } | null = null;

const _preloadReady = chrome.runtime
  .sendMessage({ type: "gyozai_get_tab_id" })
  .then(async (r) => {
    _preloadedTabId = r?.tabId ?? null;
    await Promise.all([
      _preloadedTabId != null
        ? chrome.runtime
            .sendMessage({
              type: "gyozai_load_session",
              tabId: _preloadedTabId,
            })
            .then((s: WidgetSession | null) => {
              _preloadedSession = s;
            })
            .catch(() => {})
        : Promise.resolve(),
      chrome.runtime
        .sendMessage({ type: "gyozai_get_settings" })
        .then((s: Record<string, unknown> | undefined) => {
          if (typeof s?.language === "string") {
            _preloadedLocale =
              s.language === "auto"
                ? detectBrowserLocale()
                : resolveLocale(s.language);
          }
        })
        .catch(() => {}),
      // Load persisted avatar position from local storage (survives browser restart)
      chrome.storage.local
        .get("gyozai_avatar_position")
        .then((r) => {
          if (r.gyozai_avatar_position) {
            _preloadedAvatarPosition = r.gyozai_avatar_position;
          }
        })
        .catch(() => {}),
    ]);
    // Session avatar position takes precedence over local storage
    const avatarPos =
      _preloadedSession?.avatarPosition ?? _preloadedAvatarPosition;
    // Share preloaded state with GyozaiWidget module
    setPreloadState({
      tabId: _preloadedTabId,
      locale: _preloadedLocale,
      session: _preloadedSession,
      avatarPosition: avatarPos,
      ready: Promise.resolve(),
    });
  })
  .catch(() => {});

// Share the preload promise itself (resolves after setPreloadState is called)
setPreloadState({
  tabId: null,
  locale: null,
  session: null,
  ready: _preloadReady as Promise<void>,
});

const S_BRAND = "color: #E8950A; font-weight: bold";
function log(...args: unknown[]) {
  console.log("%c[gyoza]", S_BRAND, ...args);
}

// ─── Render callback ─────────────────────────────────────────────────────────

function renderWidget(container: HTMLDivElement) {
  ReactDOM.createRoot(container).render(<GyozaiWidget />);
}

// ─── Recipe auto-import ──────────────────────────────────────────────────────

async function tryAutoImportRecipe() {
  const stored = await chrome.storage.local.get("gyozai_settings");
  const autoImport = stored.gyozai_settings?.autoImportRecipes ?? true;
  if (!autoImport) return;

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const pathParts = pathname.split("/").filter(Boolean);
  const urlsToTry = [`${origin}/llms.txt`];
  for (let i = pathParts.length; i > 0; i--) {
    urlsToTry.push(`${origin}/${pathParts.slice(0, i).join("/")}/llms.txt`);
  }

  let foundContent: string | null = null;
  for (const recipeUrl of urlsToTry) {
    try {
      const response = await fetch(recipeUrl, { method: "GET" });
      if (response.ok) {
        const text = await response.text();
        if (
          text.trimStart().startsWith("# ") &&
          (text.includes("## Routes") || text.includes("## UI Elements"))
        ) {
          foundContent = text;
          break;
        }
      }
    } catch {
      // skip this URL
    }
  }

  if (foundContent) {
    const resp = await chrome.runtime.sendMessage({
      type: "gyozai_auto_import_recipe",
      filename: "llms.txt",
      content: foundContent,
    });
    if (!resp?.skipped) {
      log("New recipe auto-imported for this site");
    }
  }
}

// ─── Tool Execution Listener (for background worker tool calls) ─────────────

const SNAPSHOT_MAP: Record<string, SnapshotType> = {
  buttons: "buttons",
  links: "links",
  forms: "forms",
  inputs: "inputs",
  textContent: "textContent",
  fullPage: "all",
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "gyozai_tool_capture_context") {
    try {
      const types: SnapshotType[] = (msg.snapshotTypes || []).map(
        (t: string) => SNAPSHOT_MAP[t] || "all",
      );
      // For fullPage requests, use the rich html-screen-capture-js snapshot
      // which includes visibility filtering and form values.
      const wantsFullPage = types.includes("all");
      const pageCtx = capturePageContext(types);
      const ctxText = formatPageContext(pageCtx);
      const fullHtml = wantsFullPage ? captureCleanHtml() : "";
      // Combine structured elements + full HTML when both available
      const combined = [ctxText, fullHtml].filter(Boolean).join("\n\n");
      sendResponse({ context: combined || captureCleanHtml() });
    } catch (e) {
      sendResponse({
        context:
          "Failed to capture: " + (e instanceof Error ? e.message : String(e)),
      });
    }
    return false;
  }
});

// ─── Content Script Entry ────────────────────────────────────────────────────

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  async main() {
    if ((window as any).__GYOZAI_SDK__) {
      log("SDK detected on page, extension deferring.");
      return;
    }

    // Load fonts non-blocking
    try {
      if (!document.querySelector("#gyozai-fonts")) {
        const fontLink = document.createElement("link");
        fontLink.id = "gyozai-fonts";
        fontLink.rel = "stylesheet";
        fontLink.href =
          "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400;500;700;800&f[]=satoshi@400;500;700&display=swap";
        document.head.appendChild(fontLink);
      }
    } catch {
      // Font loading is non-critical
    }

    // Wait for preload (avatar position, session, settings) before injecting
    // so the widget renders at the correct position on first paint.
    await _preloadReady;

    // Wait for body, then inject with retry
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const body = await waitForBody();
        const host = injectWidget(body, WIDGET_STYLES, renderWidget);
        watchForRemoval(host);
        log("Widget injected successfully");
        break;
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          log(`Injection attempt ${attempt} failed, retrying…`);
          await new Promise((r) => setTimeout(r, 200 * attempt));
        } else {
          log("Widget injection failed after retries:", err);
        }
      }
    }

    // Recipe auto-import runs independently
    tryAutoImportRecipe().catch(() => {});

    // Inject installed recipes list as global var for page UI (main world)
    // Uses chrome.scripting.executeScript via background (CSP-immune)
    function refreshInstalledRecipes() {
      chrome.runtime
        .sendMessage({ type: "gyozai_set_recipes_global" })
        .catch(() => {});
    }
    refreshInstalledRecipes();

    // Refresh when recipes change (add/remove/toggle)
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.gyozai_recipes) {
        refreshInstalledRecipes();
      }
    });
    // Also refresh on auto-import notification
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "gyozai_recipe_auto_added") {
        refreshInstalledRecipes();
      }
    });
  },
});
