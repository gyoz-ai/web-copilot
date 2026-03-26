import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import {
  capturePageContext,
  formatPageContext,
  captureCleanHtml,
} from "@gyoz-ai/engine";
import type { SnapshotType } from "@gyoz-ai/engine";

// ─── Module-level state (persists for the lifetime of this content script) ────
let pendingSnapshotTypes: SnapshotType[] | null = null;
let pendingExtraContext: string | null = null;
let autoFollowUpUsed = false;
let queryCounter = 0;

const S = {
  brand: "color: #E8950A; font-weight: bold",
  req: "color: #3b82f6; font-weight: bold",
  res: "color: #22c55e; font-weight: bold",
  action: "color: #a855f7; font-weight: bold",
  err: "color: #ef4444; font-weight: bold",
  dim: "color: #9ca3af",
};

function log(...args: unknown[]) {
  console.log("%c[gyoza]", S.brand, ...args);
}

function mapExtraRequests(extraRequests: string[]): SnapshotType[] {
  const map: Record<string, SnapshotType> = {
    buttonsSnapshot: "buttons",
    linksSnapshot: "links",
    formsSnapshot: "forms",
    inputsSnapshot: "inputs",
    textContentSnapshot: "textContent",
    fullPageSnapshot: "all",
  };
  return extraRequests.map((r) => map[r] || "all");
}

function sanitizeError(error: string): string {
  const firstLine = error.split("\n")[0];
  return firstLine.length > 200 ? firstLine.slice(0, 200) + "..." : firstLine;
}

// ─── Message storage (chrome.storage.local, per-tab) ─────────────────────

interface PendingNavState {
  snapshotTypes: SnapshotType[];
  originalQuery: string;
  tabId: number;
  timestamp: number;
}

function pendingNavKey(tabId: number) {
  return `gyozai_pending_nav_${tabId}`;
}

async function savePendingNav(state: PendingNavState) {
  await chrome.storage.local.set({ [pendingNavKey(state.tabId)]: state });
}

async function loadAndClearPendingNav(
  tabId: number,
): Promise<PendingNavState | null> {
  const key = pendingNavKey(tabId);
  try {
    const result = await chrome.storage.local.get(key);
    const state = result[key] as PendingNavState | undefined;
    if (state) {
      await chrome.storage.local.remove(key);
      // Expire after 30s (in case of stale state)
      if (Date.now() - state.timestamp > 30000) return null;
      return state;
    }
    return null;
  } catch {
    return null;
  }
}

async function loadMessages(tabId: number): Promise<Message[]> {
  const key = `gyozai_ui_messages_${tabId}`;
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] || [];
  } catch {
    return [];
  }
}

async function persistMessages(tabId: number, messages: Message[]) {
  const key = `gyozai_ui_messages_${tabId}`;
  try {
    await chrome.storage.local.set({ [key]: messages });
  } catch {
    // storage full
  }
}

async function loadExpanded(tabId: number): Promise<boolean> {
  const key = `gyozai_ui_expanded_${tabId}`;
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] === true;
  } catch {
    return false;
  }
}

async function persistExpanded(tabId: number, expanded: boolean) {
  const key = `gyozai_ui_expanded_${tabId}`;
  try {
    await chrome.storage.local.set({ [key]: expanded });
  } catch {}
}

async function getTabId(): Promise<number | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "gyozai_get_tab_id",
    });
    return response?.tabId ?? null;
  } catch {
    return null;
  }
}

// ─── Lightweight markdown renderer (ported from SDK) ─────────────────────────

function FormatMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={i} style={{ display: "flex", gap: 6, marginTop: 2 }}>
          <span style={{ color: "#9ca3af" }}>•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>,
      );
    } else {
      if (i > 0 && lines[i - 1].trim()) {
        elements.push(<br key={`br-${i}`} />);
      }
      elements.push(<span key={i}>{formatInline(line)}</span>);
    }
  }
  return <>{elements}</>;
}

function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <strong key={match.index} style={{ fontWeight: 600 }}>
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

