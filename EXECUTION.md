# gyoza — Execution Plan

Two repos. One product. Ship fast.

---

## Repo Structure

### Repo 1: `gyoz-ai/web-copilot` (the product)

The browser extension + engine. Everything the user touches (should use omni framework that compiles extension to safari too)

```
web-copilot/
├── packages/
│   ├── engine/        — Core AI engine (copied from app-copilot, adapted)
│   │                    Schemas, page context, action dispatch, conversation memory
│   └── extension/     — WXT browser extension (Chrome, Firefox, Safari)
│                        Content script, popup, background worker
├── ROADMAP.md
└── MVP.md
```

### Repo 2: `gyoz-ai/platform` (the backend + website)

Everything server-side. Managed key proxy, auth, billing, docs, marketplace.

```
platform/
├── apps/
│   ├── api/           — Backend (Bun + Hono + Drizzle)
│   │                    Auth (Stripe-based), managed key proxy, recipe API, usage metering
│   └── web/           — Frontend (Astro + React + Tailwind + shadcn)
│                        Landing page, docs, marketplace, dashboard
├── examples/          — Demo sites (Ginko, FreshCart, VidFlow — copied from app-copilot)
├── packages/
│   └── db/            — Shared DB schema + migrations
├── docker-compose.yml
└── ROADMAP.md
```

### What happens to other repos

| Repo                  | Action                                                              |
| --------------------- | ------------------------------------------------------------------- |
| `gyoz-ai/app-copilot` | Archive. Engine copied to web-copilot. Examples copied to platform. |
| `kevinfaveri/gyoza`   | Keep as planning/docs repo. No code changes.                        |

---

## MVP Scope

### MVP Part 1: Extension (web-copilot)

**Goal**: Working browser extension with BYOK + managed key support.

#### 1.0 — Setup

- [x] Copy engine from app-copilot (schemas, page-context, action dispatch, prompts)
- [x] WXT project init in packages/extension
- [x] Bun workspaces monorepo

#### 1.1 — Extension Shell

- [x] Manifest V3 (permissions: activeTab, storage, scripting)
- [x] Extension popup:
  - Mode selector: BYOK / Managed Key
  - BYOK: provider dropdown (Claude/OpenAI/Gemini) + API key input + model selector
  - Managed: "Sign in" button → redirects to platform auth
  - Saved to chrome.storage.local
- [x] Content script injection on all pages
- [x] Floating gyoza bubble (reuse BubbleSearch adapted for content script)
- [x] Background worker for API calls (avoids CSP)
- [x] Keyboard shortcut: Cmd/Ctrl+Shift+G

#### 1.2 — LLM Integration

- [x] Provider abstraction:
  ```ts
  interface LLMProvider {
    query(
      system: string,
      messages: Message[],
      schema: JSONSchema,
    ): Promise<ActionResponse>;
  }
  ```
- [x] Claude provider: `output_config.format` structured output
- [x] OpenAI provider: `response_format` + `strict: true`
- [x] Gemini provider: `generationConfig.responseSchema`
- [x] BYOK mode: calls LLM directly from background worker (key stored locally)
- [x] Managed mode: calls platform proxy at `api.gyoz.ai/v1/inference`

#### 1.3 — Core Features

- [x] No-manifest mode (reads HTML, works on any site)
- [x] Manifest/recipe mode (loads sitemap XML, structured navigation)
- [x] All action types: navigate, click, execute-js, show-message, highlight-ui, fetch, clarify
- [x] Page context capture (buttons, forms, links, text)
- [x] extraRequests with auto-follow-up
- [x] Conversation memory (chrome.storage.session)
- [x] Capabilities config per domain
- [x] Messages render before actions
- [x] SDK detection: `window.__GYOZAI_SDK__` → extension defers

#### 1.4 — Recipe Support

- [x] Load recipe from local storage per domain
- [x] Import recipe from file (XML)
- [x] Import recipe from URL
- [x] Recipe manager in popup (list installed, delete, toggle)

#### 1.5 — Ship

