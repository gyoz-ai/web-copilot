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

export default defineBackground(() => {
  console.log("[gyoza] Background worker started");

  const engines = new Map<string, QueryEngine>();

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