// ─── Content Script Entry ────────────────────────────────────────────────────

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  async main() {
    if ((window as any).__GYOZAI_SDK__) {
      log("SDK detected on page, extension deferring.");
      return;
    }

    const host = document.createElement("div");
    host.id = "gyozai-extension-root";
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = WIDGET_STYLES_BASE + WIDGET_STYLES_DARK;
    shadow.appendChild(style);

    const container = document.createElement("div");
    shadow.appendChild(container);

    ReactDOM.createRoot(container).render(<GyozaiWidget />);

    // Auto-detect recipe from website
    try {
      const recipeUrl = `${window.location.origin}/recipe.xml`;
      const response = await fetch(recipeUrl, { method: "GET" });
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("xml") || contentType.includes("text")) {
          const xml = await response.text();
          if (xml.includes("gyozai-manifest")) {
            // Auto-import this recipe
            chrome.runtime.sendMessage({
              type: "gyozai_auto_import_recipe",
              filename: "recipe.xml",
              xml,
            });
            console.log(
              "%c[gyoza]",
              "color: #E8950A; font-weight: bold",
              "Auto-detected recipe at",
              recipeUrl,
            );
          }
        }
      }
    } catch {
      // No recipe file — that's fine
    }
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ClarifyState {
  message: string;
  options: string[];
}

interface ActionResult {
  actions?: Array<{
    type: string;
    target?: string;
    selector?: string;
    code?: string;
    message?: string;
    url?: string;
    method?: string;
    options?: string[];
  }>;
  extraRequests?: string[];
  error?: string;
}

// ─── Widget Component ────────────────────────────────────────────────────────

