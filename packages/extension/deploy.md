# Deploying the gyoza Extension

This guide covers building and publishing the gyoza browser extension to **Chrome Web Store**, **Firefox Add-ons (AMO)**, and **Apple App Store** (macOS Safari, iOS Safari, iPadOS Safari).

---

## Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- Dependencies installed: `bun install` from the repo root
- Engine package built: `bun turbo build --filter=@gyoz-ai/engine`

---

## CI/CD Overview

Everything is automated via GitHub Actions:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push/PR to main | Typecheck, test, build Chrome + Firefox + Safari artifacts |
| `release.yml` | Manual dispatch | Version bump → build → GitHub release → publish to all stores |

The release workflow publishes to Chrome, Firefox, and Apple stores in parallel. Each store upload is gated on its secrets being configured — stores with missing secrets are silently skipped.

---

## 1. Chrome Web Store

### First-time setup

1. Register as a Chrome Web Store developer at https://chrome.google.com/webstore/devconsole ($5 one-time fee)
2. Create a new extension listing manually for the first upload:
   - Build the zip: `cd packages/extension && bun run zip`
   - Upload the `.output/*-chrome.zip` file
   - Fill in listing details (see "Store listing assets" below)
   - Submit for review
3. Note the **Extension ID** from the listing URL (32-char alphanumeric string)

### Store listing assets

- **Icon**: 128x128 PNG (already at `public/icon-128.png`)
- **Screenshots**: 1280x800 or 640x400 PNG/JPEG (at least 1, up to 5)
- **Promo tile** (optional): 440x280 PNG
- **Category**: Productivity
- **Privacy justifications**:
  - `activeTab` — read and interact with the current page
  - `storage` — persist settings and conversation history
  - `scripting` — execute AI-generated actions on the page
  - `notifications` — notify when background actions complete
  - `cookies` — sync managed-mode session
- **Data use**: No user data collected (BYOK mode stores keys locally only)

### CI/CD secrets for Chrome

Set these in **GitHub → Settings → Secrets and variables → Actions → Secrets**:

