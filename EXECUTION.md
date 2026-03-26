# gyozAI — Execution Plan

Two repos. One product. Ship fast.

---

## Repo Structure

### Repo 1: `gyoz-ai/web-copilot` (the product)

The browser extension + engine. Everything the user touches.

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

| Repo | Action |
|------|--------|
| `gyoz-ai/app-copilot` | Archive. Engine copied to web-copilot. Examples copied to platform. |
| `kevinfaveri/gyozAI` | Keep as planning/docs repo. No code changes. |

---

## MVP Scope

### MVP Part 1: Extension (web-copilot)

**Goal**: Working browser extension with BYOK + managed key support.

#### 1.0 — Setup
- [ ] Copy engine from app-copilot (schemas, page-context, action dispatch, prompts)
- [ ] WXT project init in packages/extension
- [ ] Bun workspaces monorepo

#### 1.1 — Extension Shell
- [ ] Manifest V3 (permissions: activeTab, storage, scripting)
- [ ] Extension popup:
  - Mode selector: BYOK / Managed Key
  - BYOK: provider dropdown (Claude/OpenAI/Gemini) + API key input + model selector
  - Managed: "Sign in" button → redirects to platform auth
  - Saved to chrome.storage.local
- [ ] Content script injection on all pages
- [ ] Floating gyoza bubble (reuse BubbleSearch adapted for content script)
- [ ] Background worker for API calls (avoids CSP)
- [ ] Keyboard shortcut: Cmd/Ctrl+Shift+G

#### 1.2 — LLM Integration
- [ ] Provider abstraction:
  ```ts
  interface LLMProvider {
    query(system: string, messages: Message[], schema: JSONSchema): Promise<ActionResponse>
  }
  ```
- [ ] Claude provider: `output_config.format` structured output
- [ ] OpenAI provider: `response_format` + `strict: true`
- [ ] Gemini provider: `generationConfig.responseSchema`
- [ ] BYOK mode: calls LLM directly from background worker (key stored locally)
- [ ] Managed mode: calls platform proxy at `api.gyoz.ai/v1/inference`

#### 1.3 — Core Features
- [ ] No-manifest mode (reads HTML, works on any site)
- [ ] Manifest/recipe mode (loads sitemap XML, structured navigation)
- [ ] All action types: navigate, click, execute-js, show-message, highlight-ui, fetch, clarify
- [ ] Page context capture (buttons, forms, links, text)
- [ ] extraRequests with auto-follow-up
- [ ] Conversation memory (chrome.storage.session)
- [ ] Capabilities config per domain
- [ ] Messages render before actions
- [ ] SDK detection: `window.__GYOZAI_SDK__` → extension defers

#### 1.4 — Recipe Support
- [ ] Load recipe from local storage per domain
- [ ] Import recipe from file (XML)
- [ ] Import recipe from URL
- [ ] Recipe manager in popup (list installed, delete, toggle)

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

## What's NOT in MVP (roadmap for later)

- Recipe marketplace (browse, buy/sell, ratings) → Phase 2
- AI recipe generator → Phase 2
- Enterprise/org mode → Phase 3
- Canvas feature → Phase 3
- SSO → Phase 3
- Safari extension → Phase 2
- Local model support (Ollama) → Phase 3
- Streaming responses → Phase 2
- Persistent DOM edits (IndexedDB) → Phase 3

---

## Build Order

```
Week 1-2: Extension shell + BYOK mode (works offline, no platform needed)
Week 3:   LLM providers (Claude + OpenAI + Gemini)
Week 4:   Core features (all actions, page context, recipes)
Week 5:   Platform setup (DB, auth via Stripe, managed proxy)
Week 6:   Platform billing + usage enforcement
Week 7:   Website (landing + docs)
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