- [ ] Extension icon + branding
- [ ] Chrome Web Store listing
- [ ] Firefox Add-ons listing
- [ ] Privacy policy

---

### MVP Part 2: Platform (gyoz-ai/platform)

**Goal**: Auth, billing, managed key proxy, docs site, example sites.

#### 2.0 — Setup

- [ ] Monorepo: Bun workspaces, Turborepo, TypeScript, Prettier
- [ ] Docker Compose: PostgreSQL + Redis
- [ ] Copy demo examples from app-copilot (Ginko, FreshCart, VidFlow)

#### 2.1 — Auth (via Stripe)

Stripe handles auth. No separate OAuth system needed.

- [ ] Stripe Customer Portal for login/signup
- [ ] Stripe Checkout for subscription
- [ ] When user subscribes → Stripe creates customer → we store customer ID
- [ ] Extension "Sign in" → redirects to Stripe checkout/portal → callback stores session
- [ ] Session token stored in extension + cookie for web dashboard
- [ ] Support Google login via Stripe's built-in Link (auto-fills email/payment)

**Why Stripe for auth**: Stripe Link already supports Google, Apple Pay, and saved payment methods. Every user who signs up is already a paying customer or trialing. No orphan accounts. No auth without billing intent.

#### 2.2 — Database

- [ ] Drizzle ORM schema:
  ```
  users (id, email, name, stripe_customer_id, plan, created_at)
  managed_keys (id, user_id, key_hash, is_active, created_at)
  usage_records (id, user_id, month, request_count, model_used)
  recipes (id, author_id, domain, name, xml, version, price, downloads, rating, created_at)
  recipe_ratings (id, recipe_id, user_id, rating, review, created_at)
  ```
- [ ] Migrations
- [ ] Seed script

#### 2.3 — Managed Key Proxy

- [ ] `POST /v1/inference` — receives query from extension, routes to Claude/GPT/Gemini
- [ ] Validates user session + plan tier
- [ ] Rate limiting per tier
- [ ] Usage metering (increment per request)
- [ ] Model enforcement (Starter = Haiku only, Pro = Haiku + Sonnet)
- [ ] Structured output for all providers (same JSON schema)
- [ ] Stores user's sitemap/recipe server-side for inference context

#### 2.4 — Billing

- [ ] Stripe products:
  - Starter: $5/month (200 queries, Haiku)
  - Pro: $12/month (500 queries, Haiku + Sonnet/GPT-4o)
  - Unlimited: $25/month (unlimited, all models)
- [ ] Stripe webhooks: subscription created/updated/deleted/payment_failed
- [ ] Usage enforcement: reject requests when quota exceeded (except Unlimited)
- [ ] Billing dashboard page: current plan, usage, upgrade/downgrade

#### 2.5 — Website (Astro + React + Tailwind)

- [ ] Landing page (gyoz.ai):
  - Hero: "AI that navigates any website for you"
  - Demo video
  - How it works (3 steps: install, add key, ask)
  - Pricing table
  - Install CTA (Chrome Web Store link)
- [ ] Docs (gyoz.ai/docs):
  - Getting started (extension install + API key)
  - Recipe format (XML sitemap spec)
  - Writing recipes guide
  - Action types reference
  - Capabilities reference
- [ ] Example showcase: link to Ginko, FreshCart, VidFlow demos

#### 2.6 — Recipe Storage (for managed key users)

- [ ] `POST /v1/recipes` — upload recipe (auth required)
- [ ] `GET /v1/recipes?domain=example.com` — fetch recipe for domain
- [ ] Extension (managed mode) auto-fetches recipe from platform when visiting a domain
- [ ] Users can save/manage their recipes via dashboard

---

## Phases

### Phase 1 — Extension MVP (DONE)

BYOK browser extension with all core features.

### Phase 2 — Platform Website (CURRENT)

