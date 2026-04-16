# Smart Context Search + Execute Page Function — Implementation Plan

## Problem

`get_page_context(fullPage)` dumps 30-35K chars of HTML every call. Most is irrelevant. JS bundles are completely invisible. Models waste tokens re-reading pages, call the tool multiple times, and still miss dynamic behavior hidden in JS.

## Solution

Replace `get_page_context` with two new tools:
1. **`search_page`** — Search raw HTML and cached JS for specific patterns. Returns focused matches with configurable context.
2. **`execute_page_function`** — Call functions/code the AI discovered via `search_page`. The AI reads JS, understands what's available, then executes it.

---

## Part 1: JS Script Cache (Background Script)

### Where: `packages/extension/src/entrypoints/background.ts`

Add module-level cache alongside existing `engines` and `activeQueries` Maps (after line 43):

```typescript
// ─── Script Cache (per-tab) ────────────────────────────────────────────
interface CachedScript {
  key: string              // URL for external, "inline-{index}-{hash}" for inline
  source: string           // raw JS text
  type: "inline" | "external"
  url?: string
  contentHash: string      // first 16 chars of sha256
  size: number
}

interface TabScriptCache {
  origin: string
  scripts: Map<string, CachedScript>
  totalSize: number
}

const scriptCaches = new Map<number, TabScriptCache>()
const MAX_CACHE_SIZE_PER_TAB = 5 * 1024 * 1024  // 5MB
const MAX_SCRIPT_SIZE = 1 * 1024 * 1024          // skip scripts > 1MB
```

### Message handler: `gyozai_cache_scripts`

Content script sends list of scripts found on page. Background fetches externals, stores all.

```typescript
// In onMessage dispatcher (line 355+)
case "gyozai_cache_scripts": {
  const { tabId, origin, scripts } = msg
  // scripts: Array<{ key, type, url?, inlineContent?, contentHash }>
  
  let cache = scriptCaches.get(tabId)
  if (!cache || cache.origin !== origin) {
    // New origin — clear and start fresh
    cache = { origin, scripts: new Map(), totalSize: 0 }
    scriptCaches.set(tabId, cache)
  }
  
  for (const script of scripts) {
    if (cache.scripts.has(script.key)) continue  // already cached
    
    if (script.type === "inline" && script.inlineContent) {
      if (script.inlineContent.length > MAX_SCRIPT_SIZE) continue
      cache.scripts.set(script.key, {
        key: script.key,
        source: script.inlineContent,
        type: "inline",
        contentHash: script.contentHash,
        size: script.inlineContent.length,
      })
      cache.totalSize += script.inlineContent.length
    }
    
    if (script.type === "external" && script.url) {
      try {
        const res = await fetch(script.url)
        const text = await res.text()
        if (text.length > MAX_SCRIPT_SIZE) continue
        cache.scripts.set(script.key, {
          key: script.key,
          source: text,
          type: "external",
          url: script.url,
          contentHash: script.contentHash,
          size: text.length,
        })
        cache.totalSize += text.length
      } catch { /* skip unfetchable scripts */ }
    }
    
    // Evict if over budget
    while (cache.totalSize > MAX_CACHE_SIZE_PER_TAB) {
      const largest = [...cache.scripts.values()].sort((a, b) => b.size - a.size)[0]
      if (!largest) break
      cache.scripts.delete(largest.key)
      cache.totalSize -= largest.size
    }
  }
  return true
}
```

### Message handler: `gyozai_search_scripts`

Tool calls this to search cached JS.

```typescript
case "gyozai_search_scripts": {
  const { tabId, patterns, contextChars = 150, maxResults = 15 } = msg
  const cache = scriptCaches.get(tabId)
  if (!cache) return { matches: [], stats: { js_files: 0, js_total_size: 0 } }
  
  const matches: Array<{ source: string, match: string, position: number }> = []
  
  for (const [key, script] of cache.scripts) {
    for (const pattern of patterns) {
      let idx = 0
      const lowerSource = script.source.toLowerCase()
      const lowerPattern = pattern.toLowerCase()
      while ((idx = lowerSource.indexOf(lowerPattern, idx)) !== -1 && matches.length < maxResults) {
        const start = Math.max(0, idx - contextChars)
        const end = Math.min(script.source.length, idx + pattern.length + contextChars)
        matches.push({
          source: script.url || key,
          match: script.source.slice(start, end),
          position: idx,
        })
        idx += pattern.length
      }
      if (matches.length >= maxResults) break
    }
    if (matches.length >= maxResults) break
  }
  
  return {
    matches,
    stats: {
      js_files: cache.scripts.size,
      js_total_size: cache.totalSize,
    },
  }
}
```

