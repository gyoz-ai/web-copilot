import { streamText, stepCountIs } from "ai";
import {
  QueryEngine,
  type QueryInput,
  type QueryResult,
} from "@gyoz-ai/engine";
import {
  getSettings,
  getConversationLlmHistory,
  saveConversationLlmHistory,
} from "../../lib/storage";
import { createProvider } from "../../lib/providers";
import { buildSystemPrompt, buildUserPrompt } from "../../lib/prompts";
import { createBrowserTools, type ToolExecContext } from "../../lib/tools";

export async function handleQuery(
  message: QueryInput & { conversationId?: string; queryId?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
  engines: Map<string, QueryEngine>,
): Promise<void> {
  const settings = await getSettings();
  const providerResult = createProvider(settings);
  const tabId = sender.tab?.id ?? null;
  const convId = message.conversationId;
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
  const modelId =
    providerResult.type === "model"
      ? (providerResult.model as { modelId?: string }).modelId || settings.model
      : `managed (${settings.model})`;
  console.log(
    "  Provider:",
    settings.provider,
    "| Model:",
    modelId,
    "| Mode:",
    settings.mode,
  );
  console.log("  Query:", message.query.slice(0, 100));
  console.log("  Manifest mode:", message.manifestMode);
  console.log("  Conversation ID:", convId ?? "none");
  console.log(
    "  Conversation history:",
    history.length,
    "messages |",
    history.reduce((sum, m) => sum + m.content.length, 0),
    "chars (~",
    Math.round(history.reduce((sum, m) => sum + m.content.length, 0) / 4),
    "tokens)",
  );
  if (history.length > 0) {
    // Show each history entry role + preview (always visible)
    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      const preview = m.content.slice(0, 120).replace(/\n/g, " ");
      console.log(
        `%c  [${i}] ${m.role}:%c ${preview}${m.content.length > 120 ? "…" : ""} %c(${m.content.length} chars)`,
        m.role === "user"
          ? "color: #3b82f6; font-weight: bold"
          : "color: #22c55e; font-weight: bold",
        "color: #9ca3af",
        "color: #6b7280; font-style: italic",
      );
    }
  }

  console.groupCollapsed("%c  [gyoza] System prompt", "color: #9ca3af");
  console.log(systemPrompt);
  console.groupEnd();
  console.groupCollapsed("%c  [gyoza] User prompt", "color: #9ca3af");
  console.log(userPrompt);
  console.groupEnd();
  if (history.length > 0) {
    console.groupCollapsed(
      "%c  [gyoza] Full conversation history",
      "color: #9ca3af",
    );
    console.log(history);
    console.groupEnd();
  }

  const start = Date.now();

  try {
    // ─── Streaming mode (BYOK + Managed both use streamText) ─────
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

    // AbortController — tools can abort the stream when navigation occurs
    const abortController = new AbortController();

    const ctx: ToolExecContext = {
      tabId,
      messages: [],
      clarify: null,
      expression: null,
      navigated: false,
      conversationId: convId ?? null,
      originalQuery: message.query,
      onStreamEvent: sendStreamEvent,
      abortStream: () => abortController.abort(),
    };

    const tools = createBrowserTools(ctx, caps, settings.yoloMode);

    const aiMessages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userPrompt },
    ];

    // Save user query to history BEFORE streaming so that if a navigate tool
    // triggers a page reload, the new page's auto-continue will find the full
    // conversation history (including this query) already persisted.
    history.push({ role: "user", content: message.query });
    if (convId) {
      await saveConversationLlmHistory(convId, history);
    }

    const allToolCalls: Array<{
      tool: string;
      args: Record<string, unknown>;
    }> = [];

    const stream = streamText({
      model: providerResult.model,
      system: systemPrompt,
      messages: aiMessages,
      tools,
      abortSignal: abortController.signal,
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
    let finalText = "";
    let aborted = false;
    try {
      finalText = await stream.text;
    } catch (streamErr) {
      // AbortError means a tool detected navigation and killed the stream
      if (
        streamErr instanceof Error &&
        (streamErr.name === "AbortError" || abortController.signal.aborted)
      ) {
        aborted = true;
        console.log(
          "%c  [gyoza] Stream aborted (navigation detected by tool verification)",
          "color: #f59e0b; font-weight: bold",
        );
      } else {
        throw streamErr;
      }
    }

    const ms = Date.now() - start;
    console.log(
      `  ⏱ Response in ${ms}ms${aborted ? " (ABORTED — navigation)" : ""}`,
    );
    console.log("  Tool calls:", allToolCalls.length);
    for (const tc of allToolCalls) {
      console.log(`    → ${tc.tool}:`, JSON.stringify(tc.args).slice(0, 100));
    }
    console.groupEnd();

    // If the model produced text outside of tool calls AND didn't already
    // send messages via show_message, include it. Skip if show_message was
    // used — the finalText is just the model rephrasing what it already said.
    if (finalText && finalText.trim() && ctx.messages.length === 0) {
      ctx.messages.push(finalText.trim());
      sendStreamEvent({ kind: "message", content: finalText.trim() });
    }

    // Ensure all streaming events have been delivered before returning
    await Promise.all(pendingSends);

    // Update conversation history — append assistant response
    // (user message was already pushed before streaming to survive navigation)
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
      // Return updated history so the widget can seed it into new conversations
      llmHistory: history,
    });
  } catch (err) {
    console.error("[gyoza] Query error:", err);
    console.groupEnd();

    // Extract the real error from Vercel AI SDK's error chain
    // (AI_NoOutputGeneratedError wraps AI_APICallError which has the real message)
    let errorMessage = err instanceof Error ? err.message : "Unknown error";
    let errorType: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cause = err instanceof Error ? (err as any).cause : undefined;
    while (cause) {
      if (cause.message) errorMessage = cause.message;
      cause = cause.cause;
    }

    // Detect billing/credit/quota errors and make them user-friendly
    const msgLower = errorMessage.toLowerCase();
    if (
      msgLower.includes("credit") ||
      msgLower.includes("balance") ||
      msgLower.includes("billing") ||
      msgLower.includes("quota") ||
      msgLower.includes("exceeded")
    ) {
      errorType = "resource_exhausted";
      const DASHBOARD_URLS: Record<string, string> = {
        claude: "https://console.anthropic.com/settings/billing",
        openai: "https://platform.openai.com/account/billing",
        gemini: "https://aistudio.google.com/billing",
      };
      const url = DASHBOARD_URLS[settings.provider] || "";
      errorMessage = `Your ${settings.provider} API key has run out of credits. Top up at: ${url}`;
    } else if (msgLower.includes("invalid") && msgLower.includes("key")) {
      errorType = "auth";
      errorMessage = `Invalid ${settings.provider} API key. Check your key in the gyoza settings.`;
    } else if (msgLower.includes("no output generated")) {
      errorMessage =
        "The AI failed to generate a response. This may be a temporary issue — try again.";
    }

    sendResponse({
      messages: [],
      toolCalls: [],
      error: errorMessage,
      errorType,
      provider: settings.provider,
    });
  }
}
