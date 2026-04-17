import { browser } from "wxt/browser";
import { tool, jsonSchema, type ToolSet } from "ai";
import type {
  Capabilities,
  BrowserToolDescriptor,
  ToolRegistry,
} from "@gyoz-ai/engine";
import { EXPRESSIONS } from "./expressions";
import type { Translations } from "./i18n";

// ─── Tool Descriptors ─────────────────────────────────────────────────────────

export const TOOL_DESCRIPTORS: ToolRegistry = {
  show_message: {
    name: "show_message",
    description: "Display message to user",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 500,
  },
  set_expression: {
    name: "set_expression",
    description: "Change avatar expression",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 100,
  },
  navigate: {
    name: "navigate",
    description: "Navigate to URL",
    pageChange: true,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: false,
    maxResultChars: 500,
  },
  click: {
    name: "click",
    description: "Click an element",
    pageChange: true,
    mutatesPage: true,
    requiresFreshContext: true,
    isConcurrencySafe: false,
    maxResultChars: 1_000,
  },
  highlight_ui: {
    name: "highlight_ui",
    description: "Highlight an element",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 500,
  },
  search_page: {
    name: "search_page",
    description: "Search page HTML and JS",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 5_000,
  },
  execute_page_function: {
    name: "execute_page_function",
    description: "Execute discovered JS function",
    pageChange: true,
    mutatesPage: true,
    requiresFreshContext: true,
    isConcurrencySafe: false,
    maxResultChars: 2_000,
  },
  fetch_url: {
    name: "fetch_url",
    description: "Fetch URL",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 5_000,
  },
  clarify: {
    name: "clarify",
    description: "Ask user for clarification",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 1_000,
  },
  fill_input: {
    name: "fill_input",
    description: "Fill input field",
    pageChange: false,
    mutatesPage: true,
    requiresFreshContext: true,
    isConcurrencySafe: false,
    maxResultChars: 500,
  },
  select_option: {
    name: "select_option",
    description: "Select dropdown option",
    pageChange: false,
    mutatesPage: true,
    requiresFreshContext: true,
    isConcurrencySafe: false,
    maxResultChars: 500,
  },
  toggle_checkbox: {
    name: "toggle_checkbox",
    description: "Toggle checkbox/radio",
    pageChange: false,
    mutatesPage: true,
    requiresFreshContext: true,
    isConcurrencySafe: false,
    maxResultChars: 500,
  },
  report_action_result: {
    name: "report_action_result",
    description: "Evaluate action result",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 500,
  },
  task_complete: {
    name: "task_complete",
    description: "Signal task completion",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 200,
  },
  page_screenshot: {
    name: "page_screenshot",
    description: "Capture page screenshot",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 500,
  },
};

// ─── Tool Result Types ─────────────────────────────────────────────────────────

export interface ToolExecContext {
  tabId: number;
  /** Accumulator for messages the AI wants to show the user */
  messages: string[];
  /** If the AI asks the user a clarification question */
  clarify: { message: string; options: string[] } | null;
  /** Expression / mood for the avatar */
  expression: string | null;
  /** Set to true when navigation was initiated (page will reload) */
  navigated: boolean;
  /** Conversation ID for pending-nav persistence */
  conversationId: string | null;
  /** Original user query for pending-nav resume */
  originalQuery: string;
  /** Streaming callback — fires as each tool produces user-visible output */
  onStreamEvent?: (event: {
    kind: "message" | "tool-status" | "expression" | "clarify";
    content?: string;
    message?: string;
    face?: string;
    options?: string[];
  }) => void;
  /** Abort the AI stream — called when navigation occurs mid-execution */
  abortStream?: () => void;
  /** Signal from the query's AbortController — used to check if stream was already aborted */
  abortSignal?: AbortSignal;
  /** Count of mutating actions performed (click, fill_input, etc.) */
  actionCount: number;
  /** Callback to notify background that a mutating action occurred (for pending-nav decisions) */
  onMutatingAction?: () => void;
  /** Last page context snapshot — used to validate task_complete evidence */
  lastPageContext?: string;
  /** Screenshot data URL captured by page_screenshot tool — consumed by prepareStep */
  pendingScreenshotDataUrl?: string | null;
  /** Number of search_page calls so far — used to cap discovery loops */
  searchPageCallCount?: number;
  /**
   * Dual-model phase tag. When dual mode is on:
   *   • "execution" — worker model grinds through the page (search, click,
   *                    fill, …). Ends its run via task_complete, which in
   *                    this phase does NOT push a summary message (the chat
   *                    model narrates next).
   *   • "chat"      — narrator model. Only tool available is show_message.
   *                    Reads what execution did and reports to the user in
   *                    the user's language.
   * Undefined in single-model mode (BYOK) — task_complete pushes summary
   * directly as before.
   */
  phase?: "execution" | "chat";
}

// ─── Helper: execute script in page's MAIN world ─────────────────────────────

async function execInPage<T>(
  tabId: number,
  func: (...args: never[]) => T,
  args: unknown[] = [],
): Promise<T> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: func as (...a: unknown[]) => T,
    args,
  });
  return results?.[0]?.result as T;
}

// ─── Helper: execute script in ISOLATED world (content script context) ───────

async function execIsolated<T>(
  tabId: number,
  func: (...args: never[]) => T,
  args: unknown[] = [],
): Promise<T> {
  const results = await browser.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func: func as (...a: unknown[]) => T,
    args,
  });
  return results?.[0]?.result as T;
}

// ─── Screenshot widget-hiding helper ─────────────────────────────────────────
// Hides the extension widget before capturing a screenshot, restores after.

const WIDGET_HOST_ID = "gyozai-extension-root";

async function hideWidgetForScreenshot(
  tabId: number,
): Promise<() => Promise<void>> {
  try {
    await execIsolated(
      tabId,
      ((hostId: string) => {
        const host = document.getElementById(hostId);
        if (!host) return;
        host.style.visibility = "hidden";
        const shadow = host.shadowRoot;
        if (shadow && !shadow.getElementById("gyozai-screenshot-hide")) {
          const s = document.createElement("style");
          s.id = "gyozai-screenshot-hide";
          s.textContent =
            "*, *::before, *::after { visibility: hidden !important; opacity: 0 !important; }";
          shadow.appendChild(s);
        }
      }) as (...args: never[]) => void,
      [WIDGET_HOST_ID],
    );
    await new Promise((r) => setTimeout(r, 50));
  } catch {
    // Content script may not be reachable — proceed with capture anyway
  }

  return async () => {
    try {
      await execIsolated(
        tabId,
        ((hostId: string) => {
          const host = document.getElementById(hostId);
          if (!host) return;
          host.style.visibility = "";
          host.shadowRoot?.getElementById("gyozai-screenshot-hide")?.remove();
        }) as (...args: never[]) => void,
        [WIDGET_HOST_ID],
      );
    } catch {
      // Best effort
    }
  };
}

