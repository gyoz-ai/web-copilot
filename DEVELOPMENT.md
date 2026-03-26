# gyozAI Web Copilot — Development Guide

## Architecture Overview

gyozAI is a browser extension that uses AI to navigate any website. The user asks a question, the AI reads the page, and responds with actions (navigate, click, highlight elements, run JavaScript, etc.).

### How it works (no proxy needed)

```
┌─────────────────────────────────────────────────────────┐
│ Browser Tab (any website)                               │
│                                                         │
│  ┌──────────────────┐    chrome.runtime.sendMessage     │
│  │  Content Script   │ ──────────────────────────────►  │
│  │  (gyoza bubble)   │                                  │
│  │  - captures HTML  │  ◄──────────────────────────────  │
│  │  - dispatches     │    action response (JSON)        │
│  │    actions (click, │                                  │
│  │    navigate, etc.) │                                  │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ Background Worker (service worker)                      │
│                                                         │
│  1. Gets settings from chrome.storage.local             │
│  2. Gets conversation history from chrome.storage.session│
│  3. Checks for recipe (XML sitemap) for current domain  │
│  4. Builds system prompt + user prompt                  │
│  5. Calls LLM directly with structured output           │
│  6. Returns guaranteed-valid JSON actions                │
│                                                         │
│  BYOK mode:  background → Claude/OpenAI/Gemini API     │
│  Managed:    background → api.gyoz.ai/v1/inference      │
└─────────────────────────────────────────────────────────┘
```

**Key insight: There is no proxy server in BYOK mode.** The old SDK architecture needed a proxy because browser code can't safely hold API keys. But extension background workers run in a privileged context — the API key is stored in `chrome.storage.local` and never exposed to web pages. The background worker calls Claude/OpenAI/Gemini directly.

### Where the proxy code went

The original proxy server (`examples/api/`) had three jobs:

1. Hold the API key → now `chrome.storage.local` + `lib/storage.ts`
2. Build prompts → now `lib/prompts.ts` (identical copy)
3. Call Claude with structured output → now `lib/providers/claude.ts`

The background worker (`entrypoints/background.ts`) is the new "proxy" — it receives queries from the content script, builds prompts, calls the LLM, returns actions. Same logic, no network hop.

---

## Project Structure

```
web-copilot/
├── packages/
│   ├── engine/              — Core schemas, page context extractor, action dispatch
│   │   ├── src/
│   │   │   ├── schemas/     — Zod schemas (actions, manifest, query, validation)
│   │   │   ├── engine.ts    — createEngine() + action dispatcher (used by SDK)
│   │   │   └── page-context.ts — DOM extractor (buttons, forms, links, text)
│   │   └── package.json     — @gyoz-ai/app-copilot
│   │
│   ├── sdk/                 — React UI components (for embeddable SDK use case)
│   │   ├── src/
│   │   │   ├── bubble-search.tsx  — Floating bubble chat widget
│   │   │   ├── search-bar.tsx     — Fixed search input with dropdown
│   │   │   ├── use-engine.ts      — React hook for engine management
│   │   │   ├── format-message.tsx — Lightweight markdown renderer
│   │   │   └── styles.ts          — Inline CSS styles (no Tailwind)
│   │   └── package.json     — @gyoz-ai/app-copilot-sdk
│   │
│   └── extension/           — WXT browser extension (THE MAIN PRODUCT)
│       ├── src/
│       │   ├── entrypoints/
│       │   │   ├── popup/         — Extension popup (settings UI)
│       │   │   │   ├── App.tsx    — BYOK/Managed config, recipe manager
│       │   │   │   ├── index.html
│       │   │   │   └── main.tsx
│       │   │   ├── content.tsx    — Content script (gyoza bubble + chat)
│       │   │   └── background.ts  — Background worker (LLM calls)
│       │   └── lib/
│       │       ├── storage.ts     — chrome.storage helpers
│       │       ├── recipes.ts     — Recipe CRUD (XML sitemaps per domain)
│       │       ├── prompts.ts     — System prompt builder
│       │       └── providers/     — LLM provider abstraction
│       │           ├── types.ts   — LLMProvider interface
│       │           ├── claude.ts  — Anthropic (output_config.format)
│       │           ├── openai.ts  — OpenAI (response_format + strict)
│       │           ├── gemini.ts  — Google (responseSchema)
│       │           ├── managed.ts — Platform proxy (Bearer token)
│       │           └── index.ts   — createProvider() factory
│       ├── wxt.config.ts
│       └── package.json     — @gyoz-ai/extension
│
├── examples/                — Demo sites (keep here for testing with extension)
│   ├── api/                 — Example proxy (for SDK demos, not needed for extension)
│   ├── ginko/               — Japanese bank (manifest mode, port 4321)
│   ├── freshcart/           — Grocery store (manifest mode, port 4322)
│   └── vidflow/             — YouTube clone (no-manifest mode, port 4323)
│
├── EXECUTION.md             — MVP plan and build order
└── DEVELOPMENT.md           — This file
```

