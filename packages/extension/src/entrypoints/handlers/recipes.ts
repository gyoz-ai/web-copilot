import {
  getRecipes,
  getMergedRecipeForDomain,
  importRecipeFromFile,
  recipeExists,
} from "../../lib/recipes";

export function handleAutoImportRecipe(
  message: { content: string; filename: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
): void {
  recipeExists(message.content).then((exists) => {
    if (exists) {
      console.log("[gyoza] Recipe already imported, skipping auto-add");
      sendResponse({ ok: true, skipped: true });
      return;
    }
    const tabHost = sender.tab?.url ? new URL(sender.tab.url).host : undefined;
    importRecipeFromFile(message.filename, message.content, tabHost).then(
      () => {
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "gyozai_recipe_auto_added",
            filename: message.filename,
          });
        }
        sendResponse({ ok: true });
      },
    );
  });
}

export function handleGetRecipe(
  message: { domain: string },
  sendResponse: (result: unknown) => void,
): void {
  getMergedRecipeForDomain(message.domain).then(sendResponse);
}

export function handleGetRecipesList(
  sendResponse: (result: unknown) => void,
): void {
  getRecipes().then((recipes) => {
    sendResponse(
      recipes.map((r) => ({
        domain: r.domain,
        name: r.name,
        enabled: r.enabled,
      })),
    );
  });
}

export function handleSetRecipesGlobal(
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
): void {
  const tabId = sender.tab?.id;
  if (tabId == null) {
    sendResponse({ ok: false });
    return;
  }
  getRecipes()
    .then((recipes) => {
      const data = recipes.filter((r) => r.enabled).map((r) => r.id);
      return chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (d: unknown) => {
          (
            window as unknown as Record<string, unknown>
          ).__GYOZAI_INSTALLED_RECIPES__ = d;
        },
        args: [data],
      });
    })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
}
