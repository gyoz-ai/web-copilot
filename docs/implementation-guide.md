# Gyozai Web Copilot — Implementation Guide

> Detailed implementation specs for every item in the [improvement plan](./improvement-plan.md).
> Each item has: exact files to create/modify, types, function signatures, step-by-step instructions, and test criteria.

---

## Phase 1: Architectural Foundation

### 1. Extract Query Engine from Background Worker

#### 1.1 Create `ConversationHistory` class

**Create:** `packages/engine/src/conversation-history.ts`

```typescript
export interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export class ConversationHistory {
  private entries: HistoryEntry[] = [];
  private maxMessages: number;
  private maxEstimatedTokens: number;

  constructor(opts?: { maxMessages?: number; maxEstimatedTokens?: number }) {
    this.maxMessages = opts?.maxMessages ?? 50;
    this.maxEstimatedTokens = opts?.maxEstimatedTokens ?? 30_000;
  }

  append(entry: HistoryEntry): void {
    this.entries.push(entry);
    this.trim();
  }

  /** Append user query + assistant summary (tool calls + messages) in one shot */
  appendTurn(userQuery: string, assistantSummary: string): void {
    this.append({ role: "user", content: userQuery });
    if (assistantSummary) {
      this.append({ role: "assistant", content: assistantSummary });
    }
  }

  /** Build tool summary string: "[click] [navigate] some message text" */
  static buildAssistantSummary(
    toolCalls: Array<{ tool: string }>,
    messages: string[],
  ): string {
    const toolPart = toolCalls
      .filter(
        (tc) => tc.tool !== "show_message" && tc.tool !== "set_expression",
      )
      .map((tc) => `[${tc.tool}]`)
      .join(" ");
    const msgPart = messages.join("\n\n").slice(0, 300);
    return [toolPart, msgPart].filter(Boolean).join("\n");
  }

  getEntries(): HistoryEntry[] {
    return [...this.entries];
  }

  load(entries: HistoryEntry[]): void {
    this.entries = [...entries];
    this.trim();
  }

  clear(): void {
    this.entries = [];
  }

  private trim(): void {
    // Trim by count
    while (this.entries.length > this.maxMessages) {
      this.entries.shift();
    }
    // Trim by token estimate
    let totalTokens = 0;
    for (const e of this.entries) {
      totalTokens += Math.ceil(e.content.length / 4);
    }
    while (totalTokens > this.maxEstimatedTokens && this.entries.length > 2) {
      const removed = this.entries.shift()!;
      totalTokens -= Math.ceil(removed.content.length / 4);
    }
  }

  toMessages(): Array<{ role: "user" | "assistant"; content: string }> {
    return this.entries.map((e) => ({ role: e.role, content: e.content }));
  }
}
```

#### 1.2 Create `QueryEngine` class

**Create:** `packages/engine/src/query-engine.ts`

This is a platform-agnostic class. It does NOT import chrome APIs. The extension injects platform-specific behavior via config callbacks.

```typescript
import type { HistoryEntry } from "./conversation-history";
import { ConversationHistory } from "./conversation-history";

// ─── Config types ───

export interface LLMProvider {
  type: "legacy" | "byok";
}

export interface LegacyProvider extends LLMProvider {
  type: "legacy";
  query(
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    jsonSchema: Record<string, unknown>,
  ): Promise<unknown>;
}

export interface BYOKProvider extends LLMProvider {
  type: "byok";
  /** The Vercel AI SDK model instance */
  model: unknown; // LanguageModel from 'ai' — kept as unknown to avoid hard dep
}

export interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

export interface QueryError {
  type: "network" | "api" | "validation" | "resource_exhausted" | "unknown";
  message: string;
  status?: number;
  provider?: string;
  retryable: boolean;
}

export interface QueryEngineConfig {
  provider: LegacyProvider | BYOKProvider;
  systemPromptBuilder: (
    mode: "manifest" | "no-manifest",
    caps: Record<string, boolean>,
    yolo: boolean,
  ) => string;
  userPromptBuilder: (params: UserPromptParams) => string;
  /** Tool definitions — passed to streamText(). Only used in BYOK mode. */
  tools?: Record<string, unknown>;
  /** Max tool calling steps per query (default: 10) */
  maxToolSteps?: number;
  /** Yolo mode toggle */
  yoloMode?: boolean;

  // Callbacks
  onStreamEvent?: (event: StreamEvent) => void;
  onStepFinish?: (
    toolCalls: Array<{ toolName: string; input: Record<string, unknown> }>,
  ) => void;
  onError?: (error: QueryError) => void;
  onRetry?: (attempt: number, error: QueryError, nextBackoffMs: number) => void;

  // History config
  maxHistoryMessages?: number;
  maxEstimatedTokens?: number;
}

export interface UserPromptParams {
  query: string;
  recipe?: string;
  htmlSnapshot?: string;
  currentRoute?: string;
  context?: Record<string, unknown>;
  pageContext?: string;
}

export interface QueryInput {
  query: string;
  manifestMode: boolean;
  recipe?: string;
  htmlSnapshot?: string;
  currentRoute?: string;
  pageContext?: string;
  context?: Record<string, unknown>;
  capabilities?: Record<string, boolean>;
}

export interface QueryResult {
  messages: string[];
  clarify?: { message: string; options: string[] } | null;
  expression?: string | null;
  navigated?: boolean;
  toolCalls: Array<{ tool: string; args: Record<string, unknown> }>;
  streamed?: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

// ─── Engine ───

export class QueryEngine {
  private history: ConversationHistory;
  private config: QueryEngineConfig;

  constructor(config: QueryEngineConfig) {
    this.config = config;
    this.history = new ConversationHistory({
      maxMessages: config.maxHistoryMessages ?? 50,
      maxEstimatedTokens: config.maxEstimatedTokens ?? 30_000,
    });
  }

  async query(input: QueryInput): Promise<QueryResult> {
    const caps = input.capabilities || {};
    const mode = input.manifestMode ? "manifest" : "no-manifest";

    const systemPrompt = this.config.systemPromptBuilder(
      mode,
      caps,
      this.config.yoloMode ?? false,
    );
    const userPrompt = this.config.userPromptBuilder({
      query: input.query,
      recipe: input.recipe,
      htmlSnapshot: input.htmlSnapshot,
      currentRoute: input.currentRoute,
      context: input.context,
      pageContext: input.pageContext,
    });

    const aiMessages = [
      ...this.history.toMessages(),
      { role: "user" as const, content: userPrompt },
    ];

    if (this.config.provider.type === "legacy") {
      return this.queryLegacy(
        this.config.provider as LegacyProvider,
        systemPrompt,
        aiMessages,
        input,
      );
    }

    return this.queryBYOK(
      this.config.provider as BYOKProvider,
      systemPrompt,
      aiMessages,
      input,
    );
  }

  private async queryLegacy(
    provider: LegacyProvider,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    input: QueryInput,
  ): Promise<QueryResult> {
    // Delegate to legacy provider — caller provides the JSON schema
    // This method normalizes the legacy ActionResponse into QueryResult
    // Implementation mirrors current background.ts lines 379-411
    throw new Error(
      "TODO: implement during refactor — move from background.ts",
    );
  }

  private async queryBYOK(
    provider: BYOKProvider,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    input: QueryInput,
  ): Promise<QueryResult> {
    // Calls streamText() with provider.model, system, messages, tools
    // Consumes stream, accumulates tool calls, forwards stream events
    // Implementation mirrors current background.ts lines 468-552
    throw new Error(
      "TODO: implement during refactor — move from background.ts",
    );
  }

  /** Update history after a completed query */
  recordTurn(userQuery: string, result: QueryResult): void {
    const summary = ConversationHistory.buildAssistantSummary(
      result.toolCalls,
      result.messages,
    );
    this.history.appendTurn(userQuery, summary);
  }

  loadHistory(entries: HistoryEntry[]): void {
    this.history.load(entries);
  }

  getHistory(): HistoryEntry[] {
    return this.history.getEntries();
  }

  reset(): void {
    this.history.clear();
  }
}
```

