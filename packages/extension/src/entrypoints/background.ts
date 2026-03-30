import { z } from "zod/v4";
import { ActionResponseSchema } from "@gyoz-ai/engine";
import {
  getSettings,
  getConversationLlmHistory,
  saveConversationLlmHistory,
} from "../lib/storage";
import {
  getMergedRecipeForDomain,
  importRecipeFromFile,
  recipeExists,
} from "../lib/recipes";
import { createProvider } from "../lib/providers";
import { buildSystemPrompt, buildUserPrompt } from "../lib/prompts";
import {
  clearWidgetSession,
  loadWidgetSession,
  saveWidgetSession,
} from "../lib/session";

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

    if (message.type === "gyozai_patch_history") {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({ ok: false });
        return false;
      }
      chrome.scripting
        .executeScript({
          target: { tabId },
          world: "MAIN",
          func: () => {
            if ((window as any).__gyozai_nav_patched__) return;
            (window as any).__gyozai_nav_patched__ = true;
            const E = "gyozai:navchange";
            const oP = history.pushState.bind(history);
            const oR = history.replaceState.bind(history);
            history.pushState = function (...args: Parameters<typeof oP>) {
              const r = oP(...args);
              window.dispatchEvent(new Event(E));
              return r;
            };
            history.replaceState = function (...args: Parameters<typeof oR>) {
              const r = oR(...args);
              window.dispatchEvent(new Event(E));
              return r;
            };
          },
        })
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "gyozai_load_session") {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId != null) {
        loadWidgetSession(tabId).then(sendResponse);
      } else {
        sendResponse(null);
      }
      return true;
    }

    if (message.type === "gyozai_save_session") {
      const tabId = sender.tab?.id ?? message.tabId;
      if (tabId != null) {
        saveWidgetSession(tabId, message.session).then(() =>
          sendResponse({ ok: true }),
        );
      } else {
        sendResponse({ ok: false });
      }
      return true;
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

  // Clean up per-tab widget session when a tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearWidgetSession(tabId).catch(() => {});
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
  conversationId?: string;
}) {
  const settings = await getSettings();
  const provider = createProvider(settings);
  const conversationId = message.conversationId;
  const history = conversationId
    ? await getConversationLlmHistory(conversationId)
    : [];

  const caps = message.capabilities || {};
  const mode = message.manifestMode ? "manifest" : "no-manifest";
  const systemPrompt = buildSystemPrompt(
    mode as "manifest" | "no-manifest",
    caps,
    settings.yoloMode,
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
  console.log("  Conversation ID:", conversationId ?? "none");
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

  // Update conversation history — store concise summary, not all verbose messages
  history.push({ role: "user", content: message.query });
  const firstMsg = result.actions.find(
    (a) => a.type === "show-message" && a.message,
  )?.message;
  if (firstMsg) {
    // Store only the first show-message, truncated to avoid bloating context
    history.push({ role: "assistant", content: firstMsg.slice(0, 300) });
  }
  if (conversationId) {
    await saveConversationLlmHistory(conversationId, history);
  }

  return result;
}