### Cache invalidation

In existing `webNavigation.onBeforeNavigate` (line 45):

```typescript
// Clear script cache on cross-origin navigation
const existingCache = scriptCaches.get(tabId)
if (existingCache) {
  try {
    const newOrigin = new URL(details.url).origin
    if (existingCache.origin !== newOrigin) {
      scriptCaches.delete(tabId)
    }
  } catch { scriptCaches.delete(tabId) }
}
```

On tab close (add `browser.tabs.onRemoved` listener):
```typescript
browser.tabs.onRemoved.addListener((tabId) => {
  scriptCaches.delete(tabId)
  // ... existing cleanup
})
```

---

## Part 2: Script Collection (Content Script)

### Where: `packages/extension/src/entrypoints/content/index.tsx`

On page load (in `defineContentScript.main()`), collect all scripts and send to background:

```typescript
// Collect and cache page scripts
async function collectPageScripts() {
  const scripts: Array<{
    key: string
    type: "inline" | "external"
    url?: string
    inlineContent?: string
    contentHash: string
  }> = []
  
  const scriptEls = document.querySelectorAll("script")
  let inlineIdx = 0
  
  for (const el of scriptEls) {
    if (el.src) {
      // External script
      scripts.push({
        key: el.src,
        type: "external",
        url: el.src,
        contentHash: el.src,  // URL is unique enough for external
      })
    } else if (el.textContent && el.textContent.trim().length > 10) {
      // Inline script (skip tiny ones)
      const content = el.textContent
      // Simple hash: first 16 chars of base64 of first 200 chars
      const hashInput = content.slice(0, 200)
      const hash = btoa(hashInput).slice(0, 16)
      scripts.push({
        key: `inline-${inlineIdx}-${hash}`,
        type: "inline",
        inlineContent: content,
        contentHash: hash,
      })
      inlineIdx++
    }
  }
  
  if (scripts.length > 0) {
    browser.runtime.sendMessage({
      type: "gyozai_cache_scripts",
      tabId: await getTabId(),
      origin: window.location.origin,
      scripts,
    }).catch(() => {})
  }
}

// Run on load
collectPageScripts()

// Watch for dynamically added scripts
const scriptObserver = new MutationObserver((mutations) => {
  let hasNewScripts = false
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node instanceof HTMLScriptElement) hasNewScripts = true
    }
  }
  if (hasNewScripts) collectPageScripts()
})
scriptObserver.observe(document.documentElement, { childList: true, subtree: true })
```

### SPA Navigation Detection

Listen for pushState/replaceState to re-collect inline scripts:

```typescript
// Patch history methods to detect SPA navigations
const origPushState = history.pushState.bind(history)
const origReplaceState = history.replaceState.bind(history)
history.pushState = (...args) => { origPushState(...args); collectPageScripts() }
history.replaceState = (...args) => { origReplaceState(...args); collectPageScripts() }
window.addEventListener("popstate", () => collectPageScripts())
```

---

## Part 3: `search_page` Tool

### Where: `packages/extension/src/lib/tools.ts`

Replaces `get_page_context` entirely.

