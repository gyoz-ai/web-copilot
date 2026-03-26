import type { Action, ActionResponse, ActionType } from "./schemas";
import { validateResponse } from "./schemas";
import {
  capturePageContext,
  formatPageContext,
  type SnapshotType,
} from "./page-context";

// ─── Engine Config ──────────────────────────────────────────────────────────────

// What actions the AI is allowed to use — sent to proxy to shape the prompt,
// and enforced client-side by the engine (disabled actions are silently dropped).
export interface Capabilities {
  navigate?: boolean; // default: true
  showMessage?: boolean; // default: true
  click?: boolean; // default: false
  executeJs?: boolean; // default: false — security sensitive
  highlightUi?: boolean; // default: true — point at elements with glow
  fetch?: boolean; // default: false
  clarify?: boolean; // default: true
}

export const DEFAULT_CAPABILITIES: Required<Capabilities> = {
  navigate: true,
  showMessage: true,
  click: false,
  executeJs: false,
  highlightUi: true,
  fetch: false,
  clarify: true,
};

export interface EngineConfig {
  proxyUrl: string;
  recipeXml?: string;
  manifestMode?: boolean;
  // What the AI is allowed to do — disabled actions won't appear in prompt and are dropped client-side
  capabilities?: Capabilities;
  // HTTP client for fetch actions (only used if capabilities.fetch is true)
  httpClient?: (url: string, method: string) => Promise<unknown>;
  // Extra static context provided by the integrator (user info, app state, etc.)
  userContext?: Record<string, unknown>;
  // Callbacks
  onMessage?: (message: string) => void;
  onNavigate?: (target: string) => void;
  onClick?: (selector: string) => void;
  onExecuteJs?: (code: string) => void;
  onClarify?: (message: string, options: string[]) => void;
  onAction?: (action: Action) => void;
  onError?: (error: EngineError) => void;
}

export interface QueryOptions {
  currentRoute?: string;
  // Per-query context overrides (merged with auto-collected + userContext)
  context?: Record<string, unknown>;
}

export interface EngineError {
  type: "network" | "proxy" | "validation" | "unknown";
  message: string;
  status?: number;
}

export interface QueryResult {
  actions: Action[];
}

// ─── Engine ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gyozai_conversation";

function loadHistory(): Array<{ role: string; content: string }> {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: Array<{ role: string; content: string }>) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage full or unavailable
  }
}

