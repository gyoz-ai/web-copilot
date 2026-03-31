# Gyozai Web Copilot — Improvement Plan

> Inspired by patterns from the [Claude Code reverse-engineering analysis](./claude-code-reverse-engineering.md).
> Excludes permission system (not needed for this project).

---

## Table of Contents

1. [Query Engine & Error Recovery](#1-query-engine--error-recovery)
2. [Context Management & Token Optimization](#2-context-management--token-optimization)
3. [Tool System Improvements](#3-tool-system-improvements)
4. [State Management Overhaul](#4-state-management-overhaul)
5. [Streaming & Concurrency](#5-streaming--concurrency)
6. [Session Persistence & History](#6-session-persistence--history)
7. [Performance Optimizations](#7-performance-optimizations)
8. [Extensibility: Recipe/Manifest System](#8-extensibility-recipemanifest-system)
9. [Resilient Provider Abstraction](#9-resilient-provider-abstraction)
10. [Cost & Usage Tracking](#10-cost--usage-tracking)
11. [Testing & Observability](#11-testing--observability)

---

## 1. Query Engine & Error Recovery

### Problem

The current engine (`packages/engine/src/engine.ts`) has basic error handling: it catches errors and returns `{ type: 'network' | 'proxy' | 'validation' | 'unknown' }`. There's no retry logic, no fallback, and no recovery from mid-stream failures. If the LLM API returns a 429 or 529, the user sees a raw error.

In the extension background worker (`packages/extension/src/entrypoints/background.ts`), streaming failures crash the query with no recovery path.

### Improvements

#### 1.1 Resilient Query Loop with Retry State Machine

**Where:** `packages/engine/src/engine.ts` — new `queryWithRetry()` wrapper around `query()`

```typescript
type RetryState = {
  attempt: number;
  maxRetries: number;
  backoffMs: number;
  lastError: EngineError | null;
  fallbackProvider: string | null;
};
```

**Implementation:**

- Wrap the existing `query()` call in a retry loop
- Classify errors as transient (429, 529, ECONNRESET) vs. permanent (400, 401, 403)
- Transient errors: exponential backoff with jitter (base 1s, max 30s, max 3 retries)
- Permanent errors: fail immediately with descriptive message
- Emit `onRetry?(attempt, error, nextBackoffMs)` callback so the UI can show "Retrying in 5s..."
- Add a `signal: AbortSignal` parameter so the user can cancel during backoff

**Files to modify:**

- `packages/engine/src/engine.ts` — Add retry wrapper
- `packages/engine/src/schemas/query.ts` — Add retry config to `EngineConfig`
- `packages/extension/src/entrypoints/background.ts` — Wire retry callbacks to content script messages

#### 1.2 Streaming Failure Recovery

**Where:** `packages/extension/src/entrypoints/background.ts` lines 304-558

**Implementation:**

- If streaming fails mid-response (network drop, SSE parse error), capture accumulated tool calls and partial text
- Re-query with a recovery prompt: inject accumulated context + "Continue from where you left off"
- Track a `streamRecoveryCount` (max 2 attempts) to prevent infinite loops
- On final failure, return whatever partial result was accumulated (better than nothing)

**Files to modify:**

- `packages/extension/src/entrypoints/background.ts` — Add try/catch around stream consumption loop
- `packages/engine/src/engine.ts` — Add `recoverFromPartial(partialResult, originalQuery)` method

#### 1.3 Provider Fallback Chain

**Where:** `packages/extension/src/providers/index.ts`

**Implementation:**

- Allow users to configure a fallback provider in settings (e.g., primary: Claude, fallback: OpenAI)
- On persistent 529/overloaded from primary, automatically switch to fallback
- Show a toast: "Primary provider unavailable, using fallback"
- Track which provider is active in session state

**Files to modify:**

- `packages/extension/src/providers/index.ts` — Add `createProviderWithFallback()`
- `packages/extension/src/utils/storage.ts` — Add `fallbackProvider` to `ExtensionSettings`
- `packages/extension/src/entrypoints/background.ts` — Wire fallback logic

---

## 2. Context Management & Token Optimization

### Problem

Every query in no-manifest mode sends a full HTML snapshot (~10-50KB depending on the page). There's no compaction, no summarization of older conversation turns, and the conversation history is capped at a hard 20 messages with no intelligence about what to keep. Page context is re-captured from scratch on every query even when the page hasn't changed.

### Improvements

#### 2.1 Incremental Page Context (Diff-Based)

**Where:** `packages/engine/src/page-context.ts`

**Implementation:**

- After each capture, store a hash of the HTML snapshot and structured elements
- On the next query, compare hashes. If unchanged, send `"[Page context unchanged from previous turn]"` instead of the full snapshot
- If changed, compute a structural diff: which elements were added/removed/modified
- Send only the diff + a reference to the original: `"Page updated: 2 new buttons added, form values changed (see diff below)"`
- Keep the full snapshot available for the first turn and any turn where the AI requests it via `get_page_context` tool

**Files to modify:**

- `packages/engine/src/page-context.ts` — Add `PageContextCache` with hash comparison and diff generation
- `packages/engine/src/engine.ts` — Use cache in `query()` to decide full vs. diff context

#### 2.2 Conversation Compaction (Summarization)

**Where:** `packages/engine/src/engine.ts` — conversation history management

**Implementation:**

- Instead of a hard cap at 20 messages, implement a token-aware compaction strategy:
  1. Count approximate tokens in conversation history (rough: `text.length / 4`)
  2. When history exceeds 80% of the model's effective context budget (minus system prompt + current page context), trigger compaction
  3. Compaction strategy: keep the last 4 turns verbatim, summarize older turns into a single "conversation summary" message
  4. The summary is generated by the LLM itself (a cheap, fast call with a small model or the same model with a summary prompt)
  5. Insert a boundary message: `"[Previous conversation summarized: User asked about X, Y. AI performed actions A, B. Key outcomes: ...]"`
- Preserve tool call results from the last 2 turns (they contain fresh state)

**Files to modify:**

- `packages/engine/src/engine.ts` — Add `compactHistory(history, tokenBudget)` method
- `packages/engine/src/schemas/query.ts` — Add `compactionModel?: string` to config
- `packages/extension/src/entrypoints/background.ts` — Call compaction before query when history is large

#### 2.3 Smart Context Budgeting

**Where:** New file `packages/engine/src/context-budget.ts`

**Implementation:**

- Define a `ContextBudget` that allocates tokens across categories:
  ```typescript
  type ContextBudget = {
    systemPrompt: number; // ~2K tokens (fixed)
    recipe: number; // ~1K tokens (if manifest mode)
    pageContext: number; // ~5K tokens (adaptive)
    history: number; // ~8K tokens (adaptive)
    userQuery: number; // ~500 tokens (fixed)
    toolResults: number; // ~3K tokens (adaptive)
    reserve: number; // ~1K tokens for output
  };
  ```
- Adaptive allocation: if the page is small, give more budget to history; if history is short, give more to page context
- HTML snapshot truncation: if page context exceeds its budget, progressively strip: scripts → styles → comments → deep nesting → non-visible elements
- This prevents the "giant page eats the whole context" problem

**Files to create:**

- `packages/engine/src/context-budget.ts`

**Files to modify:**

- `packages/engine/src/engine.ts` — Use budget to cap each context section
- `packages/engine/src/page-context.ts` — Accept a `maxTokens` parameter for truncation

#### 2.4 Microcompaction for Tool Results

**Where:** `packages/extension/src/entrypoints/background.ts`

**Implementation:**

- Tool results (especially `get_page_context` and `execute_js`) can be very large
- After each tool result is consumed by the model, replace it in conversation history with a truncated version:
  - `get_page_context` → "Page context captured (147 elements, 23KB)"
  - `execute_js` → "JS executed successfully, returned: [first 200 chars]..."
  - `fetch_url` → "Fetched URL, response: [first 500 chars]..."
- Keep the full result only for the most recent tool call of each type

**Files to modify:**

- `packages/extension/src/entrypoints/background.ts` — Add `microcompactToolResults(history)` after each query completes
- `packages/extension/src/tools.ts` — Add `compactResult(result): string` method to each tool definition

---

## 3. Tool System Improvements

### Problem

Tools are currently defined as flat objects in `packages/extension/src/tools.ts` (~750 lines) with no shared interface, no validation beyond Zod schemas, and no concurrency awareness. All tools execute serially in the Vercel AI SDK's `streamText` loop. There's no concept of read-only vs. write tools.

### Improvements

#### 3.1 Unified Tool Interface

**Where:** New file `packages/engine/src/tool.ts`

**Implementation:**

Create a generic `Tool<Input, Output>` interface that all tools conform to:

```typescript
interface Tool<Input extends z.ZodType, Output> {
  name: string;
  description: string;
  inputSchema: Input;

  execute(
    input: z.infer<Input>,
    context: ToolContext,
  ): Promise<ToolResult<Output>>;

  // Concurrency classification
  isConcurrencySafe: boolean; // true = read-only, can run in parallel

  // Result budgeting
  maxResultChars: number; // truncate results beyond this
  compactResult(result: Output): string; // for microcompaction

  // Validation beyond schema
  validate?(input: z.infer<Input>): ValidationResult;
}

type ToolContext = {
  tabId: number;
  pageUrl: string;
  capabilities: string[];
};

type ToolResult<T> =
  | { success: true; data: T; sideEffects?: SideEffect[] }
  | { success: false; error: string; retryable: boolean };
```

**Classify existing tools:**

| Tool               | Concurrency Safe        | Max Result |
| ------------------ | ----------------------- | ---------- |
| `get_page_context` | Yes (read-only)         | 30,000     |
| `show_message`     | Yes (no DOM mutation)   | 500        |
| `set_expression`   | Yes (cosmetic)          | 100        |
| `click`            | No (mutates page)       | 1,000      |
| `execute_js`       | No (arbitrary mutation) | 10,000     |
| `navigate`         | No (destroys page)      | 500        |
| `highlight_ui`     | Yes (temporary visual)  | 500        |
| `fetch_url`        | Yes (no DOM mutation)   | 20,000     |
| `clarify`          | Yes (asks user)         | 1,000      |

**Files to create:**

- `packages/engine/src/tool.ts` — Generic Tool interface

**Files to modify:**

- `packages/extension/src/tools.ts` — Refactor each tool to implement the interface
- `packages/extension/src/entrypoints/background.ts` — Use the interface for tool dispatch

#### 3.2 Concurrent Tool Execution

**Where:** `packages/extension/src/entrypoints/background.ts`

**Implementation:**

When the model returns multiple tool calls in a single turn (Vercel AI SDK supports this via `maxSteps`):

1. Partition tool calls into batches using the concurrency classification:
   ```
   [get_page_context, show_message] → Batch 1 (parallel)
   [click]                          → Batch 2 (serial)
   [get_page_context, highlight_ui] → Batch 3 (parallel)
   ```
2. Run each batch: parallel batches use `Promise.all()`, serial batches run one at a time
3. Collect results and return to the model in order

This is directly inspired by Claude Code's `partitionToolCalls` pattern. For the extension, the main win is overlapping `get_page_context` (DOM read) with `show_message` (UI update) and `fetch_url` (network I/O).

**Files to modify:**

- `packages/extension/src/entrypoints/background.ts` — Add `executeBatched(toolCalls[])`
- `packages/extension/src/tools.ts` — Expose `isConcurrencySafe` per tool

#### 3.3 Tool Result Budgeting

**Where:** `packages/extension/src/tools.ts`

**Implementation:**

- Each tool declares `maxResultChars`
- When a tool result exceeds its budget, truncate with a marker: `"[Result truncated: 45,231 chars → 30,000 chars. Full result available via get_page_context]"`
- This prevents a single `execute_js` that returns a massive JSON from blowing the context budget
- For `get_page_context`, apply progressive HTML stripping (remove data attributes → inline styles → deeply nested children) until within budget

**Files to modify:**

- `packages/extension/src/tools.ts` — Add truncation logic to each tool's result handler

---

## 4. State Management Overhaul

### Problem

State is scattered across 4 storage layers (in-memory, React state, chrome.storage.session, chrome.storage.local) with no centralized store. The widget component (`GyozaiWidget.tsx`) has ~15 `useState` calls with complex synchronization logic. State changes trigger multiple independent storage writes that can race.

### Improvements

#### 4.1 Centralized Store (Zustand-like)

**Where:** New file `packages/extension/src/store.ts`

**Implementation:**

Create a single `WidgetStore` inspired by Claude Code's AppState pattern:

```typescript
type WidgetState = {
  // UI State
  expanded: boolean;
  viewMode: "chat" | "history";
  input: string;

  // Conversation State
  activeConvId: string | null;
  messages: Message[];
  llmHistory: CoreMessage[];
  loading: boolean;
  error: string | null;

  // Clarify State
  clarifyQuestion: string | null;
  clarifyOptions: string[];

  // Avatar State
  expression: Expression;
  avatarPosition: AvatarPosition;

  // Session State
  locale: string;
  agentSize: "sm" | "md" | "lg";
  typingSoundEnabled: boolean;
  bubbleOpacity: number;
};

type WidgetStore = {
  getState(): WidgetState;
  setState(updater: (prev: WidgetState) => WidgetState): void;
  subscribe(listener: (state: WidgetState) => void): () => void;
};
```

**Centralized side effects** (inspired by `onChangeAppState()`):

```typescript
function onStateChange(prev: WidgetState, next: WidgetState) {
  // Persist to chrome.storage.session (debounced, 100ms)
  if (
    prev.expanded !== next.expanded ||
    prev.activeConvId !== next.activeConvId
  ) {
    debouncedSaveSession(next);
  }

  // Persist expression to chrome.storage.local
  if (prev.expression !== next.expression) {
    saveExpression(next.expression);
  }

  // Persist avatar position to chrome.storage.local
  if (prev.avatarPosition !== next.avatarPosition) {
    saveAvatarPosition(next.avatarPosition);
  }
}
```

**React integration:**

```typescript
function useWidgetStore<T>(selector: (state: WidgetState) => T): T {
  return useSyncExternalStore(store.subscribe, () =>
    selector(store.getState()),
  );
}
```

**Benefits:**

- Single source of truth eliminates race conditions
- `useSyncExternalStore` provides tearing-free reads
- Side effects are explicit and centralized (no scattered `useEffect`)
- State is serializable for debugging

**Files to create:**

- `packages/extension/src/store.ts` — Store implementation + side effects

**Files to modify:**

- `packages/extension/src/components/GyozaiWidget.tsx` — Replace 15 `useState` calls with `useWidgetStore` selectors
- `packages/extension/src/entrypoints/content/index.tsx` — Initialize store from preloaded data

---

## 5. Streaming & Concurrency

### Problem

In BYOK mode, streaming works but the UI only updates on complete tool calls. The user sees a loading spinner until the entire response is done. There's no typewriter effect for streaming text, and tool execution blocks the stream.

In managed mode, there's no streaming at all — the entire response is awaited.

### Improvements

#### 5.1 Granular Streaming Events

**Where:** `packages/extension/src/entrypoints/background.ts`

**Implementation:**

Expand the streaming event system beyond the current `gyozai_stream_event`:

```typescript
type StreamEvent =
  | { type: "text_delta"; delta: string } // Partial text
  | { type: "tool_call_start"; tool: string } // Tool execution beginning
  | { type: "tool_call_progress"; tool: string; status: string } // Mid-execution
  | { type: "tool_call_complete"; tool: string; result: string } // Done
  | { type: "thinking"; content: string } // Model reasoning (if available)
  | { type: "complete"; finalText: string } // All done
  | { type: "error"; error: string; retrying: boolean }; // Error with recovery info
```

**UI updates in content script:**

- `text_delta` → Append to current message with typewriter animation
- `tool_call_start` → Show status pill: "Clicking button..."
- `tool_call_progress` → Update status pill with progress
- `tool_call_complete` → Flash pill green, then fade
- `error` with `retrying: true` → Show "Retrying..." toast instead of error

**Files to modify:**

- `packages/extension/src/entrypoints/background.ts` — Emit granular events during stream
- `packages/extension/src/components/GyozaiWidget.tsx` — Handle each event type
- `packages/extension/src/entrypoints/content/index.tsx` — Forward events to widget

#### 5.2 Overlapping Tool Execution with Streaming

**Where:** `packages/extension/src/entrypoints/background.ts`

**Implementation:**

Inspired by Claude Code's streaming tool executor:

- As the Vercel AI SDK streams, detect tool call blocks as they complete (not waiting for the full response)
- Begin executing the tool immediately while the model continues streaming
- This overlaps network I/O (model streaming) with local computation (tool execution)
- Particularly impactful for `get_page_context` which involves DOM traversal

```typescript
// Current: wait for all tool calls → execute all → return all
// Proposed: execute each tool call as it arrives during streaming
for await (const part of stream) {
  if (part.type === "tool-call" && isComplete(part)) {
    // Don't await — fire and collect later
    pendingExecutions.push(executeTool(part));
  }
}
const results = await Promise.all(pendingExecutions);
```

**Files to modify:**

- `packages/extension/src/entrypoints/background.ts` — Restructure stream consumption to be eager

---

## 6. Session Persistence & History

### Problem

Session persistence is fragile. The widget saves session state via `useEffect` on every render, but this can miss rapid state changes. Conversation history is stored entirely in `chrome.storage.local` with no pagination — loading 50 conversations with full LLM history on every history view is slow. There's no transcript recording for crash recovery.

### Improvements

#### 6.1 Append-Only Transcript Recording

**Where:** New file `packages/extension/src/utils/transcript.ts`

**Implementation:**

Inspired by Claude Code's transcript system:

- Before every LLM query, append the user message to a transcript log in `chrome.storage.local`
- After every LLM response, append the assistant message + tool results
- Use a simple JSONL format per conversation: `gyozai_transcript_{convId}`
- On crash/reload, reconstruct the conversation from the transcript (source of truth)
- Benefits: even if the main session storage write fails or races, the transcript captures everything

```typescript
type TranscriptEntry = {
  timestamp: number;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata?: { toolName?: string; error?: boolean };
};

async function appendTranscript(
  convId: string,
  entry: TranscriptEntry,
): Promise<void> {
  // Atomic append via chrome.storage.local get + set
}

async function reconstructFromTranscript(convId: string): Promise<Message[]> {
  // Read transcript entries, rebuild message array
}
```

**Files to create:**

- `packages/extension/src/utils/transcript.ts`

**Files to modify:**

- `packages/extension/src/entrypoints/background.ts` — Write transcript entries around each query
- `packages/extension/src/entrypoints/content/index.tsx` — Use transcript for crash recovery

#### 6.2 Paginated Conversation History

**Where:** `packages/extension/src/utils/storage.ts`

**Implementation:**

- Store conversation index separately from conversation content:

  ```typescript
  // Index: small, loaded eagerly
  type ConversationIndex = {
    id: string;
    title: string;
    domain: string;
    lastMessageAt: number;
    messageCount: number;
    preview: string; // First 100 chars of last message
  }[];

  // Content: large, loaded on demand
  type ConversationContent = {
    messages: Message[];
    llmHistory: CoreMessage[];
  };
  ```

- Store index at `gyozai_conv_index` (loaded on history view open)
- Store each conversation's content at `gyozai_conv_{id}` (loaded only when selected)
- This eliminates the current pattern of loading ALL conversation data just to show titles

**Files to modify:**

- `packages/extension/src/utils/storage.ts` — Split `getConversations()` into index + content
- `packages/extension/src/components/GyozaiWidget.tsx` — Load content lazily on conversation select

#### 6.3 Debounced Session Save

**Where:** `packages/extension/src/utils/session.ts`

**Implementation:**

- Replace the current `useEffect` → immediate save pattern with a debounced writer
- Debounce interval: 300ms (batches rapid state changes)
- Flush on `beforeunload` / `visibilitychange` (catches tab close)
- Use `navigator.locks.request('gyozai-session-write', ...)` to prevent concurrent writes from SPA navigations

**Files to modify:**

- `packages/extension/src/utils/session.ts` — Add `DebouncedSessionWriter` class
- `packages/extension/src/components/GyozaiWidget.tsx` — Replace direct `saveWidgetSession` calls

---

## 7. Performance Optimizations

### Problem

Several performance gaps identified:

- Full HTML capture on every query (~50ms DOM walk + serialization)
- No memoization of form value baking
- Large page context sent repeatedly
- Widget re-renders on every state change (no selector-based subscription)

### Improvements

#### 7.1 Cached Page Context with Hash Invalidation

**Where:** `packages/engine/src/page-context.ts`

**Implementation:**

Expand the existing 2-second TTL cache to be smarter:

- After capture, compute a content hash of the structured elements
- On next capture request: if URL unchanged AND hash matches, return cached result
- Use `MutationObserver` in content script to detect DOM changes and invalidate cache proactively
- Cache invalidation events: navigation, form submission, click (delayed 500ms for re-render), explicit `get_page_context` tool call

```typescript
class PageContextCache {
  private lastHash: string = "";
  private lastCapture: PageContext | null = null;
  private lastUrl: string = "";
  private dirty: boolean = true;

  invalidate() {
    this.dirty = true;
  }

  async capture(): Promise<PageContext> {
    if (!this.dirty && this.lastUrl === location.href) {
      return this.lastCapture!;
    }
    const capture = await fullCapture();
    this.lastHash = hash(capture);
    this.lastCapture = capture;
    this.lastUrl = location.href;
    this.dirty = false;
    return capture;
  }
}
```

**Files to modify:**

- `packages/engine/src/page-context.ts` — Replace TTL cache with hash-based cache
- `packages/extension/src/entrypoints/content/index.tsx` — Add MutationObserver for cache invalidation

#### 7.2 Progressive HTML Stripping

**Where:** `packages/engine/src/page-context.ts`

**Implementation:**

When the HTML snapshot is too large, progressively strip content to fit the token budget:

1. Remove `data-*` attributes (often large, rarely useful for AI)
2. Remove inline `style` attributes
3. Remove deeply nested elements (depth > 8)
4. Remove hidden elements (`display: none`, `visibility: hidden`, `aria-hidden`)
5. Remove duplicate text blocks (common in repeated list items — keep first + count)
6. Collapse whitespace-only text nodes
7. If still too large: extract only interactive elements (forms, buttons, links) + visible headings

Track which stripping levels were applied so the AI knows: `"[HTML truncated: removed inline styles and elements deeper than 8 levels to fit context budget]"`

**Files to modify:**

- `packages/engine/src/page-context.ts` — Add `stripToFit(html, maxChars)` function

#### 7.3 Widget Render Optimization

**Where:** `packages/extension/src/components/GyozaiWidget.tsx`

**Implementation:**

- With the centralized store (section 4), use selector-based subscriptions:

  ```typescript
  // Only re-render when messages change
  const messages = useWidgetStore((s) => s.messages);

  // Only re-render when expression changes
  const expression = useWidgetStore((s) => s.expression);
  ```

- Split `GyozaiWidget` into sub-components with their own selectors:
  - `<AvatarBubble>` — subscribes to: expression, expanded, avatarPosition
  - `<ChatPanel>` — subscribes to: messages, loading, error, clarify
  - `<InputBar>` — subscribes to: input, loading
  - `<HistoryView>` — subscribes to: viewMode (only mounts when viewMode === 'history')
- Use `React.memo` on message list items (messages are append-only, so identity comparison works)

**Files to modify:**

- `packages/extension/src/components/GyozaiWidget.tsx` — Split into sub-components
- Create sub-component files as needed in `packages/extension/src/components/`

---

## 8. Extensibility: Recipe/Manifest System

### Problem

The recipe system (`packages/extension/src/utils/recipes.ts`) supports auto-import from `llms.txt` and manual recipes, but recipes are static text blobs. There's no versioning, no conditional activation, and no way for recipes to define custom tools or override default behavior.

### Improvements

#### 8.1 Recipe Frontmatter (Inspired by Skills)

**Where:** `packages/extension/src/utils/recipes.ts`

**Implementation:**

Add optional YAML frontmatter to recipes, inspired by Claude Code's skill format:

```yaml
---
name: GitHub PR Review Helper
version: 1.0.0
domain: github.com
routes:
  - /*/pull/*
capabilities: [click, executeJs, navigate]
model: claude-haiku-4-5-20251001
maxSteps: 5
---
You are helping the user review a GitHub pull request...
```

**Fields:**

| Field          | Purpose                                                        |
| -------------- | -------------------------------------------------------------- |
| `name`         | Display name in recipe manager                                 |
| `version`      | Semantic version for updates                                   |
| `domain`       | Auto-activate on this domain                                   |
| `routes`       | Glob patterns for URL paths — only activate on matching routes |
| `capabilities` | Override default capabilities for this recipe                  |
| `model`        | Suggest a specific model (user can override)                   |
| `maxSteps`     | Limit tool call rounds for this recipe                         |

**Benefits:**

- Route-specific recipes: a recipe for GitHub PRs doesn't activate on GitHub issues
- Capability restriction: a read-only recipe can disable `click` and `executeJs`
- Model hints: complex recipes can suggest a smarter model

**Files to modify:**

- `packages/extension/src/utils/recipes.ts` — Parse frontmatter, add `RecipeMeta` type
- `packages/extension/src/entrypoints/background.ts` — Apply recipe metadata to query config
- `packages/engine/src/schemas/manifest.ts` — Add recipe metadata to manifest schema

#### 8.2 Recipe Auto-Update Detection

**Where:** `packages/extension/src/utils/recipes.ts`

**Implementation:**

- On recipe auto-import, store the ETag/Last-Modified from the HTTP response
- Periodically (every 24 hours, or on page load), check if the remote recipe has changed
- If changed, show a non-intrusive notification: "Recipe updated for github.com — view changes?"
- User can accept or ignore the update
- Version comparison via semantic version in frontmatter

**Files to modify:**

- `packages/extension/src/utils/recipes.ts` — Add update check logic
- `packages/extension/src/utils/storage.ts` — Store recipe ETags

---

## 9. Resilient Provider Abstraction

### Problem

The provider abstraction (`packages/extension/src/providers/index.ts`) is a thin factory that creates Vercel AI SDK model instances. There's no shared interface for capabilities, no token counting, and no way to know if a provider supports features like tool calling or streaming before making the API call.

### Improvements

#### 9.1 Provider Capability Registry

**Where:** `packages/extension/src/providers/index.ts`

**Implementation:**

```typescript
type ProviderCapabilities = {
  streaming: boolean;
  toolCalling: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsImages: boolean;
  costPerInputToken: number; // USD
  costPerOutputToken: number; // USD
};

const PROVIDER_REGISTRY: Record<string, ProviderCapabilities> = {
  "claude-haiku-4-5-20251001": {
    streaming: true,
    toolCalling: true,
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    supportsImages: true,
    costPerInputToken: 0.8 / 1_000_000,
    costPerOutputToken: 4.0 / 1_000_000,
  },
  "gpt-5.4-mini": {
    streaming: true,
    toolCalling: true,
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    supportsImages: true,
    costPerInputToken: 0.15 / 1_000_000,
    costPerOutputToken: 0.6 / 1_000_000,
  },
  // ... other models
};
```

**Usage:**

- Context budget (section 2.3) uses `maxContextTokens` to size allocations
- Cost tracking (section 10) uses per-token costs
- Feature gating: if `!toolCalling`, fall back to structured JSON mode
- If `!streaming`, use non-streaming path without showing typewriter

**Files to modify:**

- `packages/extension/src/providers/index.ts` — Add capability registry
- `packages/engine/src/context-budget.ts` — Read max tokens from registry

#### 9.2 Token Counting Utility

**Where:** New file `packages/engine/src/token-count.ts`

**Implementation:**

- Implement a fast approximate token counter: `estimateTokens(text: string): number`
- Heuristic: `Math.ceil(text.length / 4)` for English, `Math.ceil(text.length / 2)` for CJK-heavy text
- Detect CJK presence via regex: `/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/`
- Use this everywhere token budgets are calculated (context budget, compaction triggers, cost estimation)
- Optional: integrate `tiktoken-lite` for exact counts when precision matters (lazy-loaded, ~200KB)

**Files to create:**

- `packages/engine/src/token-count.ts`

**Files to modify:**

- `packages/engine/src/engine.ts` — Use for history compaction triggers
- `packages/engine/src/context-budget.ts` — Use for budget allocation

---

## 10. Cost & Usage Tracking

### Problem

There's no cost tracking at all. Users on BYOK mode have no visibility into how much each query costs them. There's no way to set a budget or see cumulative session costs.

### Improvements

#### 10.1 Per-Query Cost Estimation

**Where:** New file `packages/extension/src/utils/cost-tracker.ts`

**Implementation:**

```typescript
type QueryCost = {
  inputTokens: number;
  outputTokens: number;
  model: string;
  estimatedCostUsd: number;
  timestamp: number;
};

type SessionCosts = {
  queries: QueryCost[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  sessionStartedAt: number;
};
```

- After each query, extract token usage from the Vercel AI SDK response (`usage.promptTokens`, `usage.completionTokens`)
- Calculate cost using the provider capability registry (section 9.1)
- Store cumulative session costs in `chrome.storage.session`
- Show in the widget header: "$0.03 this session" (clickable to expand)

**Files to create:**

- `packages/extension/src/utils/cost-tracker.ts`

**Files to modify:**

- `packages/extension/src/entrypoints/background.ts` — Track usage after each query
- `packages/extension/src/components/GyozaiWidget.tsx` — Show cost in header

#### 10.2 Budget Alerts

**Where:** `packages/extension/src/utils/cost-tracker.ts`

**Implementation:**

- Add `maxSessionBudgetUsd` to settings (default: $1.00)
- When cumulative cost exceeds 80% of budget, show a warning toast
- When cumulative cost exceeds 100%, block further queries with a clear message and option to increase budget
- Show per-query cost in message metadata (small, muted text under each assistant message)

**Files to modify:**

- `packages/extension/src/utils/storage.ts` — Add `maxSessionBudgetUsd` to settings
- `packages/extension/src/utils/cost-tracker.ts` — Add budget check logic
- `packages/extension/src/entrypoints/background.ts` — Check budget before query

---

## 11. Testing & Observability

### Problem

Tests exist but coverage is limited to schema validation and basic engine tests. There are no integration tests for the extension, no tests for the streaming path, and no structured error logging.

### Improvements

#### 11.1 Tool Execution Tests

**Where:** New file `packages/extension/src/tools.test.ts`

**Implementation:**

- Test each tool in isolation with mock `chrome.scripting.executeScript`
- Test success and failure paths:
  - `click` with valid selector → success
  - `click` with non-existent element → error + retryable flag
  - `execute_js` with syntax error → error + JS error message
  - `navigate` → success + navigation flag
  - `get_page_context` → returns structured elements
- Test tool result truncation (section 3.3)
- Test concurrency classification (section 3.2)

**Files to create:**

- `packages/extension/src/tools.test.ts`

#### 11.2 Streaming Integration Tests

**Where:** New file `packages/extension/src/entrypoints/background.test.ts`

**Implementation:**

- Mock the Vercel AI SDK's `streamText` to return controlled streams
- Test: text deltas arrive at content script in order
- Test: tool calls execute during streaming
- Test: stream failure triggers retry
- Test: partial result recovery after crash
- Test: token budget continuation (section 4.4 analog)

**Files to create:**

- `packages/extension/src/entrypoints/background.test.ts`

#### 11.3 Structured Error Logging

**Where:** New file `packages/extension/src/utils/logger.ts`

**Implementation:**

Replace scattered `console.log`/`console.error` with a structured logger:

```typescript
type LogEntry = {
  level: 'debug' | 'info' | 'warn' | 'error'
  category: 'query' | 'tool' | 'storage' | 'provider' | 'session'
  message: string
  data?: Record<string, unknown>
  timestamp: number
  sessionId: string
}

const logger = {
  debug(category, message, data?) { ... },
  info(category, message, data?) { ... },
  warn(category, message, data?) { ... },
  error(category, message, data?) { ... },
}
```

- In development: pretty-print to console with color coding (keep current styling)
- Store last 100 error entries in `chrome.storage.local` for `/doctor`-style diagnostics
- Add a hidden debug panel (triple-tap avatar) showing recent logs

**Files to create:**

- `packages/extension/src/utils/logger.ts`

**Files to modify:**

- `packages/extension/src/entrypoints/background.ts` — Replace console.log with logger
- `packages/extension/src/tools.ts` — Replace console.log with logger
- `packages/extension/src/entrypoints/content/index.tsx` — Replace console.log with logger

---

## Implementation Priority

Ordered by impact-to-effort ratio:

| Priority | Section                            | Estimated Effort | Impact                                                |
| -------- | ---------------------------------- | ---------------- | ----------------------------------------------------- |
| 1        | 1.1 Retry state machine            | Small            | High — eliminates most user-visible errors            |
| 2        | 5.1 Granular streaming events      | Medium           | High — dramatically better UX                         |
| 3        | 4.1 Centralized store              | Medium           | High — eliminates state bugs, enables everything else |
| 4        | 2.1 Incremental page context       | Small            | Medium — reduces token waste significantly            |
| 5        | 6.2 Paginated conversation history | Small            | Medium — fixes slow history loading                   |
| 6        | 7.1 Cached page context            | Small            | Medium — reduces redundant DOM walks                  |
| 7        | 2.2 Conversation compaction        | Medium           | High — enables longer conversations                   |
| 8        | 10.1 Cost tracking                 | Small            | Medium — critical for BYOK users                      |
| 9        | 3.1 Unified tool interface         | Medium           | Medium — enables 3.2 and 3.3                          |
| 10       | 11.3 Structured logging            | Small            | Medium — improves debuggability                       |
| 11       | 9.1 Provider capability registry   | Small            | Medium — enables context budgeting                    |
| 12       | 8.1 Recipe frontmatter             | Medium           | Medium — better extensibility                         |
| 13       | 1.3 Provider fallback              | Small            | Low-Medium — niche but valuable                       |
| 14       | 5.2 Overlapping tool execution     | Medium           | Medium — latency reduction                            |
| 15       | 6.1 Transcript recording           | Small            | Low — insurance against data loss                     |
| 16       | 2.3 Smart context budgeting        | Medium           | Medium — requires token counting                      |
| 17       | 7.2 Progressive HTML stripping     | Medium           | Medium — helps with large pages                       |
| 18       | 7.3 Widget render optimization     | Small            | Low — only matters with store                         |
| 19       | 2.4 Microcompaction                | Small            | Low — optimization for long conversations             |
| 20       | 9.2 Token counting                 | Small            | Low — enables precision elsewhere                     |
| 21       | 10.2 Budget alerts                 | Small            | Low — nice-to-have for BYOK                           |
| 22       | 8.2 Recipe auto-update             | Small            | Low — nice-to-have                                    |
| 23       | 1.2 Streaming failure recovery     | Medium           | Low — rare edge case                                  |
| 24       | 3.2 Concurrent tool execution      | Medium           | Low — small win for current tool set                  |
| 25       | 11.1-11.2 Tool/streaming tests     | Medium           | Low — quality investment                              |
| 26       | 6.3 Debounced session save         | Small            | Low — minor reliability improvement                   |
| 27       | 3.3 Tool result budgeting          | Small            | Low — edge case for large results                     |

---

## Dependencies Between Sections

```
4.1 Centralized Store ──────────┬──→ 7.3 Widget Render Optimization
                                ├──→ 5.1 Granular Streaming Events
                                └──→ 6.3 Debounced Session Save

9.1 Provider Capability Registry ─┬──→ 2.3 Smart Context Budgeting
                                  ├──→ 10.1 Cost Tracking
                                  └──→ 10.2 Budget Alerts

9.2 Token Counting ──────────────┬──→ 2.2 Conversation Compaction
                                 ├──→ 2.3 Smart Context Budgeting
                                 └──→ 7.2 Progressive HTML Stripping

3.1 Unified Tool Interface ──────┬──→ 3.2 Concurrent Tool Execution
                                 ├──→ 3.3 Tool Result Budgeting
                                 └──→ 2.4 Microcompaction

1.1 Retry State Machine ────────→ 1.3 Provider Fallback
```

---

_This plan is based on patterns observed in the Claude Code architecture. Each section is self-contained and can be implemented incrementally. Start with the high-priority items — they deliver the most user-visible improvements with manageable effort._