#### 1.3 Create handler files

**Create:** `packages/extension/src/entrypoints/handlers/query.ts`

```typescript
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
  const convId = message.conversationId || "default";
  const queryId = message.queryId;

  // Get or create engine for this conversation
  let engine = engines.get(convId);
  if (!engine) {
    const streamEventForwarder = (event: {
      type: string;
      [k: string]: unknown;
    }) => {
      if (!queryId || tabId == null) return;
      chrome.tabs
        .sendMessage(tabId, { type: "gyozai_stream_event", queryId, event })
        .catch(() => {});
    };

    const ctx: ToolExecContext = {
      tabId: tabId!,
      messages: [],
      clarify: null,
      expression: null,
      navigated: false,
      conversationId: convId,
      originalQuery: message.query,
      onStreamEvent: (ev) => streamEventForwarder({ type: ev.kind, ...ev }),
    };

    const tools = createBrowserTools(
      ctx,
      message.capabilities || {},
      settings.yoloMode,
    );

    engine = new QueryEngine({
      provider:
        providerResult.type === "legacy"
          ? {
              type: "legacy",
              query: providerResult.provider.query.bind(
                providerResult.provider,
              ),
            }
          : { type: "byok", model: providerResult.model },
      systemPromptBuilder: buildSystemPrompt,
      userPromptBuilder: buildUserPrompt,
      tools,
      yoloMode: settings.yoloMode,
      maxToolSteps: 10,
      onStreamEvent: streamEventForwarder,
    });

    // Restore history
    const history = await getConversationLlmHistory(convId);
    if (history.length) engine.loadHistory(history);
    engines.set(convId, engine);
  }

  try {
    const result = await engine.query(message);

    // Record turn in history
    engine.recordTurn(message.query, result);

    // Persist history
    await saveConversationLlmHistory(convId, engine.getHistory());

    // Persist expression
    if (result.expression) {
      chrome.storage.local
        .set({ gyozai_expression: result.expression })
        .catch(() => {});
    }

    // Desktop notification if tab inactive
    if (sender.tab?.id) {
      chrome.tabs.get(sender.tab.id, (tab) => {
        if (!tab.active && result.messages.length > 0) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "/icon-128.png",
            title: "gyoza",
            message: result.messages[0].slice(0, 100),
          });
        }
      });
    }

    sendResponse(result);
  } catch (err) {
    sendResponse({
      messages: [],
      toolCalls: [],
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
```

**Create:** `packages/extension/src/entrypoints/handlers/session.ts`

Move `gyozai_load_session`, `gyozai_save_session` handlers from background.ts.

**Create:** `packages/extension/src/entrypoints/handlers/expression.ts`

Move `gyozai_save_expression`, `gyozai_load_expression` handlers.

**Create:** `packages/extension/src/entrypoints/handlers/recipes.ts`

Move `gyozai_auto_import_recipe`, `gyozai_get_recipe`, `gyozai_get_recipes_list`, `gyozai_set_recipes_global` handlers.

**Create:** `packages/extension/src/entrypoints/handlers/settings.ts`

Move `gyozai_get_settings`, `gyozai_get_tab_id` handlers.

**Create:** `packages/extension/src/entrypoints/handlers/navigation.ts`

Move `gyozai_patch_history`, `gyozai_exec` handlers.

#### 1.4 Rewrite background.ts as thin router

**Modify:** `packages/extension/src/entrypoints/background.ts`

```typescript
import { type QueryEngine } from "@gyoz-ai/engine";
import { handleQuery } from "./handlers/query";
import { handleLoadSession, handleSaveSession } from "./handlers/session";
import {
  handleSaveExpression,
  handleLoadExpression,
} from "./handlers/expression";
import {
  handleGetRecipe,
  handleAutoImportRecipe,
  handleGetRecipesList,
  handleSetRecipesGlobal,
} from "./handlers/recipes";
import { handleGetSettings, handleGetTabId } from "./handlers/settings";
import { handlePatchHistory, handleLegacyExec } from "./handlers/navigation";
import { clearWidgetSession } from "../lib/session";

export default defineBackground(() => {
  const engines = new Map<string, QueryEngine>();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "gyozai_get_tab_id":
        return handleGetTabId(sender, sendResponse);
      case "gyozai_patch_history":
        handlePatchHistory(sender, sendResponse);
        return true;
      case "gyozai_load_session":
        handleLoadSession(message, sender, sendResponse);
        return true;
      case "gyozai_save_session":
        handleSaveSession(message, sender, sendResponse);
        return true;
      case "gyozai_save_expression":
        handleSaveExpression(message, sendResponse);
        return true;
      case "gyozai_load_expression":
        handleLoadExpression(sendResponse);
        return true;
      case "gyozai_query":
        handleQuery(message, sender, sendResponse, engines);
        return true;
      case "gyozai_get_settings":
        handleGetSettings(sendResponse);
        return true;
      case "gyozai_auto_import_recipe":
        handleAutoImportRecipe(message, sender, sendResponse);
        return true;
      case "gyozai_get_recipe":
        handleGetRecipe(message, sendResponse);
        return true;
      case "gyozai_get_recipes_list":
        handleGetRecipesList(sendResponse);
        return true;
      case "gyozai_set_recipes_global":
        handleSetRecipesGlobal(sender, sendResponse);
        return true;
      case "gyozai_open_popup":
        chrome.action.openPopup();
        return false;
      case "gyozai_exec":
        handleLegacyExec(message, sendResponse);
        return true;
      default:
        return false;
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle_widget") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id)
          chrome.tabs.sendMessage(tabs[0].id, { type: "gyozai_toggle" });
      });
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    clearWidgetSession(tabId).catch(() => {});
  });
});
```