---

## Provider Details

### Claude (BYOK)

- SDK: `@anthropic-ai/sdk`
- Structured output: `output_config.format` with `json_schema`
- Models: `claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`
- Guaranteed valid JSON — no parsing errors possible

### OpenAI (BYOK)

- SDK: `openai`
- Structured output: `response_format` with `json_schema` + `strict: true`
- Models: `gpt-4o`, `gpt-4o-mini`

### Gemini (BYOK)

- Direct REST API (no SDK — lighter)
- Structured output: `generationConfig.responseSchema`
- Models: `gemini-2.5-flash`, `gemini-2.5-pro`

### Managed (platform)

- Calls `https://api.gyoz.ai/v1/inference`
- Bearer token auth (from Stripe subscription)
- Platform chooses the model based on plan tier

---

## Action Types

| Action         | Description            | Fields                                  |
| -------------- | ---------------------- | --------------------------------------- |
| `navigate`     | Go to a URL            | `target` (URL path)                     |
| `click`        | Click an element       | `selector` (CSS)                        |
| `execute-js`   | Run JavaScript on page | `code` (JS string)                      |
| `show-message` | Display a chat message | `message` (text)                        |
| `highlight-ui` | Golden glow on element | `selector` (CSS), auto-removes after 4s |
| `fetch`        | HTTP request for data  | `url`, `method`                         |
| `clarify`      | Ask follow-up question | `message`, `options` (string array)     |

All actions can include an optional `message` field for user-facing text.

The AI can also return `extraRequests` to ask for page context: `buttonsSnapshot`, `linksSnapshot`, `formsSnapshot`, `inputsSnapshot`, `textContentSnapshot`, `fullPageSnapshot`.

---

## Recipes (XML Sitemaps)

A recipe is an XML sitemap that describes a website's structure. When installed for a domain, the extension switches from "no-manifest mode" (raw HTML analysis) to "manifest mode" (structured navigation using the sitemap).

```xml
<gyozai-manifest version="1" domain="example.com">
  <routes>
    <route path="/" name="Home" description="Landing page" />
    <route path="/products" name="Products" description="Product listing" />
  </routes>
  <ui-elements>
    <ui-element route="/" selector="#search" type="input" label="Search" />
  </ui-elements>
  <page-descriptions>
    <page route="/" summary="Landing page with hero and product showcase" />
  </page-descriptions>
</gyozai-manifest>
```

Recipes are stored in `chrome.storage.local` keyed by domain. Users import them via the popup UI.

---

## Development Setup

### Prerequisites

- Bun 1.3+
- Chrome or Firefox

### Install

```bash
cd ~/Projects/gyozai-web-copilot
bun install
```

### Build the engine (required before extension dev)

```bash
bun turbo build --filter=@gyoz-ai/app-copilot
```

### Run the extension in dev mode

```bash
# Chrome (default)
bun --filter @gyoz-ai/extension dev

# Firefox
bun --filter @gyoz-ai/extension dev:firefox
```

This opens a browser with the extension auto-loaded and hot-reloads on changes.

### Run example demo sites (for testing)

```bash
# In separate terminals:
bun --filter @gyoz-ai/example-ginko dev       # http://localhost:4321
bun --filter @gyoz-ai/example-freshcart dev   # http://localhost:4322
bun --filter @gyoz-ai/example-vidflow dev     # http://localhost:4323
```

---

## End-to-End Testing

### Test 1: Extension BYOK on any website

