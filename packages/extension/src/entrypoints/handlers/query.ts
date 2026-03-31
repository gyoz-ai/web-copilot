import { z } from "zod/v4";
import { streamText, stepCountIs } from "ai";
import {
  QueryEngine,
  type QueryInput,
  type QueryResult,
  ActionResponseSchema,
} from "@gyoz-ai/engine";
import {
  getSettings,
  getConversationLlmHistory,
  saveConversationLlmHistory,
} from "../../lib/storage";
import { createProvider } from "../../lib/providers";
import { buildSystemPrompt, buildUserPrompt } from "../../lib/prompts";
import { createBrowserTools, type ToolExecContext } from "../../lib/tools";

// Pre-compute JSON schema for legacy structured output (managed mode only)
const actionJsonSchema = z.toJSONSchema(ActionResponseSchema, {
  target: "jsonSchema7",
});

export async function handleQuery(
  message: QueryInput & { conversationId?: string; queryId?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
  engines: Map<string, QueryEngine>,
): Promise<void> {
  const settings = await getSettings();
  const providerResult = createProvider(settings);
  const tabId = sender.tab?.id ?? null;
  const convId = message.conversationId || "default";
  const queryId = message.queryId;
  const history = convId ? await getConversationLlmHistory(convId) : [];

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
  console.log("  Conversation ID:", convId ?? "none");
  console.log("  Conversation history:", history.length, "messages");

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

  try {
    // ─── Managed mode: legacy structured output path ───────────────
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
      if (convId) {
        await saveConversationLlmHistory(convId, history);
      }

      // Convert legacy ActionResponse to AgentResult
      const result = convertLegacyToAgentResult(legacyResult);
      sendResponse(result);
      return;
    }

    // ─── BYOK mode: Vercel AI SDK with streaming tool calling ──────
    if (tabId == null) {
      throw new Error("No tab ID available for tool execution");
    }

    // Helper to forward streaming events to content script
    const pendingSends: Promise<unknown>[] = [];
    const sendStreamEvent = (event: {
      kind: string;
      content?: string;
      message?: string;
      face?: string;
      options?: string[];
    }) => {
      if (!queryId) return;
      pendingSends.push(
        chrome.tabs
          .sendMessage(tabId, {
            type: "gyozai_stream_event",
            queryId,
            event,
          })
          .catch(() => {}),
      );
    };

    const ctx: ToolExecContext = {
      tabId,
      messages: [],
      clarify: null,
      expression: null,
      navigated: false,
      conversationId: convId || null,
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

    // Ensure all streaming events have been delivered before returning
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
    if (convId) {
      await saveConversationLlmHistory(convId, history);
    }

    // Persist expression to local storage so it survives page refresh
    if (ctx.expression) {
      chrome.storage.local
        .set({ gyozai_expression: ctx.expression })
        .catch(() => {});
    }

    // Desktop notification when tab is not focused
    if (sender?.tab?.id) {
      chrome.tabs.get(sender.tab.id, (tab) => {
        if (!tab.active && ctx.messages.length > 0) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "/icon-128.png",
            title: "gyoza",
            message: ctx.messages[0].slice(0, 100),
          });
        }
      });
    }

    sendResponse({
      messages: ctx.messages,
      clarify: ctx.clarify,
      expression: ctx.expression,
      navigated: ctx.navigated,
      toolCalls: allToolCalls,
      streamed: !!queryId,
    });
  } catch (err) {
    console.error("[gyoza] Query error:", err);
    console.groupEnd();
    sendResponse({
      messages: [],
      toolCalls: [],
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

// ─── Legacy conversion (managed mode) ───────────────────────────────────────

function convertLegacyToAgentResult(
  legacyResult: import("@gyoz-ai/engine").ActionResponse,
) {
  const messages: string[] = [];
  let clarify: { message: string; options: string[] } | null = null;
  let navigated = false;
  const toolCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];

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
    ...(legacyResult as unknown as Record<string, unknown>),
  };
}