```typescript
tools.search_page = tool({
  description:
    "Search the current page's HTML and JavaScript for specific patterns. " +
    "Returns matching snippets with surrounding context. " +
    "Use this to find elements, text, forms, buttons, API endpoints, " +
    "function definitions, event handlers — anything on the page. " +
    "You can search HTML (DOM), JS (all page scripts including external bundles), or both. " +
    "Adjust context_chars to control how much surrounding code you see around each match.",
  inputSchema: jsonSchema<{
    query: string | string[]
    scope?: "all" | "html" | "js"
    context_chars?: number
    max_results?: number
  }>({
    type: "object",
    properties: {
      query: {
        oneOf: [
          { type: "string" },
          { type: "array", items: { type: "string" } },
        ],
        description:
          "Text pattern(s) to search for (case-insensitive). " +
          "Examples: '<button', '/api/', 'addToCart', 'querySelector'",
      },
      scope: {
        type: "string",
        enum: ["all", "html", "js"],
        description: "Where to search. 'html' = page DOM, 'js' = all scripts (inline + external cached bundles), 'all' = both. Default: 'all'",
      },
      context_chars: {
        type: "number",
        description: "Characters of surrounding context around each match (default: 150). Use more (300-500) for understanding code flow, less (50-100) for quick scanning.",
      },
      max_results: {
        type: "number",
        description: "Maximum matches to return (default: 15)",
      },
    },
    required: ["query"],
  }),
  execute: async ({ query, scope = "all", context_chars = 150, max_results = 15 }) => {
    const patterns = Array.isArray(query) ? query : [query]
    const results: {
      html_matches: Array<{ match: string; position: number }>
      js_matches: Array<{ source: string; match: string; position: number }>
      stats: { html_size: number; js_files: number; js_total_size: number }
    } = {
      html_matches: [],
      js_matches: [],
      stats: { html_size: 0, js_files: 0, js_total_size: 0 },
    }
    
    // HTML search — runs in content script via message
    if (scope === "all" || scope === "html") {
      const htmlResult = await browser.tabs.sendMessage(ctx.tabId, {
        type: "gyozai_search_html",
        patterns,
        contextChars: context_chars,
        maxResults: max_results,
      })
      if (htmlResult) {
        results.html_matches = htmlResult.matches || []
        results.stats.html_size = htmlResult.htmlSize || 0
      }
    }
    
    // JS search — runs in background script (has the cache)
    if (scope === "all" || scope === "js") {
      const jsResult = await browser.runtime.sendMessage({
        type: "gyozai_search_scripts",
        tabId: ctx.tabId,
        patterns,
        contextChars: context_chars,
        maxResults: max_results - results.html_matches.length,
      })
      if (jsResult) {
        results.js_matches = jsResult.matches || []
        results.stats.js_files = jsResult.stats?.js_files || 0
        results.stats.js_total_size = jsResult.stats?.js_total_size || 0
      }
    }
    
    return results
  },
})
```

### HTML Search Handler (Content Script)

Add in `content/index.tsx` message listener:

```typescript
case "gyozai_search_html": {
  const { patterns, contextChars = 150, maxResults = 15 } = msg
  const html = document.documentElement.outerHTML
  const matches: Array<{ match: string; position: number }> = []
  const lowerHtml = html.toLowerCase()
  
  for (const pattern of patterns) {
    let idx = 0
    const lowerPattern = pattern.toLowerCase()
    while ((idx = lowerHtml.indexOf(lowerPattern, idx)) !== -1 && matches.length < maxResults) {
      const start = Math.max(0, idx - contextChars)
      const end = Math.min(html.length, idx + pattern.length + contextChars)
      matches.push({ match: html.slice(start, end), position: idx })
      idx += pattern.length
    }
    if (matches.length >= maxResults) break
  }
  
  return { matches, htmlSize: html.length }
}
```

---

## Part 4: `execute_page_function` Tool

### Where: `packages/extension/src/lib/tools.ts`

This tool lets the AI call functions or execute code it discovered through `search_page`.

```typescript
tools.execute_page_function = tool({
  description:
    "Execute JavaScript code on the page that you discovered through search_page. " +
    "Use this AFTER using search_page to find functions, API calls, or JS patterns. " +
    "You can call page functions, trigger events, read state, or make API calls " +
    "that you found in the page's JavaScript code. " +
    "Examples: call a function like addToCart('id'), read window.__NEXT_DATA__, " +
    "or make a fetch() call to an API endpoint you found in the JS bundle.",
  inputSchema: jsonSchema<{
    code: string
    description: string
  }>({
    type: "object",
    properties: {
      code: {
        type: "string",
        description:
          "JavaScript code to execute in the page context. " +
          "Must be based on functions/patterns you found via search_page. " +
          "The code runs in the page's global scope (window).",
      },
      description: {
        type: "string",
        description:
          "Human-readable description of what this code does, " +
          "e.g. 'Call addToCart to add product ABC to cart' or " +
          "'Fetch order status from /api/orders endpoint'",
      },
    },
    required: ["code", "description"],
  }),
  execute: async ({ code, description }) => {
    ctx.onStreamEvent?.({
      kind: "tool-status",
      content: description,
    })
    try {
      const result = await execInPage(
        ctx.tabId,
        ((jsCode: string) => {
          try {
            // Use indirect eval to run in global scope
            const fn = new Function(`return (async () => { ${jsCode} })()`)
            return fn().then(
              (val: unknown) => ({
                success: true,
                result: typeof val === "object" ? JSON.stringify(val) : String(val ?? "undefined"),
              }),
              (err: Error) => ({
                success: false,
                error: err.message || String(err),
              }),
            )
          } catch (e) {
            return {
              success: false,
              error: e instanceof Error ? e.message : String(e),
            }
          }
        }) as (...args: never[]) => Promise<{ success: boolean; result?: string; error?: string }>,
        [code],
      )
      
      return result || { success: false, error: "No result returned" }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  },
})

// Wrap with confirmation in non-yolo mode
if (!yoloMode) {
  tools.execute_page_function.execute = withConfirmation(
    ctx,
    (args: { description: string }) => args.description,
    tools.execute_page_function.execute!,
  )
}
// Wrap with verification (check page state before/after)
tools.execute_page_function.execute = withVerification(ctx, tools.execute_page_function.execute!)
```

