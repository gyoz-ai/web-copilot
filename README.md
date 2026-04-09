# gyoza — AI companion for the browser

gyoza can see your screen, understand any website, and do things for you — clicks, forms, navigation, all by just asking.

Install the extension, add your API key (Claude, ChatGPT, or Gemini), and get an AI companion that works on any website. Recipes make it faster and more accurate on popular sites.

## Features

- **Works on any website** — no setup needed. Reads what's on screen and can click, scroll, fill forms, and find information for you
- **Supercharged with recipes** — web skills that teach gyoza how a site works, making it faster, cheaper, and more accurate
- **Choose your AI** — works with Claude, ChatGPT, or Gemini. Use your own API key for free, or subscribe for a hassle-free managed experience
- **Does things for you** — click buttons, fill out forms, navigate pages, translate content — just describe what you want
- **Privacy first** — your data stays on your device. No tracking, no data collection
- **Multilingual** — works on sites in any language, speaks 23+ languages

## Architecture

```
Browser Extension (WXT)
├── Content Script — injects gyoza bubble widget on every page via shadow DOM
├── Background Worker — handles LLM API calls, recipe storage, state management
├── Popup — settings, API key config, recipe management
└── Engine — shared AI engine (schemas, page context, action dispatch, conversation memory)
```

**Two modes:**

- **BYOK** — bring your own API key, calls LLM directly from background worker
- **Managed** — subscribe at gyoz.ai, calls platform API proxy (no key needed)

## Packages

```
packages/
├── engine/      — Core AI engine (@gyoz-ai/engine)
├── extension/   — WXT browser extension for Chrome, Firefox, Safari (@gyoz-ai/extension)
└── sdk/         — React UI components (@gyoz-ai/sdk)
```

## Development

```bash
bun install                          # install dependencies
bun run --filter @gyoz-ai/extension dev          # dev mode (Chrome)
bun run --filter @gyoz-ai/extension dev:firefox   # dev mode (Firefox)
bun run --filter @gyoz-ai/extension build:safari  # build + Xcode project (Safari)
bun turbo typecheck                  # type-check all packages
bun turbo test                       # run all tests
```

## License

FSL-1.1-Apache-2.0 (Functional Source License) — free to use, modify, and redistribute. You may not use it to build a competing commercial browser extension or AI assistant service. Converts to Apache 2.0 on April 2, 2028. See [LICENSE](LICENSE) for details.