- gyoz.ai homepage (dark theme, Tailwind + shadcn + Aceternity animations)
- Free recipe directory (browse, publish, one-click install, ratings, download count)
- Hosted example sites (Ginko, FreshCart, VidFlow)
- Browser detection for install CTA (Chrome/Firefox/Safari)
- Chat scope setting: global vs per-tab/per-domain
- **Deployment**: GitHub Actions deploys platform services to Railway on push to main
  - API → `api.gyoz.ai`
  - Web → `gyoz.ai`
  - Examples → `demos.gyoz.ai/*` (ginko, freshcart, vidflow as separate Railway services)

### Phase 3 — Ship

- Chrome Web Store submission
- Firefox Add-ons submission
- Privacy policy
- Extension icon + branding polish
- Streaming responses
- **CI/CD**: GitHub Actions builds extension artifacts (Chrome + Firefox) on every push/PR
  - Chrome artifact: `packages/extension/.output/chrome-mv3/`
  - Firefox artifact: `packages/extension/.output/firefox-mv3/`
  - Artifacts uploaded to GitHub Actions for download and store submission

### Phase 4 — Managed Key + Billing

- Stripe auth (checkout → customer → session)
- Managed inference proxy (POST /v1/inference)
- Usage metering + plan enforcement
- Billing dashboard

### Future

- AI recipe generator
- Enterprise/org mode (SSO, admin dashboard)
- Persistent DOM edits (IndexedDB)
- Canvas feature (AI builds React UI on the fly)
- Local model support (Ollama)
- SDK for website embedding

---

## Deployment

### Platform (gyozai-platform repo)

- **Pipeline**: GitHub Actions (`.github/workflows/deploy.yml`) → Railway
- **Trigger**: Push to `main` or manual workflow dispatch
- **Services deployed**:
  - `gyozai-api` → `api.gyoz.ai` (Bun + Hono backend)
  - `gyozai-web` → `gyoz.ai` (Astro frontend)
  - `gyozai-example-ginko` → `demos.gyoz.ai/ginko`
  - `gyozai-example-freshcart` → `demos.gyoz.ai/freshcart`
  - `gyozai-example-vidflow` → `demos.gyoz.ai/vidflow`
- **Railway config**: `railway.toml` at repo root (nixpacks builder, `bun start`, healthcheck at `/health`)
- **Required secret**: `RAILWAY_TOKEN` in GitHub repo settings

### Extension (gyozai-web-copilot repo)

- **Pipeline**: GitHub Actions (`.github/workflows/ci.yml`) → artifact upload
- **Trigger**: Push to `main` or pull request to `main`
- **Steps**: typecheck → test → build Chrome extension → build Firefox extension → upload artifacts
- **Artifacts**: Downloaded from GitHub Actions, then manually submitted to Chrome Web Store and Firefox Add-ons

---

## Build Order

```
Week 1-2: Extension shell + BYOK mode (works offline, no platform needed)     ✓ DONE
Week 3:   LLM providers (Claude + OpenAI + Gemini)                             ✓ DONE
Week 4:   Core features (all actions, page context, recipes)                   ✓ DONE
Week 5:   Platform setup (DB, auth via Stripe, managed proxy)
Week 6:   Platform billing + usage enforcement
Week 7:   Website (landing + docs) + deployment pipeline (Railway)
Week 8:   Polish + Chrome Web Store submission
```

**Key insight**: Extension works with BYOK from week 2. Platform only needed for managed key users. Ship BYOK first, add managed key after.

---

## End-to-End Test (when done)

### BYOK flow

1. Install extension from Chrome Web Store
2. Click popup → select "Claude" → paste API key → save
3. Visit any website → gyoza bubble appears
4. Ask "what is this page about?" → AI reads HTML, responds
5. Visit a site with a recipe installed → AI uses structured sitemap

### Managed key flow

1. Install extension
2. Click popup → "Subscribe" → Stripe checkout ($5/month)
3. After payment → session stored in extension
4. Visit any website → queries go through api.gyoz.ai/v1/inference
5. Usage tracked, enforced per tier

### Recipe flow

1. Download a recipe XML file
2. Extension popup → "Import Recipe" → select file
3. Visit the recipe's domain → AI uses the structured sitemap
4. Navigation is faster and more accurate than no-manifest mode