---

## Part 5: Remove `get_page_context`

### Files to change:

| File | What to remove/change |
|------|----------------------|
| `tools.ts` | Delete `get_page_context` tool definition (~60 lines) |
| `tools.ts` | Delete `TOOL_DESCRIPTORS.get_page_context` entry |
| `tools.ts` | Add `TOOL_DESCRIPTORS.search_page` and `execute_page_function` entries |
| `tools.ts` | Update `capturePageState()` for verification (use simple HTML text diff instead of structured capture) |
| `content/index.tsx` | Replace `gyozai_tool_capture_context` handler with `gyozai_search_html` handler |
| `content/index.tsx` | Add `collectPageScripts()` + MutationObserver + SPA detection |
| `background.ts` | Add script cache, `gyozai_cache_scripts`, `gyozai_search_scripts` handlers, tab cleanup |
| `query.ts` | Remove `get_page_context` from `prepareStep` logic, remove PAGE_ACTION_TOOLS reference to it |
| `prompts.ts` | Rewrite system prompt — search-first approach, explain search_page + execute_page_function |
| `GyozaiWidget.tsx` | Update pending-nav `snapshotTypes` references (line 812) — no longer needed |

### Engine package cleanup:

| File | Action |
|------|--------|
| `packages/engine/src/page-context.ts` | Can keep for now (verification uses some helpers) or delete entirely. Functions like `isEffectivelyHidden`, `isSensitiveField` may still be useful. |

### Verification rework (`capturePageState`):

Replace structured capture with simple text snapshot for before/after diffing:

```typescript
async function capturePageState(tabId: number): Promise<string> {
  try {
    const result = await browser.tabs.sendMessage(tabId, {
      type: "gyozai_capture_text",  // new simple handler
    })
    return (result?.text as string) || ""
  } catch { return "" }
}
```

Content script handler:
```typescript
case "gyozai_capture_text": {
  // Quick text-only snapshot for verification diffing
  const text = document.body?.innerText?.slice(0, 5000) || ""
  return { text }
}
```

---

## Part 6: System Prompt Rewrite

### Where: `packages/extension/src/lib/prompts.ts`

Key changes to `BASE_RULES` and capability section:

```
Available tools:
- search_page: Search the page's HTML and JavaScript for specific patterns.
  Returns focused snippets with surrounding context. Use this to find
  elements, forms, buttons, API endpoints, functions, event handlers.
  Start with broad queries, narrow down. Adjust context_chars for detail.
  
- execute_page_function: Execute JavaScript you found via search_page.
  Call page functions, trigger events, read state, or make API calls.
  ONLY use code patterns you discovered through search_page — do not
  guess function names or API endpoints. Search first, execute second.

Rules:
- ALWAYS search before acting. Call search_page to find what you need,
  then use click/fill_input/execute_page_function to act on it.
- Do NOT search for the same thing twice. Read your results carefully.
- Start with small context_chars (100-150), increase if you need more
  understanding of surrounding code.
- For JS: search for string literals (API URLs, selectors, event names).
  These survive minification. Don't search for variable names.
- execute_page_function is powerful — prefer it when you find a direct
  function call or API endpoint in JS, rather than trying to click
  through multiple UI elements.
```

Remove all references to:
- `get_page_context`
- `fullPage`, `buttons`, `links`, `forms`, `inputs`, `textContent`
- "capture page context"
- "read the page"

---

## Part 7: Execution Model Proxy Endpoint (Phase 2 — separate PR)

New endpoint on gyozai-platform. Does NOT modify existing `/v1/ai/chat/completions`.

### Where: `apps/api/src/routes/ai-proxy.ts` (platform repo)

**`POST /v1/ai/execute`** — server-controlled execution model

