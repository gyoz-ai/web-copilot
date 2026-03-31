import { z } from "zod/v4";
import { streamText, stepCountIs } from "ai";
import { ActionResponseSchema } from "@gyoz-ai/engine";
import {
  getSettings,
  getConversationLlmHistory,
  saveConversationLlmHistory,
} from "../lib/storage";
import {
  getRecipes,
  getMergedRecipeForDomain,
  importRecipeFromFile,
  recipeExists,
} from "../lib/recipes";
import { createProvider } from "../lib/providers";
import type { Message } from "../lib/providers";
import { buildSystemPrompt, buildUserPrompt } from "../lib/prompts";
import {
  clearWidgetSession,
  loadWidgetSession,
  saveWidgetSession,
} from "../lib/session";
import { createBrowserTools, type ToolExecContext } from "../lib/tools";

// Pre-compute JSON schema for legacy structured output (managed mode only)
const actionJsonSchema = z.toJSONSchema(ActionResponseSchema, {
  target: "jsonSchema7",
});

// ─── Agent result returned to content script ────────────────────────────────

interface AgentResult {
  messages: string[];
  clarify?: { message: string; options: string[] } | null;
  expression?: string | null;
  navigated?: boolean;
  error?: string;
  /** Summary of tool calls for debugging */
  toolCalls?: Array<{
    tool: string;
    args: Record<string, unknown>;
  }>;
  /** True when streaming events were sent — content script should not duplicate UI updates */
  streamed?: boolean;
}

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
      const senderTabId = sender.tab?.id ?? null;
      handleQuery(message, senderTabId)
        .then((result) => {
          // Desktop notification when tab is not focused
          if (sender?.tab?.id) {
            chrome.tabs.get(sender.tab.id, (tab) => {
              if (!tab.active) {
                const msg = result.messages?.[0] || "Action completed";
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
            messages: [],
            error: err instanceof Error ? err.message : "Unknown error",
          } satisfies AgentResult);
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

    if (message.type === "gyozai_get_recipes_list") {
      getRecipes().then((recipes) => {
        sendResponse(
          recipes.map((r) => ({
            domain: r.domain,
            name: r.name,
            enabled: r.enabled,
          })),
        );
      });
      return true;
    }

    if (message.type === "gyozai_set_recipes_global") {
      const tabId = sender.tab?.id;
      if (tabId == null) {
        sendResponse({ ok: false });
        return false;
      }
      getRecipes()
        .then((recipes) => {
          // Expose only content hashes (IDs) — no names or domains
          const data = recipes.filter((r) => r.enabled).map((r) => r.id);
          return chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: (d: unknown) => {
              (window as any).__GYOZAI_INSTALLED_RECIPES__ = d;
            },
            args: [data],
          });
        })
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "gyozai_open_popup") {
      chrome.action.openPopup();
      return false;
    }

    // Legacy gyozai_exec — kept for backward compatibility but tools now handle this
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
                const fixedCode = code.replace(
                  /querySelector(?:All)?\(\s*['"]([^'"]+)['"]\s*\)/g,
                  (match, selector: string) => {
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

// ─── Main query handler ─────────────────────────────────────────────────────

async function handleQuery(
  message: {
    query: string;
    manifestMode: boolean;
    recipe?: string;
    htmlSnapshot?: string;
    currentRoute?: string;
    pageContext?: string;
    context?: Record<string, unknown>;
    capabilities?: Record<string, boolean>;
    conversationId?: string;
    queryId?: string;
  },
  senderTabId: number | null,
): Promise<AgentResult> {
  const settings = await getSettings();
  const providerResult = createProvider(settings);
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

  // Raw context sent to the model
  console.groupCollapsed("%c  [gyoza] System prompt", "color: #9ca3af");
  console.log(systemPrompt);
  console.groupEnd();
  console.groupCollapsed("%c  [gyoza] User prompt", "color: #9ca3af");
  console.log(userPrompt);
  console.groupEnd();
  if (history.length > 0) {
    console.groupCollapsed(
      "%c  [gyoza] Conversation history (" + history.length + " messages)",
      "color: #9ca3af",
    );
    console.log(history);
    console.groupEnd();
  }

  const start = Date.now();

  // ─── Managed mode: legacy structured output path ───────────────────────
  if (providerResult.type === "legacy") {
    const messages = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userPrompt },
    ];

    const legacyResult = await providerResult.provider.query(
      systemPrompt,
      messages,
      actionJsonSchema as Record<string, unknown>,
    );
    const ms = Date.now() - start;
    console.log(`  ⏱ Response in ${ms}ms (legacy/managed)`);
    console.groupEnd();

    // Update conversation history
    history.push({ role: "user", content: message.query });
    const firstMsg = legacyResult.actions.find(
      (a) => a.type === "show-message" && a.message,
    )?.message;
    if (firstMsg) {
      history.push({ role: "assistant", content: firstMsg.slice(0, 300) });
    }
    if (conversationId) {
      await saveConversationLlmHistory(conversationId, history);
    }

    // Convert legacy ActionResponse to AgentResult
    return convertLegacyToAgentResult(legacyResult);
  }

  // ─── BYOK mode: Vercel AI SDK with streaming tool calling ──────────

  if (senderTabId == null) {
    throw new Error("No tab ID available for tool execution");
  }

  const queryId = message.queryId;

  // Helper to forward streaming events to content script.
  // We track pending sends so we can await them all before returning the
  // final result — this prevents a race where sendResponse arrives at the
  // content script before late streaming events.
  const pendingSends: Promise<unknown>[] = [];
  const sendStreamEvent = (event: {
    kind: string;
    content?: string;
    face?: string;
    options?: string[];
  }) => {
    if (!queryId) return; // No streaming without queryId
    pendingSends.push(
      chrome.tabs
        .sendMessage(senderTabId, {
          type: "gyozai_stream_event",
          queryId,
          event,
        })
        .catch(() => {
          // Content script may have disconnected (e.g. navigation)
        }),
    );
  };

  const ctx: ToolExecContext = {
    tabId: senderTabId,
    messages: [],
    clarify: null,
    expression: null,
    navigated: false,
    conversationId: conversationId || null,
    originalQuery: message.query,
    onStreamEvent: sendStreamEvent,
  };

  const tools = createBrowserTools(ctx, caps, settings.yoloMode);

  const aiMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const allToolCalls: Array<{
      tool: string;
      args: Record<string, unknown>;
    }> = [];

    const stream = streamText({
      model: providerResult.model,
      system: systemPrompt,
      messages: aiMessages,
      tools,
      stopWhen: stepCountIs(10),
      onStepFinish: ({ toolCalls }) => {
        if (toolCalls?.length) {
          for (const tc of toolCalls) {
            const tcInput =
              "input" in tc ? (tc.input as Record<string, unknown>) : {};
            allToolCalls.push({ tool: tc.toolName, args: tcInput });

            const inputStr = JSON.stringify(tcInput);
            console.log(
              `%c  [gyoza] Tool: ${tc.toolName}%c ${inputStr.slice(0, 120)}`,
              "color: #a855f7; font-weight: bold",
              "color: #9ca3af",
            );
          }
        }
      },
    });

    // Consume the stream — tools execute as their blocks arrive
    const finalText = await stream.text;

    const ms = Date.now() - start;
    const steps = await stream.steps;
    console.log(`  ⏱ Response in ${ms}ms (${steps.length} steps)`);
    console.log("  Tool calls:", allToolCalls.length);
    for (const tc of allToolCalls) {
      console.log(`    → ${tc.tool}:`, JSON.stringify(tc.args).slice(0, 100));
    }
    console.groupEnd();

    // If the model also produced text (outside of tool calls), include it as a message
    if (finalText && finalText.trim()) {
      ctx.messages.push(finalText.trim());
      sendStreamEvent({ kind: "message", content: finalText.trim() });
    }

    // Ensure all streaming events have been delivered before returning the
    // final result — prevents the race where sendResponse arrives first.
    await Promise.all(pendingSends);

    // Update conversation history — include tool summary so AI has context
    history.push({ role: "user", content: message.query });
    const toolSummary = allToolCalls
      .filter(
        (tc) => tc.tool !== "show_message" && tc.tool !== "set_expression",
      )
      .map((tc) => `[${tc.tool}]`)
      .join(" ");
    const msgContent = ctx.messages.join("\n\n").slice(0, 300);
    const historyEntry = [toolSummary, msgContent].filter(Boolean).join("\n");
    if (historyEntry) {
      history.push({ role: "assistant", content: historyEntry });
    }
    if (conversationId) {
      await saveConversationLlmHistory(conversationId, history);
    }

    return {
      messages: ctx.messages,
      clarify: ctx.clarify,
      expression: ctx.expression,
      navigated: ctx.navigated,
      toolCalls: allToolCalls,
      // Signal that streaming events were sent (content script should not duplicate)
      streamed: !!queryId,
    };
  } catch (err) {
    console.error("[gyoza] AI SDK error:", err);
    console.groupEnd();
    throw err;
  }
}

// ─── Legacy conversion (managed mode) ───────────────────────────────────────

function convertLegacyToAgentResult(
  legacyResult: import("@gyoz-ai/engine").ActionResponse,
): AgentResult {
  const messages: string[] = [];
  let clarify: AgentResult["clarify"] = null;
  let navigated = false;

  // We need to return the legacy actions so the content script can dispatch them
  // For managed mode, the content script still handles action dispatch
  const toolCalls: AgentResult["toolCalls"] = [];

  for (const action of legacyResult.actions) {
    if (action.type === "show-message" && action.message) {
      messages.push(action.message);
    }
    if (action.type === "clarify" && action.message) {
      messages.push(action.message);
      clarify = { message: action.message, options: action.options || [] };
    }
    if (action.type === "navigate") {
      navigated = true;
    }
    // Pass through as tool calls for the content script to dispatch
    toolCalls.push({
      tool: action.type,
      args: action as unknown as Record<string, unknown>,
    });
  }

  return {
    messages,
    clarify,
    navigated,
    toolCalls,
    // Pass legacy actions and extra requests for content script dispatch
    ...(legacyResult as unknown as Record<string, unknown>),
  };
}
