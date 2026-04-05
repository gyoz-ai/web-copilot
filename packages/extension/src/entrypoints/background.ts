import { type QueryEngine } from "@gyoz-ai/engine";
import { handleQuery } from "./handlers/query";
import { handleLoadSession, handleSaveSession } from "./handlers/session";
import {
  handleSaveExpression,
  handleLoadExpression,
} from "./handlers/expression";
import {
  handleGetRecipe,
  handleAutoImportRecipe,
  handleGetRecipesList,
  handleSetRecipesGlobal,
} from "./handlers/recipes";
import { handleGetSettings, handleGetTabId } from "./handlers/settings";
import { handlePatchHistory, handleLegacyExec } from "./handlers/navigation";
import { clearWidgetSession } from "../lib/session";
import { getSettings, saveSettings } from "../lib/storage";

const PLATFORM_DOMAIN = "gyoz.ai";
const SESSION_COOKIE = "gyozai_session";
const PLATFORM_URL = "https://gyoz.ai";

export default defineBackground(() => {
  console.log("[gyoza] Background worker started");

  const engines = new Map<string, QueryEngine>();

  // ─── Active query tracking for pending-nav on navigation ──────
  // When a tab navigates while a query is running, save pending-nav
  // so the content script on the new page can auto-continue.
  const activeQueries = new Map<
    number,
    {
      conversationId: string;
      originalQuery: string;
      currentUrl?: string;
      abortController: AbortController;
      completed?: boolean;
      hadMutatingAction?: boolean;
    }
  >();

  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return; // Only main frame
    const query = activeQueries.get(details.tabId);
    if (!query) return;

    // Skip queries that have no mutating actions (click, submit, etc.)
    // If the model hasn't clicked or filled anything, navigation is NOT
    // model-caused — it's user-initiated or a third-party redirect (e.g.
    // Stripe session refresh). Don't save pending-nav.
    if (!query.hadMutatingAction) {
      console.log(
        "[gyoza:nav] No mutating actions in this query, skipping pending-nav",
      );
      activeQueries.delete(details.tabId);
      return;
    }

    // Ignore hash-only navigations (same origin+path+search, different hash)
    // Query param changes like ?lang=pt-BR ARE real navigation.
    const currentUrl = query.currentUrl;
    if (currentUrl && details.url) {
      try {
        const cur = new URL(currentUrl);
        const nav = new URL(details.url);
        if (
          cur.origin === nav.origin &&
          cur.pathname === nav.pathname &&
          cur.search === nav.search
        ) {
          console.log(
            "[gyoza:nav] Hash-only navigation, ignoring:",
            details.url.slice(0, 80),
          );
          return;
        }
      } catch {
        // Invalid URL — proceed with save
      }
    }

    console.log(
      "[gyoza:nav] Tab",
      details.tabId,
      "navigating while query active — aborting stream + saving pending-nav",
    );

    // Abort the running stream immediately so it stops calling tools
    query.abortController.abort();

    const navKey = `gyozai_pending_nav_${details.tabId}`;
    browser.storage.local
      .set({
        [navKey]: {
          snapshotTypes: ["fullPage"],
          originalQuery: query.originalQuery,
          conversationId: query.conversationId,
          tabId: details.tabId,
          timestamp: Date.now(),
        },
      })
      .catch(() => {});
    activeQueries.delete(details.tabId);
  });

  // Clean up completed mutating entries after the new page finishes loading.
  // At this point, any model-caused redirect has already been handled by
  // onBeforeNavigate → pending-nav saved. The entry is no longer needed.
  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    const entry = activeQueries.get(details.tabId);
    if (entry?.completed) {
      activeQueries.delete(details.tabId);
    }
  });

  // ─── Auto-sync session cookie from gyoz.ai → managedToken ──────
  // When user logs in/out on gyoz.ai, the extension picks it up instantly.
  browser.cookies.onChanged.addListener(async (changeInfo) => {
    console.log(
      "[gyoza:cookie] onChanged →",
      changeInfo.cookie.name,
      "domain:",
      changeInfo.cookie.domain,
      "removed:",
      changeInfo.removed,
    );
    if (
      changeInfo.cookie.domain.replace(/^\./, "") !== PLATFORM_DOMAIN ||
      changeInfo.cookie.name !== SESSION_COOKIE
    )
      return;

    console.log("[gyoza:cookie] Matched session cookie! Processing...");
    const settings = await getSettings();

    if (changeInfo.removed) {
      // Cookie deleted (logout or expiry)
      if (settings.managedToken) {
        console.log(
          "[gyoza:cookie] Session cookie removed — clearing managed token",
        );
        await saveSettings({
          ...settings,
          managedToken: undefined,
          managedPlan: undefined,
          managedUsage: undefined,
        });
      }
    } else {
      // Cookie set or updated (login)
      const token = changeInfo.cookie.value;
      console.log(
        "[gyoza:cookie] Cookie value present:",
        !!token,
        "already synced:",
        token === settings.managedToken,
      );
      if (token && token !== settings.managedToken) {
        console.log(
          "[gyoza:cookie] Session cookie detected — syncing managed token",
        );
        // Fetch plan info from platform
        let managedPlan: string | undefined;
        try {
          const res = await fetch(`${PLATFORM_URL}/v1/ai/usage`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log("[gyoza:cookie] Usage API response:", res.status);
          if (res.ok) {
            const data = await res.json();
            managedPlan = data.plan;
            console.log("[gyoza:cookie] Plan:", managedPlan);
          }
        } catch (err) {
          console.warn("[gyoza:cookie] Platform unreachable:", err);
        }
        await saveSettings({
          ...settings,
          managedToken: token,
          managedPlan,
        });
        console.log("[gyoza:cookie] Managed token saved ✓");
      }
    }
  });

  // On startup, check if cookie already exists (e.g. extension reloaded while logged in)
  console.log(
    "[gyoza:cookie] Startup: checking for existing session cookie...",
  );
  browser.cookies.get(
    { url: `https://${PLATFORM_DOMAIN}`, name: SESSION_COOKIE },
    async (cookie) => {
      console.log(
        "[gyoza:cookie] Startup cookie lookup result:",
        cookie ? `found (domain: ${cookie.domain})` : "not found",
      );
      if (!cookie) return;
      const settings = await getSettings();
      console.log(
        "[gyoza:cookie] Startup: current managedToken present:",
        !!settings.managedToken,
        "matches cookie:",
        settings.managedToken === cookie.value,
      );
      if (settings.managedToken === cookie.value) return; // already synced
      console.log("[gyoza:cookie] Startup: syncing existing session cookie");
      let managedPlan: string | undefined;
      try {
        const res = await fetch(`${PLATFORM_URL}/v1/ai/usage`, {
          headers: { Authorization: `Bearer ${cookie.value}` },
        });
        console.log("[gyoza:cookie] Startup usage API response:", res.status);
        if (res.ok) {
          const data = await res.json();
          managedPlan = data.plan;
        }
      } catch (err) {
        console.warn("[gyoza:cookie] Startup platform unreachable:", err);
      }
      await saveSettings({
        ...settings,
        managedToken: cookie.value,
        managedPlan,
      });
      console.log("[gyoza:cookie] Startup: managed token saved ✓");
    },
  );

  // ─── Port-based handler for long-running queries ───────────────
  // Firefox GC's sendResponse on long async ops ("Promised response went out
  // of scope"). Ports stay alive until explicitly disconnected.
  browser.runtime.onConnect.addListener((port) => {
    console.log("[gyoza:port] Connection received:", port.name);
    if (port.name !== "gyozai_query") return;
    const abortController = new AbortController();
    let portDisconnected = false;
    port.onMessage.addListener((message) => {
      console.log("[gyoza:port] Query message received via port");
      const sender = port.sender!;
      const tabId = sender.tab?.id;

      // Track active query for webNavigation pending-nav + stream abort
      if (tabId && message.conversationId) {
        // Abort any previous query still running for this tab
        const prev = activeQueries.get(tabId);
        if (prev) prev.abortController.abort();

        activeQueries.set(tabId, {
          conversationId: message.conversationId,
          originalQuery: message.query,
          currentUrl: sender.tab?.url,
          abortController,
          hadMutatingAction: false,
        });
      }

      // Callback for tools to notify that a mutating action occurred
      const onMutatingAction = () => {
        if (!tabId) return;
        const entry = activeQueries.get(tabId);
        if (entry && entry.abortController === abortController) {
          entry.hadMutatingAction = true;
        }
      };

      handleQuery(
        message,
        sender,
        (result) => {
          // Mark query as completed. hadMutatingAction is already set
          // in real-time by onMutatingAction callback from tools.
          if (tabId) {
            const entry = activeQueries.get(tabId);
            if (entry && entry.abortController === abortController) {
              entry.completed = true;
              // If no mutating actions, clear immediately — any future
              // navigation is user-initiated
              if (!entry.hadMutatingAction) {
                activeQueries.delete(tabId);
              }
            }
          }

          if (portDisconnected) return;
          console.log(
            "[gyoza:port] Sending query result via port, error:",
            (result as Record<string, unknown>)?.error || "none",
          );
          try {
            port.postMessage(result);
          } catch {
            // Port already disconnected (navigation mid-stream)
          }
        },
        engines,
        abortController.signal,
        onMutatingAction,
      );
    });
    port.onDisconnect.addListener(() => {
      console.log("[gyoza:port] Port disconnected — aborting stream");
      portDisconnected = true;
      abortController.abort();
      // Don't clear activeQueries here — webNavigation listener needs it
      // It gets cleared when the query completes (sendResponse) or
      // when webNavigation fires and consumes it
    });
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[gyoza:msg] onMessage →", message.type);
    switch (message.type) {
      case "gyozai_get_tab_id":
        handleGetTabId(sender, sendResponse);
        return false;
      case "gyozai_patch_history":
        handlePatchHistory(sender, sendResponse);
        return true;
      case "gyozai_load_session":
        handleLoadSession(message, sender, sendResponse);
        return true;
      case "gyozai_save_session":
        handleSaveSession(message, sender, sendResponse);
        return true;
      case "gyozai_save_expression":
        handleSaveExpression(message, sendResponse);
        return true;
      case "gyozai_load_expression":
        handleLoadExpression(sendResponse);
        return true;
      case "gyozai_get_settings":
        handleGetSettings(sendResponse);
        return true;
      case "gyozai_auto_import_recipe":
        handleAutoImportRecipe(message, sender, sendResponse);
        return true;
      case "gyozai_get_recipe":
        handleGetRecipe(message, sendResponse);
        return true;
      case "gyozai_get_recipes_list":
        handleGetRecipesList(sendResponse);
        return true;
      case "gyozai_set_recipes_global":
        handleSetRecipesGlobal(sender, sendResponse);
        return true;
      case "gyozai_open_popup":
        if (typeof browser.action?.openPopup === "function") {
          browser.action.openPopup();
        } else {
          // Firefox doesn't support openPopup — open popup page in a new tab
          browser.tabs.create({ url: browser.runtime.getURL("/popup.html") });
        }
        return false;
      case "gyozai_exec":
        handleLegacyExec(message, sendResponse);
        return true;
      default:
        return false;
    }
  });

  browser.commands.onCommand.addListener((command) => {
    console.log("[gyoza] Command received:", command);
    if (command === "toggle_widget") {
      browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log("[gyoza] Active tab:", tabs[0]?.id, tabs[0]?.url);
        if (tabs[0]?.id) {
          browser.tabs.sendMessage(tabs[0].id, { type: "gyozai_toggle" });
        }
      });
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    activeQueries.delete(tabId);
    clearWidgetSession(tabId).catch(() => {});
  });
});
