# web-copilot — Extension Roadmap

## Phase 1: Core Extension (Weeks 1-3)

> Ship a working extension that helps navigate any website. No recipes needed.

- [ ] **1.1** WXT scaffolding (Chrome + Firefox + Safari)
- [ ] **1.2** Content script — injects floating gyoza bubble on every page
- [ ] **1.3** Extension popup — API key config (Anthropic, OpenAI, Gemini), model selector
- [ ] **1.4** No-manifest mode — reads page HTML, sends to LLM, gets structured actions
- [ ] **1.5** Action execution — navigate, click, execute-js, show-message, highlight-ui, clarify
- [ ] **1.6** Page context capture — buttons, forms, links, text extraction
- [ ] **1.7** Conversation memory — persists across page navigations (extension storage)
- [ ] **1.8** Multi-LLM provider support — Claude (structured outputs), OpenAI (response_format), Gemini (responseSchema)
- [ ] **1.9** SDK detection — if page has gyozAI SDK embedded, extension disables itself
- [ ] **1.10** BYOK mode — user's own API key, stored locally in extension storage
- [ ] **1.11** Keyboard shortcut — Cmd/Ctrl+Shift+G opens the bubble

## Phase 2: Recipes (Weeks 3-5)

> Community-created sitemaps for specific websites. Better than no-manifest.

- [ ] **2.1** Recipe format — reuse XML sitemap spec from app-copilot
- [ ] **2.2** Recipe loading — extension checks if current domain has a recipe installed
- [ ] **2.3** Manual recipe import — load from file or URL
- [ ] **2.4** AI recipe generator — scan current page, generate draft recipe using LLM
- [ ] **2.5** Recipe editor — in-extension UI to review and refine generated recipes
- [ ] **2.6** Local recipe storage — extension storage per domain
- [ ] **2.7** Recipe validation — Zod schema validation before saving
- [ ] **2.8** Ship to Chrome Web Store

## Phase 3: Marketplace (Weeks 5-8)

> Browse, install, share, and sell recipes.

- [ ] **3.1** Marketplace backend — Hono + Bun, recipes CRUD, search, ratings
- [ ] **3.2** Marketplace web UI — browse at gyoz.ai/marketplace
- [ ] **3.3** In-extension marketplace — browse and install without leaving the page
- [ ] **3.4** Publish flow — review recipe → set price (free or paid) → submit
- [ ] **3.5** Install flow — one-click install from marketplace
- [ ] **3.6** Ratings and reviews
- [ ] **3.7** Recipe versioning — authors publish updates, users auto-update
- [ ] **3.8** Recipe categories — by domain, by type (banking, shopping, government, etc.)

## Phase 4: Monetization (Weeks 8-12)

- [ ] **4.1** Managed API key — user pays gyozAI instead of getting their own key
- [ ] **4.2** Pricing tiers:
  - Free: BYOK only
  - Starter $5/month: 200 Haiku queries
  - Pro $12/month: 500 queries, Haiku + Sonnet/GPT-4o, AI recipe generator
  - Unlimited $25/month: unlimited, all models, priority
- [ ] **4.3** Stripe billing integration
- [ ] **4.4** Paid recipes — authors set price ($1-5), 25% cut to gyozAI
- [ ] **4.5** Stripe Connect for recipe author payouts

## Phase 5: Enterprise (Month 4+)

- [ ] **5.1** Org mode — company org code, shared API key, admin controls
- [ ] **5.2** Admin dashboard (gyoz.ai/admin):
  - Employee list + usage tracking
  - Pre-loaded private recipes for internal tools
  - Capability restrictions per domain
  - Custom system prompt
  - Usage limits per user
  - Model restrictions per team
- [ ] **5.3** SSO integration (Google Workspace, Okta, Azure AD)
- [ ] **5.4** Invoice/PO billing for enterprise accounts
- [ ] **5.5** Private recipe hosting — recipes that never touch the public marketplace

## Phase 6: Canvas (Month 5+)

> AI builds custom UI on the fly using a library of React components.

- [ ] **6.1** Component library — set of pre-built React components (cards, tables, charts, forms, lists, modals)
- [ ] **6.2** Canvas container — a floating panel/overlay where AI renders custom UI
- [ ] **6.3** Sitemap component references — recipe can declare available React components:
  ```xml
  <components>
    <component name="DataTable" props="columns, rows" description="Sortable data table" />
    <component name="StatCard" props="label, value, trend" description="KPI card with trend" />
    <component name="FormBuilder" props="fields, onSubmit" description="Dynamic form" />
  </components>
  ```
- [ ] **6.4** LLM generates component tree — structured output returns:
  ```json
  {
    "canvas": {
      "components": [
        { "type": "StatCard", "props": { "label": "Balance", "value": "¥1,234,567", "trend": "+5%" } },
        { "type": "DataTable", "props": { "columns": ["Date", "Type", "Amount"], "rows": [...] } }
      ]
    }
  }
  ```
- [ ] **6.5** Canvas renderer — renders the component tree in the overlay panel
- [ ] **6.6** Interactive canvas — components are functional (sortable tables, clickable buttons, form submission)
- [ ] **6.7** Canvas persistence — save generated canvases for re-use
- [ ] **6.8** Custom component upload — Pro users can add their own React components to the library

## Phase 7: Advanced Features

- [ ] **7.1** Streaming responses — real-time typing effect in chat
- [ ] **7.2** Persistent DOM edits — IndexedDB, auto-replay on revisit
- [ ] **7.3** Per-page behaviors — tours, form assist, guided explanations
- [ ] **7.4** Local model support — Ollama, LM Studio integration
- [ ] **7.5** Conversion insights — aggregated anonymized query data for site owners
- [ ] **7.6** Extension content script injection — CSP bypass for reliable JS execution
- [ ] **7.7** Cross-frame support — work inside iframes and shadow DOMs
