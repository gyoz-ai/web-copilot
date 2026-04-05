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
  get_page_context: {
    name: "get_page_context",
    description: "Capture page context",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 30_000,
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
  submit_form: {
    name: "submit_form",
    description: "Submit a form",
    pageChange: true,
    mutatesPage: true,
    requiresFreshContext: true,
    isConcurrencySafe: false,
    maxResultChars: 500,
  },
  scroll_to: {
    name: "scroll_to",
    description: "Scroll to element",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
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
  find_text: {
    name: "find_text",
    description: "Find text on page",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 2_000,
  },
  extract_table: {
    name: "extract_table",
    description: "Extract table data",
    pageChange: false,
    mutatesPage: false,
    requiresFreshContext: false,
    isConcurrencySafe: true,
    maxResultChars: 10_000,
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

// ─── Post-action verification wrapper ─────────────────────────────────────────
// Wraps any mutating tool's execute function with before/after page capture.
// Captures page state BEFORE, runs the tool, then polls for changes AFTER.

function countTag(text: string, tag: string): number {
  return (text.match(new RegExp(tag, "g")) || []).length;
}

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
      type: "gyozai_tool_capture_context",
      snapshotTypes: ["buttons", "forms", "inputs", "textContent"],
    });
    return (result?.context as string) || "";
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

    const newForms =
      countTag(afterText, "<form") - countTag(beforeText, "<form");
    const newFields =
      countTag(afterText, "<field") - countTag(beforeText, "<field");
    const newInputs =
      countTag(afterText, "<input") - countTag(beforeText, "<input");

    console.log(
      `%c  [gyoza:verify] Diff: ${newForms} forms, ${newFields} fields, ${newInputs} inputs`,
      "color: #f59e0b",
    );

    if (newForms > 0 || newFields > 2 || newInputs > 2) {
      console.log(
        "%c  [gyoza:verify] → Action incomplete (new form/dialog)",
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
        error: `Action opened a form/dialog that requires attention. ${countTag(verify.pageState || "", "<form")} forms, new fields appeared. Page state:\n${verify.pageState}\nYou must handle these before the action succeeds.`,
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
      "Display a message to the user in the chat. You MUST call this tool in EVERY response to explain what you are doing or what you found. Never perform actions without also showing a message.",
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
      "REQUIRED after every page action (click, scroll_to, fill_input, select_option, toggle_checkbox, submit_form). Evaluate whether the action achieved what you intended. Check the tool result, then report here. If the action failed, explain why and retry. Pass message=null when no user-facing message is needed (e.g. mid-batch), or a string to display it to the user.",
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
          type: "string",
          nullable: true,
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
      "Call this when the ENTIRE user request is fulfilled. This stops the tool loop. You MUST include page_evidence: quote EXACT text from the page that proves the task succeeded (copy-paste from get_page_context, not paraphrased). If you cannot quote evidence, the task is not verified.",
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
            "REQUIRED for success=true. Exact text copied from the page (from get_page_context) that proves the task was completed. Must be a verbatim quote, not paraphrased.",
        },
      },
      required: ["success", "summary"],
    }),
    execute: async ({ success, summary, page_evidence }) => {
      // If the AI claims success but never performed any action, reject it
      if (success && ctx.actionCount === 0) {
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
            warning: `Your page_evidence "${page_evidence}" was NOT found on the page. You may be hallucinating. Call get_page_context to re-read the page, then look for the ACTUAL text that confirms your task, or call task_complete with success=false.`,
          };
        }
      }
      ctx.messages.push(summary);
      ctx.onStreamEvent?.({ kind: "message", content: summary });
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

          // pending-nav is saved by background's webNavigation.onBeforeNavigate
          // listener — no need to save here.

          await execIsolated(
            ctx.tabId,
            ((targetUrl: string) => {
              window.location.href = targetUrl;
            }) as (...args: never[]) => void,
            [resolved],
          );
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

  // ── get_page_context ────────────────────────────────────────────────────
  tools.get_page_context = tool<{ types: string[] }, { context: string }>({
    description:
      "Capture structured elements from the current page. Use this to understand the page before acting. For TRANSLATION or EDITING: use 'fullPage' to get all selectors and text. For understanding: use 'textContent'. For navigation: use 'links'. For forms: use 'forms' and/or 'inputs'. For clicking buttons: use 'buttons'.",
    inputSchema: jsonSchema<{ types: string[] }>({
      type: "object" as const,
      properties: {
        types: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "buttons",
              "links",
              "forms",
              "inputs",
              "textContent",
              "fullPage",
            ],
          },
          description:
            "What to capture from the page. 'fullPage' = everything combined.",
        },
      },
      required: ["types"],
    }),
    execute: async ({ types }: { types: string[] }) => {
      ctx.onStreamEvent?.({
        kind: "tool-status",
        content: tr?.status_reading_page || "Reading page",
      });
      try {
        const result = await browser.tabs.sendMessage(ctx.tabId, {
          type: "gyozai_tool_capture_context",
          snapshotTypes: types,
        });
        if (result?.context) {
          const ctx_text = result.context as string;
          console.log(
            `%c  [gyoza] get_page_context(${types.join(",")})%c ${ctx_text.length} chars`,
            "color: #a855f7; font-weight: bold",
            "color: #9ca3af",
          );
          console.groupCollapsed(
            "%c  [gyoza] page context preview",
            "color: #9ca3af",
          );
          console.log(ctx_text.slice(0, 2000));
          console.groupEnd();
          // Store for evidence validation in task_complete
          ctx.lastPageContext = ctx_text;
          return { context: ctx_text };
        }
        return { context: "No page context captured (page may be loading)." };
      } catch {
        return {
          context:
            "Failed to capture page context (content script unavailable).",
        };
      }
    },
  });

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

  // ── submit_form ───────────────────────────────────────────────────────
  if (caps.click) {
    tools.submit_form = tool({
      description:
        "Submit a form on the page. This may cause a page navigation.",
      inputSchema: jsonSchema<{ selector?: string; button_text?: string }>({
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "CSS selector for the form",
          },
          button_text: {
            type: "string",
            description: "Text of the submit button to click",
          },
        },
      }),
      execute: async ({
        selector,
        button_text,
      }: {
        selector?: string;
        button_text?: string;
      }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: tr?.status_submitting || "Submitting form",
        });
        try {
          const result = await execInPage(
            ctx.tabId,
            ((sel: string | null, btnText: string | null) => {
              let form: HTMLFormElement | null = null;
              if (sel) {
                form = document.querySelector(sel) as HTMLFormElement | null;
              }
              if (!form && btnText) {
                // Find submit button by text, then get its form
                const buttons = Array.from(
                  document.querySelectorAll(
                    'button, input[type="submit"], [role="button"]',
                  ),
                ) as HTMLElement[];
                const btn = buttons.find((b) =>
                  b.textContent
                    ?.trim()
                    .toLowerCase()
                    .includes(btnText.toLowerCase()),
                );
                if (btn) {
                  form = btn.closest("form") as HTMLFormElement | null;
                  if (!form) {
                    // Just click the button directly
                    btn.click();
                    return { found: true, method: "button_click" };
                  }
                }
              }
              if (!form) {
                form = document.querySelector("form") as HTMLFormElement | null;
              }
              if (!form) return { found: false };

              form.requestSubmit();
              return {
                found: true,
                method: "form_submit",
                action: form.action || "",
              };
            }) as (...args: never[]) => {
              found: boolean;
              method?: string;
              action?: string;
            },
            [selector || null, button_text || null],
          );
          if (!result?.found) return { success: false, error: "No form found" };
          return { success: true, method: result.method };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
    if (!yoloMode) {
      tools.submit_form.execute = withConfirmation(
        ctx,
        (args: { selector?: string }) =>
          `Submit form "${args.selector || "on page"}"`,
        tools.submit_form.execute!,
      );
    }
    tools.submit_form.execute = withVerification(
      ctx,
      tools.submit_form.execute!,
    );
  }

  // ── scroll_to ─────────────────────────────────────────────────────────
  if (caps.click) {
    tools.scroll_to = tool({
      description:
        "Scroll an element into view. IMPORTANT: Use the ACTUAL text visible on the page (from get_page_context), not a translated or assumed version. The page language may differ from yours.",
      inputSchema: jsonSchema<{
        selector?: string;
        text?: string;
        direction?: string;
      }>({
        type: "object" as const,
        properties: {
          selector: { type: "string", description: "CSS selector" },
          text: {
            type: "string",
            description:
              "Text content to find and scroll to. Must match the ACTUAL text on the page — use get_page_context first to get real text.",
          },
          direction: {
            type: "string",
            enum: ["up", "down"],
            description: "Scroll direction if no specific element",
          },
        },
      }),
      execute: async ({
        selector,
        text,
        direction,
      }: {
        selector?: string;
        text?: string;
        direction?: string;
      }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: tr?.status_scrolling || "Scrolling",
        });
        try {
          const result = await execInPage(
            ctx.tabId,
            ((sel: string | null, txt: string | null, dir: string | null) => {
              // 1. Try CSS selector first
              if (sel) {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  return { scrolled: true, target: sel };
                }
              }
              if (txt) {
                const lower = txt.toLowerCase();
                // 2. Exact text content match (case-insensitive)
                const walker = document.createTreeWalker(
                  document.body,
                  NodeFilter.SHOW_TEXT,
                );
                while (walker.nextNode()) {
                  if (
                    walker.currentNode.textContent
                      ?.toLowerCase()
                      .includes(lower)
                  ) {
                    const parent = walker.currentNode.parentElement;
                    parent?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                    return { scrolled: true, target: `text: "${txt}"` };
                  }
                }
                // 3. Fallback: search element attributes (id, class, aria-label, name, data-section)
                const attrCandidates = document.querySelectorAll(
                  `[id*="${CSS.escape(lower)}" i], [class*="${CSS.escape(lower)}" i], [aria-label*="${CSS.escape(lower)}" i], [name*="${CSS.escape(lower)}" i], [data-section*="${CSS.escape(lower)}" i]`,
                );
                if (attrCandidates.length > 0) {
                  const el = attrCandidates[0] as HTMLElement;
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  return {
                    scrolled: true,
                    target: `attr match: "${txt}" on <${el.tagName.toLowerCase()}>`,
                  };
                }
                // 4. Fallback: search headings and section-like elements for partial match
                const sectionEls = document.querySelectorAll(
                  "h1, h2, h3, h4, h5, h6, section, [role='region'], [role='heading']",
                );
                for (const el of sectionEls) {
                  const elText = (el as HTMLElement).textContent || "";
                  if (elText.toLowerCase().includes(lower)) {
                    (el as HTMLElement).scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                    return {
                      scrolled: true,
                      target: `heading/section: "${elText.trim().slice(0, 60)}"`,
                    };
                  }
                }
              }
              if (dir === "up") {
                window.scrollBy({ top: -500, behavior: "smooth" });
                return { scrolled: true, target: "up" };
              }
              if (dir === "down") {
                window.scrollBy({ top: 500, behavior: "smooth" });
                return { scrolled: true, target: "down" };
              }
              return { scrolled: false };
            }) as (...args: never[]) => { scrolled: boolean; target?: string },
            [selector || null, text || null, direction || null],
          );
          if (!result?.scrolled)
            return {
              success: false,
              error: `Could not find "${text || selector || direction}" on the page. The page may use a different language than expected. Call get_page_context first to see the actual text/selectors, then retry with the real page content.`,
            };
          return { success: true, scrolledTo: result.target };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
  }

  // ── find_text ─────────────────────────────────────────────────────────
  if (caps.click) {
    tools.find_text = tool({
      description:
        "Search for text on the page. Returns matching elements and their context.",
      inputSchema: jsonSchema<{ query: string; max_results?: number }>({
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Text to search for (case-insensitive)",
          },
          max_results: {
            type: "number",
            description: "Max matches to return (default: 10)",
          },
        },
        required: ["query"],
      }),
      execute: async ({
        query,
        max_results,
      }: {
        query: string;
        max_results?: number;
      }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: tr?.status_searching || "Searching page",
        });
        try {
          const result = await execInPage(
            ctx.tabId,
            ((searchText: string, maxResults: number) => {
              const matches: Array<{
                text: string;
                tag: string;
                context: string;
              }> = [];
              const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
              );
              while (walker.nextNode() && matches.length < maxResults) {
                const nodeText = walker.currentNode.textContent || "";
                if (nodeText.toLowerCase().includes(searchText.toLowerCase())) {
                  const parent = walker.currentNode.parentElement;
                  if (!parent) continue;
                  matches.push({
                    text: nodeText.trim().slice(0, 200),
                    tag: parent.tagName.toLowerCase(),
                    context: (
                      parent.closest("section, article, div, main")
                        ?.textContent || ""
                    )
                      .trim()
                      .slice(0, 100),
                  });
                }
              }
              return { matches, total: matches.length };
            }) as (...args: never[]) => {
              matches: Array<{ text: string; tag: string; context: string }>;
              total: number;
            },
            [query, max_results || 10],
          );
          return { success: true, ...result };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
  }

  // ── extract_table ─────────────────────────────────────────────────────
  if (caps.click) {
    tools.extract_table = tool({
      description: "Extract data from a <table> element as JSON.",
      inputSchema: jsonSchema<{ selector?: string; near_text?: string }>({
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "CSS selector for the table",
          },
          near_text: {
            type: "string",
            description: "Text near the table to identify it (e.g. a heading)",
          },
        },
      }),
      execute: async ({
        selector,
        near_text,
      }: {
        selector?: string;
        near_text?: string;
      }) => {
        ctx.onStreamEvent?.({
          kind: "tool-status",
          content: tr?.status_extracting || "Extracting table",
        });
        try {
          const result = await execInPage(
            ctx.tabId,
            ((sel: string | null, nearTxt: string | null) => {
              let table: HTMLTableElement | null = null;
              if (sel) {
                table = document.querySelector(sel) as HTMLTableElement | null;
              }
              if (!table && nearTxt) {
                // Find a heading/text near the table
                const tables = Array.from(document.querySelectorAll("table"));
                for (const t of tables) {
                  const prev = t.previousElementSibling;
                  if (
                    prev?.textContent
                      ?.toLowerCase()
                      .includes(nearTxt.toLowerCase())
                  ) {
                    table = t;
                    break;
                  }
                  // Check parent for heading
                  const heading = t
                    .closest("section, div, article")
                    ?.querySelector("h1, h2, h3, h4, h5");
                  if (
                    heading?.textContent
                      ?.toLowerCase()
                      .includes(nearTxt.toLowerCase())
                  ) {
                    table = t;
                    break;
                  }
                }
              }
              if (!table) {
                table = document.querySelector(
                  "table",
                ) as HTMLTableElement | null;
              }
              if (!table) return { found: false };

              // Extract headers
              const headers: string[] = [];
              const headerCells = table.querySelectorAll(
                "thead th, thead td, tr:first-child th",
              );
              headerCells.forEach((cell) =>
                headers.push((cell.textContent || "").trim()),
              );

              // Extract rows
              const rows: string[][] = [];
              const bodyRows = table.querySelectorAll("tbody tr, tr");
              bodyRows.forEach((row, i) => {
                if (i === 0 && headers.length > 0) return; // skip header row
                const cells: string[] = [];
                row
                  .querySelectorAll("td, th")
                  .forEach((cell) =>
                    cells.push((cell.textContent || "").trim()),
                  );
                if (cells.length > 0) rows.push(cells);
              });

              return { found: true, headers, rows, rowCount: rows.length };
            }) as (...args: never[]) => {
              found: boolean;
              headers?: string[];
              rows?: string[][];
              rowCount?: number;
            },
            [selector || null, near_text || null],
          );
          if (!result?.found)
            return { success: false, error: "No table found" };
          return {
            success: true,
            headers: result.headers,
            rows: result.rows,
            rowCount: result.rowCount,
          };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
  }

  return tools;
}