function GyozaiWidget() {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarify, setClarify] = useState<ClarifyState | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const tabIdRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Listen for auto-imported recipe notification
  useEffect(() => {
    const handler = (msg: { type: string; filename?: string }) => {
      if (msg.type === "gyozai_recipe_auto_added" && msg.filename) {
        setToast(`Recipe auto-imported from ${msg.filename}`);
        setTimeout(() => setToast(null), 4000);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // Load theme on mount and listen for changes from popup settings
  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "gyozai_get_settings" })
      .then((s: Record<string, unknown> | undefined) => {
        if (s?.theme === "light" || s?.theme === "dark") setTheme(s.theme);
      });
    const handler = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      const newTheme = changes.gyozai_settings?.newValue?.theme;
      if (newTheme === "light" || newTheme === "dark") {
        setTheme(newTheme);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // Update shadow DOM styles when theme changes
  useEffect(() => {
    const styleEl = document
      .querySelector("#gyozai-extension-root")
      ?.shadowRoot?.querySelector("style");
    if (styleEl) {
      styleEl.textContent =
        WIDGET_STYLES_BASE +
        (theme === "light" ? WIDGET_STYLES_LIGHT : WIDGET_STYLES_DARK);
    }
  }, [theme]);

  // Get tab ID, then restore state from chrome.storage.local + check pending nav
  useEffect(() => {
    getTabId().then(async (tid) => {
      tabIdRef.current = tid;
      if (tid == null) {
        setInitialized(true);
        return;
      }

      const [msgs, exp] = await Promise.all([
        loadMessages(tid),
        loadExpanded(tid),
      ]);
      setMessages(msgs);
      setExpanded(exp);
      setInitialized(true);

      // Check if we arrived here from a navigate + extraRequests
      const pendingNav = await loadAndClearPendingNav(tid);
      if (pendingNav) {
        log(
          "🔄 Resuming after navigation — capturing",
          pendingNav.snapshotTypes.join(", "),
          "for query:",
          pendingNav.originalQuery.slice(0, 60),
        );
        setExpanded(true);
        setLoading(true);

        // Small delay to let the new page render fully
        await new Promise((r) => setTimeout(r, 500));

        // Capture the requested snapshots on the NEW page
        const pageCtx = capturePageContext(pendingNav.snapshotTypes);
        const ctxText = formatPageContext(pageCtx);

        if (ctxText) {
          pendingExtraContext = ctxText;
          log("📎 Captured", ctxText.length, "chars from new page");
        }

        try {
          autoFollowUpUsed = false;
          await handleFullQuery(
            `I've navigated to this page. Continue with my original request: ${pendingNav.originalQuery}`,
            false,
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          setLoading(false);
        }
      }
    });
  }, []);

  // Persist messages to chrome.storage.local (per-tab)
  useEffect(() => {
    if (!initialized || tabIdRef.current == null) return;
    persistMessages(tabIdRef.current, messages);
  }, [messages, initialized]);

  // Persist expanded state (per-tab)
  useEffect(() => {
    if (!initialized || tabIdRef.current == null) return;
    persistExpanded(tabIdRef.current, expanded);
  }, [expanded, initialized]);

  // Listen for toggle command from background
  useEffect(() => {
    const handler = (msg: { type: string }) => {
      if (msg.type === "gyozai_toggle") setExpanded((e) => !e);
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  // Auto-focus input when expanded
  useEffect(() => {
    if (expanded && initialized) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [expanded, initialized]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 30);
    }
  }, [messages, loading]);

  // Helper to add an assistant message
  const addAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content },
    ]);
  }, []);

  // Send a query to the background worker
  async function sendQuery(
    query: string,
    extraPageContext?: string,
  ): Promise<ActionResult> {
    const currentRoute = window.location.pathname;

    const [recipe, extSettings] = await Promise.all([
      chrome.runtime.sendMessage({
        type: "gyozai_get_recipe",
        domain: window.location.host,
      }),
      chrome.runtime.sendMessage({ type: "gyozai_get_settings" }),
    ]);

    const manifestMode = !!recipe?.xml;

    // For no-manifest mode, capture clean HTML — DOM structure with
    // meaningful attrs, no scripts/styles/CSS classes/noise.
    // Gives AI both structure and content in a compact format.
    let pageSnapshot: string | undefined;
    if (!manifestMode && !extraPageContext) {
      pageSnapshot = captureCleanHtml();
    }

    const payload: Record<string, unknown> = {
      type: "gyozai_query",
      query,
      manifestMode,
      recipeXml: recipe?.xml,
      htmlSnapshot: manifestMode ? undefined : pageSnapshot,
      currentRoute,
      tabId: tabIdRef.current,
      context: {
        currentUrl: window.location.href,
        pageTitle: document.title,
        language: navigator.language,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      },
      capabilities: {
        navigate: true,
        showMessage: true,
        click: true,
        executeJs: true,
        highlightUi: true,
        fetch: false,
        clarify: !extSettings?.yoloMode,
      },
    };

    if (extraPageContext) {
      payload.pageContext = extraPageContext;
    }

    // ─── Log request ───────────────────
    queryCounter++;
    const qn = queryCounter;
    console.group(`%c[gyoza] ━━━ REQUEST #${qn} ━━━`, S.req);
    console.log(
      `%cQuery:%c ${query.slice(0, 120)}${query.length > 120 ? "..." : ""}`,
      S.req,
      "",
    );
    console.log(
      `%cMode:%c ${manifestMode ? "✅ manifest (recipe)" : "⚠️ no-manifest (raw HTML)"}`,
      S.req,
      "",
    );
    console.log(`%cRoute:%c ${currentRoute}`, S.req, "");
    console.log(
      `%cRecipe:%c ${recipe ? `✅ ${recipe.names.join(", ")}` : "❌ none"}`,
      S.req,
      "",
    );
    if (manifestMode && recipe?.xml) {
      console.log(
        `%cRecipe:%c ${recipe.xml.length} chars (${recipe.names.length} recipe${recipe.names.length > 1 ? "s" : ""})`,
        S.req,
        "",
      );
    }
    if (!manifestMode && pageSnapshot) {
      console.log(
        `%cClean HTML:%c ${pageSnapshot.length} chars sent to AI`,
        S.req,
        "",
      );
    }
    if (extraPageContext) {
      console.log(
        `%cPage context:%c ✅ ${extraPageContext.length} chars (from extraRequests capture)`,
        S.req,
        "",
      );
    }
    console.groupEnd();

    const start = Date.now();
    const result = (await chrome.runtime.sendMessage(payload)) as ActionResult;
    const ms = Date.now() - start;

    // ─── Log response ──────────────────
    console.group(`%c[gyoza] ━━━ RESPONSE #${qn} (${ms}ms) ━━━`, S.res);
    if (result?.error) {
      console.log(`%c❌ Error:%c ${result.error}`, S.err, "");
    } else {
      const actions = result?.actions || [];
      for (const action of actions) {
        const parts: string[] = [];
        if (action.target) parts.push(`target="${action.target}"`);
        if (action.selector) parts.push(`selector="${action.selector}"`);
        if (action.url) parts.push(`url="${action.url}"`);
        if (action.code)
          parts.push(
            `code="${action.code.slice(0, 80)}${action.code.length > 80 ? "..." : ""}"`,
          );
        if (action.message)
          parts.push(
            `msg="${action.message.slice(0, 80)}${action.message.length > 80 ? "..." : ""}"`,
          );
        if (action.options)
          parts.push(`options=[${action.options.join(", ")}]`);
        console.log(
          `%c  → ${action.type}%c ${parts.join(" ")}`,
          S.action,
          S.dim,
        );
      }
      if (result?.extraRequests?.length) {
        console.log(
          `%c  📋 extraRequests:%c ${result.extraRequests.join(", ")}`,
          S.action,
          "",
        );
      }
    }
    console.groupEnd();

    return result;
  }

  // Dispatch a single DOM action; returns error string if execute-js fails
  async function dispatchDomAction(action: {
    type: string;
    target?: string;
    selector?: string;
    code?: string;
  }): Promise<string | undefined> {
    switch (action.type) {
      case "navigate":
        if (action.target) {
          log("Navigate →", action.target);
          window.location.href = action.target;
        }
        break;
      case "click":
        if (action.selector) {
          const el = document.querySelector(
            action.selector,
          ) as HTMLElement | null;
          log("Click →", action.selector, el ? "(found)" : "(NOT FOUND)");
          el?.click();
        }
        break;
      case "execute-js":
        if (action.code) {
          console.log(
            `%c[gyoza] ⚡ execute-js%c ${action.code.slice(0, 100)}${action.code.length > 100 ? "..." : ""}`,
            S.action,
            S.dim,
          );
          // Execute in page's main world via background worker (CSP blocks eval in content scripts)
          const result = await chrome.runtime.sendMessage({
            type: "gyozai_exec",
            code: action.code,
          });
          if (result?.error) {
            console.error(
              `%c[gyoza] ❌ JS error:%c ${result.error}`,
              S.err,
              "",
            );
            return result.error;
          }
        }
        break;
      case "highlight-ui":
        if (action.selector) {
          const el = document.querySelector(
            action.selector,
          ) as HTMLElement | null;
          log("Highlight →", action.selector, el ? "(found)" : "(NOT FOUND)");
          if (el) {
            const prev = el.style.cssText;
            el.style.cssText += `;outline:3px solid #E8950A!important;outline-offset:4px!important;border-radius:8px!important;box-shadow:0 0 20px rgba(232,149,10,0.4)!important;transition:all 0.3s ease!important;`;
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => {
              el.style.cssText = prev;
            }, 4000);
          }
        }
        break;
    }
    return undefined;
  }

  // Full query lifecycle: handles extraRequests, auto-follow-up, fetch, JS errors
  async function handleFullQuery(
    query: string,
    isUserMessage: boolean,
  ): Promise<void> {
    let pageContextForQuery: string | null = null;

    if (pendingExtraContext) {
      pageContextForQuery = pendingExtraContext;
      pendingExtraContext = null;
      log(
        "📎 Attaching pending extra context:",
        pageContextForQuery!.length,
        "chars",
      );
    }

    if (pendingSnapshotTypes && pendingSnapshotTypes.length > 0) {
      const types = pendingSnapshotTypes;
      pendingSnapshotTypes = null;
      log("📸 Capturing pending snapshots:", types.join(", "));
      const pageCtx = capturePageContext(types);
      const ctxText = formatPageContext(pageCtx);
      if (ctxText) {
        pageContextForQuery = ctxText;
        log("📎 Captured", ctxText.length, "chars of page context");
      }
    }

    const result = await sendQuery(query, pageContextForQuery || undefined);

    if (result?.error) {
      setError(result.error);
      return;
    }

    const actions = result?.actions || [];
    const extraRequests = result?.extraRequests;

    // ─── Handle extraRequests ─────────────────────────────────
    if (extraRequests && extraRequests.length > 0) {
      const snapshotTypes = mapExtraRequests(extraRequests);
      console.log(
        `%c[gyoza] 📋 AI requested extraRequests:%c ${extraRequests.join(", ")}`,
        S.action,
        "",
      );

      const hasClarify = actions.some((a) => a.type === "clarify");
      // Only navigate and click actually change the page URL.
      // execute-js modifies DOM in-place — doesn't need stashing.
      const hasPageChange = actions.some(
        (a) => a.type === "navigate" || a.type === "click",
      );

      if (hasPageChange) {
        log(
          "🔄 navigate/click + extraRequests → saving state for auto-resume after page load",
        );
        // Persist to chrome.storage.local so it survives page navigation
        await savePendingNav({
          snapshotTypes,
          originalQuery: query,
          tabId: tabIdRef.current ?? 0,
          timestamp: Date.now(),
        });
        await dispatchActionsInOrder(actions);
        return;
      } else if (hasClarify) {
        log(
          "🤔 clarify + extraRequests → capturing now, stashing for user response",
        );
        const pageCtx = capturePageContext(snapshotTypes);
        pendingExtraContext = formatPageContext(pageCtx);
        await dispatchActionsInOrder(actions);
        return;
      } else {
        const pageCtx = capturePageContext(snapshotTypes);
        const ctxText = formatPageContext(pageCtx);

        const CONTENT_ACTIONS = ["highlight-ui", "navigate", "click"];
        const hasRealActions = actions.some((a) =>
          CONTENT_ACTIONS.includes(a.type),
        );

        if (hasRealActions || autoFollowUpUsed) {
          log(
            "📦 Real actions or already followed up → stashing",
            ctxText.length,
            "chars for next query",
          );
          pendingExtraContext = ctxText;
          autoFollowUpUsed = false;
          await dispatchActionsInOrder(actions);
          return;
        } else {
          // Only show-message — auto-follow-up once
          for (const action of actions) {
            if (action.type === "show-message" && action.message) {
              addAssistantMessage(action.message);
            }
          }
          pendingExtraContext = ctxText;
          autoFollowUpUsed = true;
          console.log(
            `%c[gyoza] 🔁 AUTO-FOLLOW-UP:%c captured ${ctxText.length} chars of page context, re-querying with context...`,
            S.brand,
            "",
          );
          await handleFullQuery(
            "Now answer my question with the page context provided.",
            false,
          );
          autoFollowUpUsed = false;
          return;
        }
      }
    }

    // ─── Handle fetch actions ─────────────────────────────────
    const fetchAction = actions.find((a) => a.type === "fetch");
    if (fetchAction && fetchAction.url) {
      if (fetchAction.message) addAssistantMessage(fetchAction.message);
      log("Fetch action →", fetchAction.url);

      try {
        const fetchResult = await fetch(fetchAction.url, {
          method: fetchAction.method || "GET",
        }).then((r) => r.text());
        log("Fetch result:", fetchResult.length, "chars");

        await handleFullQuery(
          `Based on the fetched results from ${fetchAction.url}: ${fetchResult}\n\nAnswer my original question: ${query}`,
          false,
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        addAssistantMessage(`Failed to fetch ${fetchAction.url}: ${errMsg}`);
      }
      return;
    }

    // ─── Dispatch actions (messages first, then DOM) ──────────
    await dispatchActionsInOrder(actions);
  }

  // Dispatch show-message first, wait 50ms, then DOM actions
  async function dispatchActionsInOrder(
    actions: Array<{
      type: string;
      target?: string;
      selector?: string;
      code?: string;
      message?: string;
      options?: string[];
    }>,
  ): Promise<void> {
    // Messages + clarify first
    for (const action of actions) {
      if (action.type === "show-message" && action.message) {
        addAssistantMessage(action.message);
      }
      if (action.type === "clarify" && action.message) {
        addAssistantMessage(action.message);
        setClarify({ message: action.message, options: action.options || [] });
      }
    }

    await new Promise((r) => setTimeout(r, 50));

    // DOM actions
    for (const action of actions) {
      if (
        action.type === "show-message" ||
        action.type === "clarify" ||
        action.type === "fetch"
      ) {
        continue;
      }
      if (action.message) {
        addAssistantMessage(action.message);
      }

      const jsError = await dispatchDomAction(action);

      if (jsError && action.type === "execute-js") {
        const errorMsg = sanitizeError(jsError);
        // Don't show JS errors to user — just log and let AI retry silently
        log("⚠️ JS failed, re-querying AI:", errorMsg);
        // Reset so the error re-query gets its own auto-follow-up allowance
        autoFollowUpUsed = false;
        await handleFullQuery(
          `The code you tried to execute failed with this error: "${errorMsg}". Please try a different approach or explain what went wrong.`,
          false,
        );
        return;
      }
    }
  }

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    setClarify(null);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);

    try {
      autoFollowUpUsed = false;
      await handleFullQuery(trimmed, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleClarifyOption = async (option: string) => {
    if (loading) return;
    setClarify(null);
    setError(null);
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: option },
    ]);

    try {
      autoFollowUpUsed = false;
      await handleFullQuery(option, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setClarify(null);
    chrome.runtime.sendMessage({
      type: "gyozai_clear_history",
      tabId: tabIdRef.current,
    });
    log("Chat cleared");
  };

  return (
    <>
      {/* Floating bubble */}
      <button className="gyozai-bubble" onClick={() => setExpanded(!expanded)}>
        <img
          src={chrome.runtime.getURL("/icon-128.png")}
          alt="gyoza"
          style={{ width: 32, height: 32, borderRadius: "50%" }}
        />
      </button>

      {/* Chat panel */}
      {expanded && (
        <div className="gyozai-panel">
          {/* Header */}
          <div className="gyozai-header">
            <div className="gyozai-header-title">
              <img
                src={chrome.runtime.getURL("/icon-128.png")}
                alt=""
                style={{ width: 20, height: 20 }}
              />
              <span>gyoza</span>
            </div>
            <div className="gyozai-header-actions">
              <button
                className="gyozai-icon-btn"
                onClick={clearChat}
                title="Clear chat"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
              <button
                className="gyozai-icon-btn"
                onClick={() =>
                  chrome.runtime.sendMessage({ type: "gyozai_open_popup" })
                }
                title="Settings"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="gyozai-messages">
            {messages.length === 0 && (
              <div className="gyozai-empty">
                Ask me anything about this page...
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`gyozai-msg gyozai-msg-${msg.role}`}>
                {msg.role === "assistant" ? (
                  <FormatMessage text={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            ))}
            {loading && (
              <div className="gyozai-msg gyozai-msg-assistant">
                <div className="gyozai-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Clarify options */}
          {clarify && !loading && (
            <div className="gyozai-clarify">
              {clarify.options.map((option, i) => (
                <button
                  key={i}
                  className="gyozai-clarify-btn"
                  onClick={() => handleClarifyOption(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && <div className="gyozai-error">{error}</div>}

          {/* Toast */}
          {toast && <div className="gyozai-toast">{toast}</div>}

          {/* Input */}
          <div className="gyozai-input-row">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") setExpanded(false);
              }}
              placeholder="Ask me anything..."
              className="gyozai-input"
              disabled={loading}
            />
            <button
              className="gyozai-send-btn"
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// captureCleanHtml is imported from @gyoz-ai/engine

// ─── Widget Styles ───────────────────────────────────────────────────────────

// ─── Base styles (shared between themes) ─────────────────────────────────────

const WIDGET_STYLES_BASE = `
  * { box-sizing: border-box; }

  .gyozai-bubble {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    transition: transform 0.15s ease;
  }
  .gyozai-bubble:hover { transform: scale(1.08); }

  .gyozai-panel {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 380px;
    max-height: 520px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
  }

  .gyozai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
  }
  .gyozai-header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 14px;
    color: #E8950A;
  }
  .gyozai-header-actions {
    display: flex;
    gap: 4px;
  }
  .gyozai-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: color 0.15s ease;
  }
  .gyozai-icon-btn:hover { color: #E8950A; }

  .gyozai-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 120px;
  }

  .gyozai-empty {
    text-align: center;
    padding: 32px 16px;
    font-size: 13px;
  }

  .gyozai-msg {
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 13px;
    max-width: 85%;
    word-break: break-word;
    line-height: 1.45;
  }

  .gyozai-msg-user {
    align-self: flex-end;
    background: #E8950A;
    color: #fff;
    border-radius: 12px 12px 4px 12px;
  }

  .gyozai-msg-assistant {
    align-self: flex-start;
    border-radius: 12px 12px 12px 4px;
  }

  .gyozai-typing {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }
  .gyozai-typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #71717a;
    animation: gyozai-bounce 1.4s infinite ease-in-out both;
  }
  .gyozai-typing span:nth-child(1) { animation-delay: -0.32s; }
  .gyozai-typing span:nth-child(2) { animation-delay: -0.16s; }

  @keyframes gyozai-bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  .gyozai-input-row {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    gap: 8px;
  }

  .gyozai-input {
    flex: 1;
    border-radius: 8px;
    outline: none;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 10px;
    transition: border-color 0.15s ease;
  }
  .gyozai-input:focus { border-color: #E8950A; }
  .gyozai-input:disabled { opacity: 0.6; }

  .gyozai-send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: #E8950A;
    color: #fff;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: opacity 0.15s ease;
  }
  .gyozai-send-btn:hover { opacity: 0.85; }
  .gyozai-send-btn:disabled { opacity: 0.4; cursor: default; }

  .gyozai-error {
    padding: 8px 12px;
    font-size: 12px;
  }

  .gyozai-clarify {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px;
  }

  .gyozai-clarify-btn {
    padding: 6px 12px;
    font-size: 12px;
    font-family: inherit;
    border: 1px solid #E8950A;
    border-radius: 16px;
    color: #E8950A;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .gyozai-clarify-btn:hover {
    background: #E8950A;
    color: #fff;
  }

  .gyozai-toast {
    padding: 8px 12px;
    font-size: 12px;
    color: #E8950A;
    text-align: center;
    animation: gyozai-fade-in 0.3s ease;
  }

  @keyframes gyozai-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Dark theme colors ───────────────────────────────────────────────────────

const WIDGET_STYLES_DARK = `
  .gyozai-bubble {
    background: #1a1a2e;
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    border: 1px solid #2a2a3a;
  }
  .gyozai-panel {
    background: #1a1a2e;
    color: #e4e4e7;
    border: 1px solid #2a2a3a;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  }
  .gyozai-header {
    border-bottom: 1px solid #2a2a3a;
    background: #12121a;
  }
  .gyozai-icon-btn { color: #71717a; }
  .gyozai-empty { color: #71717a; }
  .gyozai-msg-assistant {
    background: #2a2a3a;
    color: #e4e4e7;
  }
  .gyozai-input-row {
    border-top: 1px solid #2a2a3a;
    background: #12121a;
  }
  .gyozai-input {
    border: 1px solid #2a2a3a;
    color: #e4e4e7;
    background: #1a1a2e;
  }
  .gyozai-error {
    color: #f87171;
    background: #2d1b1b;
    border-top: 1px solid #4a2020;
  }
  .gyozai-clarify {
    border-top: 1px solid #2a2a3a;
  }
  .gyozai-clarify-btn {
    background: #1a1a2e;
  }
  .gyozai-toast {
    background: #12121a;
    border-top: 1px solid #2a2a3a;
  }
`;

// ─── Light theme colors ──────────────────────────────────────────────────────

const WIDGET_STYLES_LIGHT = `
  .gyozai-bubble {
    background: #ffffff;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    border: 1px solid #e5e5e5;
  }
  .gyozai-panel {
    background: #ffffff;
    color: #1a1a2e;
    border: 1px solid #e5e5e5;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  }
  .gyozai-header {
    border-bottom: 1px solid #e5e5e5;
    background: #fafafa;
  }
  .gyozai-icon-btn { color: #9ca3af; }
  .gyozai-empty { color: #9ca3af; }
  .gyozai-msg-assistant {
    background: #f3f4f6;
    color: #1a1a2e;
  }
  .gyozai-input-row {
    border-top: 1px solid #e5e5e5;
    background: #fafafa;
  }
  .gyozai-input {
    border: 1px solid #e5e5e5;
    color: #1a1a2e;
    background: #ffffff;
  }
  .gyozai-error {
    color: #dc2626;
    background: #fef2f2;
    border-top: 1px solid #fecaca;
  }
  .gyozai-clarify {
    border-top: 1px solid #e5e5e5;
  }
  .gyozai-clarify-btn {
    background: #ffffff;
  }
  .gyozai-toast {
    background: #fafafa;
    border-top: 1px solid #e5e5e5;
  }
`;
