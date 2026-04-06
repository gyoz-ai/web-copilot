import { streamText } from "ai";
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
import { getTranslations, type LocaleCode } from "../../lib/i18n";

export async function handleQuery(
  message: QueryInput & { conversationId?: string; queryId?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
  engines: Map<string, QueryEngine>,
  externalSignal?: AbortSignal,
  onMutatingAction?: () => void,
): Promise<void> {
  const settings = await getSettings();

  // ─── Free tier guard — managed mode requires a paid plan ───
  const PAID_PLANS = new Set(["pro", "max"]);
  console.log(
    "[gyoza:query] Free tier check → mode:",
    settings.mode,
    "managedPlan:",
    JSON.stringify(settings.managedPlan),
    "isPaid:",
    PAID_PLANS.has(settings.managedPlan ?? ""),
  );
  if (
    settings.mode === "managed" &&
    !PAID_PLANS.has(settings.managedPlan ?? "")
  ) {
    const tr = getTranslations(settings.language as LocaleCode);
    sendResponse({
      messages: [],
      toolCalls: [],
      error: tr.error_free_tier,
      errorType: "free_tier",
      provider: settings.provider,
    });
    return;
  }

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
    settings.chatOnly,
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
        browser.tabs
          .sendMessage(tabId, {
            type: "gyozai_stream_event",
            queryId,
            event,
          })
          .catch(() => {}),
      );
    };

    // AbortController — tools can abort the stream when navigation occurs
    // Also linked to external signal (port disconnect = user clicked Stop)
    const abortController = new AbortController();
    if (externalSignal) {
      externalSignal.addEventListener("abort", () => abortController.abort());
    }

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
      abortSignal: abortController.signal,
      actionCount: 0,
      onMutatingAction,
    };

    const tr = getTranslations(settings.language as LocaleCode);
    const tools = createBrowserTools(ctx, caps, settings.yoloMode, tr);

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

    // Tools that actually interact with the page DOM. If none of these
    // were called, the session is purely conversational (greeting, explanation).
    const PAGE_ACTION_TOOLS = new Set([
      "click",
      "navigate",
      "fill_input",
      "select_option",
      "toggle_checkbox",
      "submit_form",
      "scroll_to",
    ]);
    const hasPageAction = () =>
      allToolCalls.some((tc) => PAGE_ACTION_TOOLS.has(tc.tool));

    let streamError: Error | null = null;
    const stream = streamText({
      model: providerResult.model,
      system: systemPrompt,
      messages: aiMessages,
      tools,
      abortSignal: abortController.signal,
      stopWhen: ({ steps }) => {
        if (steps.length >= 100) return true;
        // Stop when the model calls task_complete
        const lastStep = steps[steps.length - 1];
        const calledTaskComplete = lastStep?.toolCalls?.some(
          (tc) => tc.toolName === "task_complete",
        );
        if (!calledTaskComplete) return false;
        // Chat-only mode: actions aren't possible, so always allow completion
        if (settings.chatOnly) return true;
        // If the AI performed actions OR is reporting failure, stop normally.
        // If it claims success without any actions, the tool itself returns
        // a warning (stopped: false) — let the model continue working.
        if (ctx.actionCount > 0) return true;
        // Check if it was a failure report (always allowed)
        const tcCall = allToolCalls[allToolCalls.length - 1];
        if (
          tcCall?.tool === "task_complete" &&
          (tcCall.args as { success?: boolean })?.success === false
        )
          return true;
        // Conversational completions — no page-action tools were attempted,
        // so the model was just chatting (greeting, explanation, etc.).
        if (!hasPageAction()) return true;
        // Had page actions attempted but actionCount still 0 → tool rejected, keep going
        return false;
      },
      prepareStep: ({ steps }) => {
        if (steps.length === 0) return {};

        const lastStep = steps[steps.length - 1];
        const lastToolCalls = lastStep?.toolCalls || [];
        const lastToolName = lastToolCalls[lastToolCalls.length - 1]?.toolName;

        // Let the model stop after: no tool calls, clarify, or task_complete.
        // report_action_result is NOT a stop point — the model must follow up
        // with verification (get_page_context) or completion (task_complete).
        if (
          !lastToolCalls.length ||
          lastToolName === "clarify" ||
          lastToolName === "task_complete"
        )
          return {};

        // Chat-only mode: let the model stop after show_message since it
        // can't take actions and just needs to explain to the user.
        if (settings.chatOnly && lastToolName === "show_message") return {};

        // Conversational queries: if show_message was the last tool and no
        // page-action tools have been attempted yet, let the model stop
        // naturally — it's just responding to a greeting or question.
        if (lastToolName === "show_message" && !hasPageAction()) return {};

        // Otherwise (show_message narration, get_page_context, etc.),
        // force tool use so the model keeps working instead of stopping
        // after just describing what it sees.
        const usedTools = new Set(
          steps.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) || []),
        );
        const exclude = new Set<string>();
        if (usedTools.has("set_expression")) exclude.add("set_expression");

        const active = Object.keys(tools).filter(
          (t) => !exclude.has(t),
        ) as (keyof typeof tools)[];

        return { toolChoice: "required" as const, activeTools: active };
      },
      onError: ({ error }) => {
        if (error instanceof Error) {
          streamError = error;
        } else if (
          typeof error === "object" &&
          error !== null &&
          "message" in error
        ) {
          streamError = new Error((error as { message: string }).message);
        } else {
          streamError = new Error(
            typeof error === "string" ? error : JSON.stringify(error),
          );
        }
      },
      onStepFinish: ({ text, toolCalls }) => {
        if (toolCalls?.length) {
          for (const tc of toolCalls) {
            const tcInput = (tc.input ?? {}) as Record<string, unknown>;
            allToolCalls.push({ tool: tc.toolName, args: tcInput });

            const inputStr = JSON.stringify(tcInput);
            console.log(
              `%c  [gyoza] Tool: ${tc.toolName}%c ${inputStr.slice(0, 120)}`,
              "color: #a855f7; font-weight: bold",
              "color: #9ca3af",
            );
          }
        }
        // Stream text from steps that didn't already show a message.
        // Skip if: (a) this step has show_message, OR (b) show_message was
        // already called AFTER the last get_page_context (the model already
        // communicated the result — follow-up text is just a rephrasing).
        const hasShowMessage = toolCalls?.some(
          (tc) =>
            tc.toolName === "show_message" ||
            tc.toolName === "report_action_result",
        );
        const alreadyCommunicated = ctx.messages.length > 0;
        let lastPageCtxIdx = -1;
        let lastShowMsgIdx = -1;
        for (let i = allToolCalls.length - 1; i >= 0; i--) {
          if (lastPageCtxIdx < 0 && allToolCalls[i].tool === "get_page_context")
            lastPageCtxIdx = i;
          if (lastShowMsgIdx < 0 && allToolCalls[i].tool === "show_message")
            lastShowMsgIdx = i;
          if (lastPageCtxIdx >= 0 && lastShowMsgIdx >= 0) break;
        }
        const answeredAfterData = lastShowMsgIdx > lastPageCtxIdx;
        if (
          text &&
          text.trim() &&
          !hasShowMessage &&
          !(alreadyCommunicated && answeredAfterData)
        ) {
          ctx.messages.push(text.trim());
          sendStreamEvent({ kind: "message", content: text.trim() });
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

    // If the SDK caught an error via onError (swallowed instead of thrown),
    // re-throw so our catch block formats and returns it properly.
    if (streamError && !aborted) {
      throw streamError;
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

    // Best-effort wait for streaming events — don't block sendResponse if
    // a tabs.sendMessage Promise never settles (no listener response).
    await Promise.race([
      Promise.all(pendingSends),
      new Promise((r) => setTimeout(r, 1000)),
    ]);

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
      browser.storage.local
        .set({ gyozai_expression: ctx.expression })
        .catch(() => {});
    }

    // Desktop notification when tab is not focused (not available on Safari)
    if (sender?.tab?.id && browser.notifications?.create) {
      browser.tabs.get(sender.tab.id, (tab) => {
        if (!tab.active && ctx.messages.length > 0) {
          browser.notifications.create({
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
    let statusCode: number | undefined;
    interface ErrorWithCause {
      message?: string;
      statusCode?: number;
      status?: number;
      cause?: ErrorWithCause;
    }
    let cause: ErrorWithCause | undefined =
      err instanceof Error ? (err as ErrorWithCause).cause : undefined;
    while (cause) {
      if (cause.message) errorMessage = cause.message;
      if (cause.statusCode) statusCode = cause.statusCode;
      if (cause.status) statusCode = cause.status;
      cause = cause.cause;
    }

    console.error(
      "[gyoza] Extracted error → message:",
      errorMessage,
      "statusCode:",
      statusCode,
      "original:",
      err instanceof Error ? err.constructor.name : typeof err,
    );

    // Detect billing/credit/quota/rate-limit errors and make them user-friendly
    const msgLower = errorMessage.toLowerCase();
    if (
      statusCode === 429 ||
      msgLower.includes("rate limit") ||
      msgLower.includes("rate_limit") ||
      msgLower.includes("too many requests") ||
      msgLower.includes("429")
    ) {
      errorType = "rate_limited";
      errorMessage = `${settings.provider} rate limit hit (429) — wait a moment and try again.`;
    } else if (
      statusCode === 402 ||
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
    } else if (
      statusCode === 401 ||
      statusCode === 403 ||
      (msgLower.includes("invalid") && msgLower.includes("key"))
    ) {
      errorType = "auth";
      errorMessage = `Invalid ${settings.provider} API key. Check your key in the gyoza settings.`;
    } else if (msgLower.includes("no output generated")) {
      if (settings.mode === "managed") {
        const tr = getTranslations(settings.language as LocaleCode);
        errorType = "free_tier";
        errorMessage = tr.error_free_tier;
      } else {
        errorMessage =
          "The AI failed to generate a response. This may be a temporary issue — try again.";
      }
    } else if (statusCode) {
      errorMessage = `${settings.provider} API error (${statusCode}): ${errorMessage}`;
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
