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
import { waitForPageReady } from "./helpers";
import { storageGet } from "../../lib/storage";

// ─── Module-level preload ────────────────────────────────────────────────────

let _preloadedTabId: number | null = null;
let _preloadedLocale: LocaleCode | null = null;
let _preloadedSession: WidgetSession | null = null;
let _preloadedAvatarPosition: { x: number; y: number } | null = null;
let _preloadedExpression: string | null = null;
let _preloadedChatScale: number | null = null;
let _preloadedChatFullscreen: boolean | null = null;

const _preloadReady = browser.runtime
  .sendMessage({ type: "gyozai_get_tab_id" })
  .then(async (r) => {
    _preloadedTabId = r?.tabId ?? null;
    await Promise.all([
      _preloadedTabId != null
        ? browser.runtime
            .sendMessage({
              type: "gyozai_load_session",
              tabId: _preloadedTabId,
            })
            .then((s: WidgetSession | null) => {
              _preloadedSession = s;
            })
            .catch(() => {})
        : Promise.resolve(),
      browser.runtime
        .sendMessage({ type: "gyozai_get_settings" })
        .then((s: Record<string, unknown> | undefined) => {
          if (typeof s?.language === "string") {
            _preloadedLocale =
              s.language === "auto"
                ? detectBrowserLocale()
                : resolveLocale(s.language);
          }
          if (typeof s?.chatScale === "number")
            _preloadedChatScale = s.chatScale as number;
          if (typeof s?.chatFullscreen === "boolean")
            _preloadedChatFullscreen = s.chatFullscreen as boolean;
        })
        .catch(() => {}),
      // Load persisted avatar position from local storage (survives browser restart)
      storageGet("gyozai_avatar_position")
        .then((r) => {
          if (r.gyozai_avatar_position) {
            _preloadedAvatarPosition = r.gyozai_avatar_position;
          }
        })
        .catch(() => {}),
      // Load persisted expression via background worker (survives browser restart)
      browser.runtime
        .sendMessage({ type: "gyozai_load_expression" })
        .then((expr: string | null) => {
          if (expr) _preloadedExpression = expr;
        })
        .catch(() => {}),
    ]);
    // Session avatar position takes precedence over local storage
    const avatarPos =
      _preloadedSession?.avatarPosition ?? _preloadedAvatarPosition;
    // Session expression takes precedence over local storage
    const expr = _preloadedSession?.expression ?? _preloadedExpression ?? null;
    // Share preloaded state with GyozaiWidget module
    setPreloadState({
      tabId: _preloadedTabId,
      locale: _preloadedLocale,
      session: _preloadedSession,
      avatarPosition: avatarPos,
      expression: expr,
      chatScale: _preloadedChatScale,
      chatFullscreen: _preloadedChatFullscreen,
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
  const stored = await storageGet("gyozai_settings");
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
    const resp = await browser.runtime.sendMessage({
      type: "gyozai_auto_import_recipe",
      filename: "llms.txt",
      content: foundContent,
    });
    if (!resp?.skipped) {
      log("New recipe auto-imported for this site");
    }
  }
}

// ─── Page Search Listener (for background worker tool calls) ──────────

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "gyozai_search_html") {
    (async () => {
      try {
        await waitForPageReady();
        const patterns = msg.patterns as string[];
        const contextChars = (msg.contextChars as number) || 150;
        const maxResults = (msg.maxResults as number) || 15;
        const html = document.documentElement.outerHTML;
        const matches: Array<{ match: string; position: number }> = [];
        const lowerHtml = html.toLowerCase();

        for (const pattern of patterns) {
          let idx = 0;
          const lowerPattern = pattern.toLowerCase();
          while (
            (idx = lowerHtml.indexOf(lowerPattern, idx)) !== -1 &&
            matches.length < maxResults
          ) {
            const start = Math.max(0, idx - contextChars);
            const end = Math.min(
              html.length,
              idx + pattern.length + contextChars,
            );
            matches.push({ match: html.slice(start, end), position: idx });
            idx += pattern.length;
          }
          if (matches.length >= maxResults) break;
        }

        sendResponse({ matches, htmlSize: html.length });
      } catch (e) {
        sendResponse({
          matches: [],
          htmlSize: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return true;
  }

  if (msg.type === "gyozai_capture_text") {
    // Simple text snapshot for post-action verification diffing
    const text = document.body?.innerText?.slice(0, 5000) || "";
    sendResponse({ text });
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

    // Load self-hosted fonts (no external CDN dependency)
    try {
      if (!document.querySelector("#gyozai-fonts")) {
        const fontLink = document.createElement("link");
        fontLink.id = "gyozai-fonts";
        fontLink.rel = "stylesheet";
        fontLink.href = browser.runtime.getURL("/fonts/fonts.css");
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
        const host = injectWidget(
          body,
          browser.runtime.getURL("/widget.css"),
          renderWidget,
        );
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
    // Uses browser.scripting.executeScript via background (CSP-immune)
    function refreshInstalledRecipes() {
      browser.runtime
        .sendMessage({ type: "gyozai_set_recipes_global" })
        .catch(() => {});
    }
    refreshInstalledRecipes();

    // Refresh when recipes change (add/remove/toggle)
    browser.storage.onChanged.addListener((changes) => {
      if (changes.gyozai_recipes) {
        refreshInstalledRecipes();
      }
    });
    // Also refresh on auto-import notification
    browser.runtime.onMessage.addListener((msg) => {
      if (msg.type === "gyozai_recipe_auto_added") {
        refreshInstalledRecipes();
      }
    });

    // ─── Script collection for JS search cache ───────────────────────
    async function collectPageScripts() {
      try {
        const tabIdRes = await browser.runtime.sendMessage({
          type: "gyozai_get_tab_id",
        });
        const tabId = tabIdRes?.tabId;
        if (!tabId) return;

        const scriptEls = document.querySelectorAll("script");
        const scripts: Array<{
          key: string;
          type: "inline" | "external";
          url?: string;
          inlineContent?: string;
          contentHash: string;
        }> = [];
        let inlineIdx = 0;

        for (const el of scriptEls) {
          if (el.src) {
            scripts.push({
              key: el.src,
              type: "external",
              url: el.src,
              contentHash: el.src,
            });
          } else if (el.textContent && el.textContent.trim().length > 10) {
            const content = el.textContent;
            const hash = btoa(content.slice(0, 200)).slice(0, 16);
            scripts.push({
              key: `inline-${inlineIdx}-${hash}`,
              type: "inline",
              inlineContent: content,
              contentHash: hash,
            });
            inlineIdx++;
          }
        }

        if (scripts.length > 0) {
          browser.runtime
            .sendMessage({
              type: "gyozai_cache_scripts",
              tabId,
              origin: window.location.origin,
              scripts,
            })
            .catch(() => {});
        }
      } catch {
        // Script collection is non-critical
      }
    }

    // Collect scripts on load
    collectPageScripts();

    // Watch for dynamically added scripts
    const scriptObserver = new MutationObserver((mutations) => {
      let hasNewScripts = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLScriptElement) hasNewScripts = true;
        }
      }
      if (hasNewScripts) collectPageScripts();
    });
    scriptObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  },
});