| Secret | How to get it |
|--------|--------------|
| `CHROME_EXTENSION_ID` | From Chrome Web Store Developer Console → your extension's URL |
| `CHROME_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID |
| `CHROME_CLIENT_SECRET` | Same OAuth credential |
| `CHROME_REFRESH_TOKEN` | Use the [Chrome Web Store API token tool](https://nicedoc.io/nicedoc-io/nicedoc) or `chrome-webstore-upload` CLI to get a refresh token via OAuth flow |

**Getting the OAuth credentials:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID (type: Desktop app)
3. Enable the **Chrome Web Store API** in your GCP project
4. Use the client ID/secret to run the OAuth flow and get a refresh token:
   ```bash
   npx chrome-webstore-upload-cli init
   ```
   Follow the prompts — it will output the refresh token.

### Manual publish (if CI secrets not configured)

1. `cd packages/extension && bun run zip`
2. Go to https://chrome.google.com/webstore/devconsole
3. Select your extension → **Package** → **Upload new package**
4. Upload `.output/*-chrome.zip`
5. Submit for review (1-3 business days)

---

## 2. Firefox Add-ons (AMO)

### First-time setup

1. Create an account at https://addons.mozilla.org/developers/
2. Submit the first version manually:
   - Build: `cd packages/extension && bun run zip:firefox`
   - Go to https://addons.mozilla.org/developers/addon/submit/distribution
   - Choose **On this site** (listed on AMO)
   - Upload `.output/*-firefox.zip`
   - When asked for source code, upload a repo zip:
     ```bash
     git archive --format=zip HEAD -o gyoza-source.zip
     ```
   - Fill in listing details and submit
3. Note the **Extension GUID** (shown in the extension's AMO developer page, e.g. `{uuid}` or `extension@id`)

### CI/CD secrets for Firefox

| Secret | How to get it |
|--------|--------------|
| `FIREFOX_JWT_ISSUER` | AMO → Tools → Manage API Keys → JWT issuer (API key) |
| `FIREFOX_JWT_SECRET` | AMO → Tools → Manage API Keys → JWT secret |
| `FIREFOX_EXTENSION_GUID` | From your extension's AMO developer page |

**Getting API keys:**
1. Go to https://addons.mozilla.org/developers/addon/api/key/
2. Generate new credentials
3. Copy the **JWT issuer** and **JWT secret**

### Manual publish

1. `cd packages/extension && bun run zip:firefox`
2. AMO → your extension → **Manage Versions** → **Upload a New Version**
3. Upload `.output/*-firefox.zip` + source code zip
4. Submit for review (1-5 business days)

---

## 3. Apple App Store (macOS + iOS + iPadOS Safari)

Safari extensions are distributed as native apps through the App Store. One listing covers macOS Safari (desktop) and iOS/iPadOS Safari (mobile/tablet).

### First-time setup

#### A. Apple Developer Account

1. Enroll in the Apple Developer Program at https://developer.apple.com/programs/ ($99/year)
2. Note your **Team ID** — visible at https://developer.apple.com/account → Membership

#### B. Create App IDs

In the Apple Developer portal (https://developer.apple.com/account/resources/identifiers/list):

1. Create an **App ID** for the container app:
   - Platform: iOS, macOS (check both)
   - Bundle ID: `ai.gyoz.safari` (explicit)
   - Capabilities: none needed beyond defaults
2. Create an **App ID** for the Safari web extension:
   - Platform: iOS, macOS (check both)
   - Bundle ID: `ai.gyoz.safari.Extension` (explicit)
   - Capabilities: none needed beyond defaults

#### C. Create an App Store Connect record

1. Go to https://appstoreconnect.apple.com/apps
2. Click **+** → **New App**
3. Platforms: **macOS** and **iOS**
4. Name: **gyoza — AI Browser Copilot**
5. Bundle ID: `ai.gyoz.safari`
6. SKU: `gyoza-safari`
7. Fill in:
   - Category: **Utilities** or **Productivity**
   - Description, screenshots (see sizes below), keywords
   - Privacy policy URL
   - Support URL

**Screenshot sizes needed:**
- macOS: 1280x800 or 1440x900
- iPhone 6.9": 1320x2868
- iPhone 6.7": 1290x2796
- iPad 13": 2064x2752

#### D. Create a Distribution Certificate

1. Open **Keychain Access** on your Mac
2. Keychain Access → Certificate Assistant → **Request a Certificate From a Certificate Authority**
   - Email: your Apple ID email
   - Save to disk (creates a `.certSigningRequest` file)
3. Go to https://developer.apple.com/account/resources/certificates/add
4. Choose **Apple Distribution**
5. Upload the `.certSigningRequest`
6. Download the `.cer` file and double-click to install in Keychain
7. **Export as .p12**: In Keychain Access, find "Apple Distribution: Your Name" → right-click → Export as .p12 → set a password

#### E. Create an App Store Connect API Key

1. Go to https://appstoreconnect.apple.com/access/integrations/api
2. Click **+** to generate a new key
3. Name: `gyoza-ci`
4. Access: **App Manager** (or Admin)
5. Download the `.p8` file (you can only download it once!)
6. Note the **Key ID** and **Issuer ID** shown on the page

#### F. Set GitHub Secrets

| Secret | Value |
|--------|-------|
| `APPLE_TEAM_ID` | Your 10-character Team ID |
| `APPLE_CERTIFICATE_BASE64` | `base64 -i distribution.p12 \| pbcopy` — paste the result |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the .p12 |
| `APPLE_API_KEY_ID` | Key ID from App Store Connect API page |
| `APPLE_API_ISSUER_ID` | Issuer ID from App Store Connect API page |
| `APPLE_API_KEY_BASE64` | `base64 -i AuthKey_XXXX.p8 \| pbcopy` — paste the result |

Optionally, set a **repository variable** (not secret):

| Variable | Default | Description |
|----------|---------|-------------|
| `APPLE_BUNDLE_ID` | `ai.gyoz.safari` | Base bundle identifier for the Safari app |

### How the CI/CD works

The `release.yml` workflow runs a `release-safari` job on a macOS runner that:

1. Builds the Safari extension with WXT (`wxt build --browser safari`)
2. Converts to a universal Xcode project with `xcrun safari-web-extension-converter`
3. Installs your distribution certificate into a temporary keychain
4. Archives for **macOS** and **iOS** (which includes iPadOS) using automatic signing
5. Uploads both archives directly to **App Store Connect**
6. Cleans up the temporary keychain

After upload, the builds appear in App Store Connect under **TestFlight** → **Builds**. You then:
1. Go to your app in App Store Connect
2. Select the macOS/iOS version → add the uploaded build
3. Submit for review

### Manual build (local Xcode)

If you prefer to build and upload from your Mac:

```bash
# Build Safari extension
cd packages/extension
bun run build:safari

# Convert to Xcode project (universal — macOS + iOS)
xcrun safari-web-extension-converter .output/safari-mv2/ \
  --project-location ./safari-xcode \
  --app-name "gyoza" \
  --bundle-identifier ai.gyoz.safari \
  --no-prompt

# Open in Xcode
open safari-xcode/gyoza/gyoza.xcodeproj
```

In Xcode:
1. Select your development team under **Signing & Capabilities** for ALL targets
2. For **macOS**: Select the `gyoza (macOS)` scheme → Product → Archive → Distribute App → App Store Connect
3. For **iOS**: Select the `gyoza (iOS)` scheme → Product → Archive → Distribute App → App Store Connect

### Testing locally

```bash
# Build and convert
cd packages/extension
bun run build:safari
xcrun safari-web-extension-converter .output/safari-mv2/ \
  --project-location ./safari-xcode \
  --app-name "gyoza" \
  --bundle-identifier ai.gyoz.safari \
  --no-prompt

# Open in Xcode, select scheme, click Run (Cmd+R)
open safari-xcode/gyoza/gyoza.xcodeproj
```

Then enable the extension:
- **macOS**: Safari → Settings → Extensions → check "gyoza"
- **iOS/iPadOS**: Settings → Safari → Extensions → enable "gyoza"

---

## 4. Local Development / Sideloading

For testing before publishing:

### Chrome

1. `cd packages/extension && bun run build`
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select `.output/chrome-mv3/`

### Firefox

1. `cd packages/extension && bun run build:firefox`
2. Go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on** → select any file inside `.output/firefox-mv3/`

### Safari

See "Testing locally" above in the Apple section.

### Dev mode with hot reload

```bash
# Chrome (auto-opens browser with extension loaded)
cd packages/extension && bun run dev

# Firefox
cd packages/extension && bun run dev:firefox
```

---

## 5. Release Checklist

When cutting a new release:

1. **Trigger the release workflow**: Go to GitHub → Actions → "Release Extension" → Run workflow
2. Choose version bump type: `patch` / `minor` / `major`
3. The workflow automatically:
   - Bumps the version in `wxt.config.ts` and `package.json`
   - Runs typecheck and tests
   - Builds and zips Chrome + Firefox
   - Creates a GitHub Release with artifacts
   - Uploads to Chrome Web Store (if secrets configured)
   - Uploads to Firefox Add-ons (if secrets configured)
   - Builds Safari, archives for macOS + iOS, uploads to App Store Connect (if secrets configured)
4. **After CI completes** (App Store only):
   - Go to https://appstoreconnect.apple.com
   - Select the uploaded build for each platform version
   - Submit for App Store review

---

## 6. All GitHub Secrets Reference

| Secret | Store | Required |
|--------|-------|----------|
| `CHROME_EXTENSION_ID` | Chrome | Yes |
| `CHROME_CLIENT_ID` | Chrome | Yes |
| `CHROME_CLIENT_SECRET` | Chrome | Yes |
| `CHROME_REFRESH_TOKEN` | Chrome | Yes |
| `FIREFOX_JWT_ISSUER` | Firefox | Yes |
| `FIREFOX_JWT_SECRET` | Firefox | Yes |
| `FIREFOX_EXTENSION_GUID` | Firefox | Yes |
| `APPLE_TEAM_ID` | Apple | Yes |
| `APPLE_CERTIFICATE_BASE64` | Apple | Yes |
| `APPLE_CERTIFICATE_PASSWORD` | Apple | Yes |
| `APPLE_API_KEY_ID` | Apple | Yes |
| `APPLE_API_ISSUER_ID` | Apple | Yes |
| `APPLE_API_KEY_BASE64` | Apple | Yes |

| Variable (not secret) | Default | Description |
|-----------------------|---------|-------------|
| `APPLE_BUNDLE_ID` | `ai.gyoz.safari` | Bundle ID for the Safari app |

---

## Troubleshooting

### Chrome: "The item is not found in the Web Store"
- New extensions take up to 24h to propagate after first review approval.

### Firefox: "Upload submitted (may need manual review)"
- This is normal. Extensions using bundlers often require manual review (1-5 days).
- Make sure you uploaded source code with your submission.

### Apple: "No eligible signing certificate found"
- Verify the .p12 was exported from an **Apple Distribution** certificate (not Developer).
- Check the certificate hasn't expired at https://developer.apple.com/account/resources/certificates.

### Apple: "No profiles for 'ai.gyoz.safari' were found"
- Ensure both App IDs exist in the Developer portal (`ai.gyoz.safari` and `ai.gyoz.safari.Extension`).
- The CI uses automatic signing — Xcode generates provisioning profiles via the API key. Make sure the API key has **App Manager** or **Admin** access.

### Apple: Build appears in TestFlight but can't submit
- You need to fill in all required metadata in App Store Connect first (screenshots, description, privacy policy).
- Export compliance: Safari extensions typically qualify for the encryption exemption — select "No" for custom encryption.
