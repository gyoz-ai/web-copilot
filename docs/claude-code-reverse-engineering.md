# Reverse-Engineering Claude Code: A Deep Dive into Anthropic's AI-Powered CLI

> An exhaustive technical analysis of the architecture, systems, and engineering behind Claude Code — Anthropic's flagship developer tool.
>
> March 31, 2026 · 59 min read · architecture

## Table of Contents

- [Introduction: What is Claude Code?](#1-introduction-what-is-claude-code)
- [High-Level Architecture](#2-high-level-architecture)
- [Startup: The Race Against Time](#3-startup-the-race-against-time)
- [The Query Engine: Brains of the Operation](#4-the-query-engine-brains-of-the-operation)
- [The Tool System: 60+ Tools Behind a Single Interface](#5-the-tool-system-60-tools-behind-a-single-interface)
- [The Permission System: Safety at Every Layer](#6-the-permission-system-safety-at-every-layer)
- [Terminal UI: React, but for Your Terminal](#7-terminal-ui-react-but-for-your-terminal)
- [The Command System: 100+ Slash Commands](#8-the-command-system-100-slash-commands)
- [Skills, Plugins, and MCP: The Extensibility Trifecta](#9-skills-plugins-and-mcp-the-extensibility-trifecta)
- [Context Management: Fighting the Token Limit](#10-context-management-fighting-the-token-limit)
- [State Management: Immutable Store for a Mutable World](#11-state-management-immutable-store-for-a-mutable-world)
- [Session Persistence and History](#12-session-persistence-and-history)
- [Multi-Agent Architecture: Subagents, Swarms, and Worktrees](#13-multi-agent-architecture-subagents-swarms-and-worktrees)
- [Error Recovery: A System That Refuses to Crash](#14-error-recovery-a-system-that-refuses-to-crash)
- [Cost Tracking and Telemetry](#15-cost-tracking-and-telemetry)
- [Execution Modes: One Codebase, Many Faces](#16-execution-modes-one-codebase-many-faces)
- [BUDDY: A Tamagotchi-Style AI Pet](#17-buddy-a-tamagotchi-style-ai-pet)
- [KAIROS: Persistent Assistant Mode and Auto-Dreaming](#18-kairos-persistent-assistant-mode-and-auto-dreaming)
- [ULTRAPLAN: Remote Planning Sessions](#19-ultraplan-remote-planning-sessions)
- [Coordinator Mode: Multi-Agent Orchestrator](#20-coordinator-mode-multi-agent-orchestrator)
- [The Memory System: Persistent AI Memory](#21-the-memory-system-persistent-ai-memory)
- [Hooks: User-Defined Automation](#22-hooks-user-defined-automation)
- [Voice Mode, Bridge, and Infrastructure](#23-voice-mode-bridge-and-infrastructure)
- [Vim Mode, Keybindings, and Developer Ergonomics](#24-vim-mode-keybindings-and-developer-ergonomics)
- [Key Engineering Patterns and Takeaways](#25-key-engineering-patterns-and-takeaways)
- [Conclusion](#26-conclusion)

---

## 1. Introduction: What is Claude Code?

Claude Code is Anthropic's official CLI tool — an interactive, AI-powered development assistant that lives in your terminal. It lets developers have natural-language conversations with Claude to edit files, run shell commands, search codebases, manage Git workflows, create pull requests, debug issues, and much more.

But underneath the conversational interface lies a remarkably sophisticated piece of software engineering: a custom React-based terminal renderer, a multi-layered permission system, an elastic tool discovery mechanism, a self-healing query loop with automatic context compression, and an extensibility framework spanning skills, plugins, and the Model Context Protocol (MCP).

This article is a deep technical analysis of the Claude Code source code — approximately 330+ utility files, 45+ tool implementations, 100+ slash commands, 146 UI components, and a custom terminal rendering framework — all written in TypeScript with React, running on Bun.

Let's take it apart, piece by piece.

---

## 2. High-Level Architecture

Claude Code follows a layered architecture where each layer has clear responsibilities.

### Tech Stack

| Layer         | Technology                               |
| ------------- | ---------------------------------------- |
| Language      | TypeScript (strict mode)                 |
| Runtime       | Bun (with Node.js 18+ compatibility)     |
| UI Framework  | React 18 with custom terminal reconciler |
| Layout Engine | Yoga (Facebook's flexbox implementation) |
| API Client    | @anthropic-ai/sdk                        |
| Extensibility | Model Context Protocol (MCP) SDK         |
| Validation    | Zod (schema-driven I/O for all tools)    |
| CLI Framework | Commander.js                             |
| Linting       | Biome + ESLint                           |

### Directory Structure

```
src/
├── main.tsx                 # Application entry (~800KB, bootstraps everything)
├── QueryEngine.ts           # Conversation management & API orchestration
├── query.ts                 # Query loop state machine (retries, compaction, recovery)
├── Tool.ts                  # Unified tool interface (generic over Input/Output/Progress)
├── tools.ts                 # Tool registry with feature-gated loading
├── commands.ts              # Command registry with lazy dispatch
├── context.ts               # System/user context builder (git, CLAUDE.md, date)
├── cost-tracker.ts          # Per-model usage accumulation and display
├── history.ts               # Session history (JSONL, dedup, paste refs)
├── setup.ts                 # Pre-action configuration and auth
├── entrypoints/             # CLI, SDK, MCP entry points
├── tools/                   # 45+ tool implementations (Bash, FileRead, Agent, etc.)
├── commands/                # 100+ slash command implementations
├── components/              # 146 React terminal components
├── ink/                     # Custom terminal rendering framework (~90 files)
├── services/                # API, analytics, MCP, compact, plugins
├── hooks/                   # 85+ hook implementations
├── state/                   # AppState store (Zustand-like)
├── utils/                   # 330+ utilities (git, config, permissions, etc.)
├── skills/                  # Skill loading, bundled skills
├── keybindings/             # Dynamic keybinding system
├── vim/                     # Full vi/vim mode
├── bridge/                  # CCR bridge (WebSocket to claude.ai)
├── coordinator/             # Multi-agent coordination
├── remote/                  # Remote session management
├── tasks/                   # Background task system
├── migrations/              # Versioned data migrations
└── types/                   # Shared type definitions
```

---

## 3. Startup: The Race Against Time

Claude Code's startup is aggressively optimized. The goal: minimize time-to-first-render so the developer is never left staring at a blank terminal.

### 3.1 Parallelized Prefetching

Before any module imports happen, three critical operations fire in parallel:

```typescript
// main.tsx — lines 1-20, before any other imports
profileCheckpoint("main_tsx_entry");
startMdmRawRead(); // macOS MDM policy read (subprocess)
startKeychainPrefetch(); // OAuth + API key keychain reads (2 subprocesses)
```

This exploits a clever insight: TypeScript module evaluation takes ~135ms anyway (sequential by nature). By spawning subprocesses immediately, macOS keychain reads (~65ms total) run entirely in parallel with import resolution, becoming effectively free.

### 3.2 Initialization Sequence

The `init()` function (memoized to prevent re-entrancy) orchestrates 16 setup stages:

1. Config validation — Parse and validate all JSON config files
2. Safe environment variables — Apply non-sensitive env vars before trust dialog
3. CA certificates — Load extra root CAs before first TLS handshake
4. Graceful shutdown handlers — Register SIGINT/SIGTERM handlers
5. OAuth population — Async account info fetch
6. IDE detection — JetBrains, VS Code identification
7. Remote settings — Fetch managed settings from server (async, awaited later)
8. Policy limits — Load org-enforced limits (async)
9. First-start timestamp — Analytics marker
10. mTLS configuration — Client certificate setup
11. Proxy agents — Configure HTTP/HTTPS proxies
12. API preconnection — TCP+TLS handshake overlaps with remaining init
13. Upstream proxy (CCR) — CONNECT relay for organization credentials
14. Shell detection — Windows-specific shell resolution
15. LSP manager — Language Server Protocol cleanup handlers
16. Team cleanup — Multi-agent swarm cleanup on shutdown

### 3.3 Fast Paths

Before full initialization, fast paths handle quick-exit commands:

- `--version` — Print version and exit (no init, no React)
- `--dump-system-prompt` — Output the system prompt and exit
- `mcp serve` — Start MCP server mode (different init path)

### 3.4 Startup Profiling

A sampled profiler (`startupProfiler.ts`) measures every phase:

- 100% of internal builds get sampled
- 0.5% of external users are sampled
- `CLAUDE_CODE_PROFILE_STARTUP=1` forces full profiling with memory snapshots

The decision is made once at module load time — non-sampled users pay zero profiling overhead.

### 3.5 Entrypoint Resolution

The system identifies its execution context early and sets `CLAUDE_CODE_ENTRYPOINT`:

| Value                     | Context                             |
| ------------------------- | ----------------------------------- |
| cli                       | Interactive terminal session        |
| sdk-cli                   | Non-interactive (print mode, piped) |
| mcp                       | Running as an MCP server            |
| local-agent               | Spawned as a subagent               |
| claude-code-github-action | GitHub Actions CI                   |

This gates feature loading — for example, REPL components only load in interactive mode.

---

## 4. The Query Engine: Brains of the Operation

The query engine is the core loop that manages conversations with Claude. It's split across two files: `QueryEngine.ts` (session-level orchestration) and `query.ts` (per-turn state machine).

### 4.1 QueryEngine: The Session Coordinator

The `QueryEngine` class is a singleton per conversation. It persists state across turns and coordinates:

- System context building (git status, CLAUDE.md files, date)
- Message management (accumulation, normalization, persistence)
- API calls (streaming, retries, fallback)
- Permission tracking (denial counts for SDK reporting)
- Cost accumulation (per-model token tracking)

Key method: `submitMessage(prompt, options)` — an AsyncGenerator that yields SDK messages throughout the turn. Before entering the query loop, it:

1. Creates a file history snapshot (for undo/restore)
2. Records the transcript to disk before the API call (even if the process is killed mid-request, the conversation is resumable)
3. Wraps `canUseTool` to track permission denials

### 4.2 The Query Loop: A Resilient State Machine

The `query()` function in `query.ts` is where the magic happens. It's a `while(true)` loop managing a mutable state object:

```
queryLoop():
  while(true):
    1. Prefetch memory + skills (parallel)
    2. Apply message compaction (snip, microcompact, context collapse)
    3. Call API with streaming
    4. Handle streaming errors (fallback, retry)
    5. Execute tools (concurrent or serial)
    6. Check recovery paths (compact, collapse drain, token escalation)
    7. Continue loop or return
```

The state object tracks everything needed across iterations:

```typescript
type State = {
  messages: Message[]
  toolUseContext: ToolAvailabilityContext
  maxOutputTokensRecoveryCount: number  // 0–3 limit
  autoCompactTracking: CompactState     // Compaction state + failure count
  pendingToolUseSummary: Promise<...>   // Async tool summaries
  transition: TransitionReason          // Why the loop didn't terminate
}
```

### 4.3 Streaming and Tool Execution

The query loop streams API responses and processes them incrementally:

1. **Stream start** — Yields `stream_request_start` event
2. **Accumulation** — Collects `assistantMessages`, `toolUseBlocks`, `toolResults`
3. **Usage tracking** — Tracks `currentMessageUsage` and `lastStopReason`
4. **Tool dispatch** — Routes tool calls to the orchestrator

Tool execution uses a sophisticated concurrency model:

```
partitionToolCalls(blocks[]):
  ├─ Batch 1: Read-only tools A, B, C  → runConcurrently(max=10)
  ├─ Batch 2: Write tool D              → runSerially()
  ├─ Batch 3: Read-only tools E, F      → runConcurrently(max=10)
  └─ ...
```

Each tool's `isConcurrencySafe()` method determines if it can run in parallel. Read-only tools (glob, grep, file reads) run concurrently; write tools (edits, bash with side effects) run serially with context propagation between batches.

A streaming tool executor can even begin executing tools while the model is still streaming, reducing latency by overlapping computation and I/O.

### 4.4 Token Budget Continuation

When the model's output budget is approaching exhaustion but the task isn't complete, the engine:

1. Injects an invisible meta-message: "Resume directly — no apology, no recap"
2. Continues the loop with a `token_budget_continuation` transition
3. Tracks cumulative tokens without interrupting the user
4. Detects diminishing returns to avoid infinite loops

Maximum 3 consecutive output-token recovery attempts before surfacing the stop reason.

---

## 5. The Tool System: 60+ Tools Behind a Single Interface

Every tool in Claude Code conforms to a single generic interface:

```typescript
interface Tool<Input, Output, Progress> {
  name: string;
  description(): string; // Dynamic, permission-context-aware
  prompt(): string; // System prompt additions
  inputSchema: ZodSchema<Input>; // Zod → JSON Schema for API

  call(input: Input, context: ToolContext): Promise<ToolResult<Output>>;
  checkPermissions(input: Input): PermissionResult;
  validateInput(input: Input): ValidationResult;
  isConcurrencySafe(input: Input): boolean;

  // 4-tier rendering
  renderToolUseMessage(input: Input): ReactNode;
  renderToolUseProgressMessage(input: Input, progress: Progress): ReactNode;
  renderToolResultMessage(output: Output): ReactNode;
  renderToolUseErrorMessage(error: Error): ReactNode;

  mapToolResultToToolResultBlockParam(
    output: Output,
    id: string,
  ): ToolResultBlockParam;
}
```

### 5.1 The Tool Registry

Tools are loaded through a feature-gated registry:

```
assembleToolPool(permissionContext, mcpTools):
  1. getTools(permissionContext)        // Filter built-ins by deny rules
  2. filterToolsByDenyRules()           // Remove blanket-denied MCP tools
  3. uniqBy(name)                       // Deduplicate (built-ins win)
  4. sort(name)                         // Alphabetical for prompt cache stability
```

Sorting by name is a subtle but important optimization: it keeps the tool list in the same order across requests, maximizing prompt cache hit rates on the API side.

### 5.2 Deferred Tool Discovery

Not all 60+ tools are sent to the model in every request. Tools marked `shouldDefer: true` are hidden until the model explicitly searches for them via `ToolSearchTool`:

```
Model: "I need to create a task..."
  → Calls ToolSearchTool("task create")
  → Returns TaskCreateTool schema
  → Model calls TaskCreateTool in the same turn
```

~18 tools are deferred: LSP, TaskCreate, MCPTool, SkillTool, EnterPlanMode, etc. This keeps the base prompt under 200K tokens while allowing elastic discovery.

### 5.3 Key Tool Implementations

#### BashTool — Command Execution with Guardrails

The most frequently used tool runs shell commands with extensive safety:

- **30K character result limit** — Large outputs persist to disk with a preview
- **Sandbox awareness** — Detects containerized vs. native execution
- **Background tasks** — Auto-backgrounds commands exceeding 15 seconds
- **Search classification** — Marks `ls`, `grep`, `cat` output as collapsible in the UI
- **Permission dialogs** — `sed` edits show a preview before execution

#### FileEditTool — Precision String Replacement

Rather than rewriting entire files, the edit tool does surgical string replacement:

- **Old/new string matching** — Finds exact occurrences, replaces one or all
- **1 GiB size limit** — Prevents OOM on massive files
- **Git-aware diffing** — Shows before/after diff via `gitDiff()`
- **Undo integration** — Plugs into FileHistory for one-click undo

#### AgentTool — Subagent Spawning

Claude Code can spawn child agents for parallel work:

- **Isolation modes** — Worktree (isolated git branch) or remote (CCR)
- **Model selection** — Override with `opus | sonnet | haiku`
- **Background execution** — Agents run async with notification on completion
- **Named addressing** — SendMessage to named agents for multi-agent coordination
- **Permission inheritance** — Child agents inherit or restrict parent permissions

#### GrepTool — Content Search (Ripgrep Wrapper)

Wraps `rg` with sensible defaults for LLM use:

- **250-line default limit** — Prevents context flooding
- **Multiline mode** — `rg -U --multiline-dotall` for cross-line patterns
- **VCS exclusion** — Auto-skips `.git`, `.svn`, `.hg`
- **Three output modes** — Content, file paths only, or match counts

#### LSPTool — Language Intelligence

9 operations powered by Language Server Protocol:

- `goToDefinition`, `findReferences`, `hover`
- `documentSymbol`, `workspaceSymbol`
- `goToImplementation`, `prepareCallHierarchy`
- `incomingCalls`, `outgoingCalls`

Only loaded when an LSP server is connected. Deferred by default.

#### WebSearchTool — Native Web Search

Server-side web search (beta feature):

- Max 8 searches per invocation
- Domain filtering — `allowed_domains` and `blocked_domains` parameters
- Streaming results — Interleaves text and citation blocks

### 5.4 Tool Result Budgeting

Every tool has a `maxResultSizeChars` limit:

| Tool         | Limit                     |
| ------------ | ------------------------- |
| BashTool     | 30,000 chars              |
| GrepTool     | 20,000 chars              |
| FileReadTool | Infinity (never persists) |

When output exceeds the limit, it's saved to `~/.claude/tool-results/{uuid}/output.txt` and the model receives a preview with a file reference. FileReadTool is exempt because persisting its output would create a circular dependency (Read → persist → model reads persisted file → …).

### 5.5 Lazy Schemas

Tool input schemas use a `lazySchema()` factory that defers Zod instantiation:

```typescript
const schema = lazySchema(() =>
  z.object({
    command: z.string(),
    timeout: z.number().optional(),
  }),
);
```

This prevents circular import cycles (`Tool.ts ← tools/ ← Tool.ts`) and enables mid-session schema changes when feature flags flip.

---

## 6. The Permission System: Safety at Every Layer

Claude Code's permission system is one of its most sophisticated subsystems — a multi-layered defense that balances safety with developer productivity.

### 6.1 Permission Modes

Five public modes control the default behavior:

| Mode              | Behavior                                   |
| ----------------- | ------------------------------------------ |
| default           | Ask for destructive operations             |
| plan              | Read-only + AskUserQuestion (design phase) |
| acceptEdits       | Auto-approve file edits, ask for shell     |
| bypassPermissions | Full access (dangerous, opt-in)            |
| dontAsk           | Auto-deny unsafe commands                  |

Plus two internal modes:

- **auto** — ML classifier evaluates each command
- **bubble** — Internal delegation to parent agent

### 6.2 Rule System

Permission rules form a priority cascade:

```typescript
type PermissionRule = {
  source:
    | "userSettings"
    | "projectSettings"
    | "localSettings"
    | "cliArg"
    | "session";
  ruleBehavior: "allow" | "deny" | "ask";
  ruleValue: { toolName: string; ruleContent?: string };
};
```

Rules support glob patterns: `Bash(git push*)` allows any git push command, `Bash(python:*)` allows all Python commands.

### 6.3 Decision Pipeline

For every tool call:

```
1. validateInput()        → Tool-specific validation (size limits, blocked patterns)
2. checkPermissions()     → Rule matching + classifier + hooks
3. Decision:
   ├─ allow  → Execute immediately
   ├─ deny   → Return error to model
   └─ ask    → Show permission dialog to user
4. Pre/Post hooks         → Can modify input or block execution
```

### 6.4 Dangerous Pattern Detection

The system identifies permission rules that are too broad to auto-allow:

- **Tool-level allow** (no content restriction) — Would allow ALL commands
- **Interpreter prefixes** — `python:*`, `node:*`, `ruby:*` (arbitrary code execution)
- **Wildcards** — `*`, `python*` (too permissive)

### 6.5 Three-Way Permission Result

Every permission check returns a typed union:

```typescript
type PermissionResult =
  | { behavior: "allow"; updatedInput?: Input } // Hooks can modify input
  | { behavior: "ask"; message: string } // Prompt user
  | { behavior: "deny"; message: string }; // Block with explanation
```

The `updatedInput` field is powerful: pre-execution hooks can transparently modify tool parameters (e.g., adding safety flags to shell commands).

---

## 7. Terminal UI: React, but for Your Terminal

Perhaps the most impressive subsystem in Claude Code is its custom terminal rendering framework — a complete reimplementation of React rendering for terminal environments, rivaling web browsers in sophistication.

### 7.1 The Rendering Pipeline

```
React Components
    ↓
Custom React Reconciler (createReconciler API)
    ↓
Virtual DOM Tree (ink-box, ink-text, ink-root, ink-link)
    ↓
Yoga Layout Engine (flexbox calculations)
    ↓
Output Builder (write / blit / clip / clear / shift operations)
    ↓
Screen Buffer (2D cell array with interned styles + hyperlinks)
    ↓
Diff Engine (compare with previous frame)
    ↓
ANSI Escape Sequences → TTY
```

### 7.2 Custom React Reconciler

Claude Code implements a custom React host configuration using `createReconciler`:

**Element types:**

- `ink-root` — Root container
- `ink-box` — Flexbox layout container (like `<div>`)
- `ink-text` — Text content
- `ink-virtual-text` — Nested text (layout optimization)
- `ink-link` — OSC 8 hyperlinks
- `ink-progress` — Progress indicators
- `ink-raw-ansi` — Raw ANSI passthrough (bypasses measurement)

The reconciler tracks three categories of changes separately:

1. **Styles** — Passed to Yoga for layout recalculation
2. **Text styles** — Colorization, bold, italic, etc.
3. **Event handlers** — Stored separately to prevent handler identity changes from invalidating the dirty flag

### 7.3 Yoga Layout Engine

Rather than manual ANSI cursor positioning, Claude Code uses Yoga — Facebook's cross-platform flexbox implementation — for layout:

```tsx
<Box flexDirection="row" gap={1} paddingX={2}>
  <Box flexGrow={1}>
    <Text>Left panel</Text>
  </Box>
  <Box width={30}>
    <Text>Right sidebar</Text>
  </Box>
</Box>
```

This brings responsive, declarative layouts to the terminal. Text nodes register measure functions with Yoga:

```typescript
node.yogaNode.setMeasureFunc((width, measureMode) => {
  const wrapped = wrapText(text, width);
  return { width: actualWidth, height: numLines };
});
```

A generational reset pattern prevents memory leaks from native Yoga bindings:

```typescript
if (now - lastPoolResetTime > SESSION_POOL_RESET_MS) {
  migrateScreenPools(); // Free and recreate all Yoga nodes
}
```

### 7.4 The Dirty Flag Cascade

Nodes track a dirty flag that cascades upward:

```typescript
function markDirty(node: DOMElement) {
  node.dirty = true;
  if (node.parentNode) markDirty(node.parentNode);
}
```

Only subtrees with dirty ancestors are re-laid out, providing incremental performance.

### 7.5 Double Buffering and Blitting

The renderer uses classic graphics techniques:

**Double buffering:**

```typescript
private frontFrame: Frame   // Currently displayed
private backFrame: Frame    // Being rendered into
// After render: swap pointers
[this.frontFrame, this.backFrame] = [this.backFrame, this.frontFrame]
```

**Blitting (copy unchanged regions):**

```typescript
blit(src: Screen, x, y, width, height)
// If a region hasn't changed, copy from previous frame
// instead of re-rendering — the "GPU blit" technique for terminals
```

When a selection overlay is applied, it "contaminates" the frame, disabling blit for the next render to prevent visual artifacts.

### 7.6 Screen Buffer: The 2D Cell Model

The screen is a 2D array of cells:

```typescript
type Cell = {
  char: string; // Interned via CharPool
  width: CellWidth; // 1 (normal), 2 (wide/CJK/emoji), -1 (tail of wide char)
  styleId: number; // Interned via StylePool
  hyperlink?: number; // Interned via HyperlinkPool
};
```

Three interning pools minimize memory and enable O(1) comparisons:

- **CharPool** — Deduplicates character strings, returns integer IDs
- **StylePool** — Deduplicates ANSI style combinations, pre-computes transition sequences
- **HyperlinkPool** — Deduplicates OSC 8 URLs (reset every 5 minutes to bound growth)

The style pool's `transition()` method is especially clever:

```typescript
// Pre-computed: "how to go from style A to style B"
transition(fromId: number, toId: number): string {
  const key = fromId * 0x100000 + toId
  return transitionCache.get(key)  // O(1) vs. diffing AnsiCode arrays
}
```

### 7.7 Scroll Optimization

ScrollBox uses hardware scroll regions when available:

```
CSI top;bottom r    → Set scroll region
CSI n S             → Scroll up n lines (DECSTBM)
```

This is dramatically faster than rewriting 50+ rows of content. For smooth animation, scroll deltas accumulate and drain at terminal-specific rates:

```typescript
// Native terminals: proportional drain (~3/4 per frame)
const step = Math.max(MIN, (abs * 3) >> 2);

// xterm.js: adaptive (instant for ≤5, smaller steps for fast scrolls)
const step = abs <= 5 ? abs : abs < 12 ? 2 : 3;
```

### 7.8 Event System

Events follow DOM semantics with capture and bubble phases:

```typescript
function collectListeners(target, event): DispatchListener[] {
  // Walk from target to root
  // Capture handlers: root-first
  // Bubble handlers: target-first
}
```

Event priority mirrors web browsers:

| Priority             | Events                                    |
| -------------------- | ----------------------------------------- |
| Discrete (sync)      | keydown, keyup, click, focus, blur, paste |
| Continuous (batched) | resize, scroll, mousemove                 |

### 7.9 Text Selection

Full text selection with word and line modes:

- **Character mode** — Drag selects character by character
- **Word mode** — Double-click selects word; subsequent drag extends by word boundaries
- **Line mode** — Triple-click selects line; drag extends by lines
- **Scroll tracking** — Text that scrolls off-screen is accumulated for correct copy
- **Soft-wrap handling** — Wrapped lines are joined into logical lines when copying

### 7.10 Keyboard Input Parsing

Terminal keyboard input is notoriously ambiguous. The parser handles multiple protocols:

- **Kitty Keyboard Protocol** — CSI u with codepoint + modifiers
- **xterm modifyOtherKeys** — CSI 27; modifier; keycode ~
- **Legacy function keys** — F1-F12 with their many escape sequence variants
- **SGR mouse events** — CSI < button; col; row M/m
- **Terminal identity detection** — XTVERSION response parsing for feature detection

---

## 8. The Command System: 100+ Slash Commands

### 8.1 Architecture

Commands use a declarative registration model with three types:

| Type            | Execution Model                      | Example                |
| --------------- | ------------------------------------ | ---------------------- |
| PromptCommand   | Expands to text sent to Claude       | /commit, /review       |
| LocalCommand    | Synchronous text output, no UI       | /clear, /help, /status |
| LocalJSXCommand | React component rendered to terminal | /config, /mcp, /doctor |

The command registry is memoized and lazy-loaded:

```typescript
const COMMANDS = memoize(() => [
  // Static commands array — module imports deferred until first call
]);

const loadAllCommands = memoize((cwd: string) => {
  // Merges: COMMANDS() + skills + plugins + workflows + MCP commands
});
```

### 8.2 Command Discovery Pipeline

```
getCommands(cwd)
  ├─ loadAllCommands(cwd) [memoized by CWD]
  │   ├─ getSkills()          → Disk, bundled, plugin, MCP skills
  │   ├─ getPluginCommands()  → Marketplace + built-in plugins
  │   ├─ getWorkflowCommands()→ Automation workflows [feature-gated]
  │   └─ COMMANDS()           → Static built-in commands
  ├─ getDynamicSkills()       → Session-discovered skills
  ├─ Filter by availability   → Auth provider gating
  ├─ Filter by isEnabled()    → Feature flag gating
  └─ Dedupe + sort
```

### 8.3 Remote and Bridge Filtering

Commands are pre-filtered based on execution context:

- **Remote mode** — Only `REMOTE_SAFE_COMMANDS` (session, exit, clear, help, theme, cost…)
- **Bridge mode** — Only `BRIDGE_SAFE_COMMANDS` (prompt-type skills, plus text-output locals like clear, cost, summary)
- **Local JSX commands** — Always blocked over bridge (can't render React over WebSocket)

### 8.4 Notable Command Implementations

#### /commit — Git Safety Protocol

The commit command enforces strict safety rules:

- Never `git commit --amend` (only create new commits)
- Never skip hooks (`--no-verify`, `--no-gpg-sign`)
- Never use `-i` flags (interactive mode unsupported)
- Warn on secrets (`.env`, `credentials.json`)
- Restricted tool access: only `Bash(git add:*)`, `Bash(git status:*)`, `Bash(git commit:*)`

#### /init — Interactive Project Setup

Multi-phase onboarding:

1. Ask what to set up (CLAUDE.md, skills, hooks)
2. Survey codebase (manifest files, README, CI, existing config)
3. Interview user on gaps
4. Synthesize proposal and create artifacts

#### /doctor — Self-Diagnostics

Checks system health: API connectivity, auth status, model availability, MCP server connections, permission configuration.

---

## 9. Skills, Plugins, and MCP: The Extensibility Trifecta

### 9.1 Skills

Skills are markdown-based prompt templates with frontmatter metadata:

```yaml
---
name: my-skill
description: What this skill does
whenToUse: When Claude should invoke it
allowedTools: [Bash, Read, Edit]
model: claude-sonnet-4-6
userInvocable: true
---
Skill prompt content here...
```

**Discovery sources (5):**

1. `.claude/skills/` — Project-level skills
2. `~/.claude/skills/` — User-level skills
3. Bundled skills — Compiled into the binary
4. Plugin skills — From installed plugins
5. MCP skill builders — Auto-generated from MCP servers with Prompt capability

**Forked execution:** Skills with `context: 'fork'` run in isolated subagents with their own token budgets, preventing large skills from consuming session context.

Bundled skills support lazy extraction of reference files to disk with per-process nonce-based path protection (defends against symlink/TOCTOU attacks).

### 9.2 Plugins

Plugins bundle skills, hooks, and MCP servers:

```
Plugin
├─ Skills (markdown files)
├─ Hooks (pre/post tool execution)
├─ MCP Servers (tool providers)
└─ Options (user-configurable variables)
```

**Types:**

- **Built-in plugins** — Pre-installed, togglable, `{name}@builtin`
- **Marketplace plugins** — Installed to `~/.claude/plugins`, versioned
- **Project plugins** — `--plugin-dir` for session-only plugins

Plugin variables are substituted into prompts at invocation time via `substitutePluginVariables()`.

### 9.3 Model Context Protocol (MCP)

MCP is the primary extensibility mechanism for bringing external tools into Claude Code.

**Supported transports:**

- `stdio` — Local subprocess
- `sse / http / ws` — Network-based (with optional OAuth/XAA)
- `sdk` — Embedded SDK
- `claudeai-proxy` — Claude.ai tunnel

**Config scopes (priority order):**

1. `local` — `.mcp.json` in project root
2. `project` — `.claude/.mcp.json`
3. `user` — `~/.claude/.mcp.json`
4. `userSettings` — `settings.json` mcpServers
5. `policySettings` — Managed organizational policy
6. `enterprise` — Enterprise-managed
7. `claudeai` — Claude.ai-managed
8. `dynamic` — Runtime-injected

**Connection lifecycle:**

```
MCPServerConnection =
  | ConnectedMCPServer     → Ready to use
  | FailedMCPServer        → Connection error
  | NeedsAuthMCPServer     → Awaiting OAuth
  | PendingMCPServer       → Reconnecting (max attempts)
  | DisabledMCPServer      → Explicitly disabled
```

MCP tools are normalized and prefixed: `mcp__server__toolname`. They receive the same permission checks, deny rules, and analytics as built-in tools.

---

## 10. Context Management: Fighting the Token Limit

With conversations that can last hours and generate hundreds of tool calls, managing the context window is critical. Claude Code uses a multi-strategy approach.

### 10.1 Auto-Compaction

When token count exceeds `context_window - 13,000`:

1. Strip images/documents from older messages (replace with `[image]` markers)
2. Group messages by API round (assistant + tool results)
3. Call the compaction model to generate a summary
4. Replace old messages with a `CompactBoundaryMessage`
5. Re-inject up to 5 files + skills post-compaction (50K token budget for files, 25K for skills)

A circuit breaker prevents thrashing: max 3 consecutive compaction failures before giving up.

### 10.2 Microcompaction

Lighter-weight compression for tool results:

- **Time-based** — Clear tool results older than a TTL
- **Size-based** — Truncate when accumulated tool result tokens exceed threshold
- **Tool-specific** — Only compacts: FileRead, Bash, Grep, Glob, WebSearch, WebFetch, FileEdit, FileWrite
- **Cache-aware** — A "cached" variant preserves prompt cache integrity via `CacheEditsBlock`

### 10.3 Snip Compaction

A history truncation strategy (feature-gated):

- Remove old messages beyond a snip boundary
- Preserve the assistant's "protected tail" for context continuity
- Track tokens freed for accurate token budget calculations
- Full history preserved in REPL for UI scrollback (non-destructive)

### 10.4 Context Collapse

Staged collapses are committed lazily — only when the API returns a 413 (prompt too long):

```
API 413 → Collapse drain (commit staged collapses)
        → If insufficient → Reactive compact (full summarization)
        → If still insufficient → Surface error to user
```

### 10.5 System Context

Two tiers of context are injected into every request:

**System context** (memoized per session):

- Git status (branch, recent commits, file status — truncated at 2000 chars)
- Cache breaker (optional debug injection)

**User context** (memoized per session):

- CLAUDE.md file contents (auto-discovered from project + parent directories)
- Current date (ISO format)

---

## 11. State Management: Immutable Store for a Mutable World

### 11.1 The Store

Claude Code uses a minimal, Zustand-like store:

```typescript
type Store<T> = {
  getState: () => T;
  setState: (updater: (prev: T) => T) => void;
  subscribe: (listener: Listener) => () => void;
};
```

- No middleware
- Synchronous updates
- Identity comparison (`Object.is`) gates listener invocation
- React integration via `useSyncExternalStore`

### 11.2 AppState: The Unified State Object

The AppState object contains everything:

**Core settings:**

- `settings` — User preferences (theme, model, etc.)
- `mainLoopModel` — Current AI model for the session
- `toolPermissionContext` — Safety mode and rules
- `expandedView` — `'none' | 'tasks' | 'teammates'`

**Bridge state (Claude.ai integration):**

- `replBridgeEnabled` / `replBridgeConnected` / `replBridgeSessionActive`
- `replBridgeConnectUrl` / `replBridgeError`

**Multi-agent state:**

- `tasks: { [taskId: string]: TaskState }`
- `agentNameRegistry: Map<string, AgentId>`
- `foregroundedTaskId` / `viewingAgentTaskId`

**MCP state:**

- `mcp.clients: MCPServerConnection[]`
- `mcp.tools`, `mcp.commands`, `mcp.resources`

**Speculation state (parallel model execution):**

```typescript
type SpeculationState =
  | { status: "idle" }
  | { status: "active"; messagesRef; writtenPathsRef; boundary; isPipelined };
```

Speculation is a latency optimization: while the user is still typing, the model begins generating a response speculatively. File writes go to an overlay filesystem (`writtenPathsRef`), and on completion, the overlay is either committed (if the user's actual input matches the speculation boundary) or discarded. `isPipelined` indicates whether a suggestion was already generated and is queued for display.

### 11.3 Centralized Side Effects

All state mutations that affect external systems flow through `onChangeAppState()`:

- Permission mode changes → Notify CCR bridge
- Model changes → Persist to user settings
- Settings mutations → Clear auth caches
- View changes → Persist UI state

One choke point, no scattered side effects.

---

## 12. Session Persistence and History

### 12.1 Transcript Recording

The engine records transcripts with ordering guarantees:

- **Assistant messages** — Fire-and-forget (lazy JSON stringify with 100ms drain)
- **User/boundary messages** — Blocking await (ordering guarantee)
- **Pre-compact flush** — Writes preserved segment before compaction boundary

Even if the process is killed mid-request, the conversation is resumable from the last recorded transcript.

### 12.2 History System

Two-level history with deduplication:

**In-memory:** `pendingEntries[]` — Queue before flush to disk

**On-disk:** `~/.claude/history.jsonl` — Append-only log

```typescript
type LogEntry = {
  display: string; // Formatted prompt for Ctrl+R picker
  project: string; // Current project root
  sessionId: SessionId;
  timestamp: number;
  pastedContents?: Record<number, StoredPastedContent>;
};
```

**Key algorithms:**

- Dedup by display text (newest first) for Ctrl+R
- Current-session-first ordering (up-arrow doesn't interleave sessions)
- Small pastes (<1KB) inlined; large pastes stored with hash references

### 12.3 Cost State Persistence

Session costs survive process restarts:

```typescript
getStoredSessionCosts(); // Retrieve if session ID matches
saveCurrentSessionCosts(); // Persist before session switch
restoreCostStateForSession(); // Restore on resume (validates session ID)
```

---

## 13. Multi-Agent Architecture: Subagents, Swarms, and Worktrees

### 13.1 Agent Spawning

The AgentTool spawns child agents with configurable isolation:

- **Default** — Shared filesystem, separate conversation context
- **Worktree** — Isolated git branch copy, changes merged on exit
- **Remote (CCR)** — Runs on a separate machine

Agents are addressable by name:

```
Model: "Ask the test-runner agent to run the suite"
  → SendMessage(to: "test-runner", message: "Run the test suite")
```

### 13.2 Task System

Background tasks use file-based IPC with concurrent-session locking:

```typescript
type TaskType =
  | "local_bash"
  | "local_agent"
  | "remote_agent"
  | "in_process_teammate"
  | "local_workflow"
  | "monitor_mcp"
  | "dream";

type TaskStatus = "pending" | "running" | "completed" | "failed" | "killed";
```

Task IDs use base-36 encoding with type prefixes (`b`=bash, `a`=agent, `r`=remote, etc.).

Lock retries use 30 attempts with 5-100ms backoff (~2.6s max wait) for swarm coordination across tmux/iTerm2 panes.

### 13.3 Worktree Isolation

EnterWorktreeTool / ExitWorktreeTool provide git-level isolation:

1. Create a temporary git worktree on a new branch
2. Agent works in the worktree (safe to make destructive changes)
3. On exit: keep changes (merge) or discard (clean up)

---

## 14. Error Recovery: A System That Refuses to Crash

### 14.1 API Error Recovery

The retry system handles transient and permanent errors differently:

**Transient (retryable):**

| Error            | Strategy                                       |
| ---------------- | ---------------------------------------------- |
| 529 (Overloaded) | Max 3 retries for foreground queries           |
| 429 (Rate limit) | Exponential backoff, persistent mode available |
| ECONNRESET/EPIPE | Stale connection retry                         |

**Permanent (fail fast):**

| Error | Strategy                                       |
| ----- | ---------------------------------------------- |
| 401   | OAuth refresh → retry once → clear credentials |
| 400   | Invalid request, no retry                      |
| 403   | Permission denied, no retry                    |

**Persistent retry mode** (for unattended operation):

- Env var: `CLAUDE_CODE_UNATTENDED_RETRY`
- Indefinite 429/529 retries with max 5-minute backoff
- 30-second heartbeat keep-alive messages

### 14.2 Prompt-Too-Long Recovery

When the API returns 413:

```
413 Prompt Too Long
  ├─ 1. Collapse drain (commit staged context collapses)
  ├─ 2. Reactive compact (generate full conversation summary)
  └─ 3. Surface error if all paths exhausted
```

The error is withheld from the SDK until recovery paths are exhausted — the user never sees a 413 if compaction can resolve it.

### 14.3 Max Output Tokens Recovery

```
max_output_tokens stop reason
  ├─ 1. Escalate to 64K tokens (once per turn)
  ├─ 2. Inject meta recovery message ("Resume directly")
  ├─ 3. Max 3 attempts before surfacing
  └─ 4. Withhold intermediate errors
```

### 14.4 Model Fallback

On persistent 529 errors:

1. Switch to fallback model (e.g., Sonnet when Opus is overloaded)
2. Strip thinking blocks (model-bound signatures)
3. Log fallback event with chain ID
4. Yield system message about the switch

### 14.5 Streaming Fallback

If streaming fails mid-response:

1. Retry with non-streaming request
2. Tombstone orphaned messages
3. Clear assistant messages to restart the turn
4. Fresh tool executor to prevent orphan results

---

## 15. Cost Tracking and Telemetry

### 15.1 Usage Accumulation

Per-model tracking:

- Input tokens, output tokens
- Cache read/write tokens
- Web search requests
- USD cost (calculated via `calculateUSDCost()`)

Advisor model costs are recursively accumulated from `getAdvisorUsage()`.

### 15.2 Display

`formatTotalCost()` produces a multi-line report:

- Total cost
- Per-model breakdown
- API/wall-clock duration
- Lines of code changed
- Unknown model cost disclaimer

### 15.3 Telemetry

Analytics use a decoupled sink pattern:

- `attachAnalyticsSink()` called during startup
- Events queued until sink is available (prevents import cycles)
- Datadog fanout + first-party event logging
- PII-tagged fields for compliance
- OpenTelemetry spans for LLM request tracing

Gateway detection identifies proxy infrastructure from response headers: LiteLLM, Helicone, Portkey, Cloudflare AI Gateway, Kong, Braintrust, Databricks.

---

## 16. Execution Modes: One Codebase, Many Faces

Claude Code runs in multiple modes from a single codebase:

**Interactive CLI (Default)**
Full React terminal UI with REPL loop, text selection, mouse support, and rich rendering.

**Non-Interactive / Headless**
`--print` mode outputs the response to stdout. `--output` saves to a file. No user interaction — suitable for scripts, CI/CD, and piping.

**MCP Server Mode**
`claude mcp serve` runs Claude Code as an MCP server, exposing its tools to other MCP clients.

**Bridge Mode (Claude.ai Integration)**
WebSocket connection to claude.ai for remote control:

- CLI sends status updates to the web UI
- Web UI sends control commands back
- Bidirectional message adaptation (SDK format ↔ local format)
- Viewer-only mode for read-only clients

**Remote / Teleport**
`claude remote-control` exposes the CLI as a WebSocket server. Users can connect via claude.ai's web interface or QR code.

**Local Agent Mode**
Subprocesses spawned for multi-agent swarms. Each agent gets its own session, AppState, and task directory. Communication via file I/O.

**Coordinator Mode**
Orchestrates multiple agents working in parallel on different aspects of a task. (See dedicated section below.)

---

## 17. BUDDY: A Tamagotchi-Style AI Pet

One of the most surprising finds in the codebase: a fully implemented Tamagotchi-style virtual companion that lives beside the user's input box.

### 17.1 How Your Buddy Is Born

Every companion is deterministically generated from the user's account ID using a Mulberry32 seeded PRNG:

```typescript
// Mulberry32 — tiny seeded PRNG, good enough for picking ducks
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

The seed is `hash(userId + 'friend-2026-401')`. This means your companion is unique to you but identical across devices and sessions — you always get the same one.

### 17.2 Species, Rarity, and Cosmetics

**18 species:** duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

**Rarity tiers (weighted random):**

| Tier      | Weight | Stat Floor | Hat?   |
| --------- | ------ | ---------- | ------ |
| Common    | 60%    | 5          | None   |
| Uncommon  | 25%    | 15         | Random |
| Rare      | 10%    | 25         | Random |
| Epic      | 4%     | 35         | Random |
| Legendary | 1%     | 50         | Random |

**Cosmetics:**

- 6 eye styles: `·`, `+`, `x`, `@`, `°`, and a special star eye
- 8 hats: none, crown, tophat, propeller, halo, wizard, beanie, tinyduck
- 1% shiny chance — independent of rarity
- 5 stats: DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK — one peak stat, one dump stat, rest scattered

### 17.3 Soul Generation

On first "hatch," Claude generates a unique name and personality for the companion. This is stored permanently in the user's global config as `StoredCompanion`:

```typescript
type StoredCompanion = CompanionSoul & { hatchedAt: number };
type CompanionSoul = { name: string; personality: string };
```

### 17.4 Sprite Animation System

Each species has 3 animation frames as 5-line, 12-character-wide ASCII art. The idle sequence cycles at 500ms per tick:

```typescript
const IDLE_SEQUENCE = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0];
// -1 = "blink on frame 0" (eyes temporarily replaced)
```

### 17.5 Speech Bubbles and Interaction

The companion renders as a `CompanionSprite` React component positioned beside the prompt input. It features:

- Speech bubbles with a `SpeechBubble` component using rounded borders
- Bubbles display for ~10 seconds (20 ticks) then fade over the last 3 seconds
- `/buddy pet` triggers a floating heart animation (2.5 seconds)
- When terminal is too narrow (<100 cols), the full sprite is hidden and replaced with a compact face-only rendering

---

## 18. KAIROS: Persistent Assistant Mode and Auto-Dreaming

KAIROS (feature-flagged as `KAIROS`) is a complete alternate UX where Claude becomes a long-lived autonomous agent that persists across sessions.

### 18.1 Auto-Dreaming: Memory Consolidation

The most concrete KAIROS subsystem is the auto-dream system (`services/autoDream/`). This is a background memory consolidation agent that runs as a forked subagent.

**Gate order (cheapest checks first):**

1. Time gate: Hours since last consolidation >= minHours (default: 24h)
2. Session gate: Number of transcript sessions since last consolidation >= minSessions (default: 5)
3. Lock gate: No other process is mid-consolidation (file lock with mtime-based conflict detection)
4. Scan throttle: Even when the time gate passes, session scanning is throttled to every 10 minutes

**The 4-phase dream prompt:**

```
Phase 1 — Orient
  └─ ls the memory directory, read the index, skim existing topic files

Phase 2 — Gather recent signal
  └─ Check daily logs, find drifted memories, grep transcripts narrowly

Phase 3 — Consolidate
  └─ Write/update memory files, merge duplicates, convert relative dates

Phase 4 — Prune and index
  └─ Update the entrypoint index (max ~25KB), remove stale pointers
```

### 18.2 KAIROS Integration Points

- `getKairosActive()` in bootstrap state — gates whether KAIROS mode is active
- Auto-dream is disabled in KAIROS mode (KAIROS uses its own disk-skill dream variant)
- Brief mode (`BriefTool`) — all output goes through `SendUserMessage` tool
- Proactive `<tick>` prompts — periodic check-ins where Claude decides what to do next
- 15-second blocking budget — commands exceeding 15s are auto-backgrounded
- Exclusive tools: `SendUserFile`, `PushNotification`, `SubscribePR`, `SleepTool`
- Append-only daily logs at `~/.claude/projects/<slug>/memory/logs/YYYY/MM/YYYY-MM-DD.md`

---

## 19. ULTRAPLAN: Remote Planning Sessions

ULTRAPLAN is an interactive planning system that farms out complex exploration to a remote Claude Code instance (CCR) for up to 30 minutes.

### 19.1 How It Works

1. User types "ultraplan" (keyword detection, not slash command) or uses `/ultraplan`
2. A remote CCR session is created with plan mode pre-configured
3. The CLI polls the remote session every 3 seconds for up to 30 minutes
4. Remote Claude explores, plans, and calls `ExitPlanMode` when ready
5. User approves or rejects the plan in the browser (claude.ai)
6. Rejected plans loop back for iteration

### 19.2 Keyword Detection

The keyword trigger system skips:

- Inside paired delimiters (backticks, quotes, brackets, angle brackets)
- Path-like context (`src/ultraplan/foo.ts`, `ultraplan.tsx`)
- Identifier-like context (`--ultraplan-mode`, `ultraplan-s`)
- Followed by `?` (questions about the feature shouldn't invoke it)
- Slash command input (`/rename ultraplan foo` runs `/rename`, not ultraplan)

### 19.3 Two Execution Paths on Approval

| Path                   | What Happens                                |
| ---------------------- | ------------------------------------------- |
| "remote"               | Execute the plan in the cloud CCR instance  |
| "teleport to terminal" | Archive the remote session, execute locally |

### 19.4 Event Stream Scanning

The `ExitPlanModeScanner` class is a pure stateful classifier for the CCR event stream:

```typescript
type ScanResult =
  | { kind: "approved"; plan: string }
  | { kind: "teleport"; plan: string }
  | { kind: "rejected"; id: string }
  | { kind: "pending" }
  | { kind: "terminated"; subtype: string }
  | { kind: "unchanged" };
```

---

## 20. Coordinator Mode: Multi-Agent Orchestrator

Coordinator Mode (`CLAUDE_CODE_COORDINATOR_MODE=1`) transforms Claude Code from a single-agent assistant into a multi-agent orchestrator.

### 20.1 Architecture

```
Coordinator (you)
  ├─ AgentTool → Worker A (research)     ─┐
  ├─ AgentTool → Worker B (research)     ─┤ Run in parallel
  ├─ AgentTool → Worker C (implement)    ─┘
  └─ SendMessage → Continue Worker A with synthesized spec
```

### 20.2 Task Workflow

| Phase          | Who                | Purpose                                   |
| -------------- | ------------------ | ----------------------------------------- |
| Research       | Workers (parallel) | Investigate codebase, find files          |
| Synthesis      | Coordinator        | Read findings, craft implementation specs |
| Implementation | Workers            | Make changes per spec, commit             |
| Verification   | Workers            | Prove the code works                      |

### 20.3 Concurrency Rules

- Read-only tasks (research) — run in parallel freely
- Write-heavy tasks (implementation) — one at a time per set of files
- Verification — can run alongside implementation on different file areas

---

## 21. The Memory System: Persistent AI Memory

### 21.1 Memory Architecture

Memories are stored as individual markdown files with YAML frontmatter at `~/.claude/projects/<sanitized-project-root>/memory/`:

```markdown
---
name: user_role
description: User is a senior backend engineer focused on Rust
type: user
---

User is a senior backend engineer at Acme Corp, primarily works in Rust...
```

An index file `MEMORY.md` (max 200 lines / 25KB) serves as a table of contents.

### 21.2 Four Memory Types

| Type      | Purpose                            | Example                                          |
| --------- | ---------------------------------- | ------------------------------------------------ |
| user      | Role, preferences, knowledge level | "User is a data scientist, new to React"         |
| feedback  | How to approach work               | "Don't mock the database in integration tests"   |
| project   | Ongoing work, goals, deadlines     | "Merge freeze begins 2026-03-05"                 |
| reference | Pointers to external systems       | "Pipeline bugs tracked in Linear project INGEST" |

### 21.3 Intelligent Memory Recall

Not all memories are loaded every turn. A Sonnet-powered relevance selector runs as a side query:

1. Scan all `.md` files in the memory directory (max 200, newest-first)
2. Parse frontmatter headers from the first 30 lines
3. Send the user's query + memory manifest to Sonnet
4. Sonnet returns up to 5 most relevant filenames
5. Those files are injected into the conversation context

---

## 22. Hooks: User-Defined Automation

### 22.1 Four Hook Types

```typescript
type HookCommand =
  | { type: "command"; command: string; shell?: "bash" | "powershell" }
  | { type: "prompt"; prompt: string; model?: string }
  | { type: "http"; url: string; headers?: Record<string, string> }
  | { type: "agent"; prompt: string; model?: string };
```

### 22.2 Advanced Hook Features

- `async: true` — Hook runs in background without blocking the model
- `asyncRewake: true` — Runs in background but wakes the model on exit code 2
- `once: true` — Auto-removes after first execution
- `statusMessage` — Custom spinner text while the hook runs
- Environment variable interpolation in HTTP headers with explicit allowlist

---

## 23. Voice Mode, Bridge, and Infrastructure

### 23.1 The Bridge System (31 Files)

The bridge is a persistent WebSocket connection between the local CLI and claude.ai's web interface (CCR). Key components:

- `bridgeMain.ts` — Main bridge loop with exponential backoff (2s initial → 2min cap → 10min give-up)
- `replBridge.ts` / `replBridgeTransport.ts` — REPL-side bridge handle, message framing
- `bridgeApi.ts` — API client with JWT refresh, trusted device tokens, session validation
- `bridgeMessaging.ts` / `inboundMessages.ts` — Message adaptation (SDK format ↔ local format)
- `bridgePermissionCallbacks.ts` — Permission request mediation between web UI and local CLI
- `sessionRunner.ts` — Spawns agent sessions per work item, manages worktrees

### 23.2 Upstream Proxy (CCR Security)

When running inside a CCR container:

1. Read session token from `/run/ccr/session_token`
2. Set `prctl(PR_SET_DUMPABLE, 0)` — blocks same-UID ptrace
3. Download CA certificate and concatenate with system bundle
4. Start local CONNECT→WebSocket relay on a random port
5. Unlink the token file (token stays heap-only)
6. Inject `HTTPS_PROXY` / `SSL_CERT_FILE` env vars

---

## 24. Vim Mode, Keybindings, and Developer Ergonomics

### 24.1 Vim Mode

A full vi command system:

- **Motions** — h, j, k, l, w, b, e, 0, $, gg, G
- **Operators** — d (delete), c (change), y (yank)
- **Text Objects** — iw (inner word), ap (a paragraph)
- **Modal State Machine** — Insert, Normal, Visual modes

### 24.2 Dynamic Keybindings

Context-aware keybinding resolution:

```typescript
type KeybindingContext = {
  focus?: "prompt" | "file" | "terminal";
  isRecording?: boolean;
  vimMode?: boolean;
  mode?: "insert" | "normal" | "visual";
};
```

---

## 25. Key Engineering Patterns and Takeaways

### Pattern 1: Lazy Everything

- Lazy schemas — Zod instantiation deferred via `lazySchema()`
- Lazy commands — Module imports via `load()` functions
- Lazy tools — 18 tools deferred to `ToolSearchTool`
- Lazy modules — Dynamic imports for OpenTelemetry, analytics, heavy components
- Lazy bundled skills — Reference files extracted on first use

### Pattern 2: Memoization by Identity

- `COMMANDS()` — Memoized, cleared by `clearCommandMemoizationCaches()`
- `loadAllCommands(cwd)` — Memoized by working directory
- `init()` — Memoized to prevent re-entrancy

### Pattern 3: Feature Flags for Dead Code Elimination

```typescript
if (feature("COORDINATOR_MODE")) {
  // This entire block is removed from the binary when the flag is off
  const { CoordinatorUI } = await import("./coordinator/index.js");
}
```

### Pattern 4: Interning for Performance

Three interning pools (chars, styles, hyperlinks) reduce memory and enable O(1) comparison by integer ID instead of string equality.

### Pattern 5: Fail-Closed Security

The `buildTool()` factory provides safe defaults for 7 commonly-stubbed methods. Permissions default to "ask."

### Pattern 6: Centralized Side Effects

`onChangeAppState()` is the single choke point for all state mutations that affect external systems.

### Pattern 7: File-Based IPC

Multi-agent coordination uses files, not sockets.

### Pattern 8: Prompt Cache Stability

Tools are sorted alphabetically before being sent to the API.

### Pattern 9: Progressive Disclosure

The deferred tool system implements progressive disclosure at the API level.

### Pattern 10: Three-Tier Configuration

Settings are resolved from multiple sources with clear precedence:

```
MDM Policy (highest) → Remote Managed → User Settings
→ Project Config → Global Config → Defaults (lowest)
```

---

## 26. Conclusion

Claude Code is a remarkable piece of engineering. What appears to the user as a simple chat interface in the terminal is backed by:

- A custom React reconciler with Yoga layout, double-buffered rendering, and hardware scroll optimization
- A resilient query engine with automatic context compression, multi-strategy error recovery, and token budget continuation
- A 60+ tool ecosystem unified under a single generic interface with Zod validation, lazy schemas, and elastic discovery
- A multi-layered permission system balancing security and developer productivity
- An extensibility framework spanning skills, plugins, and MCP
- Production-grade infrastructure: interned style pools, file-based IPC, sampled profiling, parallelized startup, and comprehensive telemetry

For developers building similar tools, the key lessons are:

1. **Invest in the rendering layer.** Claude Code's custom Ink framework is its competitive advantage for terminal UX.
2. **Design for failure.** The multi-strategy error recovery means users almost never see raw API errors.
3. **Defer aggressively.** Lazy loading at every level keeps startup fast and memory bounded.
4. **Intern everything.** Style pools, character pools, and hyperlink pools turn O(n) string comparisons into O(1) integer comparisons.
5. **Make safety the default.** Fail-closed permissions and mandatory confirmation for destructive operations build user trust.

Claude Code isn't just a wrapper around an API. It's a complete development environment that happens to run in your terminal.

---

_This analysis is based on examination of the Claude Code source code. All technical details reflect the codebase as observed at the time of analysis._
