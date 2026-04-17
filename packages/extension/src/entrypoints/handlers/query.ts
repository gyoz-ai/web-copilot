import { streamText, type ModelMessage, type SystemModelMessage } from "ai";
import {
  QueryEngine,
  ConversationHistory,
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
import {
  getTranslations,
  resolveLocale,
  type LocaleCode,
} from "../../lib/i18n";

const PLATFORM_URL = "https://gyoz.ai";

export async function handleQuery(
  message: QueryInput & { conversationId?: string; queryId?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
  engines: Map<string, QueryEngine>,
  externalSignal?: AbortSignal,
  onMutatingAction?: () => void,
): Promise<void> {
  const settings = await getSettings();

  let providerResult;
  try {
    providerResult = createProvider(settings);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const isNotSignedIn =
      raw.includes("Not signed in") || raw.includes("not signed in");
    const errorMessage = isNotSignedIn
      ? `Not signed in - log in at https://gyoz.ai or switch to "Own Key" mode in settings.`
      : raw;
    sendResponse({
      messages: [],
      toolCalls: [],
      error: errorMessage,
      provider: settings.provider,
    });
    return;
  }
  const tabId = sender.tab?.id ?? null;
  const convId = message.conversationId;
  const queryId = message.queryId;
  const history = convId ? await getConversationLlmHistory(convId) : [];

  const caps = message.capabilities || {};
  const mode = message.manifestMode ? "manifest" : "no-manifest";
  // Resolve the user's configured response language. Priority:
  //   1. settings.language (explicit picker in popup) — unless "auto"
  //   2. context.language from the content script (navigator.language)
  //   3. English fallback
  const ctxLang =
    typeof message.context?.language === "string"
      ? (message.context.language as string)
      : undefined;
  const responseLanguage: string =
    settings.language && settings.language !== "auto"
      ? resolveLocale(settings.language)
      : ctxLang
        ? resolveLocale(ctxLang)
        : "en";
  const systemPrompt = buildSystemPrompt(
    mode as "manifest" | "no-manifest",
    caps,
    settings.yoloMode,
    settings.chatOnly,
    responseLanguage,
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
      : `dual: chat=${settings.model} | exec=server-selected`;
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
  console.log(
    "  Response language:",
    responseLanguage,
    `(setting=${settings.language ?? "unset"}, ctx=${ctxLang ?? "unset"})`,
  );
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

    // Build the current user message — multimodal when images/files are attached
    const images = message.images;
    const files = message.files;
    const hasAttachments =
      (images && images.length > 0) || (files && files.length > 0);
    const currentUserContent:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image"; image: string }
          | {
              type: "file";
              data: string;
              mediaType: string;
              filename?: string;
            }
        > = hasAttachments
      ? [
          ...(images ?? []).map((img) => ({
            type: "image" as const,
            image: img,
          })),
          ...(files ?? []).map((f) => ({
            type: "file" as const,
            // Strip data URL prefix — AI SDK FilePart expects raw base64
            data: f.dataUrl.replace(/^data:[^;]+;base64,/, ""),
            mediaType: f.mimeType,
            ...(f.filename ? { filename: f.filename } : {}),
          })),
          { type: "text" as const, text: userPrompt },
        ]
      : userPrompt;

    // Window history to last 10 messages (5 turns) to reduce token usage.
    // Storage still keeps up to 50 for UI display.
    const MAX_SEND_MESSAGES = 10;
    const windowedHistory = history.slice(-MAX_SEND_MESSAGES);

    // Microcompact older entries — truncate verbose tool results
    const compactor = new ConversationHistory();
    compactor.load(
      windowedHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    );
    compactor.microcompact();
    const compactedEntries = compactor.getEntries();

    const aiMessages: ModelMessage[] = [
      ...compactedEntries.map(
        (m): ModelMessage => ({
          role: m.role,
          content: m.content,
        }),
      ),
      { role: "user", content: currentUserContent },
    ];

    // Save user query to history BEFORE streaming so that if a navigate tool
    // triggers a page reload, the new page's auto-continue will find the full
    // conversation history (including this query) already persisted.
    // Attachments are NOT stored in LLM history — only text.
    const imageCount = images?.length ?? 0;
    const fileCount = files?.length ?? 0;
    const attachmentNote = [
      imageCount > 0 ? `${imageCount} image(s)` : "",
      fileCount > 0 ? `${fileCount} file(s)` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const historyText = attachmentNote
      ? `${message.query} [${attachmentNote} attached]`
      : message.query;
    history.push({ role: "user", content: historyText });
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
      "execute_page_function",
    ]);
    const hasPageAction = () =>
      allToolCalls.some((tc) => PAGE_ACTION_TOOLS.has(tc.tool));

    // Two-phase dual model tool split:
    //
    //   EXECUTION phase: everything EXCEPT show_message. The worker model
    //     grinds through the page (search, click, fill, …) and finishes by
    //     calling task_complete. task_complete in execution phase does NOT
    //     push a user-facing message — chat takes over next.
    //
    //   CHAT phase: ONLY show_message. After execution's task_complete we
    //     flip to chat; the narrator model reads the prior tool results and
    //     issues one polished show_message in the user's language. That
    //     call ends the stream.
    const EXECUTION_PHASE_TOOLS = new Set([
      "set_expression",
      "navigate",
      "click",
      "highlight_ui",
      "search_page",
      "execute_page_function",
      "fetch_url",
      "clarify",
      "fill_input",
      "select_option",
      "toggle_checkbox",
      "submit_form",
      "report_action_result",
      "task_complete",
      "page_screenshot",
    ]);

    // Anthropic prompt caching — mark system prompt + tools for caching
    // so repeated requests get ~90% discount on those input tokens.
    const isAnthropicByok =
      settings.mode === "byok" && settings.provider === "claude";
    const systemParam: string | SystemModelMessage[] = isAnthropicByok
      ? [
          {
            role: "system" as const,
            content: systemPrompt,
            providerOptions: {
              anthropic: { cacheControl: { type: "ephemeral" } },
            },
          },
        ]
      : systemPrompt;

    let streamError: Error | null = null;
    // Dual-model orchestration (managed mode):
    //   • chat model       → user-facing reasoning & talking (greet, clarify,
    //                         task_complete summary, conversational replies)
    //   • execution model  → fast/cheap tool-execution loop on the page
    // Single-model fallback (BYOK): same model used for everything.
    const isDual = providerResult.type === "dual";
    const chatModel =
      providerResult.type === "dual"
        ? providerResult.chatModel
        : providerResult.model;
    const executionModel =
      providerResult.type === "dual"
        ? providerResult.executionModel
        : providerResult.model;

    // Two-phase dual-model architecture (final split):
    //
    //   Step 0+ : EXECUTION phase (execution model, EXECUTION_PHASE_TOOLS).
    //             The worker grinds through the page and wraps up via
    //             task_complete. task_complete in this phase suppresses its
    //             summary push so the user does NOT see raw execution text.
    //
    //   After execution calls task_complete → flip to CHAT phase.
    //             Chat model sees ONLY show_message; it reads the prior
    //             tool results from the transcript and narrates the outcome
    //             in the user's language. show_message ends the stream.
    //
    // Rationale: the cheap/fast execution model (cerebras gpt-oss-120b)
    // handles the loop; the smart chat model owns the single user-facing
    // message. Keeps tokens on the chat model minimal while preserving
    // voice quality.
    let phase: "execution" | "chat" = isDual ? "execution" : "chat";
    if (isDual) ctx.phase = "execution";

    const pickModelForStep = (
      _steps: ReadonlyArray<{
        toolCalls?: ReadonlyArray<{ toolName: string }>;
      }>,
    ) => {
      if (!isDual) return chatModel;
      return phase === "execution" ? executionModel : chatModel;
    };

    const stream = streamText({
      // Initial model — in dual mode the execution model owns step 0 and
      // grinds until task_complete; chat model takes over afterwards to
      // narrate. In single-model mode, always use the sole model.
      model: isDual ? executionModel : chatModel,
      system: systemParam,
      messages: aiMessages,
      tools,
      providerOptions: isAnthropicByok
        ? { anthropic: { cacheControl: { type: "ephemeral" } } }
        : undefined,
      abortSignal: abortController.signal,
      stopWhen: ({ steps }) => {
        if (steps.length >= 100) return true;
        const lastStep = steps[steps.length - 1];
        const lastToolNames =
          lastStep?.toolCalls?.map((tc) => tc.toolName) ?? [];
        const calledTaskComplete = lastToolNames.includes("task_complete");
        const calledShowMessage = lastToolNames.includes("show_message");

        // ── Dual-mode phase machine ──────────────────────────────
        if (isDual) {
          if (phase === "execution") {
            if (!calledTaskComplete) return false;
            // task_complete may return {stopped:false} to reject itself
            // (e.g. claimed success with 0 actions, or hallucinated
            // page_evidence). In that case we must NOT flip phase — the
            // execution model needs to retry.
            const lastToolResults = (lastStep?.toolResults ?? []) as Array<{
              toolName: string;
              output?: { stopped?: boolean };
            }>;
            const tcResult = lastToolResults.find(
              (r) => r.toolName === "task_complete",
            );
            if (tcResult?.output?.stopped === false) return false;
            // Accepted completion — flip to chat so narrator speaks.
            phase = "chat";
            ctx.phase = "chat";
            return false;
          }
          // phase === "chat" — terminate once narration happens.
          if (calledShowMessage) return true;
          if (calledTaskComplete) return true;
          // Chat had nothing to say (empty step) — stop to avoid burning.
          if (lastToolNames.length === 0) return true;
          return false;
        }

        // ── Single-model legacy path (BYOK) ──────────────────────
        if (!calledTaskComplete) return false;
        if (settings.chatOnly) return true;
        if (ctx.actionCount > 0) return true;
        const tcCall = allToolCalls[allToolCalls.length - 1];
        if (
          tcCall?.tool === "task_complete" &&
          (tcCall.args as { success?: boolean })?.success === false
        )
          return true;
        if (!hasPageAction()) return true;
        return false;
      },
      prepareStep: ({ steps, messages: stepMessages }) => {
        // Decide which model handles THIS step (chat vs execution)
        const stepModel = pickModelForStep(steps);

        if (isDual) {
          const modelLabel =
            stepModel === executionModel ? "execution" : "chat";
          console.log(
            `%c  [gyoza] step #${steps.length} → ${modelLabel} model (phase=${phase})`,
            modelLabel === "execution"
              ? "color: #06b6d4; font-weight: bold"
              : "color: #f59e0b; font-weight: bold",
          );
        }

        // In dual-mode CHAT phase, the narrator sees ONLY show_message and
        // must use it. This is true at any step — whether we just flipped
        // or are reentering chat. Force the tool set regardless of the
        // step-count shortcut so execution-tool remnants never leak in.
        if (isDual && phase === "chat") {
          return {
            model: stepModel,
            toolChoice: "required" as const,
            activeTools: ["show_message"] as (keyof typeof tools)[],
          };
        }

        if (steps.length === 0) {
          // First step — dual mode uses execution model and must restrict
          // to EXECUTION_PHASE_TOOLS so show_message cannot be called by
          // the worker. Single mode: no restriction.
          if (isDual && phase === "execution") {
            const active = Object.keys(tools).filter((t) =>
              EXECUTION_PHASE_TOOLS.has(t),
            ) as (keyof typeof tools)[];
            return { model: stepModel, activeTools: active };
          }
          return { model: stepModel };
        }

        // If page_screenshot was used, inject the image as a user message
        // so the model sees it as visual content (same path as chat image upload)
        if (ctx.pendingScreenshotDataUrl) {
          const screenshotDataUrl = ctx.pendingScreenshotDataUrl;
          ctx.pendingScreenshotDataUrl = null;
          console.log(
            "%c[gyoza] prepareStep → injecting screenshot as user image message",
            "color: #22c55e; font-weight: bold",
          );
          stepMessages.push({
            role: "user",
            content: [
              { type: "image" as const, image: screenshotDataUrl },
              {
                type: "text" as const,
                text: "Here is the screenshot of the current page. Analyze this image visually and describe what you see.",
              },
            ],
          });
        }

        const lastStep = steps[steps.length - 1];
        const lastToolCalls = lastStep?.toolCalls || [];
        const lastToolName = lastToolCalls[lastToolCalls.length - 1]?.toolName;

        // Let the model stop after: no tool calls, clarify, task_complete,
        // or navigate (page is reloading — auto-resume handles the rest).
        if (
          !lastToolCalls.length ||
          lastToolName === "clarify" ||
          lastToolName === "task_complete" ||
          lastToolName === "navigate"
        )
          return { model: stepModel };

        // Chat-only mode: let the model stop after show_message since it
        // can't take actions and just needs to explain to the user.
        if (settings.chatOnly && lastToolName === "show_message")
          return { model: stepModel };

        // Conversational queries: if show_message was the last tool and no
        // page-action tools have been attempted yet, let the model stop
        // naturally — it's just responding to a greeting or question.
        if (lastToolName === "show_message" && !hasPageAction())
          return { model: stepModel };

        // Otherwise (show_message narration, search_page, etc.),
        // force tool use so the model keeps working instead of stopping
        // after just describing what it sees.
        const usedTools = new Set(
          steps.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) || []),
        );
        const exclude = new Set<string>();
        if (usedTools.has("set_expression")) exclude.add("set_expression");

        // Cap search_page at 3 calls total. After that, exclude it from the
        // active tool set so the model is forced to commit — pick show_message
        // / task_complete / clarify (in chat phase) or move to a DOM action
        // (in execution phase) instead of looping on more searches. This
        // matters most for weaker models (grok non-reasoning, gpt-oss-120b)
        // that otherwise spin forever on discovery.
        const searchPageCount = allToolCalls.filter(
          (tc) => tc.tool === "search_page",
        ).length;
        if (searchPageCount >= 3) exclude.add("search_page");

        // In dual-mode execution phase, restrict the tool set to worker
        // tools only — show_message is reserved for the chat/narrator
        // model after task_complete flips phase.
        const phaseFilter = (t: string) =>
          isDual && phase === "execution" ? EXECUTION_PHASE_TOOLS.has(t) : true;

        const active = Object.keys(tools).filter(
          (t) => !exclude.has(t) && phaseFilter(t),
        ) as (keyof typeof tools)[];

        return {
          model: stepModel,
          toolChoice: "required" as const,
          activeTools: active,
        };
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
      onStepFinish: ({ text, toolCalls, toolResults }) => {
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
        // Log tool results — especially useful for search_page so we can see
        // what snippets the model got back and understand why it chose to
        // call another tool vs. commit to an answer.
        if (toolResults?.length) {
          for (const tr of toolResults as ReadonlyArray<{
            toolName: string;
            output?: unknown;
          }>) {
            if (tr.toolName === "search_page") {
              const out = (tr.output ?? {}) as {
                html_matches?: Array<{ match: string }>;
                js_matches?: Array<{ match: string; source?: string }>;
                patterns_used?: string[];
                stats?: {
                  html_size?: number;
                  js_files?: number;
                  js_total_size?: number;
                  body_text_length?: number;
                };
                body_text_preview?: string;
                search_calls_used?: number;
                search_calls_remaining?: number;
                next_action_hint?: string;
              };
              const htmlN = out.html_matches?.length ?? 0;
              const jsN = out.js_matches?.length ?? 0;
              console.groupCollapsed(
                `%c  [gyoza] ↳ search_page result: ${htmlN} html + ${jsN} js matches (call ${out.search_calls_used ?? "?"}/${(out.search_calls_used ?? 0) + (out.search_calls_remaining ?? 0)})`,
                "color: #22c55e; font-weight: bold",
              );
              if (out.patterns_used) {
                console.log(
                  `%c  patterns (after normalization):%c ${JSON.stringify(out.patterns_used)}`,
                  "color: #8b5cf6; font-weight: bold",
                  "color: #e5e7eb",
                );
              }
              if (out.next_action_hint) {
                console.log(
                  `%c  hint:%c ${out.next_action_hint}`,
                  "color: #f59e0b; font-weight: bold",
                  "color: #e5e7eb",
                );
              }
              if (out.stats) {
                console.log("  stats:", out.stats);
              }
              if (out.body_text_preview) {
                console.groupCollapsed(
                  `%c  body_text_preview (page content model sees when 0 matches)`,
                  "color: #ef4444; font-weight: bold",
                );
                console.log(out.body_text_preview);
                console.groupEnd();
              }
              if (htmlN > 0) {
                console.groupCollapsed(
                  `%c  html_matches (${htmlN})`,
                  "color: #9ca3af",
                );
                for (let i = 0; i < htmlN; i++) {
                  const m = out.html_matches![i];
                  console.log(
                    `  [${i}] ${m.match.slice(0, 200).replace(/\n/g, " ")}${m.match.length > 200 ? "…" : ""}`,
                  );
                }
                console.groupEnd();
              }
              if (jsN > 0) {
                console.groupCollapsed(
                  `%c  js_matches (${jsN})`,
                  "color: #9ca3af",
                );
                for (let i = 0; i < jsN; i++) {
                  const m = out.js_matches![i];
                  console.log(
                    `  [${i}] ${m.source ?? ""} → ${m.match.slice(0, 200).replace(/\n/g, " ")}${m.match.length > 200 ? "…" : ""}`,
                  );
                }
                console.groupEnd();
              }
              console.groupEnd();
            }
          }
        }
        // Stream text from steps that didn't already show a message.
        // Skip if: (a) this step has show_message, OR (b) show_message was
        // already called AFTER the last search_page (the model already
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
          if (lastPageCtxIdx < 0 && allToolCalls[i].tool === "search_page")
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
    const msgContent = ctx.messages.join("\n\n").slice(0, 150);
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
        xai: "https://console.x.ai/billing",
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
      if (settings.mode === "managed" && settings.managedToken) {
        try {
          const usageRes = await fetch(`${PLATFORM_URL}/v1/ai/usage`, {
            headers: { Authorization: `Bearer ${settings.managedToken}` },
          });
          if (usageRes.ok) {
            const usage = await usageRes.json();
            const freshTier = ((usage.tier as string) ?? "").toLowerCase();
            const PAID_TIERS = new Set(["pro", "max", "enterprise"]);
            if (freshTier && !PAID_TIERS.has(freshTier)) {
              const tr = getTranslations(settings.language as LocaleCode);
              errorType = "free_tier";
              errorMessage = tr.error_free_tier;
            }
          }
        } catch {
          // API unreachable — fall through to generic message
        }
      }
      if (!errorType) {
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