// ─── Post-action verification wrapper ─────────────────────────────────────────
// Wraps any mutating tool's execute function with before/after page capture.
// Captures page state BEFORE, runs the tool, then polls for changes AFTER.

function findNewLines(before: string, after: string): string {
  const beforeSet = new Set(before.split("\n").map((l) => l.trim()));
  return after
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !beforeSet.has(l))
    .slice(0, 20)
    .join("\n");
}

async function capturePageState(tabId: number): Promise<string> {
  try {
    const result = await browser.tabs.sendMessage(tabId, {
      type: "gyozai_capture_text",
    });
    return (result?.text as string) || "";
  } catch {
    return "";
  }
}

async function waitForPageLoad(tabId: number): Promise<void> {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        if (document.readyState === "complete") return;
        return new Promise<void>((resolve) => {
          const check = () => {
            if (document.readyState === "complete") return resolve();
            setTimeout(check, 200);
          };
          check();
          setTimeout(resolve, 5000);
        });
      },
    });
  } catch {
    /* page may have unloaded */
  }
}

async function getPageUrl(tabId: number): Promise<string | null> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => window.location.href,
    });
    return (results?.[0]?.result as string) || null;
  } catch {
    return null;
  }
}

interface VerifyResult {
  navigated?: boolean;
  newUrl?: string;
  actionIncomplete?: boolean;
  pageState?: string;
  verification?: string;
}

async function verifyPostAction(
  tabId: number,
  beforeText: string,
  preUrl: string,
): Promise<VerifyResult> {
  const MAX_POLLS = 5;
  const POLL_INTERVAL = 500;

  console.log(
    "%c  [gyoza:verify] Polling for changes (before: %d chars)...",
    "color: #f59e0b; font-weight: bold",
    beforeText.length,
  );

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    await waitForPageLoad(tabId);

    // Check URL change
    const currentUrl = await getPageUrl(tabId);
    if (!currentUrl) break;

    if (currentUrl !== preUrl) {
      // Ignore hash-only changes (same origin+path+search, different hash)
      try {
        const pre = new URL(preUrl);
        const cur = new URL(currentUrl);
        if (
          pre.origin === cur.origin &&
          pre.pathname === cur.pathname &&
          pre.search === cur.search
        ) {
          console.log(
            `%c  [gyoza:verify] Poll ${poll}: hash-only URL change, ignoring`,
            "color: #9ca3af",
          );
          continue;
        }
      } catch {
        // Invalid URL — treat as navigation
      }

      console.log(
        `%c  [gyoza:verify] Poll ${poll}: navigation → ${currentUrl}`,
        "color: #22c55e; font-weight: bold",
      );
      return { navigated: true, newUrl: currentUrl };
    }

    // Capture current state
    const afterText = await capturePageState(tabId);
    if (!afterText) break;

    if (afterText === beforeText) {
      console.log(
        `%c  [gyoza:verify] Poll ${poll}: no change`,
        "color: #9ca3af",
      );
      continue;
    }

    // Something changed — analyze
    console.log(
      `%c  [gyoza:verify] Poll ${poll}: changed (${beforeText.length} → ${afterText.length} chars)`,
      "color: #f59e0b; font-weight: bold",
    );

    const lengthDiff = Math.abs(afterText.length - beforeText.length);

    console.log(
      `%c  [gyoza:verify] Diff: ${lengthDiff} chars length change`,
      "color: #f59e0b",
    );

    if (lengthDiff > 500) {
      console.log(
        "%c  [gyoza:verify] → Action incomplete (significant page change)",
        "color: #ef4444; font-weight: bold",
      );
      return {
        actionIncomplete: true,
        pageState: afterText.slice(0, 1500),
      };
    }

    const successPattern =
      /added to cart|カートに追加|追加しました|success|完了|confirmed/i;
    if (successPattern.test(afterText) && !successPattern.test(beforeText)) {
      const match = afterText.match(successPattern)?.[0] || "";
      console.log(
        `%c  [gyoza:verify] → Success: "${match}"`,
        "color: #22c55e; font-weight: bold",
      );
      return { verification: `Action confirmed — "${match}" appeared.` };
    }

    const newLines = findNewLines(beforeText, afterText);
    return {
      verification: `Page changed after action. New content:\n${newLines.slice(0, 800)}`,
    };
  }

  console.log("%c  [gyoza:verify] → No change after polling", "color: #f59e0b");
  return { verification: "No visible page change detected after action." };
}

/**
 * Wrap a tool's execute function with before/after page verification.
 * Only runs verification for tools that mutate the page or cause navigation.
 */
function withVerification<TArgs, TResult extends Record<string, unknown>>(
  ctx: ToolExecContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ToolSet execute uses any for the options param
  executeFn: (args: TArgs, ...rest: any[]) => Promise<TResult>,
): typeof executeFn {
  return async (args: TArgs) => {
    // Track that a mutating action was attempted
    ctx.actionCount++;
    ctx.onMutatingAction?.();

    // Capture before state
    const beforeText = await capturePageState(ctx.tabId);
    const preUrl = (await getPageUrl(ctx.tabId)) || "";

    // Run the original tool
    const result = await executeFn(args);

    // If the tool already failed, skip verification
    if ("success" in result && result.success === false) {
      return result;
    }

    // Poll for changes
    const verify = await verifyPostAction(ctx.tabId, beforeText, preUrl);

    if (verify.navigated) {
      ctx.navigated = true;

      console.log(
        "%c  [gyoza:verify] Navigation detected — aborting stream",
        "color: #ef4444; font-weight: bold",
      );

      // For SPA navigations (pushState/replaceState), webNavigation doesn't
      // fire, so save pending-nav here as fallback. Skip if the stream was
      // already aborted — onBeforeNavigate already saved pending-nav for
      // full-page navigations and the mount effect will consume it.
      const alreadyAborted = ctx.abortSignal?.aborted;

      if (!alreadyAborted) {
        const pendingNavKey = `gyozai_pending_nav_${ctx.tabId}`;
        await browser.storage.local
          .set({
            [pendingNavKey]: {
              snapshotTypes: ["fullPage"],
              originalQuery: ctx.originalQuery,
              conversationId: ctx.conversationId || "",
              tabId: ctx.tabId,
              timestamp: Date.now(),
            },
          })
          .catch(() => {});
      }

      // Abort the AI stream so it doesn't keep calling tools on a dead page
      ctx.abortStream?.();

      // Notify content script to check pending-nav — needed for SPA navigations
      // where the content script stays alive and the mount useEffect won't re-fire.
      if (!alreadyAborted) {
        browser.tabs
          .sendMessage(ctx.tabId, { type: "gyozai_check_pending_nav" })
          .catch(() => {});
      }

      return {
        ...result,
        verification: `Page navigated to ${verify.newUrl}. Execution stopped — the widget will resume on the new page.`,
      };
    }

    if (verify.actionIncomplete) {
      return {
        success: false,
        error: `Action caused a significant page change (new form/dialog). Page state:\n${verify.pageState}\nYou must handle these before the action succeeds.`,
      } as unknown as TResult;
    }

    if (verify.verification) {
      return { ...result, verification: verify.verification };
    }

    return result;
  };
}

