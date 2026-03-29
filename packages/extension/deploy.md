# Deploying the gyoza Extension

This guide covers building and publishing the gyoza browser extension to Chrome Web Store, Firefox Add-ons (AMO), and Safari.

## Prerequisites

- Node.js 18+ and Bun installed
- Dependencies installed: `bun install` from the repo root
- Engine package built: `bun turbo build` (builds `@gyoz-ai/engine` dependency)

## 1. Build the Extension

All build commands run from `packages/extension/`.

```bash
# Chrome / Edge / Chromium browsers
bun run build

# Firefox
bun run build:firefox
```

Build output goes to `.output/chrome-mv3/` or `.output/firefox-mv2/`.

To create a distributable zip:

```bash
# Chrome zip → .output/gyoza — AI Browser Copilot-0.0.1-chrome.zip
bun run zip

# Firefox zip → .output/gyoza — AI Browser Copilot-0.0.1-firefox.zip
bun run zip:firefox
```

---

## 2. Chrome Web Store

### First-time setup

1. Register as a Chrome Web Store developer at https://chrome.google.com/webstore/devconsole ($5 one-time fee)
2. Prepare store listing assets:
   - **Icon**: 128x128 PNG (already at `public/icon-128.png`)
   - **Screenshots**: 1280x800 or 640x400 PNG/JPEG (at least 1, up to 5)
   - **Promo tile** (optional): 440x280 PNG
   - **Description**: short (132 chars) and detailed

### Publish

1. Build the zip: `bun run zip`
2. Go to https://chrome.google.com/webstore/devconsole
3. Click **New Item** → upload the `.output/*-chrome.zip` file
4. Fill in the store listing:
   - Category: **Productivity** or **Developer Tools**
   - Language: English
   - Add screenshots and description
5. Under **Privacy**, declare:
   - **Single purpose**: "AI assistant that navigates websites on your behalf"
   - **Permissions justification**:
     - `activeTab` — to read and interact with the current page
     - `storage` — to persist settings and conversation history
     - `scripting` — to execute AI-generated actions on the page
     - `notifications` — to notify when actions complete in background tabs
   - **Data use**: no user data collected (BYOK mode stores keys locally only)
6. Submit for review (typically 1-3 business days)

### Updates

1. Bump `version` in `wxt.config.ts` manifest section
2. Build new zip: `bun run zip`
3. In Developer Console → select existing item → **Package** → **Upload new package**
4. Submit for review

---

## 3. Firefox Add-ons (AMO)

### First-time setup

1. Create an account at https://addons.mozilla.org/developers/
2. Prepare the same store listing assets as Chrome

### Publish

1. Build the zip: `bun run zip:firefox`
2. Go to https://addons.mozilla.org/developers/addon/submit/distribution
3. Choose **On this site** (listed on AMO)
4. Upload the `.output/*-firefox.zip` file
5. AMO may ask for source code — upload the full repo zip (or link to the GitHub repo) so reviewers can verify the build
6. Fill in listing details:
   - Name: **gyoza — AI Browser Copilot**
   - Category: **Other** or **Web Development**
   - Add screenshots and description
   - Support email / website
7. Submit for review (typically 1-5 business days, can be longer)

### Source code submission

Firefox reviewers require source code for extensions that use bundlers. When prompted:

1. Zip the entire repo: `git archive --format=zip HEAD -o gyoza-source.zip`
2. Include build instructions:
   - `bun install`
   - `bun turbo build` (builds engine dependency)
   - `cd packages/extension && bun run build:firefox`
3. Upload as "source code" during submission

### Updates

1. Bump `version` in `wxt.config.ts`
2. Build new zip: `bun run zip:firefox`
3. Go to your extension's AMO page → **Manage Versions** → **Upload a New Version**
4. Submit for review

---

## 4. Safari (via Xcode)

Safari extensions require wrapping the web extension in a native macOS/iOS app using Xcode.

### Prerequisites

- macOS with Xcode 14+ installed
- Apple Developer account ($99/year) for App Store distribution
- Safari web extension conversion tool (bundled with Xcode)

### Convert to Safari extension

1. Build the Chrome version first: `bun run build`
2. Run the conversion tool:
   ```bash
   xcrun safari-web-extension-converter .output/chrome-mv3/ \
     --project-location ./safari-extension \
     --app-name "gyoza" \
     --bundle-identifier ai.gyoz.extension \
     --macos-only
   ```
   Add `--ios-only` or remove `--macos-only` for iOS support.
3. This creates an Xcode project at `./safari-extension/`

### Build and test locally

1. Open `safari-extension/gyoza.xcodeproj` in Xcode
2. Select your development team under **Signing & Capabilities**
3. Build and run (Cmd+R)
4. Enable the extension: Safari → Settings → Extensions → check "gyoza"
5. Grant permissions when prompted

### Publish to Mac App Store

1. In Xcode, set the version and build number
2. Archive: **Product → Archive**
3. In the Organizer window, click **Distribute App**
4. Choose **App Store Connect** → **Upload**
5. Go to https://appstoreconnect.apple.com:
   - Create a new app (type: Safari Extension)
   - Add screenshots (1280x800 for Mac, appropriate sizes for iOS)
   - Fill in description, category (**Utilities** or **Productivity**), keywords
   - Select the uploaded build
   - Submit for review (typically 1-2 days)

### Updates

1. Rebuild the Chrome version with bumped version
2. Re-run `xcrun safari-web-extension-converter` with `--force` to overwrite
3. Update version/build in Xcode
4. Archive and upload again

---

## 5. Local Development / Sideloading

For testing before publishing:

### Chrome

1. `bun run build`
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select `.output/chrome-mv3/`

### Firefox

1. `bun run build:firefox`
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** → select any file inside `.output/firefox-mv2/`

### Safari

1. Build and run from Xcode (see above)
2. Enable in Safari → Settings → Extensions

### Dev mode with hot reload

```bash
# Chrome (auto-opens browser with extension loaded)
bun run dev

# Firefox
bun run dev:firefox
```

---

## Version Bumping Checklist

When releasing a new version:

1. Update `version` in `wxt.config.ts` → `manifest` section
2. Update `version` in `packages/extension/package.json`
3. Build and test locally for each target browser
4. Create zip files and upload to respective stores
5. Tag the release: `git tag v0.0.x && git push --tags`