#### 1.5 Update engine package exports

**Modify:** `packages/engine/src/index.ts`

Add:

```typescript
export { QueryEngine } from "./query-engine";
export type {
  QueryEngineConfig,
  QueryInput,
  QueryResult,
  QueryError,
  StreamEvent,
  LLMProvider,
  LegacyProvider,
  BYOKProvider,
  UserPromptParams,
} from "./query-engine";
export { ConversationHistory } from "./conversation-history";
export type { HistoryEntry } from "./conversation-history";
```

#### 1.6 Test criteria

- background.ts is < 100 lines
- `bun turbo typecheck` passes
- `bun turbo test` passes
- Extension loads and queries work in both managed and BYOK mode
- Streaming events still arrive at widget
- Session persistence works across navigations
- Desktop notifications fire when tab inactive

---

### 2. Tool System: Registry and Structured Outcomes

#### 2.1 Create BrowserTool interface and ToolOutcome types

**Create:** `packages/engine/src/tool.ts`

```typescript
import type { z } from "zod/v4";

export type ToolOutcome<T = unknown> =
  | { status: "success"; data: T }
  | { status: "soft_failure"; error: string; retryable: true }
  | { status: "hard_failure"; error: string; retryable: false }
  | { status: "navigation_started"; target: string }
  | { status: "needs_user_input"; prompt: string; options?: string[] }
  | { status: "stale_context"; message: string };

export interface ToolContext {
  tabId: number;
  pageUrl: string;
}

export interface BrowserToolDescriptor {
  name: string;
  description: string;

  // Behavior metadata
  pageChange: boolean;
  mutatesPage: boolean;
  requiresFreshContext: boolean;
  isConcurrencySafe: boolean;

  // Result budgeting
  maxResultChars: number;
}

/** Mapping of tool name → descriptor for all registered tools */
export type ToolRegistry = Record<string, BrowserToolDescriptor>;
```

This is the interface layer only. The actual Vercel AI SDK `tool()` calls remain in `tools.ts` — but each tool now also exports a descriptor that the engine can inspect.

#### 2.2 Add descriptors to existing tools

**Modify:** `packages/extension/src/lib/tools.ts`

Add at the top:

```typescript
import type { BrowserToolDescriptor, ToolRegistry } from "@gyoz-ai/engine";

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
  execute_js: {
    name: "execute_js",
    description: "Execute JavaScript",
    pageChange: true,
    mutatesPage: true,
    requiresFreshContext: false,
    isConcurrencySafe: false,
    maxResultChars: 10_000,
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
};
```

#### 2.3 Refactor tool return values to use ToolOutcome

This is a gradual migration. Each tool's `execute` function currently returns ad-hoc objects like `{ success: true, element: "..." }`. Wrap these in ToolOutcome:

For each tool in `createBrowserTools()`, change the return pattern from:

```typescript
return { success: true, element: el.tagName };
```

to:

```typescript
return { status: "success", data: { element: el.tagName } };
```

And error returns from:

```typescript
return { success: false, error: "Element not found" };
```

to:

```typescript
return { status: "soft_failure", error: "Element not found", retryable: true };
```

The `navigate` tool returns:

```typescript
return { status: "navigation_started", target: url };
```

The `clarify` tool returns:

```typescript
return { status: "needs_user_input", prompt: message, options };
```

#### 2.4 Update engine package exports

**Modify:** `packages/engine/src/index.ts`

Add:

```typescript
export type {
  ToolOutcome,
  ToolContext,
  BrowserToolDescriptor,
  ToolRegistry,
} from "./tool";
```

#### 2.5 Test criteria

- All existing tool calls still work (backward compat with Vercel AI SDK)
- `TOOL_DESCRIPTORS` is exported and has entries for all 9 tools
- `bun turbo typecheck` passes

---

### 3. Move Prompt Rules into Runtime Code

#### 3.1 Add post-processing in QueryEngine

**Modify:** `packages/engine/src/query-engine.ts`

After `queryBYOK()` returns a result, add:

```typescript
private postProcess(result: QueryResult): QueryResult {
  // Rule: always include at least one show_message
  if (result.messages.length === 0 && !result.clarify && !result.error) {
    result.messages.push("Done.");
  }

  // Rule: halt tool loop after navigation
  // (already enforced by ToolOutcome.navigation_started in query loop)

  return result;
}
```

#### 3.2 Add selector validation in click tool

**Modify:** `packages/extension/src/lib/tools.ts` — in the `click` tool definition

Before executing, validate input:

```typescript
// Reject dangerous selector patterns
const BLOCKED_PATTERNS = [
  /:nth-child/,
  /:nth-of-type/,
  /:first-child/,
  /:last-child/,
];
if (args.selector) {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(args.selector)) {
      return {
        status: "soft_failure",
        error: `Selector pattern "${pattern}" is unreliable. Use text-based matching instead.`,
        retryable: true,
      };
    }
  }
}
```

#### 3.3 Create task templates

**Create:** `packages/extension/src/lib/task-templates.ts`

```typescript
import type { Capabilities } from "@gyoz-ai/engine";

export interface TaskTemplate {
  name: string;
  description: string;
  systemPromptAddition: string;
  defaultCapabilities: Partial<Capabilities>;
}

export const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  "translate-page": {
    name: "Translate Page",
    description: "Translate visible page content",
    systemPromptAddition: `You are translating this page. Use get_page_context with fullPage first, then execute_js to replace text nodes. Preserve HTML structure. Work section by section.`,
    defaultCapabilities: { executeJs: true, click: false, navigate: false },
  },
  "explain-ui": {
    name: "Explain UI",
    description: "Explain what elements on the page do",
    systemPromptAddition: `You are explaining this page's interface. Use get_page_context to understand the layout, then highlight_ui to point at elements as you explain them.`,
    defaultCapabilities: { highlightUi: true, click: false, executeJs: false },
  },
  "fill-form": {
    name: "Fill Form",
    description: "Help fill out a form on the page",
    systemPromptAddition: `You are helping fill a form. Use get_page_context to understand the form fields, clarify any ambiguous fields with the user, then use the narrow interaction tools (fill_input, select_option, toggle_checkbox) to fill them. Use execute_js only as a last resort.`,
    defaultCapabilities: { executeJs: true, click: true },
  },
};
```

#### 3.4 Slim the system prompt

**Modify:** `packages/extension/src/lib/prompts.ts`

Remove these sections from the system prompt (they're now enforced in code):

- "You MUST call show_message in every response" → enforced by `postProcess()`
- "Never use :nth-child or :nth-of-type selectors" → enforced by click tool validation
- "Always call get_page_context at the start" → will be enforced by context manager (section 4)

Keep: personality, tool descriptions, capability list, YOLO mode section.

#### 3.5 Test criteria

- System prompt is measurably shorter
- Engine appends "Done." when model returns no messages
- Click tool rejects `:nth-child` selectors with a helpful error
- Task templates are importable and have correct types

---

## Phase 2: Context, Memory, and Recovery

### 4. Context Management & Token Optimization

#### 4.1 Create context manager

**Create:** `packages/engine/src/context-manager.ts`

```typescript
export type ContextLevel = "light" | "interactive" | "full";