/**
 * Wrap a tool's execute function with a pre-execution confirmation step.
 * Sends a message to the content script asking the user to Allow/Deny.
 * Only applied when yolo mode is OFF.
 */
function withConfirmation<TArgs, TResult extends Record<string, unknown>>(
  ctx: ToolExecContext,
  actionDescription: (args: TArgs) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ToolSet execute uses any for the options param
  executeFn: (args: TArgs, ...rest: any[]) => Promise<TResult>,
): typeof executeFn {
  return async (args: TArgs) => {
    const description = actionDescription(args);
    ctx.onStreamEvent?.({ kind: "tool-status", content: description });

    try {
      const confirmed = await browser.tabs.sendMessage(ctx.tabId, {
        type: "gyozai_confirm_action",
        description,
      });

      if (!confirmed) {
        ctx.messages.push("Action cancelled.");
        ctx.onStreamEvent?.({ kind: "message", content: "Action cancelled." });
        return {
          success: false,
          error: "User cancelled the action",
        } as unknown as TResult;
      }
    } catch {
      // Content script not reachable — proceed without confirmation
    }

    return executeFn(args);
  };
}

// ─── Tool Factory ──────────────────────────────────────────────────────────────

export function createBrowserTools(
  ctx: ToolExecContext,
  caps: Capabilities,
  yoloMode: boolean,
  tr?: Translations,
) {
  const tools: ToolSet = {};

  // ── Always available: show_message ──────────────────────────────────────
  tools.show_message = tool<{ message: string }, { displayed: boolean }>({
    description:
      "Display a message to the user in the chat. Call this ONCE per response to explain what you did or found. Do NOT call it multiple times — combine your update into a single concise message. Never perform actions without also showing a message.",
    inputSchema: jsonSchema<{ message: string }>({
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "The message to display to the user",
        },
      },
      required: ["message"],
    }),
    execute: async ({ message }) => {
      ctx.messages.push(message);
      ctx.onStreamEvent?.({ kind: "message", content: message });
      return { displayed: true };
    },
  });

  // ── Always available: set_expression ────────────────────────────────────
  tools.set_expression = tool<{ face: string }, { applied: boolean }>({
    description:
      "Set your facial expression for this response. Call this BEFORE responding to set the mood.",
    inputSchema: jsonSchema<{ face: string }>({
      type: "object" as const,
      properties: {
        face: {
          type: "string",
          enum: [...EXPRESSIONS],
          description: "The expression to set",
        },
      },
      required: ["face"],
    }),
    execute: async ({ face }) => {
      ctx.expression = face;
      ctx.onStreamEvent?.({ kind: "expression", face });
      return { applied: true };
    },
  });

  // ── Always available: report_action_result ───────────────────────────────
  tools.report_action_result = tool<
    { success: boolean; summary: string; message: string | null },
    { acknowledged: boolean }
  >({
    description:
      "REQUIRED after every page action (click, fill_input, select_option, toggle_checkbox). Evaluate whether the action achieved what you intended. Check the tool result, then report here. If the action failed, explain why and retry. Pass message=null when no user-facing message is needed (e.g. mid-batch), or a string to display it to the user.",
    inputSchema: jsonSchema<{
      success: boolean;
      summary: string;
      message: string | null;
    }>({
      type: "object" as const,
      properties: {
        success: {
          type: "boolean",
          description: "Did the action achieve the intended result?",
        },
        summary: {
          type: "string",
          description:
            "Brief evaluation of what happened (e.g. 'scrolled to features section', 'click failed — element not found')",
        },
        message: {
          type: ["string", "null"],
          description: "Message to show the user, or null if no message needed",
        },
      },
      required: ["success", "summary", "message"],
    }),
    execute: async ({ message }) => {
      if (message && message !== "null") {
        ctx.messages.push(message);
        ctx.onStreamEvent?.({ kind: "message", content: message });
      }
      return { acknowledged: true };
    },
  });

  // ── task_complete — signals the task is done, stops the tool loop ──────
  tools.task_complete = tool<
    { success: boolean; summary: string; page_evidence?: string },
    { stopped: boolean; warning?: string }
  >({
    description:
      "Call this when the ENTIRE user request is fulfilled. This stops the tool loop. You MUST include page_evidence: quote EXACT text from the page that proves the task succeeded (copy-paste from search_page results, not paraphrased). If you cannot quote evidence, the task is not verified.",
    inputSchema: jsonSchema<{
      success: boolean;
      summary: string;
      page_evidence?: string;
    }>({
      type: "object" as const,
      properties: {
        success: {
          type: "boolean",
          description: "Was the task completed successfully?",
        },
        summary: {
          type: "string",
          description:
            "Final summary of what was done (shown to user as the last message)",
        },
        page_evidence: {
          type: "string",
          description:
            "REQUIRED for success=true. Exact text copied from the page (from search_page) that proves the task was completed. Must be a verbatim quote, not paraphrased.",
        },
      },
      required: ["success", "summary"],
    }),
    execute: async ({ success, summary, page_evidence }) => {
      // If the AI claims success but never performed any action, reject it
      // — UNLESS it already communicated via show_message (conversational
      // responses like greetings or explanations don't require page actions).
      if (success && ctx.actionCount === 0) {
        if (ctx.messages.length > 0) {
          // Conversational completion — model already responded to the user
          return { stopped: true };
        }
        return {
          stopped: false,
          warning:
            "You marked the task as complete but you have NOT performed any page actions (click, fill_input, etc.) in this session. Reading a page is not completing a task. Go back and actually interact with the page to fulfill the request, or call task_complete with success=false if the task cannot be done.",
        };
      }
      // Validate evidence against last page context
      if (success && page_evidence && ctx.lastPageContext) {
        const normalizedEvidence = page_evidence
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        const normalizedPage = ctx.lastPageContext
          .toLowerCase()
          .replace(/\s+/g, " ");
        if (!normalizedPage.includes(normalizedEvidence)) {
          return {
            stopped: false,
            warning: `Your page_evidence "${page_evidence}" was NOT found on the page. You may be hallucinating. Call search_page to re-read the page, then look for the ACTUAL text that confirms your task, or call task_complete with success=false.`,
          };
        }
      }
      // In dual-mode execution phase, the chat model narrates next — do NOT
      // push the summary here or the user sees two messages (the raw summary
      // followed by the chat model's polished narration). In single-model
      // mode, or when the chat model itself calls task_complete, push as usual.
      if (ctx.phase !== "execution") {
        ctx.messages.push(summary);
        ctx.onStreamEvent?.({ kind: "message", content: summary });
      }
      return { stopped: true };
    },
  });

  // ── navigate ────────────────────────────────────────────────────────────
  if (caps.navigate !== false) {
    tools.navigate = tool<
      { url: string },
      | { success: true; navigatedTo: string; note: string }
      | { success: false; error: string }
    >({
      description:
        "Navigate to any URL — same site or cross-site (e.g. 'https://amazon.co.jp'). This causes a full page load — after calling this tool, you CANNOT interact with the page further. Do not call any more tools after navigate.",
      inputSchema: jsonSchema<{ url: string }>({
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description:
              "URL path or full URL to navigate to (e.g. '/dashboard' or 'https://example.com/page')",
          },
        },
        required: ["url"],
      }),
      execute: async ({ url }: { url: string }) => {
        ctx.navigated = true;
        // Mark as mutating so background's webNavigation.onBeforeNavigate
        // saves pending-nav and the new page can auto-resume the task.
        ctx.actionCount++;
        ctx.onMutatingAction?.();
        try {
          const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
          });
          const resolved = tab?.url ? new URL(url, tab.url).href : url;

          ctx.onStreamEvent?.({
            kind: "tool-status",
            content: tr
              ? tr.status_navigating.replace("{url}", resolved)
              : `Navigating to ${resolved}`,
          });

          await execIsolated(
            ctx.tabId,
            ((targetUrl: string) => {
              window.location.href = targetUrl;
            }) as (...args: never[]) => void,
            [resolved],
          );

          // Abort the stream immediately — the content script will be
          // destroyed by the navigation. Any further tool calls would
          // target a dead page. The auto-resume on the new page will
          // continue the task via pending-nav.
          ctx.abortStream?.();

          return {
            success: true as const,
            navigatedTo: resolved,
            note: "Page is now loading. Do not call any more tools.",
          };
        } catch (e) {
          return {
            success: false as const,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
  }

  // ── click ───────────────────────────────────────────────────────────────
  if (caps.click) {
    tools.click = tool<
      { selector?: string; text?: string; tag?: string; near_text?: string },
      | { success: true; element: string; context: string }
      | { success: false; error: string }
    >({
      description:
        "Click an element on the current page. PREFERRED: use 'text' (+ optional 'tag') to find by visible text — this is more reliable than CSS selectors. When there are MULTIPLE elements with the same text (e.g. several 'Install' buttons), you MUST use 'near_text' to disambiguate by specifying text from the surrounding card/section (e.g. near_text='gyoza Platform'). Use 'selector' only when you have a unique #id or [name] attribute. NEVER use nth-child, nth-of-type, or Playwright pseudo-selectors.",
      inputSchema: jsonSchema<{
        selector?: string;
        text?: string;
        tag?: string;
        near_text?: string;
      }>({
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description:
              "CSS selector (use only for #id or [name] selectors — avoid complex selectors)",
          },
          text: {
            type: "string",
            description:
              "Visible text content of the element to click (preferred over selector)",
          },
          tag: {
            type: "string",
            description:
              "HTML tag to narrow text search, e.g. 'button', 'a', 'div' (optional, used with 'text')",
          },
          near_text: {
            type: "string",
            description:
              "Text from a parent/ancestor element to disambiguate when multiple elements have the same text, e.g. near_text='gyoza Platform' to click the Install button inside the gyoza Platform card",
          },
        },
      }),
      execute: async ({
        selector,
        text,
        tag,
        near_text,
      }: {
        selector?: string;
        text?: string;
        tag?: string;
        near_text?: string;
      }) => {
        if (!selector && !text) {
          return {
            success: false as const,
            error:
              "Provide either 'selector' or 'text' to identify the element",
          };
        }

        // Reject dangerous selector patterns
        const BLOCKED_PATTERNS = [
          /:nth-child/,
          /:nth-of-type/,
          /:first-child/,
          /:last-child/,
        ];
        if (selector) {
          for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(selector)) {
              return {
                success: false as const,
                error: `Selector pattern "${pattern}" is unreliable. Use text-based matching instead.`,
              };
            }
          }
        }
        try {
          const result = await execIsolated(
            ctx.tabId,
            ((
              sel: string | null,
              txt: string | null,
              htmlTag: string | null,
              nearTxt: string | null,
            ) => {
              const LOG = "%c[gyoza:click]";
              const S = "color: #E8950A; font-weight: bold";

              let el: HTMLElement | null = null;
              if (txt) {
                const searchTag = htmlTag || "*";
                const candidates = Array.from(
                  document.querySelectorAll(searchTag),
                ) as HTMLElement[];

                // Log all candidates with matching text
                const textMatches = candidates.filter(
                  (e) => e.textContent?.trim() === txt,
                );
                console.log(
                  LOG,
                  S,
                  `Searching for text="${txt}" tag="${searchTag}" near_text="${nearTxt || "none"}"`,
                );
                console.log(
                  LOG,
                  S,
                  `Total <${searchTag}> elements: ${candidates.length}, exact text matches: ${textMatches.length}`,
                );
                textMatches.forEach((e, i) => {
                  let parentCtx = "";
                  let node: HTMLElement | null = e.parentElement;
                  for (let d = 0; node && d < 5; d++) {
                    if (node.tagName === "BODY") break;
                    const t = (node.textContent || "").trim();
                    if (t.length > 20 && t.length < 500) {
                      parentCtx = t.slice(0, 120);
                      break;
                    }
                    node = node.parentElement;
                  }
                  console.log(
                    LOG,
                    S,
                    `  Match[${i}]: <${e.tagName.toLowerCase()}> "${e.textContent?.trim().slice(0, 50)}" | parent context: "${parentCtx.slice(0, 80)}..."`,
                  );
                });

                if (nearTxt) {
                  // Find the element whose SMALLEST (most specific) ancestor
                  // contains near_text. This avoids matching a top-level
                  // container that holds all cards on the page.
                  let bestMatch: HTMLElement | null = null;
                  let bestAncestorLen = Infinity;

                  for (const e of textMatches) {
                    let node: HTMLElement | null = e.parentElement;
                    for (let d = 0; node && d < 8; d++) {
                      const nodeText = node.textContent || "";
                      if (
                        nodeText.toLowerCase().includes(nearTxt.toLowerCase())
                      ) {
                        // Prefer the ancestor with least text (most specific)
                        if (nodeText.length < bestAncestorLen) {
                          bestAncestorLen = nodeText.length;
                          bestMatch = e;
                          console.log(
                            LOG,
                            S,
                            `  ↳ near_text candidate: <${e.tagName.toLowerCase()}> at depth ${d}, ancestor size: ${nodeText.length} chars`,
                          );
                        }
                        break; // found nearest ancestor for this candidate
                      }
                      node = node.parentElement;
                    }
                  }

                  if (bestMatch) {
                    // If multiple types match (div + button), prefer interactive
                    const interactiveTags = new Set([
                      "BUTTON",
                      "A",
                      "INPUT",
                      "SELECT",
                    ]);
                    if (!interactiveTags.has(bestMatch.tagName)) {
                      const interactive = textMatches.find((e) => {
                        if (!interactiveTags.has(e.tagName)) return false;
                        // Must share the same parent card
                        return (
                          bestMatch!.closest("[class]") ===
                            e.closest("[class]") ||
                          bestMatch!.contains(e) ||
                          e.contains(bestMatch!)
                        );
                      });
                      if (interactive) {
                        console.log(
                          LOG,
                          S,
                          `  ↳ Upgraded from <${bestMatch.tagName.toLowerCase()}> to <${interactive.tagName.toLowerCase()}> (prefer interactive)`,
                        );
                        bestMatch = interactive;
                      }
                    }

                    el = bestMatch;
                    console.log(
                      LOG,
                      S,
                      `  ✓ near_text best match: <${el.tagName.toLowerCase()}> (ancestor size: ${bestAncestorLen} chars)`,
                    );
                  } else {
                    console.log(
                      LOG,
                      S,
                      `  ✗ No near_text match — none of the "${txt}" elements have ancestor containing "${nearTxt}"`,
                    );
                  }
                }

                if (!el) {
                  const INTERACTIVE = new Set([
                    "A",
                    "BUTTON",
                    "INPUT",
                    "SELECT",
                    "SUMMARY",
                  ]);
                  const exactMatches = candidates.filter(
                    (e) => e.textContent?.trim() === txt,
                  );
                  const partialMatches = candidates.filter((e) =>
                    e.textContent?.trim().includes(txt),
                  );
                  const pool =
                    exactMatches.length > 0 ? exactMatches : partialMatches;

                  // Prefer interactive elements (a, button) over wrappers (div, span, h2)
                  el =
                    pool.find((e) => INTERACTIVE.has(e.tagName)) ||
                    pool.find((e) => e.closest("a") !== null) ||
                    pool[0] ||
                    null;
                  if (el) {
                    console.log(
                      LOG,
                      S,
                      `  Picked <${el.tagName.toLowerCase()}> from ${pool.length} matches (prefer interactive)`,
                    );
                  }
                }
              } else if (sel) {
                el = document.querySelector(sel) as HTMLElement | null;
                console.log(
                  LOG,
                  S,
                  `Selector "${sel}" → ${el ? "found" : "NOT FOUND"}`,
                );
              }

              if (!el) {
                console.log(LOG, S, `✗ No element found — click aborted`);
                return { found: false };
              }

              // Gather ancestor context so the AI knows what it clicked
              let ancestorCtx = "";
              let node: HTMLElement | null = el.parentElement;
              for (let d = 0; node && d < 5; d++) {
                if (node.tagName === "BODY") break;
                const t = (node.textContent || "").trim();
                if (t.length > 20 && t.length < 1000) {
                  ancestorCtx = t.slice(0, 150);
                  break;
                }
                node = node.parentElement;
              }

              console.log(
                LOG,
                S,
                `✓ Clicking <${el.tagName.toLowerCase()}> "${(el.textContent || "").trim().slice(0, 60)}" | context: "${ancestorCtx.slice(0, 80)}..."`,
              );

              // Capture pre-click state for verification
              const preClickUrl = window.location.href;
              const isLink = el.tagName === "A" || el.closest("a") !== null;
              const linkHref =
                el.tagName === "A"
                  ? (el as HTMLAnchorElement).href
                  : el.closest("a")
                    ? (el.closest("a") as HTMLAnchorElement).href
                    : null;

              el.click();

              // Post-click: check if element is still visible
              const stillVisible = el.isConnected && el.offsetParent !== null;

              return {
                found: true,
                tagName: el.tagName.toLowerCase(),
                text: (el.textContent || "").trim().slice(0, 100),
                context: ancestorCtx,
                preClickUrl,
                isLink,
                linkHref,
                stillVisible,
              };
            }) as (...args: never[]) => {
              found: boolean;
              tagName?: string;
              text?: string;
              context?: string;
              preClickUrl?: string;
              isLink?: boolean;
              linkHref?: string | null;
              stillVisible?: boolean;
            },
            [selector || null, text || null, tag || null, near_text || null],
          );
          if (!result?.found) {
            const target = text
              ? `element with text "${text}"${tag ? ` (tag: ${tag})` : ""}${near_text ? ` near "${near_text}"` : ""}`
              : `selector: ${selector}`;
            return {
              success: false as const,
              error: `No element found: ${target}`,
            };
          }
          ctx.onStreamEvent?.({
            kind: "tool-status",
            content: tr?.status_clicked || "Clicked element",
          });
          return {
            success: true as const,
            element: `<${result.tagName}> "${result.text}"`,
            context: result.context || "",
          };
        } catch (e) {
          return {
            success: false as const,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
    tools.click.execute = withVerification(ctx, tools.click.execute!);
  }

  // ── highlight_ui ────────────────────────────────────────────────────────
  if (caps.highlightUi !== false) {
    tools.highlight_ui = tool<
      { selector: string },
      { success: true; highlighted: string } | { success: false; error: string }
    >({
      description:
        "Draw attention to an element with a glowing gold outline. The element will glow and scroll into view. Use this to point at things on the page.",
      inputSchema: jsonSchema<{ selector: string }>({
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "CSS selector of the element to highlight",
          },
        },
        required: ["selector"],
      }),
      execute: async ({ selector }: { selector: string }) => {
        try {
          const found = await execIsolated(
            ctx.tabId,
            ((sel: string) => {
              const el = document.querySelector(sel) as HTMLElement | null;
              if (!el) return false;
              const prev = el.style.cssText;
              el.style.cssText +=
                ";outline:3px solid #E8950A!important;outline-offset:4px!important;border-radius:8px!important;box-shadow:0 0 20px rgba(232,149,10,0.4)!important;transition:all 0.3s ease!important;";
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              setTimeout(() => {
                el.style.cssText = prev;
              }, 4000);
              return true;
            }) as (...args: never[]) => boolean,
            [selector],
          );
          if (found) {
            ctx.onStreamEvent?.({
              kind: "tool-status",
              content: tr?.status_highlighted || "Highlighted element",
            });
          }
          return found
            ? { success: true as const, highlighted: selector }
            : {
                success: false as const,
                error: `No element found for selector: ${selector}`,
              };
        } catch (e) {
          return {
            success: false as const,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
  }

  // ── search_page ────────────────────────────────────────────────────
  tools.search_page = tool({
    description:
      "Search the current page's HTML and JavaScript for specific patterns. " +
      "Matching is LITERAL case-insensitive substring — NOT regex. " +
      "Do NOT use regex syntax like 'A|B', '(a|b)', 'A OR B', wildcards, or escapes. " +
      "To search for multiple alternatives, pass an ARRAY of strings (e.g. ['S席', 'A席', '価格']) " +
      "or a single pipe-delimited string which will be auto-split (e.g. 'S席|A席|価格'). " +
      "Keep each pattern short and concrete — a single word, tag, or phrase that likely appears verbatim on the page. " +
      "Returns matching snippets with surrounding context. " +
      "Use this to find elements, text, forms, buttons, API endpoints, " +
      "function definitions, event handlers — anything on the page. " +
      "Search HTML for DOM elements, JS for string literals in all scripts (including external bundles). " +
      "Adjust context_chars to control how much surrounding code you see around each match (default 150).",
    inputSchema: jsonSchema<{
      query: string | string[];
      scope?: "all" | "html" | "js";
      context_chars?: number;
      max_results?: number;
    }>({
      type: "object" as const,
      properties: {
        query: {
          description:
            "Literal substring(s) to search for (case-insensitive). " +
            "NOT regex. Use an array for multiple alternatives: ['button', 'form']. " +
            "Pipe-delimited strings are auto-split into alternatives ('S席|A席' → ['S席','A席']). " +
            "Do NOT write 'A OR B' or 'A|B|C' expecting regex — use an array instead. " +
            "Examples: '<button', '/api/', 'addToCart', '<form', ['S席', 'A席'].",
        },
        scope: {
          type: "string",
          enum: ["all", "html", "js"],
          description:
            "Where to search: 'html' = page DOM, 'js' = all scripts, 'all' = both (default: 'all')",
        },
        context_chars: {
          type: "number",
          description:
            "Characters of context around each match (default: 150). Use 300-500 for understanding code flow.",
        },
        max_results: {
          type: "number",
          description: "Maximum matches to return (default: 15)",
        },
      },
      required: ["query"],
    }),
    execute: async ({
      query,
      scope = "all",
      context_chars = 150,
      max_results = 15,
    }: {
      query: string | string[];
      scope?: "all" | "html" | "js";
      context_chars?: number;
      max_results?: number;
    }) => {
      ctx.onStreamEvent?.({
        kind: "tool-status",
        content: tr?.status_reading_page || "Searching page",
      });

      // Normalize patterns — models often try to use regex-style OR syntax
      // even though we do literal substring matching. Split pipes + " OR ".
      // Turns "A|B|C" → ["A","B","C"] and "A OR B" → ["A","B"].
      const rawPatterns = Array.isArray(query) ? query : [query];
      const patterns = rawPatterns
        .flatMap((p) => String(p).split(/\s+OR\s+|\|/i))
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const htmlMatches: Array<{ match: string; position: number }> = [];
      const jsMatches: Array<{
        source: string;
        match: string;
        position: number;
      }> = [];
      let htmlSize = 0;
      let jsFiles = 0;
      let jsTotalSize = 0;
      let bodyTextPreview = "";
      let bodyTextLength = 0;

      // HTML search — runs in content script
      if (scope === "all" || scope === "html") {
        try {
          const result = await browser.tabs.sendMessage(ctx.tabId, {
            type: "gyozai_search_html",
            patterns,
            contextChars: context_chars,
            maxResults: max_results,
          });
          if (result?.matches) {
            htmlMatches.push(...result.matches);
            htmlSize = result.htmlSize || 0;
          }
          if (typeof result?.bodyTextPreview === "string") {
            bodyTextPreview = result.bodyTextPreview;
            bodyTextLength = result.bodyTextLength || 0;
          }
        } catch {
          // Content script not reachable
        }
      }

      // Store for evidence validation in task_complete
      if (htmlMatches.length > 0) {
        ctx.lastPageContext = htmlMatches.map((m) => m.match).join("\n");
      }

      // JS search — runs in background script (has the cache)
      if (scope === "all" || scope === "js") {
        try {
          const result = await browser.runtime.sendMessage({
            type: "gyozai_search_scripts",
            tabId: ctx.tabId,
            patterns,
            contextChars: context_chars,
            maxResults: Math.max(1, max_results - htmlMatches.length),
          });
          if (result?.matches) {
            jsMatches.push(...result.matches);
            jsFiles = result.stats?.js_files || 0;
            jsTotalSize = result.stats?.js_total_size || 0;
          }
        } catch {
          // Background script not reachable
        }
      }

      // Increment call counter + build guidance for the model so it doesn't
      // spin forever re-searching instead of answering the user.
      ctx.searchPageCallCount = (ctx.searchPageCallCount ?? 0) + 1;
      const callNo = ctx.searchPageCallCount;
      const MAX_SEARCH_CALLS = 3;
      const totalMatches = htmlMatches.length + jsMatches.length;

      let next_action_hint: string;
      if (totalMatches === 0) {
        next_action_hint =
          callNo >= MAX_SEARCH_CALLS
            ? `No matches after ${callNo} searches. Stop searching — call show_message to tell the user you could not find this information on the page, or clarify if you need more info.`
            : `No matches for this query. Try different keywords, or if the info genuinely isn't on this page call show_message to tell the user.`;
      } else {
        next_action_hint =
          callNo >= MAX_SEARCH_CALLS
            ? `You have gathered enough context (${callNo} searches, ${totalMatches} total matches). DO NOT call search_page again — answer the user now via show_message, or call task_complete. Use the snippets above verbatim.`
            : callNo === MAX_SEARCH_CALLS - 1
              ? `Snippets found (${totalMatches} matches). You have budget for at most 1 more search. Prefer to answer the user now with show_message using these snippets verbatim.`
              : `Snippets found (${totalMatches} matches). If these answer the user's question, call show_message now using the snippet text verbatim. Only call search_page again if you truly need a different part of the page.`;
      }

      return {
        html_matches: htmlMatches,
        js_matches: jsMatches,
        patterns_used: patterns,
        stats: {
          html_size: htmlSize,
          js_files: jsFiles,
          js_total_size: jsTotalSize,
          body_text_length: bodyTextLength,
        },
        // Only surface the preview when 0 matches — helps the model (and the
        // developer via logs) understand what's actually on the page when
        // none of the patterns matched. When matches exist, the snippets
        // already tell the story.
        body_text_preview:
          htmlMatches.length + jsMatches.length === 0
            ? bodyTextPreview
            : undefined,
        search_calls_used: callNo,
        search_calls_remaining: Math.max(0, MAX_SEARCH_CALLS - callNo),
        next_action_hint,
      };
    },
  });

  // ── execute_page_function ──────────────────────────────────────────
  if (caps.click) {
    tools.execute_page_function = tool({
      description:
        "Execute JavaScript code on the page that you discovered through search_page. " +
        "Use this AFTER using search_page to find functions, API calls, or JS patterns. " +
        "Call page functions, trigger events, read state, or make fetch calls " +
        "that you found in the page's JavaScript. " +
        "Examples: call addToCart('id'), read window.__NEXT_DATA__, " +
        "or fetch an API endpoint you found in the JS bundle.",
      inputSchema: jsonSchema<{
        code: string;
        description: string;
      }>({
        type: "object" as const,
        properties: {
          code: {
            type: "string",
            description:
              "JavaScript code to execute in the page context. " +
              "Must be based on functions/patterns you found via search_page.",
          },
          description: {
            type: "string",
            description: "Human-readable description of what this code does.",
          },
        },
        required: ["code", "description"],
      }),
      execute: async ({
        code,
        description,
      }: {
        code: string;
        description: string;
      }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: description,
        });
        try {
          const result = await execInPage(
            ctx.tabId,
            ((jsCode: string) => {
              try {
                const fn = new Function(`return (async () => { ${jsCode} })()`);
                return fn().then(
                  (val: unknown) => ({
                    success: true,
                    result:
                      typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val ?? "undefined"),
                  }),
                  (err: Error) => ({
                    success: false,
                    error: err.message || String(err),
                  }),
                );
              } catch (e) {
                return Promise.resolve({
                  success: false,
                  error: e instanceof Error ? e.message : String(e),
                });
              }
            }) as (...args: never[]) => Promise<{
              success: boolean;
              result?: string;
              error?: string;
            }>,
            [code],
          );

          return result || { success: false, error: "No result returned" };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
    if (!yoloMode) {
      tools.execute_page_function.execute = withConfirmation(
        ctx,
        (args: { description: string }) => args.description,
        tools.execute_page_function.execute!,
      );
    }
    tools.execute_page_function.execute = withVerification(
      ctx,
      tools.execute_page_function.execute!,
    );
  }

  // ── fetch_url ───────────────────────────────────────────────────────────
  if (caps.fetch) {
    tools.fetch_url = tool<
      { url: string; method?: string },
      { status: number; body: string; truncated: boolean } | { error: string }
    >({
      description:
        "Make an HTTP request to get data. Use this to fetch API endpoints or external data before making decisions.",
      inputSchema: jsonSchema<{ url: string; method?: string }>({
        type: "object" as const,
        properties: {
          url: { type: "string", description: "URL to fetch" },
          method: {
            type: "string",
            description: "HTTP method (default: GET)",
          },
        },
        required: ["url"],
      }),
      execute: async ({ url, method }: { url: string; method?: string }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: tr?.status_fetching || "Fetching data",
        });
        try {
          const response = await fetch(url, { method: method || "GET" });
          const text = await response.text();
          return {
            status: response.status,
            body: text.slice(0, 5000),
            truncated: text.length > 5000,
          };
        } catch (e) {
          return {
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
  }

  // ── clarify ─────────────────────────────────────────────────────────────
  if (!yoloMode && caps.clarify !== false) {
    tools.clarify = tool<
      { message: string; options: string[] },
      { awaiting_user_response: boolean }
    >({
      description:
        'Ask the user a follow-up question with clickable options. Use when you need user input to proceed. When used together with other actions (e.g. you filled a form), your message MUST reference what you just did — e.g. "I\'ve filled in the form with 1000 JPY. Confirm?" with options like ["Yes, submit", "No, cancel"]. After calling clarify, do NOT call any more action tools — wait for the user\'s response.',
      inputSchema: jsonSchema<{ message: string; options: string[] }>({
        type: "object" as const,
        properties: {
          message: {
            type: "string",
            description: "The question to ask the user",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Clickable option buttons for the user",
          },
        },
        required: ["message", "options"],
      }),
      execute: async ({
        message,
        options,
      }: {
        message: string;
        options: string[];
      }) => {
        ctx.clarify = { message, options };
        ctx.messages.push(message);
        ctx.onStreamEvent?.({ kind: "message", content: message });
        ctx.onStreamEvent?.({ kind: "clarify", message, options });
        return { awaiting_user_response: true };
      },
    });
  }

  // ── fill_input ──────────────────────────────────────────────────────────
  if (caps.click) {
    tools.fill_input = tool({
      description:
        "Fill an input field with a value. Use label text or placeholder to identify the field.",
      inputSchema: jsonSchema<{
        selector?: string;
        label?: string;
        value: string;
      }>({
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "CSS selector for the input",
          },
          label: {
            type: "string",
            description: "Label text near the input (preferred)",
          },
          value: {
            type: "string",
            description: "Value to set",
          },
        },
        required: ["value"],
      }),
      execute: async ({
        selector,
        label,
        value,
      }: {
        selector?: string;
        label?: string;
        value: string;
      }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: tr?.status_filling || "Filling input",
        });
        try {
          const result = await execInPage(
            ctx.tabId,
            ((sel: string | null, lbl: string | null, val: string) => {
              let el: HTMLInputElement | HTMLTextAreaElement | null = null;
              if (sel) {
                el = document.querySelector(sel) as HTMLInputElement | null;
              }
              if (!el && lbl) {
                // Find by label text
                const labels = Array.from(document.querySelectorAll("label"));
                const matchLabel = labels.find((l) =>
                  l.textContent
                    ?.trim()
                    .toLowerCase()
                    .includes(lbl.toLowerCase()),
                );
                if (matchLabel?.htmlFor) {
                  el = document.getElementById(
                    matchLabel.htmlFor,
                  ) as HTMLInputElement | null;
                } else if (matchLabel) {
                  el = matchLabel.querySelector(
                    "input, textarea, select",
                  ) as HTMLInputElement | null;
                }
                // Fallback: find by placeholder
                if (!el) {
                  el = document.querySelector(
                    `input[placeholder*="${lbl}" i], textarea[placeholder*="${lbl}" i]`,
                  ) as HTMLInputElement | null;
                }
                // Fallback: find by aria-label
                if (!el) {
                  el = document.querySelector(
                    `input[aria-label*="${lbl}" i], textarea[aria-label*="${lbl}" i]`,
                  ) as HTMLInputElement | null;
                }
              }
              if (!el) return { found: false };

              // Set value using native setter (works with React controlled inputs)
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value",
              )?.set;
              const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                "value",
              )?.set;
              const setter =
                el.tagName === "TEXTAREA"
                  ? nativeTextareaValueSetter
                  : nativeInputValueSetter;
              if (setter) {
                setter.call(el, val);
              } else {
                el.value = val;
              }
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));

              // Build a selector for re-finding this element during verification
              const verifySelector = el.id
                ? `#${el.id}`
                : el.name
                  ? `[name="${el.name}"]`
                  : null;

              return {
                found: true,
                element: el.tagName.toLowerCase(),
                name: el.name || el.id || "",
                verifySelector,
              };
            }) as (...args: never[]) => {
              found: boolean;
              element?: string;
              name?: string;
              verifySelector?: string | null;
            },
            [selector || null, label || null, value],
          );
          if (!result?.found) {
            return {
              success: false,
              error: `No input found${label ? ` with label "${label}"` : ""}${selector ? ` matching "${selector}"` : ""}`,
            };
          }

          return { success: true, filled: result.element, name: result.name };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
    tools.fill_input.execute = withVerification(ctx, tools.fill_input.execute!);
  }

  // ── select_option ─────────────────────────────────────────────────────
  if (caps.click) {
    tools.select_option = tool({
      description:
        "Select an option in a <select> dropdown. Identify by label, selector, or option text.",
      inputSchema: jsonSchema<{
        selector?: string;
        label?: string;
        option_text?: string;
        option_value?: string;
      }>({
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "CSS selector for the select element",
          },
          label: {
            type: "string",
            description: "Label text near the select (preferred)",
          },
          option_text: {
            type: "string",
            description: "Visible text of the option to select",
          },
          option_value: {
            type: "string",
            description: "Value attribute of the option",
          },
        },
      }),
      execute: async ({
        selector,
        label,
        option_text,
        option_value,
      }: {
        selector?: string;
        label?: string;
        option_text?: string;
        option_value?: string;
      }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: tr?.status_selecting || "Selecting option",
        });
        try {
          const result = await execInPage(
            ctx.tabId,
            ((
              sel: string | null,
              lbl: string | null,
              optText: string | null,
              optValue: string | null,
            ) => {
              let el: HTMLSelectElement | null = null;
              if (sel)
                el = document.querySelector(sel) as HTMLSelectElement | null;
              if (!el && lbl) {
                const labels = Array.from(document.querySelectorAll("label"));
                const matchLabel = labels.find((l) =>
                  l.textContent
                    ?.trim()
                    .toLowerCase()
                    .includes(lbl.toLowerCase()),
                );
                if (matchLabel?.htmlFor) {
                  el = document.getElementById(
                    matchLabel.htmlFor,
                  ) as HTMLSelectElement | null;
                } else if (matchLabel) {
                  el = matchLabel.querySelector(
                    "select",
                  ) as HTMLSelectElement | null;
                }
              }
              if (!el || el.tagName !== "SELECT") return { found: false };

              const options = Array.from(el.options);
              let targetOpt: HTMLOptionElement | undefined;
              if (optValue) {
                targetOpt = options.find((o) => o.value === optValue);
              }
              if (!targetOpt && optText) {
                targetOpt = options.find((o) =>
                  o.textContent
                    ?.trim()
                    .toLowerCase()
                    .includes(optText.toLowerCase()),
                );
              }
              if (!targetOpt)
                return {
                  found: true,
                  selected: false,
                  error: "Option not found",
                };

              el.value = targetOpt.value;
              el.dispatchEvent(new Event("change", { bubbles: true }));

              return {
                found: true,
                selected: true,
                value: targetOpt.value,
                text: targetOpt.textContent?.trim(),
              };
            }) as (...args: never[]) => {
              found: boolean;
              selected?: boolean;
              value?: string;
              text?: string;
              error?: string;
            },
            [
              selector || null,
              label || null,
              option_text || null,
              option_value || null,
            ],
          );
          if (!result?.found)
            return { success: false, error: "Select element not found" };
          if (!result.selected)
            return {
              success: false,
              error: result.error || "Option not found",
            };

          return { success: true, selected: result.text, value: result.value };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
    tools.select_option.execute = withVerification(
      ctx,
      tools.select_option.execute!,
    );
  }

  // ── toggle_checkbox ───────────────────────────────────────────────────
  if (caps.click) {
    tools.toggle_checkbox = tool({
      description: "Check or uncheck a checkbox or radio button.",
      inputSchema: jsonSchema<{
        selector?: string;
        label?: string;
        checked?: boolean;
      }>({
        type: "object" as const,
        properties: {
          selector: { type: "string", description: "CSS selector" },
          label: {
            type: "string",
            description: "Label text near the checkbox (preferred)",
          },
          checked: {
            type: "boolean",
            description: "Target state (default: toggle)",
          },
        },
      }),
      execute: async ({
        selector,
        label,
        checked,
      }: {
        selector?: string;
        label?: string;
        checked?: boolean;
      }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: tr?.status_toggling || "Toggling checkbox",
        });
        try {
          const result = await execInPage(
            ctx.tabId,
            ((
              sel: string | null,
              lbl: string | null,
              targetState: boolean | null,
            ) => {
              let el: HTMLInputElement | null = null;
              if (sel)
                el = document.querySelector(sel) as HTMLInputElement | null;
              if (!el && lbl) {
                const labels = Array.from(document.querySelectorAll("label"));
                const matchLabel = labels.find((l) =>
                  l.textContent
                    ?.trim()
                    .toLowerCase()
                    .includes(lbl.toLowerCase()),
                );
                if (matchLabel?.htmlFor) {
                  el = document.getElementById(
                    matchLabel.htmlFor,
                  ) as HTMLInputElement | null;
                } else if (matchLabel) {
                  el = matchLabel.querySelector(
                    'input[type="checkbox"], input[type="radio"]',
                  ) as HTMLInputElement | null;
                }
              }
              if (!el) return { found: false };

              if (targetState !== null) {
                el.checked = targetState;
              } else {
                el.checked = !el.checked;
              }
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("input", { bubbles: true }));
              return {
                found: true,
                checked: el.checked,
                name: el.name || el.id,
              };
            }) as (...args: never[]) => {
              found: boolean;
              checked?: boolean;
              name?: string;
            },
            [selector || null, label || null, checked ?? null],
          );
          if (!result?.found)
            return { success: false, error: "Checkbox not found" };
          return { success: true, checked: result.checked, name: result.name };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
    tools.toggle_checkbox.execute = withVerification(
      ctx,
      tools.toggle_checkbox.execute!,
    );
  }

  // ── page_screenshot — capture visible tab as image for visual analysis ──
  tools.page_screenshot = tool<
    Record<string, never>,
    { success: boolean; description: string }
  >({
    description:
      "Take a screenshot of the current page. The screenshot will be injected as an image into the conversation so you can see and analyze it visually in the next step. After calling this, wait for the next step where you will see the page image, then respond with your analysis via show_message.",
    inputSchema: jsonSchema<Record<string, never>>({
      type: "object" as const,
      properties: {},
    }),
    execute: async () => {
      ctx.onStreamEvent?.({
        kind: "tool-status",
        content: tr?.status_screenshot || "Taking screenshot",
      });
      const restore = await hideWidgetForScreenshot(ctx.tabId);
      try {
        const dataUrl = await browser.tabs.captureVisibleTab(
          null as unknown as number,
          { format: "jpeg", quality: 70 },
        );
        // Store on ctx — prepareStep in query.ts injects this as a user image
        ctx.pendingScreenshotDataUrl = dataUrl;
        console.log(
          "%c[gyoza] page_screenshot captured → stored on ctx for prepareStep injection",
          "color: #a855f7; font-weight: bold",
        );
        console.log(
          "%c  ",
          `font-size: 200px; background: url(${dataUrl}) no-repeat center/contain; background-size: contain;`,
        );
        return {
          success: true,
          description:
            "Screenshot captured. The image will appear in your next message. Analyze it visually and respond.",
        };
      } catch (e) {
        return {
          success: false,
          description: `Failed to capture screenshot: ${e instanceof Error ? e.message : String(e)}`,
        };
      } finally {
        await restore();
      }
    },
  });

  return tools;
}
