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
const PLATFORM_URL = "https://api.gyoz.ai";

export default defineBackground(() => {
  console.log("[gyoza] Background worker started");

  const engines = new Map<string, QueryEngine>();

  // ─── Auto-sync session cookie from gyoz.ai → managedToken ──────
  // When user logs in/out on gyoz.ai, the extension picks it up instantly.
  chrome.cookies.onChanged.addListener(async (changeInfo) => {
    if (
      changeInfo.cookie.domain.replace(/^\./, "") !== PLATFORM_DOMAIN ||
      changeInfo.cookie.name !== SESSION_COOKIE
    )
      return;

    const settings = await getSettings();

    if (changeInfo.removed) {
      // Cookie deleted (logout or expiry)
      if (settings.managedToken) {
        console.log("[gyoza] Session cookie removed — clearing managed token");
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
      if (token && token !== settings.managedToken) {
        console.log("[gyoza] Session cookie detected — syncing managed token");
        // Fetch plan info from platform
        let managedPlan: string | undefined;
        try {
          const res = await fetch(`${PLATFORM_URL}/v1/ai/usage`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            managedPlan = data.plan;
          }
        } catch {
          // Platform unreachable — still store the token
        }
        await saveSettings({
          ...settings,
          managedToken: token,
          managedPlan,
        });
      }
    }
  });

  // On startup, check if cookie already exists (e.g. extension reloaded while logged in)
  chrome.cookies.get(
    { url: `https://${PLATFORM_DOMAIN}`, name: SESSION_COOKIE },
    async (cookie) => {
      if (!cookie) return;
      const settings = await getSettings();
      if (settings.managedToken === cookie.value) return; // already synced
      console.log("[gyoza] Startup: syncing existing session cookie");
      let managedPlan: string | undefined;
      try {
        const res = await fetch(`${PLATFORM_URL}/v1/ai/usage`, {
          headers: { Authorization: `Bearer ${cookie.value}` },
        });
        if (res.ok) {
          const data = await res.json();
          managedPlan = data.plan;
        }
      } catch {}
      await saveSettings({
        ...settings,
        managedToken: cookie.value,
        managedPlan,
      });
    },
  );

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
      case "gyozai_query":
        handleQuery(message, sender, sendResponse, engines);
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
        chrome.action.openPopup();
        return false;
      case "gyozai_exec":
        handleLegacyExec(message, sendResponse);
        return true;
      default:
        return false;
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    console.log("[gyoza] Command received:", command);
    if (command === "toggle_widget") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log("[gyoza] Active tab:", tabs[0]?.id, tabs[0]?.url);
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "gyozai_toggle" });
        }
      });
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    clearWidgetSession(tabId).catch(() => {});
  });
});
