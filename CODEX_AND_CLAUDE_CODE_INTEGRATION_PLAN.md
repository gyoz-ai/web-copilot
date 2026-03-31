# Codex & Claude Code Integration Plan

> Add Claude Code (via Native Messaging Bridge) and OpenAI Codex (via ChatGPT subscription OAuth) as provider options in the gyoza browser extension. Both providers are subscription-based — no API keys needed.

## Table of Contents

- [Background & Research](#background--research)
- [Current Architecture](#current-architecture)
- [Phase 1: Claude Code via Native Messaging Bridge](#phase-1-claude-code-via-native-messaging-bridge)
  - [Claude Code Skill: /install-gyoza](#claude-code-skill-install-gyoza)
- [Phase 2: Codex via ChatGPT Subscription (OAuth)](#phase-2-codex-via-chatgpt-subscription-oauth)
- [Shared Work: Storage & UI Changes](#shared-work-storage--ui-changes)
- [Appendix A: How Cline Integrates Claude Code](#appendix-a-how-cline-integrates-claude-code)
- [Appendix B: How Cline Integrates Codex](#appendix-b-how-cline-integrates-codex)
- [Appendix C: Why Claude Code OAuth Cannot Be Used Directly](#appendix-c-why-claude-code-oauth-cannot-be-used-directly)

---

## Background & Research

### Why these two providers?

- **Claude Code** is Anthropic's agentic CLI — it uses the user's Claude Pro/Max subscription (no per-token cost). It has its own "engineering brain" system prompt and agentic capabilities. Cline (VS Code extension) already supports it by spawning the CLI as a child process.

- **OpenAI Codex** models are available through a ChatGPT subscription OAuth flow (free with Plus/Pro/Max). Cline supports this by replicating the official Codex CLI's OAuth PKCE flow and calling `chatgpt.com/backend-api/codex/responses` directly.

Both providers let users leverage their **existing subscriptions** instead of paying per-token API costs.

### Browser Extension Constraints

A Chrome extension's background service worker **cannot** spawn child processes (`child_process`, `execa`). This is the fundamental constraint that shapes the Claude Code architecture:

| Capability                       | Background Worker | Native Messaging Host |
| -------------------------------- | ----------------- | --------------------- |
| `fetch()` HTTP requests          | Yes               | Yes                   |
| Spawn child processes            | **No**            | Yes                   |
| Access filesystem                | **No**            | Yes                   |
| `chrome.runtime.connectNative()` | Yes (initiator)   | Yes (receiver)        |
| OAuth via `chrome.identity`      | Yes               | N/A                   |

### Key Insight

Cline can spawn the `claude` CLI directly because VS Code extensions run in Node.js. We need Chrome's **Native Messaging API** to bridge the gap — a tiny companion app that the extension talks to, which in turn spawns the CLI.

For Codex, no bridge is needed — the extension can do OAuth via `chrome.identity.launchWebAuthFlow()` and call the Codex API directly from the background worker via `fetch()`.

---

## Current Architecture

### Provider Abstraction

```
packages/extension/src/lib/providers/
  ├── types.ts      → ProviderResult = { type: "model", model: LanguageModel } | { type: "legacy", ... }
  ├── index.ts      → createProvider(settings) → switch on provider key
  └── managed.ts    → ManagedProvider (legacy structured output via api.gyoz.ai)
```

**`ProviderKey`** (in `storage.ts`): `"claude" | "openai" | "gemini"`

**Provider factory** (in `providers/index.ts`): Returns a Vercel AI SDK `LanguageModel` for BYOK mode, routed through `streamText()` with tool calling in `background.ts`.

### Query Flow

```
Content Script → chrome.runtime.sendMessage("gyozai_query")
  → background.ts:handleQuery()
    → createProvider(settings) → LanguageModel
    → streamText({ model, system, messages, tools, stopWhen: stepCountIs(10) })
    → Tools execute in page context via chrome.scripting.executeScript()
    → Stream events sent back via chrome.tabs.sendMessage()
  → AgentResult returned to content script
```

### Current Dependencies

```json
{
  "@ai-sdk/anthropic": "^3.0.64",
  "@ai-sdk/google": "^3.0.53",
  "@ai-sdk/openai": "^3.0.48",
  "ai": "^6.0.141"
}
```

---

## Phase 1: Claude Code via Native Messaging Bridge

**Effort**: Medium (1-2 days)
**Value**: Users with Claude Pro/Max get Claude Code's agentic capabilities for free (no API key)
**Auth**: Claude Code's own auth (user must have run `claude login` already)

### Architecture

```
Extension Background Worker
    ↕ chrome.runtime.connectNative("ai.gyoz.claude_bridge")
Native Messaging Host (Node.js script, ~150 lines)
    ↕ child_process.spawn() with stdin/stdout pipes
Claude Code CLI (`claude -p --output-format stream-json --max-turns 1`)
```

### Why This Works

1. **Claude Desktop already installs the CLI** at `~/Library/Application Support/Claude/claude-code/<VERSION>/claude`. Many developers already have it. The standalone CLI is also a one-liner: `curl -fsSL https://claude.ai/install.sh | bash`

2. **No ToS violation** — we're running Anthropic's actual first-party binary, exactly like Cline does. Auth is handled by Claude Code itself.

3. **No API key needed** — users who have Claude Pro/Max get it through their subscription.

4. **Claude Code IS the "eng brain"** — unlike a raw API call, it has its own system prompt, extended thinking, and agentic capabilities. We disable its built-in tools (Bash, Edit, Read, etc.) and pass our browser tools instead.

### User Setup

One-time installation of the bridge companion:

```bash
# macOS / Linux
curl -fsSL https://gyoz.ai/install-claude-bridge.sh | bash

# Or via npm
npx @gyoz-ai/claude-bridge install
```

This drops two files:

1. The bridge script (e.g., `~/.gyoza/claude-bridge.js`)
2. The native messaging host manifest JSON (in the browser-specific location)

### Files to Create

#### 1. `packages/native-host/` — New package

```
packages/native-host/
  ├── package.json
  ├── bridge.js            → The native messaging host script
  ├── install.sh           → macOS/Linux installer
  ├── install.ps1          → Windows installer
  └── manifest.json        → Template for native messaging host manifest
```

#### 2. `packages/native-host/bridge.js` — The Bridge

Core responsibilities:

- Read length-prefixed JSON from stdin (Chrome native messaging protocol)
- Write length-prefixed JSON to stdout
- Find the `claude` binary (PATH → Claude Desktop location → error)
- Spawn `claude` with Cline-compatible flags
- Pipe messages between extension and CLI
- Handle process lifecycle (spawn, kill, timeout)

```
Native Messaging Protocol (Chrome):
  [4-byte uint32 length][JSON payload] → stdin
  [4-byte uint32 length][JSON payload] ← stdout
```

**Claude CLI invocation** (matching Cline's approach):

```bash
claude \
  --output-format stream-json \
  --verbose \
  --max-turns 1 \
  --model <user-selected-model> \
  --system-prompt "<system prompt>" \
  --disallowedTools "Task,TaskOutput,Bash,Glob,Grep,Read,Edit,Write,NotebookEdit,WebFetch,WebSearch,TodoRead,TodoWrite" \
  -p
```

**Key flags:**

- `--output-format stream-json` — Newline-delimited JSON on stdout
- `--max-turns 1` — We handle the agentic loop ourselves
- `--disallowedTools` — Disable ALL built-in tools so the model uses our browser tools
- `-p` — Pipe mode (reads from stdin)

**Message types from Claude CLI** (stream-json format):

- `{ type: "system", subtype: "init" }` — Session started, includes session_id
- `{ type: "assistant" }` — Model response with content blocks (text, thinking, tool_use)
- `{ type: "result" }` — Completion with total_cost_usd, duration
- Rate limit events — Informational, can be surfaced as warnings

#### 3. `packages/native-host/install.sh` — Installer

```bash
#!/bin/bash
# 1. Create ~/.gyoza/ directory
# 2. Copy bridge.js to ~/.gyoza/claude-bridge.js
# 3. Write native messaging host manifest to:
#    - Chrome: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/ai.gyoz.claude_bridge.json
#    - Firefox: ~/.mozilla/native-messaging-hosts/ai.gyoz.claude_bridge.json
#    - Chromium: ~/.config/chromium/NativeMessagingHosts/ai.gyoz.claude_bridge.json
# 4. Verify `claude` is in PATH or at known Claude Desktop location
# 5. Print success message with next steps
```

**Native messaging host manifest** (`ai.gyoz.claude_bridge.json`):

```json
{
  "name": "ai.gyoz.claude_bridge",
  "description": "Gyoza ↔ Claude Code bridge",
  "path": "/Users/<user>/.gyoza/claude-bridge.js",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://<extension-id>/"]
}
```

### Claude Code Skill: `/install-gyoza`

A Claude Code custom slash command that automates the bridge installation for users. Instead of manually running a `curl` command, users who have Claude Code can simply type `/install-gyoza` in their Claude Code session and the bridge gets set up automatically.

#### How Claude Code Skills Work

Claude Code supports custom slash commands via markdown files placed in `.claude/commands/`. These files contain a prompt template that Claude Code executes when the user types the command. The skill has full access to Claude Code's built-in tools (Bash, Read, Write, etc.).

#### File: `.claude/commands/install-gyoza.md`

This file lives in the gyoza repo (so users who clone it get the skill automatically) and can also be distributed as a standalone installable skill.

```markdown
---
description: Install the Gyoza browser extension ↔ Claude Code bridge
---

Install the Gyoza native messaging bridge so the Gyoza browser extension can
communicate with Claude Code. This sets up a small Node.js script and registers
it as a Chrome/Firefox/Chromium native messaging host.

Steps:

1. Create the directory ~/.gyoza/ if it doesn't exist
2. Download the bridge script from https://raw.githubusercontent.com/<org>/gyozai-web-copilot/main/packages/native-host/bridge.js and save it to ~/.gyoza/claude-bridge.js
3. Make it executable: chmod +x ~/.gyoza/claude-bridge.js
4. Detect which browsers are installed and write the native messaging host manifest to the correct locations:
   - Chrome (macOS): ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/ai.gyoz.claude_bridge.json
   - Chrome (Linux): ~/.config/google-chrome/NativeMessagingHosts/ai.gyoz.claude_bridge.json
   - Firefox (macOS): ~/Library/Application Support/Mozilla/NativeMessagingHosts/ai.gyoz.claude_bridge.json
   - Firefox (Linux): ~/.mozilla/native-messaging-hosts/ai.gyoz.claude_bridge.json
   - Chromium (Linux): ~/.config/chromium/NativeMessagingHosts/ai.gyoz.claude_bridge.json
   - On Windows, write the manifest to %LOCALAPPDATA%\gyoza\ and create a Registry key at HKCU\Software\Google\Chrome\NativeMessagingHosts\ai.gyoz.claude_bridge pointing to it
5. The manifest content should be:
   {
   "name": "ai.gyoz.claude_bridge",
   "description": "Gyoza browser extension ↔ Claude Code bridge",
   "path": "<absolute path to ~/.gyoza/claude-bridge.js>",
   "type": "stdio",
   "allowed_origins": ["chrome-extension://<extension-id>/"]
   }
   For Firefox, use "allowed_extensions" instead of "allowed_origins" with the extension's Firefox add-on ID.
6. Verify the claude binary is accessible (run `which claude` or check known locations)
7. Run a quick smoke test: echo '{"type":"ping"}' | node ~/.gyoza/claude-bridge.js and verify it responds with {"status":"ok",...}
8. Print a success message with what was installed and where
```

#### Distribution Options

1. **In-repo**: Users who clone the gyoza repo get `/install-gyoza` automatically from `.claude/commands/install-gyoza.md`

2. **Global install**: Users can copy the skill to `~/.claude/commands/install-gyoza.md` to have it available in any project:

   ```bash
   mkdir -p ~/.claude/commands
   curl -fsSL https://raw.githubusercontent.com/<org>/gyozai-web-copilot/main/.claude/commands/install-gyoza.md \
     -o ~/.claude/commands/install-gyoza.md
   ```

3. **Via the extension UI**: The gyoza extension popup can show an "Install Bridge" button that copies the install command to clipboard or opens a link with instructions.

#### Why This Is Elegant

- Users already have Claude Code running — asking Claude to set up the bridge is natural
- Claude Code has Bash, Read, Write tools so it can do the full installation
- It handles platform detection, path resolution, and manifest writing automatically
- If anything goes wrong, Claude Code can diagnose and fix it on the spot
- No separate installer binary to maintain — the skill IS the installer

---

### Files to Change in Extension

#### 4. `packages/extension/src/lib/providers/types.ts`

Add third `ProviderResult` variant for Claude Code (bypasses Vercel AI SDK since it's a CLI, not an API):

```typescript
export type ProviderResult =
  | { type: "model"; model: LanguageModel }
  | { type: "legacy"; provider: LegacyLLMProvider }
  | { type: "claude-code" };
```

#### 5. `packages/extension/src/lib/providers/claude-code.ts` — New file

Bridge detection and native messaging helpers:

```typescript
const NATIVE_HOST_NAME = "ai.gyoz.claude_bridge";

export async function isClaudeCodeBridgeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(
        NATIVE_HOST_NAME,
        { type: "ping" },
        (response) => {
          resolve(!chrome.runtime.lastError && response?.status === "ok");
        },
      );
    } catch {
      resolve(false);
    }
  });
}

// The bridge responds to ping with:
// { status: "ok", claude_path: "/usr/local/bin/claude", version: "1.0.0" }
```

#### 6. `packages/extension/src/lib/providers/index.ts`

Add the `claude-code` case to `createProvider()`:

```typescript
case "claude-code":
  return { type: "claude-code" };
```

#### 7. `packages/extension/src/entrypoints/background.ts`

Add a new code path in `handleQuery()` for Claude Code:

```typescript
// ─── Claude Code mode: Native Messaging Bridge ──────────────────────
if (providerResult.type === "claude-code") {
  return handleClaudeCodeQuery(
    message,
    senderTabId,
    settings,
    history,
    systemPrompt,
    userPrompt,
  );
}
```

**`handleClaudeCodeQuery()` implementation:**

1. Connect to native host: `chrome.runtime.connectNative("ai.gyoz.claude_bridge")`
2. Send message with: model, system prompt, user messages, tool definitions (our browser tools described in Claude's format)
3. Read stream-json responses line by line
4. Parse `assistant` messages for:
   - `text` content blocks → send as `show_message` stream events
   - `thinking` content blocks → optional, could surface as "thinking..." status
   - `tool_use` content blocks → map to our browser tools and execute them
5. After tool execution, send tool results back to the bridge (for multi-turn within a single query)
6. On `result` message → return final `AgentResult`

**Tool mapping challenge:**
Claude Code's tool_use blocks will reference our custom tools (show_message, navigate, click, execute_js, etc.) because we disabled its built-in tools and describe ours in the system prompt. The tool call format from the CLI is standard Anthropic format:

```json
{
  "type": "tool_use",
  "id": "toolu_xxx",
  "name": "click",
  "input": { "selector": "#btn", "text": "Submit" }
}
```

We execute these the same way as the Vercel AI SDK path, then send tool results back.

### Bridge Detection

On popup load and when switching to `claude-code` provider, probe the bridge:

```typescript
async function detectClaudeCodeBridge(): Promise<{
  available: boolean;
  claudePath?: string;
}> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(
        "ai.gyoz.claude_bridge",
        { type: "ping" },
        (response) => {
          if (chrome.runtime.lastError || response?.status !== "ok") {
            resolve({ available: false });
          } else {
            resolve({
              available: true,
              claudePath: response.claude_path,
            });
          }
        },
      );
    } catch {
      resolve({ available: false });
    }
  });
}
```

### Models for Claude Code

Claude Code's `--model` flag accepts model aliases (`sonnet`, `opus`, `haiku`) or full model IDs. The user selects from a dropdown in the popup, and the selected model ID is passed to the CLI via `--model`.

```typescript
"claude-code": [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
],
```

---

## Phase 2: Codex via ChatGPT Subscription (OAuth)

**Effort**: Medium-High (2-3 days)
**Value**: Users with ChatGPT Plus/Pro/Max can use Codex models for free (no API key)
**Auth**: OAuth 2.0 PKCE flow via ChatGPT

### Architecture

```
Extension Popup → "Sign in with OpenAI" button
  → chrome.identity.launchWebAuthFlow() → auth.openai.com/oauth/authorize
  → User authenticates with ChatGPT account
  → Redirect back to extension with auth code
  → Exchange code for tokens
  → Store tokens in chrome.storage.local
  → Background worker uses bearer token to call chatgpt.com/backend-api/codex/responses
```

### Why chrome.identity Works Here

- `chrome.identity.launchWebAuthFlow()` opens a browser window for OAuth
- Redirect URL is `https://<extension-id>.chromiumapp.org/auth/callback` (auto-handled by Chrome)
- No localhost server needed (unlike Cline which runs an HTTP server on port 1455)
- PKCE flow means no client secret needed (public client)

### OAuth Parameters (from Cline's implementation)

| Parameter         | Value                                                |
| ----------------- | ---------------------------------------------------- |
| Authorization URL | `https://auth.openai.com/oauth/authorize`            |
| Token URL         | `https://auth.openai.com/oauth/token`                |
| Client ID         | `app_EMoamEEZ73f0CkXaXp7hrann` (Codex public client) |
| Redirect URI      | `https://<ext-id>.chromiumapp.org/auth/callback`     |
| Scopes            | `openid profile email offline_access`                |
| PKCE Method       | S256                                                 |
| Extra Params      | `codex_cli_simplified_flow=true`, `originator=gyoza` |

**Important**: The client ID is a public Codex client used by the official Codex CLI. Cline also uses it with `originator=cline`. We would use `originator=gyoza`. Whether the redirect URI is accepted depends on OpenAI's server validation — this needs testing. If it rejects the chrome-extension redirect, we may need to register our own OAuth client with OpenAI or use a proxy redirect.

### Files to Create

#### 1. `packages/extension/src/lib/codex-oauth.ts` — OAuth Flow

```typescript
// ─── PKCE utilities ──────────────────────────────────────────────────────────

function generateCodeVerifier(): string; // 32 random bytes, base64url
async function generateCodeChallenge(verifier: string): Promise<string>; // SHA-256, base64url
function generateState(): string; // 16 random bytes, hex

// ─── OAuth flow ──────────────────────────────────────────────────────────────

async function startCodexOAuthFlow(): Promise<CodexCredentials>;
async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<TokenResponse>;
async function refreshCodexToken(refreshToken: string): Promise<TokenResponse>;
function extractAccountIdFromJWT(token: string): string | null;

// ─── Credential storage ─────────────────────────────────────────────────────

async function getCodexCredentials(): Promise<CodexCredentials | null>;
async function saveCodexCredentials(creds: CodexCredentials): Promise<void>;
async function clearCodexCredentials(): Promise<void>;
async function getValidCodexAccessToken(): Promise<string>; // auto-refreshes
```

**Credential shape:**

```typescript
interface CodexCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms since epoch
  email?: string;
  accountId?: string; // ChatGPT Account ID from JWT
}
```

**OAuth flow detail (`startCodexOAuthFlow`):**

1. Generate `code_verifier` and `code_challenge` (S256)
2. Generate random `state`
3. Build authorization URL:
   ```
   https://auth.openai.com/oauth/authorize
     ?client_id=app_EMoamEEZ73f0CkXaXp7hrann
     &redirect_uri=https://<ext-id>.chromiumapp.org/auth/callback
     &scope=openid profile email offline_access
     &code_challenge=<S256 hash>
     &code_challenge_method=S256
     &response_type=code
     &state=<random hex>
     &codex_cli_simplified_flow=true
     &originator=gyoza
   ```
4. Call `chrome.identity.launchWebAuthFlow({ url, interactive: true })`
5. Parse redirect URL for `code` and `state`, validate state matches
6. Exchange code for tokens:

   ```
   POST https://auth.openai.com/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &client_id=app_EMoamEEZ73f0CkXaXp7hrann
   &code=<code>
   &redirect_uri=<redirect_uri>
   &code_verifier=<verifier>
   ```

   **Note**: Do NOT include `state` in the token exchange body (OpenAI rejects it).

7. Extract `ChatGPT-Account-Id` from JWT claims in `id_token` or `access_token`:
   - Check `chatgpt_account_id` (root)
   - Check `https://api.openai.com/auth` → `chatgpt_account_id` (nested)
   - Fallback: `organizations[0].id`
8. Save credentials to `chrome.storage.local`

#### 2. `packages/extension/src/lib/providers/codex-subscription.ts` — API Handler

The Codex subscription endpoint uses the **OpenAI Responses API** format (NOT Chat Completions), and the endpoint is `chatgpt.com/backend-api/codex/responses` (NOT `api.openai.com`).

This means we **cannot** use `@ai-sdk/openai` for this path. We need a custom `LanguageModel` adapter that wraps the Codex subscription endpoint so we can keep using `streamText()` in background.ts.

```typescript
export function createCodexSubscriptionModel(
  modelId: string,
  getAccessToken: () => Promise<string>,
  accountId: string | undefined,
): LanguageModel;
```

**Request format** (Responses API):

```json
{
  "model": "gpt-5.3-codex",
  "input": [],
  "stream": true,
  "store": false,
  "instructions": "<system prompt>",
  "reasoning": { "effort": "medium", "summary": "auto" },
  "tools": []
}
```

**Message format conversion**: The Responses API uses `input` instead of `messages`. Each message is an object with `role` and `content`. System prompt goes in `instructions`, not as a message.

**Response events** (SSE from `chatgpt.com/backend-api/codex/responses`):

- `response.output_text.delta` → text chunks
- `response.function_call_arguments.delta` → tool call argument chunks
- `response.output_item.added` → new tool call started (with function name, call_id)
- `response.output_item.done` → tool call complete
- `response.done` / `response.completed` → finished, includes usage

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
originator: gyoza
session_id: <UUIDv7, generated once per handler>
ChatGPT-Account-Id: <account_id>
```

### Files to Change in Extension

#### 3. `packages/extension/src/lib/providers/index.ts`

Add the `codex` case:

```typescript
case "codex": {
  const token = await getValidCodexAccessToken();
  const creds = await getCodexCredentials();
  return {
    type: "model",
    model: createCodexSubscriptionModel(
      settings.model,
      getValidCodexAccessToken,
      creds?.accountId,
    ),
  };
}
```

**Note**: `createProvider()` becomes `async` since Codex needs to fetch tokens.

### Token Refresh Strategy

- Check token expiry before each API call (5-minute buffer, matching Cline's approach)
- If expired, refresh using `POST auth.openai.com/oauth/token` with `grant_type=refresh_token`
- If refresh fails (`invalid_grant`, 401, 403), clear credentials and prompt re-login
- Retry once on 401 during API calls (force-refresh then retry)
- Concurrent refresh deduplicated via singleton promise (prevents race conditions)

### Codex Models

The user selects from a dropdown in the popup. The selected model ID is passed in the `model` field of the Responses API request body. These models are available through the ChatGPT subscription endpoint (pricing is $0 — included with Plus/Pro/Max).

```typescript
codex: [
  { id: "gpt-5.4", name: "GPT-5.4" },
  { id: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
  { id: "gpt-5.2-codex", name: "GPT-5.2 Codex" },
  { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini" },
  { id: "gpt-5.2", name: "GPT-5.2" },
],
```

### Risks & Mitigations

| Risk                                                           | Impact                 | Mitigation                                                                                          |
| -------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `chatgpt.com/backend-api/codex` is a private API               | Could break w/o notice | Monitor for changes; surface clear error to user if endpoint shifts                                 |
| Client ID may not accept extension redirect URIs               | OAuth flow fails       | Test first; if rejected, register own OAuth client with OpenAI or use a proxy redirect              |
| OpenAI could block third-party use (like Anthropic did)        | Feature dies           | Unlike Anthropic, OpenAI has been actively supportive of third-party Codex OAuth (Cline, Roo, etc.) |
| Token refresh races in service worker                          | Stale tokens           | Singleton refresh promise (same pattern as Cline)                                                   |
| Service worker idle shutdown (30s) during long Codex responses | Request dropped        | Use `chrome.runtime.getContexts()` keepalive or periodic self-ping                                  |

---

## Shared Work: Storage & UI Changes

These changes support both Phase 1 and Phase 2.

### `packages/extension/src/lib/storage.ts`

Expand `ProviderKey` and settings:

```typescript
export type ProviderKey =
  | "claude"
  | "openai"
  | "gemini"
  | "claude-code"
  | "codex";

export interface ExtensionSettings {
  // ... existing fields ...
  apiKeys: Record<ProviderKey, string>; // claude-code and codex keys will be empty
  codexCredentials?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    email?: string;
    accountId?: string;
  };
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  // ...
  apiKeys: { claude: "", openai: "", gemini: "", "claude-code": "", codex: "" },
  // ...
};
```

### `packages/extension/wxt.config.ts`

Add required permissions:

```typescript
permissions: [
  "activeTab",
  "tabs",
  "storage",
  "scripting",
  "notifications",
  "nativeMessaging", // Phase 1: Claude Code bridge
  "identity",        // Phase 2: Codex OAuth
],
```

### `packages/extension/src/entrypoints/popup/App.tsx`

Add both providers with conditional UI:

```typescript
const PROVIDERS = [
  { id: "claude", name: "Claude (Anthropic)" },
  { id: "openai", name: "OpenAI" },
  { id: "gemini", name: "Gemini (Google)" },
  { id: "claude-code", name: "Claude Code (Local)" },
  { id: "codex", name: "Codex (ChatGPT Sub)" },
] as const;

const MODELS: Record<string, Array<{ id: string; name: string }>> = {
  claude: [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
    { id: "gpt-5.4-nano", name: "GPT-5.4 Nano" },
  ],
  gemini: [
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
    {
      id: "gemini-3.1-flash-lite-preview",
      name: "Gemini 3.1 Flash Lite Preview",
    },
  ],
  "claude-code": [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
    { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
  ],
  codex: [
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
    { id: "gpt-5.2-codex", name: "GPT-5.2 Codex" },
    { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini" },
    { id: "gpt-5.2", name: "GPT-5.2" },
  ],
};
```

**Conditional UI per provider:**

| Provider      | API Key Input | Special UI                                                             |
| ------------- | ------------- | ---------------------------------------------------------------------- |
| `claude`      | Show          | —                                                                      |
| `openai`      | Show          | —                                                                      |
| `gemini`      | Show          | —                                                                      |
| `claude-code` | **Hide**      | Bridge status (connected/not found), "Install Bridge" link, setup note |
| `codex`       | **Hide**      | "Sign in with OpenAI" button or "Signed in as user@email" + sign-out   |

### i18n

All new UI strings must be added to ALL language files (per project rules).

---

## Implementation Order & Dependencies

```
Phase 1 (Claude Code)          Phase 2 (Codex OAuth)
  ├── 1a. native-host pkg         ├── 2a. OAuth PKCE flow
  ├── 1b. installer scripts       ├── 2b. Token management
  ├── 1c. claude-code provider    ├── 2c. Responses API adapter
  └── 1d. tool mapping + test     └── 2d. Custom LanguageModel
              │                              │
              └──────── Shared work ─────────┘
                  ├── storage.ts (ProviderKey, settings)
                  ├── wxt.config.ts (permissions)
                  ├── popup/App.tsx (providers, models, conditional UI)
                  └── i18n (all languages)
```

Phases 1 and 2 are independent and can be done in parallel. The shared work should be done first or alongside Phase 1.

---

## Appendix A: How Cline Integrates Claude Code

**Source**: `src/integrations/claude-code/run.ts` in the Cline repo.

Cline spawns the Claude CLI as a child process:

```typescript
const claudeCodeProcess = execa(claudePath, args, {
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
  env, // ANTHROPIC_API_KEY deliberately deleted
  cwd,
  maxBuffer: BUFFER_SIZE,
  timeout: CLAUDE_CODE_TIMEOUT, // 10 minutes
});
```

**CLI flags:**

- `--output-format stream-json` — Newline-delimited JSON stdout
- `--verbose` — Extra logging
- `--max-turns 1` — Cline controls the agentic loop
- `--model <modelId>` — User-selected model
- `--system-prompt <prompt>` (or `--system-prompt-file` for long prompts on Windows)
- `--disallowedTools Task,TaskOutput,Bash,Glob,Grep,Read,Edit,Write,...` — Disables all built-in tools
- `-p` — Pipe mode (reads messages from stdin)

**Messages piped to stdin**: `claudeCodeProcess.stdin.write(JSON.stringify(messages))`

**Output format** (stream-json, one JSON per line):

```json
{"type":"system","subtype":"init","session_id":"...","tools":[...],"apiKeySource":"..."}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."},{"type":"tool_use","id":"...","name":"...","input":{...}}]}}
{"type":"result","total_cost_usd":0.05,"is_error":false,"duration_ms":3200}
```

**Image handling**: Claude Code doesn't support images. Cline replaces image blocks with text placeholders: `[Image (base64): image/png not supported by Claude Code]`.

**Auth**: Cline deletes `ANTHROPIC_API_KEY` from env, letting Claude Code resolve auth itself (subscription tokens stored in macOS Keychain).

**Models**: `sonnet`, `opus`, `haiku`, plus versioned IDs. All have `supportsImages: false`.

**Settings UI**: Only one field — the path to the `claude` CLI binary (defaults to "claude").

---

## Appendix B: How Cline Integrates Codex

**Source**: `src/integrations/openai-codex/oauth.ts` and `src/core/api/providers/openai-codex.ts` in the Cline repo.

### OAuth 2.0 PKCE Flow

1. Generate `code_verifier` (32 random bytes, base64url) and `code_challenge` (SHA-256 hash)
2. Open browser to:
   ```
   https://auth.openai.com/oauth/authorize
     ?client_id=app_EMoamEEZ73f0CkXaXp7hrann
     &redirect_uri=http://localhost:1455/auth/callback
     &scope=openid profile email offline_access
     &code_challenge=<S256 hash>
     &code_challenge_method=S256
     &response_type=code
     &state=<random hex>
     &codex_cli_simplified_flow=true
     &originator=cline
   ```
3. Local HTTP server on port 1455 catches the callback
4. Exchange code for tokens:

   ```
   POST https://auth.openai.com/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code&client_id=app_EMoamEEZ73f0CkXaXp7hrann&code=<code>&redirect_uri=<uri>&code_verifier=<verifier>
   ```

5. Extract `ChatGPT-Account-Id` from JWT claims in id_token/access_token:
   - `chatgpt_account_id` (root-level)
   - `https://api.openai.com/auth` → `chatgpt_account_id` (nested)
   - `organizations[0].id` (fallback)
6. Store credentials in VS Code SecretStorage

### API Calls

**Endpoint**: `POST https://chatgpt.com/backend-api/codex/responses`

**Headers**:

```
Authorization: Bearer <access_token>
Content-Type: application/json
originator: cline
session_id: <UUIDv7>
ChatGPT-Account-Id: <account_id>
```

**Request body** (OpenAI Responses API format):

```json
{
  "model": "gpt-5.3-codex",
  "input": [],
  "stream": true,
  "store": false,
  "instructions": "<system prompt>",
  "reasoning": { "effort": "medium", "summary": "auto" },
  "tools": []
}
```

**Token refresh**: Auto-refresh with 5-minute buffer. POST to `auth.openai.com/oauth/token` with `grant_type=refresh_token`. Concurrent refresh deduplicated via singleton promise.

**Pricing**: $0 per token (uses ChatGPT subscription).

---

## Appendix C: Why Claude Code OAuth Cannot Be Used Directly

### The OAuth Flow Exists

Claude Code uses standard OAuth 2.0 PKCE:

- Client ID: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- Authorize URL: `https://claude.com/cai/oauth/authorize`
- Token URL: `https://platform.claude.com/v1/oauth/token`
- API calls: `Authorization: Bearer <token>` + `anthropic-beta: oauth-2025-04-20`

### But Anthropic Prohibits Third-Party Use

From [Anthropic's Legal & Compliance docs](https://code.claude.com/docs/en/legal-and-compliance):

> "OAuth authentication (used with Free, Pro, and Max plans) is intended exclusively for Claude Code and Claude.ai. Using OAuth tokens obtained through Claude Free, Pro, or Max accounts in any other product, tool, or service — including the Agent SDK — is not permitted and constitutes a violation of the Consumer Terms of Service."

### Enforcement

- **January 2026**: Anthropic deployed server-side checks blocking subscription tokens from non-genuine Claude Code binaries
- **February 2026**: Updated documentation to formally ban third-party OAuth usage
- **Legal takedowns**: Sent to projects like OpenCode, CLIProxyAPI, OpenClaw

### Why Native Messaging Bridge Is Different

Running the actual `claude` CLI binary via Native Messaging is the same pattern as Cline — we're invoking Anthropic's first-party tool, not spoofing OAuth tokens. The CLI handles auth internally. This is the only legitimate path.