export function createEngine(config: EngineConfig) {
  const caps = { ...DEFAULT_CAPABILITIES, ...config.capabilities };
  const conversationHistory = loadHistory();
  let destroyed = false;
  let pendingExtraContext: string | null = null;
  let autoFollowUpUsed = false; // prevent infinite auto-follow-up loops

  const manifestMode = config.manifestMode ?? true;

  async function query(
    text: string,
    opts?: QueryOptions,
  ): Promise<QueryResult> {
    if (destroyed) throw new Error("Engine has been destroyed");

    // Collect page context from pending requests (clarify or navigation)
    let pageContextForQuery: string | null = null;

    if (pendingExtraContext) {
      pageContextForQuery = pendingExtraContext;
      pendingExtraContext = null;
    }

    // Check for pending snapshots from a previous navigate/click+extraRequests
    if (typeof sessionStorage !== "undefined") {
      const pendingSnapshots = sessionStorage.getItem(
        "gyozai_pending_snapshots",
      );
      if (pendingSnapshots) {
        sessionStorage.removeItem("gyozai_pending_snapshots");
        const types = JSON.parse(pendingSnapshots) as SnapshotType[];
        const pageCtx = capturePageContext(types);
        const ctxText = formatPageContext(pageCtx);
        if (ctxText) {
          pageContextForQuery = ctxText;
        }
      }
    }

    // Auto-collect browser context
    const browserContext: Record<string, unknown> = {};
    if (typeof window !== "undefined") {
      browserContext.currentUrl = window.location.href;
      browserContext.currentPath = window.location.pathname;
      browserContext.pageTitle = document.title;
      browserContext.timestamp = new Date().toISOString();
      browserContext.language = navigator.language;
      browserContext.timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      browserContext.screenWidth = window.innerWidth;
      browserContext.screenHeight = window.innerHeight;
    }

    // Merge: auto browser context + static userContext + per-query context
    const context = {
      ...browserContext,
      ...config.userContext,
      ...opts?.context,
    };

    // Build payload — page context sent as separate field, NOT in conversationHistory
    const payload: Record<string, unknown> = {
      query: text,
      manifestMode,
      conversationHistory,
      context,
      capabilities: caps,
    };

    // Attach page context if we have it (from extraRequests)
    if (pageContextForQuery) {
      payload.pageContext = pageContextForQuery;
    }

    if (manifestMode && config.recipeXml) {
      payload.recipeXml = config.recipeXml;
    }

    if (!manifestMode) {
      payload.htmlSnapshot = captureHtml();
    }

    if (opts?.currentRoute) {
      payload.currentRoute = opts.currentRoute;
    } else if (typeof window !== "undefined") {
      payload.currentRoute = window.location.pathname;
    }

    // Call proxy
    let response: Response;
    try {
      response = await fetch(`${config.proxyUrl}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      const error: EngineError = {
        type: "network",
        message: err instanceof Error ? err.message : "Network request failed",
      };
      config.onError?.(error);
      throw error;
    }

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ error: "Unknown proxy error" }));
      const error: EngineError = {
        type: "proxy",
        message:
          (body as { error?: string }).error ||
          `Proxy returned ${response.status}`,
        status: response.status,
      };
      config.onError?.(error);
      throw error;
    }

    const data = await response.json();

    // Validate response
    const validation = validateResponse(data);
    if (!validation.success) {
      const error: EngineError = {
        type: "validation",
        message: `Invalid response: ${validation.error}`,
      };
      config.onError?.(error);
      throw error;
    }

    // Filter out actions that are disabled in capabilities
    const capabilityMap: Record<string, boolean> = {
      navigate: caps.navigate,
      "show-message": caps.showMessage,
      click: caps.click,
      "execute-js": caps.executeJs,
      "highlight-ui": caps.highlightUi,
      fetch: caps.fetch,
      clarify: caps.clarify,
    };
    const allowedActions = validation.data.actions.filter(
      (a) => capabilityMap[a.type] !== false,
    );
    const result = {
      actions:
        allowedActions.length > 0 ? allowedActions : validation.data.actions,
    };

    // Update conversation history (capped at 20 messages)
    conversationHistory.push({ role: "user", content: text });
    const assistantMessage = result.actions
      .map((a) => a.message)
      .filter(Boolean)
      .join(" ");
    if (assistantMessage) {
      conversationHistory.push({
        role: "assistant",
        content: assistantMessage,
      });
    }
    while (conversationHistory.length > 20) {
      conversationHistory.shift();
    }
    saveHistory(conversationHistory);

    // Handle extraRequests — AI wants more page context
    const extraRequests = (validation.data as { extraRequests?: string[] })
      .extraRequests;
    if (extraRequests && extraRequests.length > 0) {
      const snapshotTypes: SnapshotType[] = extraRequests.map((r) => {
        const map: Record<string, SnapshotType> = {
          buttonsSnapshot: "buttons",
          linksSnapshot: "links",
          formsSnapshot: "forms",
          inputsSnapshot: "inputs",
          textContentSnapshot: "textContent",
          fullPageSnapshot: "all",
        };
        return map[r] || "all";
      });

      const hasClarify = result.actions.some((a) => a.type === "clarify");
      // Any action that causes page change — navigate OR click (clicking a link navigates too)
      const hasPageChange = result.actions.some(
        (a) =>
          a.type === "navigate" ||
          a.type === "click" ||
          a.type === "execute-js",
      );

      if (hasPageChange) {
        // AI wants to navigate/click/execute AND get page context.
        // Stash the snapshot request — capture it on the NEXT user query
        // (after the page has actually loaded from the action).
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(
            "gyozai_pending_snapshots",
            JSON.stringify(snapshotTypes),
          );
        }
        // Do NOT re-query — let the actions dispatch normally below
      } else if (hasClarify) {
        // AI asks user a question + wants context — capture now and stash for when user responds
        const pageCtx = capturePageContext(snapshotTypes);
        pendingExtraContext = formatPageContext(pageCtx);
        // Dispatch the clarify normally below
      } else {
        // Capture requested context
        const pageCtx = capturePageContext(snapshotTypes);
        const ctxText = formatPageContext(pageCtx);

        // Check if AI gave content-changing actions (morph-ui, highlight-ui, navigate, click)
        // These mean the AI is actually answering, not just saying "let me check..."
        const CONTENT_ACTIONS = ["highlight-ui", "navigate", "click"];
        const hasRealActions = result.actions.some((a) =>
          CONTENT_ACTIONS.includes(a.type),
        );

        if (hasRealActions || autoFollowUpUsed) {
          // AI gave real actions OR we already auto-followed-up — stash context for next user query
          pendingExtraContext = ctxText;
          autoFollowUpUsed = false;
          // Fall through to dispatch actions normally below
        } else {
          // Only show-message — AI needs context to actually answer.
          // Dispatch the show-message first, then auto-follow-up with context (once).
          for (const action of result.actions) {
            if (action.type === "show-message" && action.message) {
              config.onMessage?.(action.message);
            }
          }
          pendingExtraContext = ctxText;
          autoFollowUpUsed = true;
          console.log(
            "[gyozai] Auto-follow-up: captured context, re-querying...",
          );
          const reResult = await query(
            "Now answer my question with the page context provided.",
            opts,
          );
          autoFollowUpUsed = false;
          console.log(
            "[gyozai] Auto-follow-up result:",
            reResult.actions.length,
            "actions",
          );
          const originalMessages = result.actions.filter(
            (a) => a.type === "show-message",
          );
          return { actions: [...originalMessages, ...reResult.actions] };
        }
      }
    }

    // Handle fetch actions — make HTTP request, re-query with result as context
    const fetchAction = result.actions.find((a) => a.type === "fetch");
    if (fetchAction && fetchAction.url && config.httpClient) {
      if (fetchAction.message) config.onMessage?.(fetchAction.message);
      config.onAction?.(fetchAction);

      const fetchResult = await config.httpClient(
        fetchAction.url,
        fetchAction.method || "GET",
      );
      // Add fetch result to conversation and re-query
      conversationHistory.push({ role: "user", content: text });
      conversationHistory.push({
        role: "assistant",
        content: `I fetched ${fetchAction.url}. Result: ${JSON.stringify(fetchResult)}`,
      });
      while (conversationHistory.length > 20) conversationHistory.shift();

      // Re-query — the AI now has the fetch result as context and will respond with next action
      return query(
        `Based on the fetched results, answer my original question: ${text}`,
        opts,
      );
    }

    // Dispatch messages FIRST so user sees them before any DOM actions
    for (const action of result.actions) {
      if (action.type === "show-message" && action.message) {
        dispatchAction(action, config);
      }
    }

    // Small delay to let React flush the messages before DOM actions execute
    await new Promise((r) => setTimeout(r, 50));

    // Then dispatch all other actions
    for (const action of result.actions) {
      if (action.type === "show-message") continue; // already dispatched above
      const jsError = dispatchAction(action, config);

      // If execute-js failed, re-query AI with the error so it can reason about it
      if (jsError && action.type === "execute-js") {
        const errorMsg = sanitizeError(jsError);
        config.onMessage?.(`Code execution failed: ${errorMsg}`);
        conversationHistory.push({
          role: "assistant",
          content: `I tried to run JS but it failed with error: ${errorMsg}`,
        });
        while (conversationHistory.length > 20) conversationHistory.shift();
        saveHistory(conversationHistory);

        // Re-query so AI can try a different approach
        return query(
          `The code you tried to execute failed with this error: "${errorMsg}". Please try a different approach or explain what went wrong.`,
          opts,
        );
      }
    }

    return { actions: result.actions };
  }

  function destroy() {
    destroyed = true;
    conversationHistory.length = 0;
    saveHistory([]);
  }

  function getHistory() {
    return [...conversationHistory];
  }

  return { query, destroy, getHistory };
}

// ─── Action Dispatcher ──────────────────────────────────────────────────────────

// Returns error string if execute-js fails, undefined otherwise
function dispatchAction(
  action: Action,
  config: EngineConfig,
): string | undefined {
  config.onAction?.(action);

  switch (action.type) {
    case "navigate":
      if (action.target) {
        if (action.message) config.onMessage?.(action.message);
        if (config.onNavigate) {
          config.onNavigate(action.target);
        } else if (typeof window !== "undefined") {
          window.location.href = action.target;
        }
      }
      break;

    case "click":
      if (action.selector) {
        if (action.message) config.onMessage?.(action.message);
        if (config.onClick) {
          config.onClick(action.selector);
        } else if (typeof document !== "undefined") {
          const el = document.querySelector(
            action.selector,
          ) as HTMLElement | null;
          el?.click();
        }
      }
      break;

    case "execute-js":
      if (action.code) {
        if (action.message) config.onMessage?.(action.message);
        if (config.onExecuteJs) {
          try {
            config.onExecuteJs(action.code);
          } catch (e) {
            return e instanceof Error ? e.message : String(e);
          }
        } else if (typeof window !== "undefined") {
          try {
            new Function(action.code)();
          } catch (e) {
            return e instanceof Error ? e.message : String(e);
          }
        }
      }
      break;

    case "show-message":
      if (action.message) {
        config.onMessage?.(action.message);
      }
      break;

    case "highlight-ui":
      if (action.selector) {
        if (action.message) config.onMessage?.(action.message);
        if (typeof document !== "undefined") {
          const hlEl = document.querySelector(
            action.selector,
          ) as HTMLElement | null;
          if (hlEl) {
            const prev = hlEl.style.cssText;
            hlEl.style.cssText += `;
              outline: 3px solid #E8950A !important;
              outline-offset: 4px !important;
              border-radius: 8px !important;
              box-shadow: 0 0 20px rgba(232, 149, 10, 0.4) !important;
              transition: all 0.3s ease !important;
            `;
            hlEl.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => {
              hlEl.style.cssText = prev;
            }, 4000);
          }
        }
      }
      break;

    case "clarify":
      if (action.message) {
        config.onClarify?.(action.message, action.options || []);
      }
      break;

    case "fetch":
      // Fetch actions are handled in the query loop, not here
      break;
  }
  return undefined;
}

// Truncate error messages to avoid sending huge blobs to the AI
function sanitizeError(error: string): string {
  const firstLine = error.split("\n")[0];
  return firstLine.length > 200 ? firstLine.slice(0, 200) + "..." : firstLine;
}

// ─── HTML Capture (No-Manifest Mode) ────────────────────────────────────────────

function captureHtml(): string {
  if (typeof document === "undefined") return "";

  const clone = document.body.cloneNode(true) as HTMLElement;

  // Remove scripts and styles
  clone
    .querySelectorAll("script, style, noscript")
    .forEach((el) => el.remove());

  // Remove inline event handlers
  clone.querySelectorAll("*").forEach((el) => {
    const attrs = el.attributes;
    for (let i = attrs.length - 1; i >= 0; i--) {
      if (attrs[i].name.startsWith("on")) {
        el.removeAttribute(attrs[i].name);
      }
    }
  });

  let html = clone.innerHTML;

  // Truncate to ~30KB
  if (html.length > 30000) {
    html = html.slice(0, 30000) + "\n<!-- truncated -->";
  }

  return html;
}

export type Engine = ReturnType<typeof createEngine>;