export interface ContextSnapshot {
  level: ContextLevel;
  url: string;
  hash: string;
  content: string;
  capturedAt: number;
}

export class ContextManager {
  private lastSnapshot: ContextSnapshot | null = null;

  /** Decide what context level to provide for this turn */
  decideLevel(opts: {
    isFirstTurn: boolean;
    pageUrl: string;
    lastPageUrl: string | null;
    lastActionFailed: boolean;
    userQueryLooksStructural: boolean;
  }): ContextLevel {
    if (opts.isFirstTurn) return "full";
    if (opts.lastActionFailed) return "full";
    if (opts.pageUrl !== opts.lastPageUrl) return "full";
    if (opts.userQueryLooksStructural) return "interactive";
    return "light";
  }

  /** Check if cached snapshot is still valid */
  isCacheValid(currentUrl: string, currentHash: string): boolean {
    if (!this.lastSnapshot) return false;
    return (
      this.lastSnapshot.url === currentUrl &&
      this.lastSnapshot.hash === currentHash
    );
  }

  /** Store a snapshot */
  cacheSnapshot(snapshot: ContextSnapshot): void {
    this.lastSnapshot = snapshot;
  }

  /** Get diff message when content hasn't changed */
  getUnchangedMessage(): string {
    return "[Page context unchanged from previous turn]";
  }

  /** Simple heuristic: does the query ask about page structure? */
  static looksStructural(query: string): boolean {
    const patterns = [
      /what.*(button|link|form|input|field)/i,
      /where.*(is|are)/i,
      /how many/i,
      /list.*(all|every)/i,
      /show me/i,
      /find.*(on|in).*page/i,
    ];
    return patterns.some((p) => p.test(query));
  }
}
```

#### 4.2 Add hash-based capture cache to page-context

**Modify:** `packages/engine/src/page-context.ts`

Add a content hash function:

```typescript
function quickHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}
```

Replace the existing 2-second TTL cache with hash-based invalidation:

```typescript
let _cachedContext: { hash: string; url: string; result: PageContext } | null = null;

export function capturePageContext(types: SnapshotType[] = ["all"]): PageContext {
  const url = typeof window !== "undefined" ? window.location.href : "";
  // ... existing capture logic ...
  const result = /* captured context */;
  const hash = quickHash(JSON.stringify(result));
  _cachedContext = { hash, url, result };
  return result;
}

export function getContextHash(): string | null {
  return _cachedContext?.hash ?? null;
}
```

#### 4.3 Conversation compaction

**Modify:** `packages/engine/src/conversation-history.ts`

Add a `compact()` method:

```typescript
/** Compact old messages into a summary. Returns the summary text.
 *  Caller is responsible for calling the LLM to generate the summary. */
prepareCompaction(keepRecentTurns: number = 4): {
  toSummarize: HistoryEntry[];
  toKeep: HistoryEntry[];
} {
  if (this.entries.length <= keepRecentTurns * 2) {
    return { toSummarize: [], toKeep: [...this.entries] };
  }
  const keepCount = keepRecentTurns * 2; // 2 entries per turn (user + assistant)
  const toKeep = this.entries.slice(-keepCount);
  const toSummarize = this.entries.slice(0, -keepCount);
  return { toSummarize, toKeep };
}

/** Apply compaction — replace old entries with a single summary */
applyCompaction(summary: string, keepRecentTurns: number = 4): void {
  const { toKeep } = this.prepareCompaction(keepRecentTurns);
  this.entries = [
    { role: "assistant", content: `[Previous conversation summary: ${summary}]` },
    ...toKeep,
  ];
}
```

The QueryEngine calls `prepareCompaction()`, sends the `toSummarize` entries to the LLM with a compact prompt, gets back a summary, and calls `applyCompaction(summary)`.

#### 4.4 Microcompaction

**Modify:** `packages/engine/src/conversation-history.ts`

Add:

```typescript
/** Replace large tool results in history with compact summaries */
microcompact(): void {
  const toolResultPatterns: Array<{ pattern: RegExp; replacement: (match: string) => string }> = [
    { pattern: /Page context captured.*$/s, replacement: (m) => m.split("\n")[0] + " [truncated]" },
    { pattern: /JS executed.*$/s, replacement: (m) => m.slice(0, 200) + "... [truncated]" },
    { pattern: /Fetched URL.*$/s, replacement: (m) => m.slice(0, 500) + "... [truncated]" },
  ];
  // Only compact entries older than the last 4
  for (let i = 0; i < Math.max(0, this.entries.length - 4); i++) {
    const entry = this.entries[i];
    if (entry.role === "assistant" && entry.content.length > 1000) {
      for (const { pattern, replacement } of toolResultPatterns) {
        if (pattern.test(entry.content)) {
          entry.content = replacement(entry.content);
          break;
        }
      }
    }
  }
}
```

#### 4.5 Test criteria

- `ContextManager.decideLevel()` returns correct levels for each scenario
- `ContextManager.looksStructural()` matches structural queries
- `prepareCompaction()` correctly splits history
- `microcompact()` truncates old large entries, leaves recent ones intact
- Hash-based cache returns same result for unchanged page

---

### 5. Query Engine Resilience & Error Recovery

#### 5.1 Add retry loop to QueryEngine

**Modify:** `packages/engine/src/query-engine.ts`

Wrap the API call in `queryBYOK()` with retry logic:

```typescript
private async withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError: QueryError | null = null;

  while (attempt <= MAX_RETRIES) {
    try {
      if (signal?.aborted) throw new Error("Aborted");
      return await fn();
    } catch (err) {
      const classified = this.classifyError(err);
      lastError = classified;

      if (!classified.retryable || attempt >= MAX_RETRIES) {
        this.config.onError?.(classified);
        throw err;
      }

      attempt++;
      const backoff = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 30_000);
      this.config.onRetry?.(attempt, classified, backoff);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastError;
}

