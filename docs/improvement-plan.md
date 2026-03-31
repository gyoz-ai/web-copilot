# Gyozai Web Copilot — Improvement Plan

> Synthesized from the [Claude Code reverse-engineering analysis](./claude-code-reverse-engineering.md) and the [extension improvement report](../CLAUDE_CODE_EXTENSION_IMPROVEMENT_REPORT.md).
> Covers architecture, engineering, and product improvements.
> Organized into phases with dependency tracking.
> Excludes permission/policy system — not needed for now.

---

## Table of Contents

### Phase 1: Architectural Foundation

1. [Extract Query Engine from Background Worker](#1-extract-query-engine-from-background-worker)
2. [Tool System: Registry and Structured Outcomes](#2-tool-system-registry-and-structured-outcomes)
3. [Move Prompt Rules into Runtime Code](#3-move-prompt-rules-into-runtime-code)

### Phase 2: Context, Memory, and Recovery

4. [Context Management & Token Optimization](#4-context-management--token-optimization)
5. [Query Engine Resilience & Error Recovery](#5-query-engine-resilience--error-recovery)
6. [Structured Task Memory](#6-structured-task-memory)

### Phase 3: Better Browser Action Model

7. [Narrow Interaction Tools](#7-narrow-interaction-tools)
8. [Self-Healing Interaction Strategies](#8-self-healing-interaction-strategies)

### Phase 4: Streaming, State, and UX

9. [Streaming Event Model](#9-streaming-event-model)
10. [State Management Overhaul](#10-state-management-overhaul)
11. [Structured Decision Cards](#11-structured-decision-cards)

### Phase 5: Session, History, and Performance

12. [Session Persistence](#12-session-persistence)
13. [Performance Optimizations](#13-performance-optimizations)

### Phase 6: Extensibility

14. [Recipe System with Playbooks](#14-recipe-system-with-playbooks)
15. [Token Counting Utility](#15-token-counting-utility)

### Phase 7: New Product Capabilities

16. [Browser Memory](#16-browser-memory)
17. [Page Watchers](#17-page-watchers)

### Phase 8: Testing & Observability

18. [Testing & Observability](#18-testing--observability)

### Deferred

- [Plan Mode for Browser Tasks](#deferred-plan-mode-for-browser-tasks)
- [Task Checklists & Progress Tracking](#deferred-task-checklists--progress-tracking)

---

# Phase 1: Architectural Foundation

## 1. Extract Query Engine from Background Worker

### Problem

The background worker (`background.ts`, 600 lines) is a monolith mixing six unrelated responsibilities: message routing, query orchestration, streaming consumption, tool execution tracking, history management, and legacy conversion. Meanwhile `engine.ts` (561 lines) is a separate legacy-only query engine sharing zero code with the BYOK streaming path. Any improvement must be implemented twice.

### Improvements

#### 1.1 Extract `QueryEngine` Class

**Where:** New file `packages/engine/src/query-engine.ts`

Create a unified `QueryEngine` that handles both legacy and BYOK paths:

```typescript
interface QueryEngineConfig {
  provider: LLMProvider;
  systemPromptBuilder: (mode: PromptMode, caps: Capabilities, yolo: boolean) => string;
  userPromptBuilder: (params: UserPromptParams) => string;
  toolExecutor?: ToolExecutor;
  contextManager?: ContextManager;          // NEW: freshness-aware context (section 4)
  onStreamEvent?: (event: StreamEvent) => void;
  onError?: (error: QueryError) => void;
  maxHistoryMessages: number;
  maxToolSteps: number;
}

class QueryEngine {
  private history: ConversationHistory;
  private taskMemory: TaskMemory;           // NEW: structured task state (section 6)

  async query(input: QueryInput): Promise<QueryResult> { ... }
  loadHistory(history: HistoryEntry[]): void { ... }
  getHistory(): HistoryEntry[] { ... }
  reset(): void { ... }
}
```

**What moves into QueryEngine:**

| Current Location                                | New Location                                    |
| ----------------------------------------------- | ----------------------------------------------- |
| `background.ts` provider creation, history load | `QueryEngine.constructor` / `query()` preamble  |
| `background.ts` system/user prompt building     | `QueryEngine.query()` — calls injected builders |
| `background.ts` request logging                 | `QueryEngine` with injected logger              |
| `background.ts` legacy mode query path          | `QueryEngine.queryLegacy()` private method      |
| `background.ts` BYOK streaming + tool tracking  | `QueryEngine.queryBYOK()` private method        |
| `background.ts` history update + tool summary   | `ConversationHistory.append()`                  |
| `background.ts` `convertLegacyToAgentResult`    | `QueryEngine.normalizeLegacyResult()` private   |
| `engine.ts` `createEngine()` + query + dispatch | **Deprecated** — replaced by QueryEngine        |

**Files to create:**

- `packages/engine/src/query-engine.ts` — The QueryEngine class
- `packages/engine/src/conversation-history.ts` — History management (append, cap, summary, serialize/deserialize)

**Files to modify:**

- `packages/engine/src/index.ts` — Export QueryEngine
- `packages/engine/src/engine.ts` — Mark as deprecated, thin wrapper for backward compat

#### 1.2 Slim Down Background Worker to Pure Message Router

After extracting QueryEngine, `background.ts` becomes ~80 lines:

```
packages/extension/src/entrypoints/
├── background.ts              # ~80 lines: router + lifecycle only
├── handlers/
│   ├── query.ts               # creates/reuses QueryEngine, maps result
│   ├── session.ts             # load/save/clear widget session
│   ├── recipes.ts             # get/import/list recipes
│   ├── settings.ts            # get settings, get tab ID
│   ├── expression.ts          # save/load expression
│   └── navigation.ts          # patch history, legacy exec
```

The `handleQuery` handler becomes simple glue — create engine, call `engine.query()`, persist side effects (expression, history, notifications).

#### 1.3 Deprecate Legacy `createEngine()`

Keep `createEngine()` as a thin wrapper with `@deprecated` annotation. Remove duplicated HTML capture (`captureHtml()`) and action dispatch (`dispatchAction()`) — the SDK should handle dispatch via callbacks.

### Why This Is Priority #1

Every subsequent improvement plugs into QueryEngine: retry logic (5), context management (4), streaming events (9), task memory (6), and testability (18).

---

## 2. Tool System: Registry and Structured Outcomes

### Problem

Tools are flat objects in `tools.ts` (~750 lines) with no shared interface, no concurrency awareness, and no structured outcome types. All tools execute serially. Tool failures return raw strings — the engine can't distinguish retryable from permanent errors.

### Improvements

#### 2.1 Tool Registry with Typed Interface

**Where:** New file `packages/engine/src/tool.ts`

```typescript
interface BrowserTool<Input extends z.ZodType, Output> {
  name: string;
  description: string;
  inputSchema: Input;

  // Behavior metadata
  pageChange: boolean; // true = may cause navigation/reload
  mutatesPage: boolean; // true = modifies DOM
  requiresFreshContext: boolean; // true = stale context may cause failure

  // Concurrency
  isConcurrencySafe: boolean; // true = read-only, can run in parallel

  // Result budgeting
  maxResultChars: number;
  compactResult(result: Output): string;

  // Execution
  execute(
    input: z.infer<Input>,
    ctx: ToolContext,
  ): Promise<ToolOutcome<Output>>;
  validate?(input: z.infer<Input>): ValidationResult;
}
```

**Tool classification:**

| Tool                          | Page Change | Mutates        | Concurrency Safe | Max Result |
| ----------------------------- | ----------- | -------------- | ---------------- | ---------- |
| `get_page_context`            | no          | no             | yes              | 30,000     |
| `show_message`                | no          | no             | yes              | 500        |
| `set_expression`              | no          | no             | yes              | 100        |
| `highlight_ui`                | no          | no (temporary) | yes              | 500        |
| `fetch_url`                   | no          | no             | yes              | 20,000     |
| `clarify`                     | no          | no             | yes              | 1,000      |
| `click`                       | maybe       | yes            | no               | 1,000      |
| `navigate`                    | yes         | no             | no               | 500        |
| `execute_js`                  | maybe       | yes            | no               | 10,000     |
| `fill_input` (new, section 7) | no          | yes            | no               | 500        |
| `select_option` (new)         | no          | yes            | no               | 500        |
| `submit_form` (new)           | maybe       | yes            | no               | 500        |
| `scroll_to` (new)             | no          | no             | yes              | 500        |

#### 2.2 Structured Tool Outcomes

Replace raw success/error strings with typed outcomes:

```typescript
type ToolOutcome<T> =
  | { status: "success"; data: T }
  | { status: "soft_failure"; error: string; retryable: true }
  | { status: "hard_failure"; error: string; retryable: false }
  | { status: "navigation_started"; target: string }
  | { status: "needs_user_input"; prompt: string; options?: string[] }
  | { status: "stale_context"; message: string };
```

The query engine uses these to decide: retry? request fresh context? halt tool loop? ask user?

#### 2.3 Concurrent Tool Execution

Partition tool calls into batches based on `isConcurrencySafe`:

```
[get_page_context, show_message] → Batch 1 (parallel via Promise.all)
[click]                          → Batch 2 (serial)
[get_page_context, highlight_ui] → Batch 3 (parallel)
```

#### 2.4 Tool Result Budgeting

Each tool declares `maxResultChars`. When exceeded, truncate with marker. For `get_page_context`, apply progressive HTML stripping until within budget.

**Files to create:**

- `packages/engine/src/tool.ts` — BrowserTool interface + ToolOutcome types

**Files to modify:**

- `packages/extension/src/lib/tools.ts` — Refactor each tool to implement BrowserTool

---

## 3. Move Prompt Rules into Runtime Code

### Problem

The system prompt (`prompts.ts`) enforces operational rules that belong in code: tool ordering, selector safety, clarification triggers, translation workflows. This is brittle — the model can ignore prompt rules, and any change requires prompt engineering rather than code changes.

### Improvements

#### 3.1 Extract Invariants from Prompt to Engine

**Rules to move to runtime:**

| Current Prompt Rule                  | New Runtime Enforcement                                        |
| ------------------------------------ | -------------------------------------------------------------- |
| "Always call show_message"           | QueryEngine appends show_message if response has none          |
| "Stop tool execution after navigate" | ToolOutcome `navigation_started` halts tool loop               |
| "Never use nth-child selectors"      | `click` tool validates selector input, rejects unsafe patterns |
| "Prefer text-based selectors"        | Selector resolver in `click` tool normalizes selectors         |
| "Call get_page_context first"        | Context manager auto-attaches appropriate level (section 4)    |

#### 3.2 Task Templates for Special Modes

Replace long prompt sections with focused task templates:

```typescript
type TaskTemplate = {
  name: string;
  description: string;
  systemPromptAddition: string;    // Short, focused
  defaultCapabilities: Capabilities;
};

const TEMPLATES: Record<string, TaskTemplate> = {
  'translate-page': { ... },
  'explain-ui': { ... },
  'fill-form': { ... },
  'navigate-to': { ... },
  'compare-products': { ... },
};
```

The system prompt shrinks significantly — it only describes the assistant's personality and available tools. Behavioral rules live in code.

**Files to modify:**

- `packages/extension/src/lib/prompts.ts` — Strip operational rules, keep personality + tool descriptions
- `packages/engine/src/query-engine.ts` — Add post-processing rules (e.g., ensure show_message)

**Files to create:**

- `packages/extension/src/lib/task-templates.ts` — Task template definitions

---

# Phase 2: Context, Memory, and Recovery

## 4. Context Management & Token Optimization

### Problem

Every query in no-manifest mode sends a full HTML snapshot (~10-50KB). The prompt forces the model to call `get_page_context` at the start of almost every response, wasting tokens. Page context is re-captured from scratch even when the page hasn't changed. History is capped at 20 messages with no intelligence about what to keep.

### Improvements

#### 4.1 Freshness-Aware Context Levels

**Where:** New file `packages/engine/src/context-manager.ts`

Move context decisions from the prompt into infrastructure:

| Level         | Contents                                          | When to use                                          |
| ------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `light`       | Route, title, key buttons/links/forms             | Simple follow-ups, chitchat                          |
| `interactive` | + inputs, actionable selectors, form values       | Action requests                                      |
| `full`        | + cleaned HTML, text content, structured sections | First turn, structural questions, post-failure retry |

The context manager decides which level to provide based on:

- Has the page changed since last capture? (URL + DOM mutation marker)
- Is this the first turn? → `full`
- Did the user ask a structural question? → `full`
- Did a previous action fail? → `full` (need evidence)
- Simple follow-up? → `light`

#### 4.2 Incremental Page Context (Diff-Based)

- Store content hash after each capture
- If unchanged: send `"[Page context unchanged from previous turn]"`
- If changed: compute structural diff (elements added/removed/modified)
- Keep full snapshot available when AI requests via `get_page_context`

#### 4.3 Conversation Compaction (Summarization)

Token-aware compaction instead of hard cap at 20 messages:

1. Estimate tokens: `text.length / 4` (heuristic)
2. When history exceeds 80% of model context budget, trigger compaction
3. Keep last 4 turns verbatim, summarize older turns into boundary message
4. Preserve tool results from last 2 turns (contain fresh state)

Store as structured layers:

- Raw recent turns (verbatim)
- Rolling summary for older turns
- Last known page state summary
- Unresolved clarification state
- Navigation chain summary

#### 4.4 Microcompaction for Tool Results

After consumption, replace large tool results with summaries:

- `get_page_context` → "Page context captured (147 elements, 23KB)"
- `execute_js` → "JS executed, returned: [first 200 chars]..."
- `fetch_url` → "Fetched URL, response: [first 500 chars]..."

Keep full result only for the most recent call of each type.

**Files to create:**

- `packages/engine/src/context-manager.ts`

**Files to modify:**

- `packages/engine/src/page-context.ts` — Hash-based cache, accept `maxTokens` for truncation
- `packages/engine/src/query-engine.ts` — Use context manager, compaction

---

## 5. Query Engine Resilience & Error Recovery

### Problem

No retry logic, no fallback, no recovery from mid-stream failures. If the LLM returns 429/529, the user sees a raw error. Tool failures (stale context, unexpected page changes) aren't classified for recovery. If the user's BYOK API key runs out of credits, they get a cryptic error instead of a clear message.

### Improvements

#### 5.1 Retry State Machine

```typescript
type RetryState = {
  attempt: number;
  maxRetries: number;
  backoffMs: number;
  lastError: QueryError | null;
  fallbackProvider: string | null;
};
```

- Classify errors: transient (429, 529, ECONNRESET) vs. permanent (400, 401, 403)
- Transient: exponential backoff with jitter (1s base, 30s max, 3 retries)
- Permanent: fail immediately
- Emit `onRetry?(attempt, error, nextBackoffMs)` for UI feedback
- Accept `signal: AbortSignal` for user cancellation

#### 5.2 BYOK Resource Exhaustion Handling

Detect when the user's API key has run out of credits or quota:

- **Detection:** Catch 402 (Payment Required), 429 with `quota_exceeded` body, or provider-specific "insufficient funds" errors from Anthropic/OpenAI/Google APIs
- **User-facing message:** Clear, actionable error: "Your API key has run out of credits. Top up your balance at [provider dashboard link] to continue."
- **Behavior:** Block further queries with a dismissible banner (not a toast that disappears). Show a "Check again" button that re-validates the key
- **Per-provider dashboard links:**
  - Anthropic: `console.anthropic.com/settings/billing`
  - OpenAI: `platform.openai.com/account/billing`
  - Google: `aistudio.google.com/billing`
- **Distinguish from rate limiting:** 429 rate limit (transient, retry with backoff) vs. 429 quota exceeded (permanent until user tops up) — check the response body/error code

#### 5.3 Streaming Failure Recovery

- Capture accumulated tool calls + partial text on stream failure
- Re-query with recovery prompt: "Continue from where you left off"
- Max 2 recovery attempts, then return partial result

#### 5.4 Provider Fallback Chain

- Configure fallback provider in settings (e.g., primary: Claude, fallback: OpenAI)
- On persistent 529, auto-switch with toast notification
- Track active provider in session state

#### 5.5 Tool Failure Recovery

Leverage structured `ToolOutcome` (section 2.2):

- `soft_failure` → engine retries automatically (max 2)
- `stale_context` → re-capture page context, retry
- `navigation_started` → persist turn checkpoint, resume on next page load
- `needs_user_input` → emit clarify event, pause tool loop

**Files to modify:**

- `packages/engine/src/query-engine.ts` — Add retry loop, resource exhaustion detection, recovery logic
- `packages/extension/src/lib/providers/index.ts` — Add fallback chain, provider-specific error parsing
- `packages/extension/src/lib/storage.ts` — Add `fallbackProvider` to settings
- `packages/extension/src/entrypoints/content/GyozaiWidget.tsx` — Resource exhaustion banner UI

---

## 6. Structured Task Memory

### Problem

The current system only has conversation history (simple message pairs). There's no structured understanding of what the task is, what pages were visited, what facts were found, or what's pending. Multi-step website tasks lose coherence.

### Improvements

**Where:** New file `packages/engine/src/task-memory.ts`

```typescript
type TaskMemory = {
  goal: string | null; // "Find the cheapest annual plan"
  pagesVisited: { url: string; title: string; summary: string }[];
  factsFound: { key: string; value: string; source: string }[];
  formsTouched: { selector: string; field: string; value: string }[];
  pendingClarification: string | null;
  previousFailures: { action: string; error: string; strategy: string }[];
  navigationChain: string[]; // URL breadcrumb
};
```

- Sits beside conversation history, not inside user-visible chat
- Updated by QueryEngine after each tool execution
- Injected into context when relevant (e.g., after navigation, on retry)
- Persisted to `chrome.storage.session` for resume across SPA navigations

**Files to create:**

- `packages/engine/src/task-memory.ts`

**Files to modify:**

- `packages/engine/src/query-engine.ts` — Update task memory after tool calls

---

# Phase 3: Better Browser Action Model

## 7. Narrow Interaction Tools

### Problem

`execute_js` is an escape hatch that lets the model run arbitrary JavaScript. This is powerful but hard to audit, and the model overuses it for tasks that should have dedicated tools with clear semantics.

### Improvements

Add focused tools replacing common `execute_js` patterns:

| New Tool          | What It Does                                     | Replaces                              |
| ----------------- | ------------------------------------------------ | ------------------------------------- |
| `fill_input`      | Set value on input/textarea by selector or label | `execute_js` with `.value = ...`      |
| `select_option`   | Choose option in `<select>` by value or text     | `execute_js` with `.selectedIndex`    |
| `toggle_checkbox` | Check/uncheck a checkbox or radio                | `execute_js` with `.checked = ...`    |
| `submit_form`     | Submit a form by selector                        | `execute_js` with `.submit()`         |
| `scroll_to`       | Scroll element into view                         | `execute_js` with `.scrollIntoView()` |
| `find_text`       | Search for text on page, return location         | `get_page_context` + model reasoning  |
| `extract_table`   | Extract table data as structured JSON            | `execute_js` with DOM traversal       |

**Implementation per tool:**

- Each uses `chrome.scripting.executeScript` with a focused, auditable function
- Each has typed Zod input schemas (not arbitrary code strings)
- Each returns structured `ToolOutcome` with clear success/failure semantics

**`execute_js` as last-resort fallback:**

- `execute_js` stays available for edge cases the narrow tools can't handle
- The system prompt instructs the model to prefer narrow tools first and only fall back to `execute_js` when none of the specific tools can accomplish the task
- This gives the model an escape hatch while still nudging it toward the safer, auditable tools for common operations

**Files to modify:**

- `packages/extension/src/lib/tools.ts` — Add new tool definitions
- `packages/extension/src/lib/prompts.ts` — Update tool descriptions, add preference ordering

---

## 8. Self-Healing Interaction Strategies

### Problem

When a click fails (element not found, selector stale), the model gets a generic error and must reason from scratch about an alternative. This wastes tokens and often fails again.

### Improvements

**Where:** New file `packages/extension/src/lib/interaction-resolver.ts`

Build a fallback chain into the `click` tool itself:

```
1. Click by text content match (most robust across page changes)
2. Click by aria-label / button role
3. Click by CSS selector
4. Scroll into view, then retry
5. If ambiguous (multiple matches), emit clarify with candidates
```

Each step is tried automatically before surfacing failure to the model. The tool returns the strategy that succeeded:

```typescript
// Success response includes which strategy worked
{ status: 'success', data: { strategy: 'text_match', element: 'Submit Order' } }
```

Same approach for `fill_input`, `select_option`, etc. — try by label text first, then by selector, then by position.

**Files to create:**

- `packages/extension/src/lib/interaction-resolver.ts`

**Files to modify:**

- `packages/extension/src/lib/tools.ts` — `click` and new tools use the resolver

---

# Phase 4: Streaming, State, and UX

## 9. Streaming Event Model

### Problem

Current streaming is mostly message forwarding. The user sees a spinner until the entire response completes. There's no visibility into what the agent is doing.

### Improvements

#### 9.1 Granular Event Types

```typescript
type StreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "thinking"; content: string }
  | { type: "context_capture_started" }
  | { type: "context_capture_finished"; elements: number }
  | { type: "tool_running"; tool: string; description: string }
  | { type: "tool_finished"; tool: string; status: string }
  | { type: "recovery_retry"; attempt: number; reason: string }
  | { type: "navigation_resume_pending" }
  | { type: "complete"; finalText: string }
  | { type: "error"; error: string; retrying: boolean };
```

**UI mapping:**

- `text_delta` → Typewriter animation
- `tool_running` → Status pill: "Clicking button..."
- `tool_finished` → Flash pill green, then fade
- `recovery_retry` → "Retrying..." toast
- `error` with `retrying: true` → Suppress error, show retry indicator

#### 9.2 Overlapping Tool Execution

Execute tools as they arrive during streaming (don't wait for full response):

```typescript
for await (const part of stream) {
  if (part.type === "tool-call" && isComplete(part)) {
    pendingExecutions.push(executeTool(part));
  }
}
const results = await Promise.all(pendingExecutions);
```

**Files to modify:**

- `packages/extension/src/entrypoints/handlers/query.ts` — Emit granular events
- `packages/extension/src/entrypoints/content/GyozaiWidget.tsx` — Handle each event type

---

## 10. State Management Overhaul

### Problem

State scattered across 4 storage layers with ~15 `useState` calls in `GyozaiWidget.tsx`. Race conditions between independent storage writes.

### Improvements

#### 10.1 Centralized Store

```typescript
type WidgetState = {
  // UI
  expanded: boolean;
  viewMode: "chat" | "history";
  input: string;
  // Conversation
  activeConvId: string | null;
  messages: Message[];
  loading: boolean;
  error: string | null;
  // Clarify
  clarifyQuestion: string | null;
  clarifyOptions: string[];
  // Avatar
  expression: Expression;
  avatarPosition: AvatarPosition;
};
```

Centralized side effects via `onStateChange()` — one choke point for all storage writes. React integration via `useSyncExternalStore` with selector-based subscriptions.

Split `GyozaiWidget` into sub-components:

- `<AvatarBubble>` — expression, expanded, avatarPosition
- `<ChatPanel>` — messages, loading, error
- `<InputBar>` — input, loading
- `<HistoryView>` — viewMode

**Files to create:**

- `packages/extension/src/store.ts`

**Files to modify:**

- `packages/extension/src/entrypoints/content/GyozaiWidget.tsx` — Replace `useState` calls

---

## 11. Structured Decision Cards

### Problem

The current `clarify` flow shows plain text bubbles with clickable options. This is functional but doesn't communicate context or trade-offs well.

### Improvements

Replace plain clarify bubbles with structured decision cards:

```typescript
type DecisionCard = {
  type: "clarify" | "ambiguity";
  title: string;
  description: string;
  options: {
    label: string;
    description?: string;
    recommended?: boolean;
  }[];
  context?: {
    element?: string; // What element triggered this
    pageSection?: string; // Where on the page
    evidence?: string; // What the AI found
  };
};
```

**Examples:**

- "I found 3 matching Install buttons" → card with element previews
- "I can translate only visible content or the whole page" → card with trade-off descriptions
- "This form has 2 submit buttons — which one?" → card with location context

**Files to create:**

- `packages/extension/src/components/DecisionCard.tsx`

**Files to modify:**

- `packages/extension/src/lib/tools.ts` — `clarify` tool returns `DecisionCard` format
- `packages/extension/src/entrypoints/content/GyozaiWidget.tsx` — Render decision cards

---

# Phase 5: Session, History, and Performance

## 12. Session Persistence

### Improvements

#### 12.1 Append-Only Transcript Recording

Before every LLM query, append user message to transcript log. After every response, append assistant + tool results. On crash, reconstruct from transcript (source of truth).

#### 12.2 Debounced Session Save

Replace immediate `useEffect` save with debounced writer (300ms). Flush on `beforeunload`/`visibilitychange`. Use `navigator.locks.request()` to prevent concurrent writes.

**Files to create:**

- `packages/extension/src/lib/transcript.ts`

**Files to modify:**

- `packages/extension/src/lib/session.ts` — Debounced writer

---

## 13. Performance Optimizations

### Improvements

#### 13.1 Cached Page Context with Hash Invalidation

Expand 2-second TTL to hash-based cache. Use `MutationObserver` for proactive invalidation. Cache invalidation on: navigation, form submit, click (delayed 500ms), explicit tool call.

#### 13.2 Progressive HTML Stripping

When HTML too large for token budget, progressively strip:

1. `data-*` attributes → 2. inline `style` → 3. depth > 8 → 4. hidden elements → 5. duplicate text blocks → 6. whitespace nodes → 7. non-interactive elements only

**Files to modify:**

- `packages/engine/src/page-context.ts` — Hash cache + `stripToFit()`
- `packages/extension/src/entrypoints/content/index.tsx` — MutationObserver

---

# Phase 6: Extensibility

## 14. Recipe System with Playbooks

### Problem

Recipes are static text blobs. No versioning, no conditional activation, and no way to describe multi-step task workflows within the recipe format.

### Improvements

#### 14.1 Recipe Frontmatter

Add optional YAML frontmatter (inspired by Claude Code skills):

```yaml
---
name: GitHub PR Review Helper
version: 1.0.0
domain: github.com
routes: ["/*/pull/*"]
capabilities: [click, executeJs, navigate]
model: claude-haiku-4-5-20251001
maxSteps: 5
---
```

Route-specific activation, capability restriction, model hints.

#### 14.2 Playbook Section Within Recipes

Playbooks are not a separate concept — they're a new section within the recipe format. A recipe can optionally include a `## Playbooks` section that defines reusable multi-step task scripts for common workflows on that site:

```markdown
---
name: Stripe Dashboard Helper
domain: dashboard.stripe.com
---

You are helping the user navigate the Stripe dashboard...

## Playbooks

### Download Invoice

1. Navigate to Billing > Invoices
2. Find the target invoice by date
3. Click the "..." menu on that row
4. Click "Download PDF"

### Cancel Subscription

1. Navigate to Customers > [customer]
2. Find the active subscription
3. Click "Cancel subscription"
4. Select cancellation reason
5. Confirm cancellation
```

**How it works:**

- The playbook section is included in the system prompt when the recipe is active
- The model uses the playbook as a step-by-step guide when the user's request matches a playbook's purpose
- Playbooks can be auto-generated: after a successful multi-step task, the model proposes a playbook distilled from the session, and the user can save it into the recipe

**Files to modify:**

- `packages/extension/src/lib/recipes.ts` — Parse frontmatter, recognize playbook sections
- `packages/extension/src/lib/prompts.ts` — Inject playbook context when recipe is active

---

## 15. Token Counting Utility

**Where:** New file `packages/engine/src/token-count.ts`

Fast approximate counter: `Math.ceil(text.length / 4)` for English, `/2` for CJK-heavy. Used by conversation compaction (4.3) to decide when to trigger summarization.

**Files to create:**

- `packages/engine/src/token-count.ts`

---

# Phase 7: New Product Capabilities

## 16. Browser Memory

Remember stable user/browser preferences across sites:

```typescript
type BrowserMemory = {
  preferences: { key: string; value: string; source: string }[];
  // Examples:
  // { key: 'language', value: 'en', source: 'user-stated' }
  // { key: 'shipping_country', value: 'JP', source: 'inferred-from-usage' }
  // { key: 'price_comparison', value: 'always_annual_vs_monthly', source: 'pattern' }
};
```

- Stored in `chrome.storage.local` — survives sessions
- Injected into system prompt as lightweight context
- User can view/edit/delete via settings popup
- AI can propose new memories: "I noticed you always choose annual — should I remember that?"

**Files to create:**

- `packages/extension/src/lib/browser-memory.ts`

**Files to modify:**

- `packages/extension/src/lib/prompts.ts` — Inject memory into system prompt
- `packages/extension/src/lib/storage.ts` — Memory persistence

---

## 17. Page Watchers

Ask Gyozai to watch for a condition and notify when it changes:

**Examples:**

- Ticket sales open
- Item restocked
- Visa appointment slot appears
- Build status changes in dashboard
- Error message disappears after retry

**Implementation:**

- User describes condition in natural language
- Engine translates to a `MutationObserver` + polling check
- Runs in background service worker with periodic `chrome.scripting.executeScript`
- Notification via `chrome.notifications` when condition met
- Stored as persistent watchers in `chrome.storage.local`

**Files to create:**

- `packages/extension/src/lib/page-watcher.ts`
- `packages/extension/src/entrypoints/handlers/watchers.ts`

---

# Phase 8: Testing & Observability

## 18. Testing & Observability

### Improvements

#### 18.1 Tool Execution Tests

Test each tool in isolation with mock `chrome.scripting.executeScript`. Test success/failure paths, concurrency flags, result truncation.

#### 18.2 QueryEngine Unit Tests

With QueryEngine extracted, test without Chrome APIs:

- Mock provider returns controlled responses
- Test retry logic, compaction triggers, tool outcome handling
- Test resource exhaustion detection
- Test task memory updates

#### 18.3 Structured Error Logging

Replace scattered `console.log` with structured logger:

```typescript
const logger = {
  debug(category: Category, message: string, data?: Record<string, unknown>) { ... },
  info(...) { ... },
  warn(...) { ... },
  error(...) { ... },
};
```

- Categories: `query`, `tool`, `storage`, `provider`, `session`
- Store last 100 errors in `chrome.storage.local`
- Hidden debug panel (triple-tap avatar) showing recent logs + tool traces + prompt snapshots

#### 18.4 Outcome-Oriented Analytics

Log browser-task outcomes, not just model/provider stats:

| Metric                    | What it tells you          |
| ------------------------- | -------------------------- |
| `task_completed`          | Success rate               |
| `task_blocked_ambiguity`  | Needs better clarify UI    |
| `recovered_after_failure` | Self-healing effectiveness |
| `required_clarification`  | Model confidence issues    |
| `user_abandoned`          | UX friction                |

**Files to create:**

- `packages/extension/src/lib/logger.ts`
- `packages/extension/src/lib/analytics.ts`
- `packages/extension/src/tools.test.ts`
- `packages/engine/src/query-engine.test.ts`

---

# Deferred

Items worth building later but not prioritized now.

## Deferred: Plan Mode for Browser Tasks

A "plan first" interaction mode where Gyozai inspects the site, proposes steps, and waits for approval before acting. Useful for checkout, banking, job applications. Depends on QueryEngine (1) and task templates (3.2).

## Deferred: Task Checklists & Progress Tracking

Visible checklist for multi-step browser tasks with real-time status (`pending | running | blocked | done`). Depends on centralized store (10) and task memory (6).

---

## Implementation Priority

| Priority | Section                                           | Effort     | Impact                                                |
| -------- | ------------------------------------------------- | ---------- | ----------------------------------------------------- |
| **1**    | **1. Extract QueryEngine**                        | **Medium** | **Critical — prerequisite for everything**            |
| **2**    | **2. Tool registry + structured outcomes**        | **Medium** | **High — enables narrow tools, self-healing**         |
| **3**    | **3. Prompt rules → runtime code**                | **Small**  | **High — reduces prompt bloat, improves reliability** |
| 4        | 5.1 Retry state machine                           | Small      | High — eliminates user-visible errors                 |
| 5        | 5.2 BYOK resource exhaustion handling             | Small      | High — critical for BYOK users                        |
| 6        | 9.1 Granular streaming events                     | Medium     | High — dramatically better UX                         |
| 7        | 10.1 Centralized store                            | Medium     | High — eliminates state bugs                          |
| 8        | 4.1 Freshness-aware context levels                | Medium     | High — biggest token savings                          |
| 9        | 7. Narrow interaction tools + execute_js fallback | Medium     | High — safer, more reliable actions                   |
| 10       | 8. Self-healing strategies                        | Medium     | High — "it actually works on messy sites"             |
| 11       | 4.3 Conversation compaction                       | Medium     | High — enables longer tasks                           |
| 12       | 11. Structured decision cards                     | Small      | Medium — better clarify UX                            |
| 13       | 18.3 Structured logging                           | Small      | Medium — improves debuggability                       |
| 14       | 6. Structured task memory                         | Medium     | Medium — enables multi-page tasks                     |
| 15       | 14.1 Recipe frontmatter                           | Medium     | Medium — better extensibility                         |
| 16       | 14.2 Playbook sections in recipes                 | Small      | Medium — reusable task scripts                        |
| 17       | 16. Browser memory                                | Medium     | Medium — personalization                              |
| 18       | 13.1 Cached page context                          | Small      | Medium — performance                                  |
| 19       | 5.4 Provider fallback                             | Small      | Low-Medium                                            |
| 20       | 17. Page watchers                                 | Large      | Medium — product differentiator                       |
| 21       | 13.2 Progressive HTML stripping                   | Medium     | Low-Medium                                            |
| 22       | 12.1 Transcript recording                         | Small      | Low                                                   |
| 23       | 15. Token counting                                | Small      | Low                                                   |
| 24       | 9.2 Overlapping tool execution                    | Medium     | Low-Medium                                            |
| 25       | 5.3 Streaming failure recovery                    | Medium     | Low                                                   |
| 26       | 2.3 Concurrent tool execution                     | Medium     | Low                                                   |
| 27       | 18.1-18.2 Tests                                   | Medium     | Low (quality investment)                              |
| 28       | 12.2 Debounced session save                       | Small      | Low                                                   |
| 29       | 4.4 Microcompaction                               | Small      | Low                                                   |
| 30       | 18.4 Outcome analytics                            | Small      | Low                                                   |
| 31       | 1.3 Deprecate legacy createEngine                 | Small      | Low (cleanup)                                         |

---

## Dependencies

```
1. QueryEngine ─────────────────┬──→ 2. Tool Registry (structured outcomes)
(FOUNDATION)                    ├──→ 3. Prompt-to-Code (engine post-processing)
                                ├──→ 4. Context Management (context manager)
                                ├──→ 5. Error Recovery (retry in engine)
                                ├──→ 6. Task Memory (engine updates it)
                                ├──→ 9. Streaming Events (engine emits them)
                                └──→ 18. Testing (engine is testable)

2. Tool Registry ───────────────┬──→ 7. Narrow Tools (implement BrowserTool)
                                ├──→ 8. Self-Healing (tool-level fallback chains)
                                └──→ 2.3 Concurrent Execution

10. Centralized Store ──────────┬──→ 12.2 Debounced Session Save
                                └──→ 11. Decision Cards (store pending decision)

15. Token Counting ─────────────→ 4.3 Conversation Compaction

6. Task Memory ─────────────────→ 16. Browser Memory (similar persistence pattern)
```

---

## What NOT to Build

These are powerful in Claude Code, but wrong or premature for a browser copilot:

- **Permission/policy system** — not needed now; keep the existing `yoloMode` boolean
- **MCP as an integration surface** — stay browser-native
- **Multi-agent swarms** — one agent per tab is correct
- **LSP/git/project-aware context** — not a dev tool
- **Giant command systems** — natural language is the interface
- **Bun feature-flag dead-code elimination** — over-engineering at this scale
- **Full memory consolidation/dreaming** — browser memory (section 16) is sufficient
- **Provider capability registry** — premature; hardcode what's needed until provider count grows
- **Per-query cost display** — nice-to-have but not essential; focus on resource exhaustion handling instead

The product risk is becoming an over-general agent framework instead of a precise website copilot.

---

_Synthesized from Claude Code architecture patterns and browser-specific product analysis. Each section is self-contained. Start with Phase 1 — it unlocks everything else._
