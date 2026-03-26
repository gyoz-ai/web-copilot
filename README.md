# web-copilot

gyozAI browser extension — AI navigation assistant that works on any website.

Install the extension, add your API key (Claude, GPT, or Gemini), and get AI-powered navigation everywhere. Community "recipes" (sitemaps) make it work even better on popular sites.

## Features

- Works on ANY website immediately (no-manifest mode — reads raw HTML)
- Optional recipes for structured, accurate navigation on specific sites
- Recipe marketplace — share, discover, and sell navigation recipes
- Multiple LLM providers (Claude, GPT, Gemini, local models)
- BYOK (bring your own key) or managed subscription
- Translate pages, fill forms, navigate foreign-language sites
- Canvas: AI builds custom UI on the fly from React components
- If a site has the gyozAI SDK embedded, the extension defers to it

## Architecture

```
Browser Extension (WXT)
├── Content Script — injects gyoza bubble on every page
├── Background Worker — manages state, API calls, recipe storage
├── Popup — settings, API key, recipe management
├── Options Page — advanced config, org mode
└── Shared Engine — same @gyoz-ai/app-copilot engine

Proxy (optional, for managed key users)
└── Thin server that holds managed API key + routes to Claude/GPT/Gemini

Marketplace (gyoz.ai)
└── Recipe CRUD, search, ratings, payments
```

## Repo Structure

```
web-copilot/
├── packages/
│   └── extension/     — WXT browser extension (Chrome, Firefox, Safari)
├── examples/
│   ├── ginko/         — Japanese bank demo site
│   ├── freshcart/     — Grocery store demo site
│   └── vidflow/       — YouTube clone demo site
├── recipes/           — Community recipe collection
├── MVP.md             — Extension MVP scope
└── ROADMAP.md         — Full extension roadmap
```

## License

BSL 1.1 (Business Source License) — free to use, can't sell competing product. Converts to Apache 2.0 after 3 years.