private classifyError(err: unknown): QueryError {
  if (!(err instanceof Error)) return { type: "unknown", message: String(err), retryable: false };

  const msg = err.message.toLowerCase();
  const status = (err as any).status ?? (err as any).statusCode;

  // Resource exhaustion (BYOK out of credits)
  if (status === 402 || msg.includes("quota_exceeded") || msg.includes("insufficient_quota") || msg.includes("billing") || msg.includes("exceeded your current quota")) {
    return { type: "resource_exhausted", message: err.message, status, retryable: false, provider: this.getProviderName() };
  }

  // Rate limit (transient)
  if (status === 429 && !msg.includes("quota")) {
    return { type: "api", message: err.message, status, retryable: true };
  }

  // Overloaded (transient)
  if (status === 529 || status === 503) {
    return { type: "api", message: err.message, status, retryable: true };
  }

  // Network errors (transient)
  if (msg.includes("econnreset") || msg.includes("epipe") || msg.includes("fetch failed") || msg.includes("network")) {
    return { type: "network", message: err.message, retryable: true };
  }

  // Permanent API errors
  if (status === 400 || status === 401 || status === 403) {
    return { type: "api", message: err.message, status, retryable: false };
  }

  return { type: "unknown", message: err.message, retryable: false };
}

private getProviderName(): string {
  // Infer from config — the extension caller sets this
  return "unknown";
}
```

#### 5.2 BYOK resource exhaustion UI

**Modify:** `packages/extension/src/entrypoints/content/GyozaiWidget.tsx`

Add a `resourceExhausted` state:

```typescript
const [resourceExhausted, setResourceExhausted] = useState<{
  message: string;
  provider: string;
  dashboardUrl: string;
} | null>(null);
```

In the query error handler:

```typescript
if (result.error && result.errorType === "resource_exhausted") {
  const DASHBOARD_URLS: Record<string, string> = {
    claude: "https://console.anthropic.com/settings/billing",
    openai: "https://platform.openai.com/account/billing",
    gemini: "https://aistudio.google.com/billing",
  };
  setResourceExhausted({
    message: result.error,
    provider: result.provider || settings.provider,
    dashboardUrl: DASHBOARD_URLS[settings.provider] || "",
  });
}
```

Render a dismissible banner above the input:

```tsx
{
  resourceExhausted && (
    <div style={styles.exhaustionBanner}>
      <p>Your API key has run out of credits.</p>
      <a href={resourceExhausted.dashboardUrl} target="_blank">
        Top up your balance →
      </a>
      <button
        onClick={() => {
          setResourceExhausted(null);
        }}
      >
        Dismiss
      </button>
      <button
        onClick={() => {
          setResourceExhausted(null);
          handleQuery("test");
        }}
      >
        Check again
      </button>
    </div>
  );
}
```

#### 5.3 Test criteria

- Transient errors (429, 529, network) retry up to 3 times with backoff
- Permanent errors (400, 401, 403) fail immediately
- Resource exhaustion (402, quota_exceeded) shows banner with provider dashboard link
- `onRetry` callback fires with correct attempt count and backoff time
- AbortSignal cancels retry loop

---

### 6. Structured Task Memory

#### 6.1 Create TaskMemory

**Create:** `packages/engine/src/task-memory.ts`

```typescript
export interface TaskMemory {
  goal: string | null;
  pagesVisited: Array<{ url: string; title: string; summary: string }>;
  factsFound: Array<{ key: string; value: string; source: string }>;
  formsTouched: Array<{ selector: string; field: string; value: string }>;
  pendingClarification: string | null;
  previousFailures: Array<{ action: string; error: string; strategy: string }>;
  navigationChain: string[];
}

export function createEmptyTaskMemory(): TaskMemory {
  return {
    goal: null,
    pagesVisited: [],
    factsFound: [],
    formsTouched: [],
    pendingClarification: null,
    previousFailures: [],
    navigationChain: [],
  };
}

