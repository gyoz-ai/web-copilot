# gyoza — Finish Execution Checklist

Everything needed to go from "works locally" to "shipped and live."

---

## 1. Deploy Platform to Railway

The platform is a monolith — one Bun server serves the API, website, docs, and demo examples.

### Steps

1. Create a Railway project at [railway.app](https://railway.app)
2. Add a **PostgreSQL** service (Railway managed — click "New Service" → Database → PostgreSQL)
3. Add a **Redis** service (Railway managed — click "New Service" → Database → Redis)
4. Add the **app service** — connect the `gyoz-ai/platform` GitHub repo
   - Railway auto-detects the Dockerfile
   - Set the root directory to `/` (repo root)
5. Set environment variables on the app service (see `SETUP.md` for full list):

   ```
   PORT=3000
   DATABASE_URL=<from Railway PostgreSQL service>
   REDIS_URL=<from Railway Redis service>
   SESSION_SECRET=<generate random 64-char string>

   # OAuth (see section 2)
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   APPLE_CLIENT_ID=...
   APPLE_TEAM_ID=...
   APPLE_KEY_ID=...
   APPLE_PRIVATE_KEY=...
   TWITTER_CLIENT_ID=...
   TWITTER_CLIENT_SECRET=...
   ```

6. Set custom domain: `gyoz.ai` → point DNS to Railway
7. Push to `main` → GitHub Actions builds + deploys automatically
8. Verify: `https://gyoz.ai/health` returns `{ "status": "ok" }`

### After deploy

- Run migrations: Railway shell → `cd packages/db && bun run generate && bun run migrate`
- Or add a release command in railway.toml: `cd packages/db && bun run migrate`
- Test: visit gyoz.ai, sign in, browse recipes, try demos

---

## 2. Set Up OAuth Apps

Each provider needs an OAuth app configured with the correct redirect URI.

**Production redirect URI pattern:** `https://gyoz.ai/auth/callback/{provider}`

### Google

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create project → OAuth consent screen → Create credentials → OAuth Client ID → Web application
2. Authorized redirect URI: `https://gyoz.ai/auth/callback/google`
3. Copy Client ID + Client Secret → set as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Railway

### GitHub

1. [GitHub Developer Settings](https://github.com/settings/developers) → New OAuth App
2. Authorization callback URL: `https://gyoz.ai/auth/callback/github`
3. Copy Client ID + Client Secret → `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

### Discord

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application → OAuth2
2. Redirect URI: `https://gyoz.ai/auth/callback/discord`
3. Copy Client ID + Client Secret → `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`

### Apple

1. [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers) → Certificates, Identifiers & Profiles
2. Create App ID with "Sign In with Apple" capability
3. Create Service ID (this is the Client ID) → configure web domain `gyoz.ai` and redirect `https://gyoz.ai/auth/callback/apple`
4. Create Key with "Sign In with Apple" enabled → download the `.p8` file
5. Set: `APPLE_CLIENT_ID` (Service ID), `APPLE_TEAM_ID` (top-right of developer portal), `APPLE_KEY_ID` (from key), `APPLE_PRIVATE_KEY` (contents of .p8 file)

### Twitter/X

1. [Twitter Developer Portal](https://developer.twitter.com/en/portal/projects) → Create Project → Create App → OAuth 2.0 settings
2. Callback URL: `https://gyoz.ai/auth/callback/twitter`
3. Copy Client ID + Client Secret → `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`

---

## 3. Chrome Web Store Submission

### Build

```bash
cd ~/Projects/gyozai-web-copilot
bun turbo build --filter=@gyoz-ai/engine
cd packages/extension && bunx wxt build
```

Output: `packages/extension/.output/chrome-mv3/`

### Submit

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item" → upload the `.output/chrome-mv3/` directory as a zip
3. Fill in:
   - **Name**: gyoza — AI Browser Copilot
   - **Summary**: AI that navigates any website for you. Ask questions, get answers, let AI click and navigate.
   - **Description**: Detailed description of features (BYOK, recipes, multi-LLM, all action types)
   - **Category**: Productivity
   - **Language**: English
   - **Screenshots**: capture the widget on a few websites (Ginko demo, Google, etc.)
   - **Icon**: use `logo.png` (128x128)
4. Privacy section:
   - Link to privacy policy: `https://gyoz.ai/privacy`
   - Single purpose: "AI-powered website navigation assistant"
   - Permissions justification:
     - `activeTab`: needed to read page content for AI context
     - `storage`: stores user settings, API keys, recipes, conversation history
     - `scripting`: executes AI-generated actions on the page (click, fill forms, etc.)
     - `notifications`: alerts user when AI completes tasks on background tabs
   - Does NOT collect personal data, does NOT sell data, API keys stored locally only
5. Submit for review (takes 1-3 business days)

---

## 4. Firefox Add-ons Submission

### Build

```bash
cd packages/extension && bunx wxt build --browser firefox
```

Output: `packages/extension/.output/firefox-mv3/`

### Submit

1. Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
2. Submit New Add-on → upload the `.output/firefox-mv3/` directory as a zip
3. Same metadata as Chrome Web Store
4. Firefox reviews are usually faster (1-2 days)

---

## 5. Safari Extension

WXT supports Safari via the `--browser safari` flag, but Safari extensions require:

1. An Apple Developer account ($99/year)
2. Xcode to convert the web extension to a Safari extension
3. Signing with an Apple developer certificate

### Steps

```bash
cd packages/extension && bunx wxt build --browser safari
```

Then in Xcode:
1. File → New → Project → Safari Extension App
2. Import the built extension files
3. Build and run on macOS/iOS Safari
4. Submit to App Store Connect for review

### Alternative: Safari Web Extension Converter

Apple provides `safari-web-extension-converter` CLI tool:

```bash
xcrun safari-web-extension-converter packages/extension/.output/safari-mv3/ --project-location ./safari-extension
```

This creates an Xcode project you can build and submit.

---

## 6. Privacy Policy

Create a page at `gyoz.ai/privacy`. It should cover:

- **What we collect**: nothing by default. In BYOK mode, all data stays local (API keys in chrome.storage, conversation history in chrome.storage). In managed mode, we store: email, name, OAuth provider ID, usage counts.
- **API keys**: stored locally in your browser, never sent to our servers. In BYOK mode, keys go directly from your browser to Claude/OpenAI/Gemini.
- **Page content**: page HTML/Markdown is sent to the LLM provider you configured (not to us). We never see or store page content.
- **Recipes**: stored locally. When using the recipe directory, download/install counts are tracked anonymously.
- **Cookies**: session cookie for authentication on gyoz.ai (httpOnly, secure, 30-day expiry).
- **Third parties**: Claude (Anthropic), OpenAI, Google (Gemini) — only when you configure and use them.
- **Data deletion**: clear extension data via Chrome settings, or delete account on gyoz.ai.
- **Contact**: email for privacy questions.

Add the page to the platform: `apps/web/src/pages/privacy.astro`

---

## 7. Deep Link Recipe Install

Currently clicking "Install" on the recipe directory downloads a `.txt` file. The user then manually imports it via the extension popup. This should be seamless.

### How deep links work for extensions

1. **Custom protocol**: register a protocol like `gyoza://install-recipe?url=...` that the extension intercepts
2. **OR webpage detection**: the extension content script listens for a specific DOM event or URL pattern on gyoz.ai

### Recommended approach: DOM event

1. The recipe directory page dispatches a custom event when "Install" is clicked:
   ```js
   window.dispatchEvent(new CustomEvent('gyoza-install-recipe', {
     detail: { url: '/recipes/ginko.txt' }
   }))
   ```

2. The extension content script listens for this event on gyoz.ai:
   ```js
   window.addEventListener('gyoza-install-recipe', async (e) => {
     const { url } = e.detail
     const response = await fetch(url)
     const content = await response.text()
     await chrome.runtime.sendMessage({
       type: 'gyozai_auto_import_recipe',
       filename: 'recipe.txt',
       content
     })
     // Show toast: "Recipe installed!"
   })
   ```

3. After install, show a toast notification in the widget AND a desktop notification if the tab is focused.

### Alternative: extension message passing via `window.postMessage`

The website can post a message that the content script picks up:

```js
// Website (gyoz.ai/recipes)
window.postMessage({ type: 'gyoza-install-recipe', url: '/recipes/ginko.txt' }, '*')

// Content script
window.addEventListener('message', (e) => {
  if (e.data.type === 'gyoza-install-recipe') {
    // fetch + import + toast
  }
})
```

This is simpler and doesn't require protocol registration.

---

## 8. Test Recipe Directory Flow End-to-End

Before shipping, verify:

1. Visit `gyoz.ai/recipes` → recipes load (or fallback if API is down)
2. Click "Install" on Ginko recipe → file downloads as `.txt`
3. Import in extension popup → recipe appears in list for `localhost:4321`
4. Visit Ginko demo → console shows `Mode: ✅ manifest (recipe)`
5. Ask AI to do something → uses recipe context
6. Deep link install (after implementing) → one-click from website to extension

---

## 9. Extension → Platform Recipe Sync

When a managed-mode user visits a website, the extension should check the platform for recipes:

1. Content script sends domain to background
2. Background calls `GET /v1/recipes?domain=example.com`
3. If recipes found, auto-import them (same as auto-detect but from the API instead of the website)
4. Show toast: "Found 2 recipes for this site from the gyoza directory"

This makes the recipe directory useful even without manually installing — the extension discovers recipes automatically for managed users.

---

## 10. Prompt Fine-Tuning

Heavy pass on `packages/extension/src/lib/prompts.ts` to improve AI behavior. Issues to address:

- AI sometimes highlights elements unprompted (only when user asks to find/show something)
- AI sometimes tries to capture page content via execute-js instead of using extraRequests
- AI doesn't always use autoContinue when it should (e.g. translation flow)
- AI sometimes returns navigate + execute-js in the same response (execute-js runs on wrong page before navigation)
- Batch operations: AI still sometimes sends one message per action instead of one summary at the end
- Translation: AI should always request fullPageSnapshot + autoContinue, then translate all elements systematically
- Form filling: AI should fill all fields + submit in one response (especially in yolo mode)
- Review extraRequests documentation in the prompt for clarity
- Test with multiple query types across all demos:
  - Navigation: "go to deposit page"
  - Form filling: "deposit 5000 yen"
  - Translation: "translate this page to English"
  - Information: "what is my account balance?"
  - Multi-step: "withdraw 10000 yen to account 1234567"
  - No-manifest: same queries on VidFlow (no recipe)

---

## Execution Order

Recommended sequence:

1. **Privacy policy page** (required for store submission)
2. **Deploy platform to Railway** (get gyoz.ai live)
3. **Set up OAuth apps** (enable sign-in on live site)
4. **Run DB migrations on Railway**
5. **Chrome Web Store submission** (build + submit)
6. **Firefox Add-ons submission** (build + submit)
7. **Safari extension** (Xcode + App Store Connect)
8. **Deep link recipe install** (seamless install flow)
9. **Extension → platform recipe sync** (managed mode auto-fetch)
10. **Prompt fine-tuning** (iterate on AI behavior quality)
