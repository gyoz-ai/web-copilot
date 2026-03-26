import { z } from "zod/v4";
import { ActionResponseSchema } from "@gyoz-ai/engine";
import {
  getSettings,
  getConversationHistory,
  saveConversationHistory,
  clearConversationHistory,
} from "../lib/storage";
import {
  getMergedRecipeForDomain,
  importRecipeFromFile,
  recipeExists,
} from "../lib/recipes";
import { createProvider } from "../lib/providers";
import { buildSystemPrompt, buildUserPrompt } from "../lib/prompts";

// Pre-compute JSON schema for structured output
const actionJsonSchema = z.toJSONSchema(ActionResponseSchema, {
  target: "jsonSchema7",
});

export default defineBackground(() => {
  console.log("[gyoza] Background worker started");

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "gyozai_get_tab_id") {
      sendResponse({ tabId: sender.tab?.id ?? null });
      return false;
    }

    if (message.type === "gyozai_query") {
      handleQuery(message)
        .then((result) => {
          // Feature 3: Desktop notification when tab is not focused
          if (sender?.tab?.id) {
            chrome.tabs.get(sender.tab.id, (tab) => {
              if (!tab.active) {
                const msg =
                  result.actions.find((a: { message?: string }) => a.message)
                    ?.message || "Action completed";
                chrome.notifications.create({
                  type: "basic",
                  iconUrl: "/icon-128.png",
                  title: "gyoza",
                  message: msg.slice(0, 100),
                });
              }
            });
          }
          sendResponse(result);
        })
        .catch((err) => {
          console.error("[gyoza] Query error:", err);
          sendResponse({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        });
      return true;
    }

    if (message.type === "gyozai_get_settings") {
      getSettings().then(sendResponse);
      return true;
    }

    if (message.type === "gyozai_auto_import_recipe") {
      recipeExists(message.content).then((exists) => {
        if (exists) {
          console.log("[gyoza] Recipe already imported, skipping auto-add");
          sendResponse({ ok: true, skipped: true });
          return;
        }
        // Use the tab's actual host as domain (not what's in the file)
        const tabHost = sender.tab?.url
          ? new URL(sender.tab.url).host
          : undefined;
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
      return true;
    }

    if (message.type === "gyozai_get_recipe") {
      getMergedRecipeForDomain(message.domain).then(sendResponse);
      return true;
    }

    if (message.type === "gyozai_clear_history") {
      const tabId = message.tabId as number | undefined;
      if (tabId != null) {
        clearConversationHistory(tabId).then(() => {
          console.log(`[gyoza] Conversation history cleared for tab ${tabId}`);
          sendResponse({ ok: true });
        });
      } else {
        sendResponse({ ok: true });
      }
      return true;
    }

    if (message.type === "gyozai_open_popup") {
      chrome.action.openPopup();
      return false;
    }

    if (message.type === "gyozai_exec") {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!tab?.id) {
          sendResponse({ error: "No active tab" });
          return;
        }
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            world: "MAIN",
            func: (code: string) => {
              try {
                // Auto-fix selectors with special characters before executing
                // Replace #id selectors containing special chars with CSS.escape'd versions
                const fixedCode = code.replace(
                  /querySelector(?:All)?\(\s*['"]([^'"]+)['"]\s*\)/g,
                  (match, selector: string) => {
                    // If selector has an ID part with special chars, escape it
                    const fixed = selector.replace(
                      /#([^.\s#\[>~+,]+)/g,
                      (_: string, id: string) => {
                        if (/[^a-zA-Z0-9_-]/.test(id)) {
                          return "#" + CSS.escape(id);
                        }
                        return "#" + id;
                      },
                    );
                    if (fixed !== selector) {
                      return match.replace(selector, fixed);
                    }
                    return match;
                  },
                );
                new Function(fixedCode)();
                return null;
              } catch (e) {
                return e instanceof Error ? e.message : String(e);
              }
            },
            args: [message.code],
          })
          .then((results) => {
            const error = results?.[0]?.result;
            sendResponse(error ? { error } : { ok: true });
          })
          .catch((err) => {
            sendResponse({ error: err.message });
          });
      });
      return true;
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === "_execute_action") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "gyozai_toggle" });
        }
      });
    }
  });
});

async function handleQuery(message: {
  query: string;
  manifestMode: boolean;
  recipe?: string;
  htmlSnapshot?: string;
  currentRoute?: string;
  pageContext?: string;
  context?: Record<string, unknown>;
  capabilities?: Record<string, boolean>;
  tabId?: number;
}) {
  const settings = await getSettings();
  const provider = createProvider(settings);
  const tabId = message.tabId;
  const history = tabId != null ? await getConversationHistory(tabId) : [];

  const caps = message.capabilities || {};
  const mode = message.manifestMode ? "manifest" : "no-manifest";
  const systemPrompt = buildSystemPrompt(
    mode as "manifest" | "no-manifest",
    caps,
  );
  const userPrompt = buildUserPrompt({
    query: message.query,
    recipe: message.recipe,
    htmlSnapshot: message.htmlSnapshot,
    currentRoute: message.currentRoute,
    context: message.context,
    pageContext: message.pageContext,
  });

  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userPrompt },
  ];

  // ─── Log request ───────────────────
  console.group(
    `%c[gyoza] BACKGROUND → LLM`,
    "color: #E8950A; font-weight: bold",
  );
  console.log(
    "  Provider:",
    settings.provider,
    "| Model:",
    settings.model,
    "| Mode:",
    settings.mode,
  );
  console.log("  Query:", message.query.slice(0, 100));
  console.log("  Manifest mode:", message.manifestMode);
  console.log("  Tab ID:", tabId ?? "unknown");
  console.log("  Conversation history:", history.length, "messages");
  console.log("  System prompt:", systemPrompt.slice(0, 100) + "...");
  console.log("  User prompt:", userPrompt.slice(0, 150) + "...");
  if (message.pageContext) {
    console.log("  Page context:", message.pageContext.length, "chars");
  }

  const start = Date.now();
  const result = await provider.query(
    systemPrompt,
    messages,
    actionJsonSchema as Record<string, unknown>,
  );
  const ms = Date.now() - start;

  // ─── Log response ──────────────────
  console.log(`  ⏱ Response in ${ms}ms`);
  console.log("  Actions:");
  for (const action of result.actions) {
    const parts = [`    → ${action.type}`];
    if (action.target) parts.push(`target="${action.target}"`);
    if (action.selector) parts.push(`selector="${action.selector}"`);
    if (action.url) parts.push(`url="${action.url}"`);
    if (action.code) parts.push(`code="${(action.code || "").slice(0, 60)}"`);
    if (action.message)
      parts.push(`msg="${(action.message || "").slice(0, 80)}"`);
    if (action.options) parts.push(`options=[${action.options.join(", ")}]`);
    console.log(parts.join(" "));
  }
  const extraReqs = (result as { extraRequests?: string[] }).extraRequests;
  if (extraReqs?.length) {
    console.log("  Extra requests:", extraReqs.join(", "));
  }
  console.groupEnd();

  // Update conversation history
  history.push({ role: "user", content: message.query });
  const assistantMsg = result.actions
    .map((a) => a.message)
    .filter(Boolean)
    .join(" ");
  if (assistantMsg) {
    history.push({ role: "assistant", content: assistantMsg });
  }
  if (tabId != null) {
    await saveConversationHistory(tabId, history);
  }

  return result;
}
