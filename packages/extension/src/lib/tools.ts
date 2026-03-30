import { tool, jsonSchema } from "ai";
import type { Capabilities } from "@gyoz-ai/engine";

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
    face?: string;
    options?: string[];
  }) => void;
}

// ─── Helper: execute script in page's MAIN world ─────────────────────────────

async function execInPage<T>(
  tabId: number,
  func: (...args: never[]) => T,
  args: unknown[] = [],
): Promise<T> {
  const results = await chrome.scripting.executeScript({
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
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func: func as (...a: unknown[]) => T,
    args,
  });
  return results?.[0]?.result as T;
}

// ─── Tool Factory ──────────────────────────────────────────────────────────────

export function createBrowserTools(
  ctx: ToolExecContext,
  caps: Capabilities,
  yoloMode: boolean,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

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
          enum: [
            "neutral",
            "happy",
            "thinking",
            "surprised",
            "confused",
            "excited",
            "concerned",
            "proud",
          ],
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

  // ── navigate ────────────────────────────────────────────────────────────
  if (caps.navigate !== false) {
    tools.navigate = tool<
      { url: string },
      | { success: true; navigatedTo: string; note: string }
      | { success: false; error: string }
    >({
      description:
        "Navigate to a URL path on the current site. This causes a full page load — after calling this tool, you CANNOT interact with the page further. Do not call any more tools after navigate.",
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
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          const resolved = tab?.url ? new URL(url, tab.url).href : url;

          ctx.onStreamEvent?.({
            kind: "tool-status",
            content: `Navigating to ${resolved}`,
          });

          // Save pending-nav state so the widget auto-resumes on the new page
          const pendingNavKey = `gyozai_pending_nav_${ctx.tabId}`;
          await chrome.storage.local.set({
            [pendingNavKey]: {
              snapshotTypes: ["all"],
              originalQuery: ctx.originalQuery,
              conversationId: ctx.conversationId || "",
              tabId: ctx.tabId,
              timestamp: Date.now(),
            },
          });

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
      { selector: string },
      { success: true; element: string } | { success: false; error: string }
    >({
      description:
        "Click an element on the current page by CSS selector. Returns whether the element was found and clicked.",
      inputSchema: jsonSchema<{ selector: string }>({
        type: "object" as const,
        properties: {
          selector: {
            type: "string",
            description: "CSS selector of the element to click",
          },
        },
        required: ["selector"],
      }),
      execute: async ({ selector }: { selector: string }) => {
        try {
          const result = await execIsolated(
            ctx.tabId,
            ((sel: string) => {
              const el = document.querySelector(sel) as HTMLElement | null;
              if (!el) return { found: false };
              el.click();
              return {
                found: true,
                tagName: el.tagName.toLowerCase(),
                text: (el.textContent || "").trim().slice(0, 100),
              };
            }) as (...args: never[]) => {
              found: boolean;
              tagName?: string;
              text?: string;
            },
            [selector],
          );
          if (!result?.found) {
            return {
              success: false as const,
              error: `No element found for selector: ${selector}`,
            };
          }
          ctx.onStreamEvent?.({
            kind: "tool-status",
            content: "Clicked element",
          });
          return {
            success: true as const,
            element: `<${result.tagName}> "${result.text}"`,
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

  // ── execute_js ──────────────────────────────────────────────────────────
  if (caps.executeJs) {
    tools.execute_js = tool<
      { code: string; description: string },
      { success: boolean; error?: string }
    >({
      description:
        'Execute JavaScript code in the page context. Use for: filling forms, clicking buttons, editing text content (translation), changing styles. Target elements with querySelector. Keep code simple — one element per action when possible. NEVER modify body, html, or framework wrapper elements. SELECTOR RULES: prefer #id or [name="..."], then unique class, then find by text content with Array.from(). Always null-check elements.',
      inputSchema: jsonSchema<{ code: string; description: string }>({
        type: "object" as const,
        properties: {
          code: {
            type: "string",
            description: "JavaScript code to execute in the page",
          },
          description: {
            type: "string",
            description:
              "Brief description of what this code does (for the user)",
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
        try {
          ctx.onStreamEvent?.({
            kind: "tool-status",
            content: description.length > 40 ? "Ran code" : description,
          });
          // Auto-fix selectors with special characters
          const fixedCode = code.replace(
            /querySelector(?:All)?\(\s*['"]([^'"]+)['"]\s*\)/g,
            (match: string, selector: string) => {
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

          const error = await execInPage(
            ctx.tabId,
            ((jsCode: string) => {
              try {
                new Function(jsCode)();
                return null;
              } catch (e) {
                return e instanceof Error ? e.message : String(e);
              }
            }) as (...args: never[]) => string | null,
            [fixedCode],
          );

          if (error) {
            return { success: false, error };
          }
          return { success: true };
        } catch (e) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    });
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
              content: "Highlighted element",
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
      ctx.onStreamEvent?.({ kind: "tool-status", content: "Reading page" });
      try {
        const result = await chrome.tabs.sendMessage(ctx.tabId, {
          type: "gyozai_tool_capture_context",
          snapshotTypes: types,
        });
        if (result?.context) {
          return { context: result.context as string };
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
        ctx.onStreamEvent?.({ kind: "tool-status", content: "Fetching data" });
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
        ctx.onStreamEvent?.({ kind: "clarify", options, content: message });
        return { awaiting_user_response: true };
      },
    });
  }

  return tools;
}