```typescript
aiProxyRoutes.post('/execute', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  
  // Server picks the execution model — user has no choice
  const EXECUTION_MODEL = process.env.EXECUTION_MODEL || 'gemini-2.5-flash'
  const EXECUTION_CREDIT_COST = 1  // always cheap
  
  // Same quota check as chat/completions
  const tier = getTier(user.plan)
  if (!tier.managed) return c.json({ error: 'Plan does not include managed access' }, 403)
  const quota = await checkQuota(user.id, user.plan)
  if (!quota.allowed) return c.json({ error: 'Quota exceeded' }, 429)
  
  // Same message conversion, same streaming, but fixed model
  const provider = resolveProvider(EXECUTION_MODEL)
  const aiModel = createPlatformModel(EXECUTION_MODEL)
  // ... rest follows same pattern as chat/completions
})
```

### Differences from `/v1/ai/chat/completions`:

| Aspect | `/v1/ai/chat/completions` | `/v1/ai/execute` |
|---|---|---|
| Model | User-selected | Server-selected (`EXECUTION_MODEL` env var) |
| Credit cost | 1-40 per model tier | Fixed 1 credit always |
| Purpose | Chat, reasoning, user-facing | Tool calls, HTML/JS parsing |
| Streaming | Always | Optional (short responses) |
| Body format | Same OpenAI-compatible | Same OpenAI-compatible |
| Auth | Same session token | Same session token |

### Extension integration:

In `packages/extension/src/lib/providers/index.ts`:

```typescript
// Managed mode — two providers
if (settings.mode === "managed") {
  const chatProvider = createOpenAI({
    baseURL: PLATFORM_URL,
    apiKey: settings.managedToken,
  })
  const executionProvider = createOpenAI({
    baseURL: PLATFORM_URL.replace('/ai', '/ai'),  // same base
    apiKey: settings.managedToken,
    // Override endpoint for execution calls
  })
  return {
    type: "dual",
    chatModel: chatProvider.chat(settings.model),
    executionModel: executionProvider.chat("execution"),  // server picks real model
  }
}
```

### BYOK mode:

User configures `executionModel` + `executionProvider` in settings (optional, defaults to same as chat model). No proxy involved — direct to provider.

### Execution model:

**GPT OSS 120B on Cerebras** — 3000 tok/s, $0.35/$0.75 per M tokens, 131K context, production-ready.

Uses OpenAI-compatible API — no new SDK needed:
```typescript
const executionProvider = createOpenAI({
  baseURL: "https://api.cerebras.ai/v1",
  apiKey: process.env.CEREBRAS_API_KEY,
})
const executionModel = executionProvider.chat("gpt-oss-120b")
```

Env vars on proxy:
```env
EXECUTION_BASE_URL=https://api.cerebras.ai/v1
EXECUTION_MODEL=gpt-oss-120b
EXECUTION_API_KEY=csk-...
```

Configurable — can swap to Groq/Qwen3-32B or other models if needed.

Build and ship Parts 1-6 first, validate search_page + execute_page_function work well, then add this endpoint.

---

## Testing Plan

1. **JS Cache**: Navigate to a JS-heavy site (e.g. amazon.co.jp), verify scripts are cached in background, verify cache clears on cross-origin navigation
2. **search_page HTML**: Search for buttons, forms, links — verify focused results vs old 30K dump
3. **search_page JS**: Search for API endpoints, function names in cached scripts
4. **execute_page_function**: Find a function via search_page, execute it, verify page state changed
5. **SPA navigation**: Test on a React/Next.js SPA — verify inline scripts re-collected on route change
6. **Verification**: Ensure click/fill_input still verify correctly with simplified capturePageState
7. **Context size**: Measure total tokens sent to model — should be 60-80% less than before
8. **Minified JS**: Test on production sites with webpack/vite bundles — verify string literal search works

---

## File Change Summary

| File | Lines Changed (est.) | Type |
|------|---------------------|------|
| `background.ts` | +120 | Script cache + message handlers |
| `content/index.tsx` | +80, -40 | Script collection, HTML search handler, remove old capture |
| `tools.ts` | +120, -80 | New tools, remove get_page_context, update verification |
| `prompts.ts` | +30, -30 | Rewrite tool descriptions |
| `query.ts` | -15 | Remove get_page_context references |
| `GyozaiWidget.tsx` | -10 | Remove snapshotTypes references |
| `types.ts` | +5 | Add new message types |
| **Total** | ~+355, -175 | Net +180 lines |