1. Run `bun --filter @gyoz-ai/extension dev` → Chrome opens with extension loaded
2. Click the extension popup icon → select "BYOK" mode
3. Choose provider: "Claude (Anthropic)"
4. Paste your Anthropic API key
5. Select model: "Claude Sonnet 4"
6. Click "Save Settings"
7. Visit any website (e.g., https://news.ycombinator.com)
8. The golden gyoza bubble appears bottom-right
9. Click it → chat panel opens
10. Type: "what is this page about?"
11. AI reads the HTML, responds with a show-message action
12. Type: "find me the top story" → AI highlights or navigates

### Test 2: Extension on demo sites (no-manifest mode)

1. Start VidFlow: `bun --filter @gyoz-ai/example-vidflow dev`
2. With extension running, visit http://localhost:4323/demos/video/
3. Click gyoza bubble → "find me a cooking video"
4. AI reads the HTML, finds matching videos, navigates or highlights

### Test 3: Extension with recipe (manifest mode)

1. Start Ginko: `bun --filter @gyoz-ai/example-ginko dev`
2. In extension popup → "Recipes" section → "Import"
3. Select the XML file at `packages/engine/src/sitemaps/ginko.xml`
4. Visit http://localhost:4321/demos/ginko/
5. Click gyoza bubble → "how do I deposit money?" (in English)
6. AI uses the Japanese sitemap to navigate a Japanese banking site

### Test 4: Multiple providers

Repeat Test 1 with OpenAI key + gpt-4o, then Gemini key + gemini-2.5-flash. Verify all three produce valid action responses.

### Test 5: Keyboard shortcut

1. Visit any page with extension loaded
2. Press Cmd+Shift+G (Mac) or Ctrl+Shift+G (Windows/Linux)
3. Gyoza bubble should toggle open/closed

---

## CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)

Runs on every push to `main` and on pull requests targeting `main`.

**Jobs:**

1. **Typecheck & Test** (`check`)
   - Installs dependencies with `bun install --frozen-lockfile`
   - Builds the engine package (required dependency for extension and SDK)
   - Runs `bun turbo typecheck` across all packages
   - Runs `bun turbo test` across all packages

2. **Build Extension** (`build-extension`, depends on `check`)
   - Builds the engine package
   - Builds Chrome extension: `bunx wxt build`
   - Uploads Chrome artifact (`packages/extension/.output/chrome-mv3/`)
   - Builds Firefox extension: `bunx wxt build --browser firefox`
   - Uploads Firefox artifact (`packages/extension/.output/firefox-mv3/`)

### Building the extension for production

```bash
# Chrome (Manifest V3)
cd packages/extension && bunx wxt build
# Output: packages/extension/.output/chrome-mv3/

# Firefox (Manifest V3)
cd packages/extension && bunx wxt build --browser firefox
# Output: packages/extension/.output/firefox-mv3/
```

The engine must be built first (`bun turbo build --filter=@gyoz-ai/engine`) before building the extension, as the extension imports from it.

### Extension artifacts

CI produces two downloadable artifacts per run:

- `extension-chrome` — ready to upload to Chrome Web Store or load as unpacked extension
- `extension-firefox` — ready to upload to Firefox Add-ons

Download artifacts from the GitHub Actions run page. For store submission, download the artifact zip and upload it to the respective store's developer console.

---

## Environment Variables

The extension itself has no env vars — everything is configured via the popup UI and stored in `chrome.storage.local`.

For running the example proxy (only needed for SDK demos, not the extension):

| Variable            | Description                    | Default                     |
| ------------------- | ------------------------------ | --------------------------- |
| `ANTHROPIC_API_KEY` | Claude API key                 | (required)                  |
| `PORT`              | Proxy server port              | `3001`                      |
| `ALLOWED_ORIGINS`   | CORS origins (comma-separated) | `http://localhost:4321,...` |
| `MODEL`             | Default Claude model           | `claude-sonnet-4-20250514`  |
| `SYSTEM_PROMPT`     | Custom system prompt prefix    | (empty)                     |

---

## Capabilities System

The content script sends a `capabilities` object to the background worker, which passes it to the prompt builder. This controls what action types the AI is told it can use:

```ts
capabilities: {
  navigate: true,      // go to URLs
  showMessage: true,   // display messages
  click: true,         // click elements
  executeJs: true,     // run JavaScript (security sensitive)
  highlightUi: true,   // golden glow on elements
  fetch: false,        // HTTP requests (disabled by default)
  clarify: true,       // ask follow-up questions
}
```

Disabled capabilities are excluded from the system prompt entirely, so the AI never generates actions it can't perform.

---

## Conversation Memory

- **Session storage** (`chrome.storage.session`): Conversation history per browser session, capped at 20 messages. Cleared when browser closes.
- **Local storage** (`chrome.storage.local`): Settings (API key, provider, model, mode) and installed recipes. Persists across sessions.

---

## SDK vs Extension

|                  | SDK (packages/sdk)                         | Extension (packages/extension)                |
| ---------------- | ------------------------------------------ | --------------------------------------------- |
| **Target**       | Website owners embed into their site       | End users install in browser                  |
| **API key**      | Stored on proxy server                     | Stored in chrome.storage                      |
| **Works on**     | Only the site that embeds it               | Any website                                   |
| **Needs proxy**  | Yes                                        | No (BYOK) / Yes (managed mode → platform API) |
| **UI**           | React components (BubbleSearch, SearchBar) | Shadow DOM content script                     |
| **Distribution** | npm package                                | Chrome Web Store / Firefox Add-ons            |

The extension is the primary product. The SDK exists for site owners who want native integration.