/** Format task memory as context string for injection into prompt */
export function formatTaskMemory(memory: TaskMemory): string | null {
  const parts: string[] = [];
  if (memory.goal) parts.push(`Goal: ${memory.goal}`);
  if (memory.pagesVisited.length > 0) {
    parts.push(
      `Pages visited: ${memory.pagesVisited.map((p) => `${p.title} (${p.url})`).join(", ")}`,
    );
  }
  if (memory.factsFound.length > 0) {
    parts.push(
      `Known facts:\n${memory.factsFound.map((f) => `- ${f.key}: ${f.value}`).join("\n")}`,
    );
  }
  if (memory.previousFailures.length > 0) {
    parts.push(
      `Previous failures:\n${memory.previousFailures.map((f) => `- ${f.action}: ${f.error}`).join("\n")}`,
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : null;
}
```

#### 6.2 Test criteria

- `createEmptyTaskMemory()` returns all fields initialized
- `formatTaskMemory()` returns null for empty memory
- `formatTaskMemory()` includes goal, pages, facts, failures when populated

---

## Phase 3: Better Browser Action Model

### 7. Narrow Interaction Tools

#### 7.1 Add new tools to `createBrowserTools()`

**Modify:** `packages/extension/src/lib/tools.ts`

Add these tools inside `createBrowserTools()` (all gated on `caps.executeJs` since they modify the page):

```typescript
// fill_input — set value on input/textarea
fill_input: tool({
  description: "Fill an input field with a value. Prefer this over execute_js for form filling. Use label text or placeholder to identify the field.",
  parameters: jsonSchema({
    type: "object",
    properties: {
      selector: { type: "string", description: "CSS selector for the input" },
      label: { type: "string", description: "Label text near the input (preferred)" },
      value: { type: "string", description: "Value to set" },
    },
    required: ["value"],
  }),
  execute: async (args) => {
    // Try by label first, then selector, via interaction-resolver
    // Uses execInPage to set .value and dispatch 'input' + 'change' events
  },
}),

// select_option — choose option in <select>
select_option: tool({ ... }),

// toggle_checkbox — check/uncheck
toggle_checkbox: tool({ ... }),

// submit_form — submit a form
submit_form: tool({ ... }),

// scroll_to — scroll element into view
scroll_to: tool({ ... }),

// find_text — search for text on page
find_text: tool({ ... }),

// extract_table — extract table as JSON
extract_table: tool({ ... }),
```

Each tool follows the same pattern:

1. Accept `selector` and/or `label`/`text` for identification
2. Use `interaction-resolver.ts` (section 8) to find the element
3. Execute via `execInPage()` with a focused function
4. Return `ToolOutcome` with `status: "success"` or `status: "soft_failure"`
5. Dispatch appropriate DOM events (`input`, `change`, `click`, `submit`)

#### 7.2 Update prompt to prefer narrow tools

**Modify:** `packages/extension/src/lib/prompts.ts`

Add to the tool description section:

```
When interacting with forms, prefer the specific tools (fill_input, select_option, toggle_checkbox, submit_form, scroll_to) over execute_js. Only use execute_js as a last resort when none of the specific tools can accomplish the task.
```

#### 7.3 Add descriptors for new tools

**Modify:** `packages/extension/src/lib/tools.ts` — add to `TOOL_DESCRIPTORS`:

```typescript
fill_input: { name: "fill_input", description: "Fill input field", pageChange: false, mutatesPage: true, requiresFreshContext: true, isConcurrencySafe: false, maxResultChars: 500 },
select_option: { name: "select_option", description: "Select dropdown option", pageChange: false, mutatesPage: true, requiresFreshContext: true, isConcurrencySafe: false, maxResultChars: 500 },
toggle_checkbox: { name: "toggle_checkbox", description: "Toggle checkbox/radio", pageChange: false, mutatesPage: true, requiresFreshContext: true, isConcurrencySafe: false, maxResultChars: 500 },
submit_form: { name: "submit_form", description: "Submit a form", pageChange: true, mutatesPage: true, requiresFreshContext: true, isConcurrencySafe: false, maxResultChars: 500 },
scroll_to: { name: "scroll_to", description: "Scroll to element", pageChange: false, mutatesPage: false, requiresFreshContext: false, isConcurrencySafe: true, maxResultChars: 500 },
find_text: { name: "find_text", description: "Find text on page", pageChange: false, mutatesPage: false, requiresFreshContext: false, isConcurrencySafe: true, maxResultChars: 2_000 },
extract_table: { name: "extract_table", description: "Extract table data", pageChange: false, mutatesPage: false, requiresFreshContext: false, isConcurrencySafe: true, maxResultChars: 10_000 },
```

#### 7.4 Test criteria

- Each new tool has a test case in `tools.test.ts`
- `fill_input` dispatches `input` + `change` events on the target
- `select_option` works with both value and visible text
- `submit_form` returns `navigation_started` if the form causes navigation
- `execute_js` still works as fallback

---

### 8. Self-Healing Interaction Strategies

#### 8.1 Create interaction resolver

**Create:** `packages/extension/src/lib/interaction-resolver.ts`

```typescript
export interface ResolvedElement {
  strategy: "text_match" | "aria_label" | "css_selector" | "scroll_retry";
  selector: string;
  element: string; // tagName + text preview
}

export interface ResolveResult {
  found: true;
  resolved: ResolvedElement;
} | {
  found: false;
  candidates: Array<{ text: string; selector: string }>;
  error: string;
}

/**
 * Resolve an element using a fallback chain.
 * Executes in the MAIN world via chrome.scripting.executeScript.
 */
export async function resolveElement(
  tabId: number,
  opts: {
    selector?: string;
    text?: string;
    label?: string;
    tag?: string;
    nearText?: string;
  },
): Promise<ResolveResult> {
  // Strategy 1: Text content match
  if (opts.text || opts.label) {
    const result = await tryTextMatch(tabId, opts.text || opts.label!, opts.tag, opts.nearText);
    if (result.found) return result;
  }

  // Strategy 2: Aria-label / button role
  if (opts.text || opts.label) {
    const result = await tryAriaMatch(tabId, opts.text || opts.label!);
    if (result.found) return result;
  }

  // Strategy 3: CSS selector
  if (opts.selector) {
    const result = await trySelectorMatch(tabId, opts.selector);
    if (result.found) return result;

    // Strategy 4: Scroll into view, then retry selector
    const scrollResult = await tryScrollAndRetry(tabId, opts.selector);
    if (scrollResult.found) return scrollResult;
  }

  // All strategies failed — return candidates for clarify
  const candidates = await gatherCandidates(tabId, opts);
  return {
    found: false,
    candidates,
    error: `Could not find element matching ${JSON.stringify(opts)}`,
  };
}
```

Each `try*` function calls `chrome.scripting.executeScript` with a focused matcher function.

#### 8.2 Wire into click tool

**Modify:** `packages/extension/src/lib/tools.ts` — `click` tool

Replace the current element matching logic with:

```typescript
const resolved = await resolveElement(ctx.tabId, {
  selector: args.selector,
  text: args.text,
  tag: args.tag,
  nearText: args.near_text,
});

if (!resolved.found) {
  if (resolved.candidates.length > 0) {
    // Emit clarify with candidates
    return {
      status: "needs_user_input",
      prompt: `I found ${resolved.candidates.length} possible matches. Which one?`,
      options: resolved.candidates.map((c) => c.text),
    };
  }
  return { status: "soft_failure", error: resolved.error, retryable: true };
}

// Click the resolved element
await execInPage(
  ctx.tabId,
  (sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    el?.click();
  },
  [resolved.resolved.selector],
);

return {
  status: "success",
  data: {
    strategy: resolved.resolved.strategy,
    element: resolved.resolved.element,
  },
};
```

#### 8.3 Test criteria

- Text match finds button by visible text
- Aria match finds button by `aria-label`
- Selector match finds element by CSS selector
- Scroll retry finds offscreen element
- Ambiguous matches return `needs_user_input` with candidates
- Each new narrow tool (fill_input, etc.) uses the resolver

---

## Phase 4: Streaming, State, and UX

### 9. Streaming Event Model

#### 9.1 Define event types

Already defined in `packages/engine/src/query-engine.ts` as `StreamEvent`. The query handler maps events to content script messages.

#### 9.2 Emit granular events from QueryEngine

**Modify:** `packages/engine/src/query-engine.ts` — in `queryBYOK()`

As the stream is consumed:

```typescript
// Before tool execution
this.config.onStreamEvent?.({
  type: "tool_running",
  tool: tc.toolName,
  description: `Executing ${tc.toolName}...`,
});

// After tool execution
this.config.onStreamEvent?.({
  type: "tool_finished",
  tool: tc.toolName,
  status: outcome.status,
});

// On retry
this.config.onStreamEvent?.({
  type: "recovery_retry",
  attempt,
  reason: error.message,
});

// Text delta (from stream parts)
this.config.onStreamEvent?.({ type: "text_delta", delta: textPart });

// Complete
this.config.onStreamEvent?.({ type: "complete", finalText });
```

#### 9.3 Handle events in widget

**Modify:** `packages/extension/src/entrypoints/content/GyozaiWidget.tsx`

Extend the stream event listener to handle new event types:

```typescript
case "tool_running":
  // Show status pill with tool description
  break;
case "tool_finished":
  // Flash pill green briefly
  break;
case "text_delta":
  // Append to current message with typewriter animation
  break;
case "recovery_retry":
  // Show "Retrying..." toast
  break;
```

#### 9.4 Test criteria

- `tool_running` events appear as status pills
- `text_delta` events produce typewriter animation
- `recovery_retry` shows toast, not error

---

### 10. State Management Overhaul

#### 10.1 Create centralized store

**Create:** `packages/extension/src/store.ts`

```typescript
import { useSyncExternalStore } from "react";

type Listener = () => void;

export function createStore<T>(
  initialState: T,
  onChange?: (prev: T, next: T) => void,
) {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (updater: (prev: T) => T) => {
      const prev = state;
      state = updater(prev);
      if (state !== prev) {
        onChange?.(prev, state);
        listeners.forEach((l) => l());
      }
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T, S>(
  store: ReturnType<typeof createStore<T>>,
  selector: (state: T) => S,
): S {
  return useSyncExternalStore(store.subscribe, () =>
    selector(store.getState()),
  );
}
```

Create the widget store instance in `GyozaiWidget.tsx` or a shared module, wire `onStateChange` for persistence side effects (session save, expression save, avatar position save).

#### 10.2 Migrate GyozaiWidget

Replace 15+ `useState` calls with `useStore(widgetStore, s => s.fieldName)`. This is a large mechanical refactor — do it incrementally, one state field at a time.

#### 10.3 Test criteria

- Widget renders identically before and after migration
- State changes persist to chrome.storage
- No race conditions between rapid state updates

---

### 11. Structured Decision Cards

#### 11.1 Create component

**Create:** `packages/extension/src/components/DecisionCard.tsx`

A styled card with title, description, options with optional descriptions and recommended flag. Renders inline in the message list when `clarify` tool fires.

#### 11.2 Test criteria

- Card renders with title, description, and clickable options
- Recommended option has visual highlight
- Clicking an option calls the clarify resolution callback

---

## Phase 5: Session, History, and Performance

### 12. Session Persistence

#### 12.1 Transcript recording

**Create:** `packages/extension/src/lib/transcript.ts`

```typescript
export async function appendTranscript(
  convId: string,
  entry: { role: string; content: string; timestamp: number },
): Promise<void> {
  const key = `gyozai_transcript_${convId}`;
  const { [key]: existing } = await chrome.storage.local.get(key);
  const entries = existing || [];
  entries.push(entry);
  // Cap at 200 entries
  if (entries.length > 200) entries.splice(0, entries.length - 200);
  await chrome.storage.local.set({ [key]: entries });
}
```

#### 12.2 Debounced session save

**Modify:** `packages/extension/src/lib/session.ts`

Add a debounced writer that batches saves and flushes on `beforeunload`.

---

### 13. Performance Optimizations

#### 13.1 Hash-based context cache

Already implemented in section 4.2 (page-context.ts changes).

#### 13.2 Progressive HTML stripping

**Modify:** `packages/engine/src/page-context.ts`

Add:

```typescript
export function stripToFit(
  html: string,
  maxChars: number,
): { html: string; strippedLevels: string[] } {
  const levels: Array<{ name: string; strip: (h: string) => string }> = [
    {
      name: "data-attributes",
      strip: (h) => h.replace(/ data-[a-z-]+="[^"]*"/g, ""),
    },
    { name: "inline-styles", strip: (h) => h.replace(/ style="[^"]*"/g, "") },
    {
      name: "deep-nesting",
      strip: (h) => /* remove elements at depth > 8 */ h,
    },
    {
      name: "hidden-elements",
      strip: (h) => /* remove display:none, aria-hidden */ h,
    },
    {
      name: "duplicate-text",
      strip: (h) => /* collapse repeated list items */ h,
    },
    { name: "whitespace", strip: (h) => h.replace(/\s{2,}/g, " ") },
    {
      name: "non-interactive-only",
      strip: (h) => /* keep only forms, buttons, links, headings */ h,
    },
  ];

  let result = html;
  const applied: string[] = [];

  for (const level of levels) {
    if (result.length <= maxChars) break;
    result = level.strip(result);
    applied.push(level.name);
  }

  if (result.length > maxChars) {
    result = result.slice(0, maxChars) + "\n<!-- truncated -->";
  }

  return { html: result, strippedLevels: applied };
}
```

---

## Phase 6: Extensibility

### 14. Recipe System with Playbooks

#### 14.1 Recipe frontmatter parsing

**Modify:** `packages/extension/src/lib/recipes.ts`

Add frontmatter parser:

```typescript
interface RecipeMeta {
  name?: string;
  version?: string;
  domain?: string;
  routes?: string[];
  capabilities?: string[];
  model?: string;
  maxSteps?: number;
}

function parseFrontmatter(content: string): { meta: RecipeMeta; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2];
  const meta: RecipeMeta = {};

  // Simple YAML-like parser (no dependency needed for this subset)
  for (const line of yamlBlock.split("\n")) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (key.trim() === "name") meta.name = value;
    if (key.trim() === "version") meta.version = value;
    if (key.trim() === "domain") meta.domain = value;
    if (key.trim() === "model") meta.model = value;
    if (key.trim() === "maxSteps") meta.maxSteps = parseInt(value, 10);
    if (key.trim() === "routes") meta.routes = JSON.parse(value);
    if (key.trim() === "capabilities") meta.capabilities = JSON.parse(value);
  }

  return { meta, body };
}
```

#### 14.2 Playbook section extraction

```typescript
function extractPlaybooks(recipeBody: string): string | null {
  const match = recipeBody.match(
    /## Playbooks\n([\s\S]*?)(?=\n## [^P]|\n---|\Z)/,
  );
  return match ? match[1].trim() : null;
}
```

When building the user prompt, if a recipe is active and has a playbook section, include it:

```
## Available Playbooks for this site
{playbook content}
Use these playbooks as step-by-step guides when the user's request matches.
```

---

### 15. Token Counting Utility

**Create:** `packages/engine/src/token-count.ts`

```typescript
const CJK_RANGE = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;

export function estimateTokens(text: string): number {
  // Sample first 200 chars for CJK density
  const sample = text.slice(0, 200);
  const cjkChars = (sample.match(CJK_RANGE) || []).length;
  const cjkRatio = cjkChars / Math.max(sample.length, 1);

  const charsPerToken = cjkRatio > 0.3 ? 2 : 4;
  return Math.ceil(text.length / charsPerToken);
}
```

---

## Phase 7: New Product Capabilities

### 16. Browser Memory

**Create:** `packages/extension/src/lib/browser-memory.ts`

```typescript
export interface MemoryEntry {
  key: string;
  value: string;
  source: "user-stated" | "inferred-from-usage" | "pattern";
  createdAt: number;
}

const STORAGE_KEY = "gyozai_browser_memory";
const MAX_ENTRIES = 50;

export async function getMemories(): Promise<MemoryEntry[]> {
  const { [STORAGE_KEY]: entries } =
    await chrome.storage.local.get(STORAGE_KEY);
  return entries || [];
}

export async function addMemory(
  entry: Omit<MemoryEntry, "createdAt">,
): Promise<void> {
  const entries = await getMemories();
  // Upsert by key
  const idx = entries.findIndex((e) => e.key === entry.key);
  const full = { ...entry, createdAt: Date.now() };
  if (idx >= 0) entries[idx] = full;
  else entries.push(full);
  // Cap
  if (entries.length > MAX_ENTRIES)
    entries.splice(0, entries.length - MAX_ENTRIES);
  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}

export async function removeMemory(key: string): Promise<void> {
  const entries = await getMemories();
  await chrome.storage.local.set({
    [STORAGE_KEY]: entries.filter((e) => e.key !== key),
  });
}

export function formatMemoriesForPrompt(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- ${e.key}: ${e.value}`);
  return `\n\n## User Preferences (remembered)\n${lines.join("\n")}`;
}
```

Inject into system prompt via `buildSystemPrompt()`.

---

### 17. Page Watchers

**Create:** `packages/extension/src/lib/page-watcher.ts`

```typescript
export interface PageWatcher {
  id: string;
  description: string;       // Natural language condition
  checkScript: string;        // JS code that returns boolean
  url: string;                // Page to watch
  intervalMs: number;         // Poll interval (default: 60_000)
  createdAt: number;
  lastCheckedAt: number | null;
  triggered: boolean;
}

const STORAGE_KEY = "gyozai_watchers";

export async function getWatchers(): Promise<PageWatcher[]> { ... }
export async function addWatcher(watcher: Omit<PageWatcher, "id" | "createdAt" | "lastCheckedAt" | "triggered">): Promise<string> { ... }
export async function removeWatcher(id: string): Promise<void> { ... }
export async function checkWatcher(watcher: PageWatcher): Promise<boolean> {
  // Use chrome.scripting.executeScript on the watcher's tab
  // Returns true if condition is met
}
```

**Create:** `packages/extension/src/entrypoints/handlers/watchers.ts`

Register a `chrome.alarms` handler that periodically checks all active watchers. When triggered, send a `chrome.notifications.create()` notification.

---

## Phase 8: Testing & Observability

### 18. Testing & Observability

#### 18.1 Tool tests

**Create:** `packages/extension/src/lib/tools.test.ts`

Mock `chrome.scripting.executeScript` and test each tool's execute function:

- Success cases with valid inputs
- Failure cases (element not found, invalid selector)
- ToolOutcome status codes are correct
- `maxResultChars` truncation works

#### 18.2 QueryEngine tests

**Create:** `packages/engine/src/query-engine.test.ts`

Mock the LLM provider to return controlled responses:

- Test retry logic with simulated 429 errors
- Test resource exhaustion detection (402, quota_exceeded)
- Test conversation history trimming
- Test post-processing rules (ensure show_message)

#### 18.3 Structured logger

**Create:** `packages/extension/src/lib/logger.ts`

```typescript
type Category = "query" | "tool" | "storage" | "provider" | "session";
type Level = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: Level;
  category: Category;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER = 100;

export const logger = {
  debug: (cat: Category, msg: string, data?: Record<string, unknown>) =>
    log("debug", cat, msg, data),
  info: (cat: Category, msg: string, data?: Record<string, unknown>) =>
    log("info", cat, msg, data),
  warn: (cat: Category, msg: string, data?: Record<string, unknown>) =>
    log("warn", cat, msg, data),
  error: (cat: Category, msg: string, data?: Record<string, unknown>) =>
    log("error", cat, msg, data),
  getBuffer: () => [...LOG_BUFFER],
};

function log(
  level: Level,
  category: Category,
  message: string,
  data?: Record<string, unknown>,
) {
  const entry: LogEntry = {
    level,
    category,
    message,
    data,
    timestamp: Date.now(),
  };
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();

  // Console output with color coding
  const colors: Record<Level, string> = {
    debug: "color: #9ca3af",
    info: "color: #3b82f6",
    warn: "color: #f59e0b",
    error: "color: #ef4444",
  };
  console.log(`%c[gyoza:${category}] ${message}`, colors[level], data || "");

  // Persist errors to storage
  if (level === "error") {
    chrome.storage.local
      .get("gyozai_error_log")
      .then(({ gyozai_error_log: existing }) => {
        const log = existing || [];
        log.push(entry);
        if (log.length > 100) log.splice(0, log.length - 100);
        chrome.storage.local.set({ gyozai_error_log: log });
      });
  }
}
```

#### 18.4 Outcome analytics

**Create:** `packages/extension/src/lib/analytics.ts`

```typescript
type Outcome =
  | "task_completed"
  | "task_blocked_ambiguity"
  | "recovered_after_failure"
  | "required_clarification"
  | "user_abandoned";

export function trackOutcome(
  outcome: Outcome,
  metadata?: Record<string, unknown>,
): void {
  // For now, just log to structured logger
  logger.info("query", `Outcome: ${outcome}`, metadata);
  // Future: send to analytics endpoint
}
```

---

## Deferred Items

### Plan Mode

When ready to implement:

- Add `planMode: boolean` to `QueryEngineConfig`
- In plan mode, system prompt appends: "Do NOT execute actions. Instead, list the steps you would take as a numbered checklist. Wait for user approval."
- QueryEngine returns `QueryResult` with a `plan: string[]` field instead of executing tools
- Widget shows plan with approve/edit/cancel buttons
- On approve, re-query with plan as context and `planMode: false`

### Task Checklists

When ready to implement:

- Add `TaskStep[]` to `WidgetState` in centralized store
- Create `<TaskProgress>` component showing collapsible step list
- QueryEngine emits `{ type: "task_step_update", stepId, status }` stream events
- Steps auto-generated from plan mode output or from tool execution sequence

---

_Each section is self-contained and can be implemented independently. Start with Phase 1 — it unlocks everything else. After each section, run `bun prettier --write` on changed files and `bun turbo typecheck` to verify._
