# Safari Extension — App Store Deployment

## Prerequisites

- Apple Developer account ($99/year) — already active
- Xcode installed (latest stable)
- Team ID: `QF7B5DW2R7`
- Bundle ID: `com.gyoz.ai` (app) / `com.gyoz.ai.Extension` (extension)

---

## A. One-Time Setup (do this once, never again)

### A1. Create a Distribution Certificate

You need this to sign your app for the App Store.

1. Open **Keychain Access** on your Mac
2. Top menu → **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
3. Enter your email, leave CA Email empty, select **Saved to disk** → **Continue** → save the `.certSigningRequest` file
4. Open https://developer.apple.com/account/resources/certificates/list
5. Click the **+** button
6. Select **Apple Distribution** → **Continue**
7. Upload the `.certSigningRequest` file you just saved → **Continue**
8. Click **Download** — you get a `.cer` file
9. Double-click the `.cer` file — it installs into Keychain Access
10. Back in **Keychain Access**, go to **login** keychain → **My Certificates**
11. Find "Apple Distribution: YOUR NAME" → right-click → **Export...**
12. Save as `.p12` format, set a password you'll remember
13. Keep both the `.p12` file and the password — you need them for CI later

### A2. Create App Store Connect API Key

You need this so CI can upload builds without your password.

1. Open https://appstoreconnect.apple.com/access/integrations/api
2. Click **Generate API Key**
3. Name: `gyoza-ci`
4. Access: **App Manager**
5. Click **Generate**
6. **Download the `.p8` file immediately** — you can only download it ONCE
7. Write down the **Key ID** (shown in the table, e.g. `ABC123DEFG`)
8. Write down the **Issuer ID** (shown at the top of the page)

### A3. Register App IDs

1. Open https://developer.apple.com/account/resources/identifiers/list
2. Check if `com.gyoz.ai` exists. If not:
   - Click **+** → **App IDs** → **Continue** → **App** → **Continue**
   - Description: `gyoza`
   - Bundle ID: Explicit → `com.gyoz.ai`
   - **Register**
3. Check if `com.gyoz.ai.Extension` exists. If not:
   - Same steps, but Bundle ID: `com.gyoz.ai.Extension`, Description: `gyoza Extension`

### A4. Create the App in App Store Connect

1. Open https://appstoreconnect.apple.com/apps
2. Click **+** → **New App**
3. Fill in:
   - Platforms: check **iOS** AND **macOS**
   - Name: `gyoza`
   - Primary Language: **English (U.S.)**
   - Bundle ID: select **com.gyoz.ai**
   - SKU: `gyoza-safari`
4. Click **Create**

### A5. Fill the App Store Listing

This is required before you can submit your first build for review.

1. In your app page, left sidebar → **App Information**
   - Subtitle: `AI Browser Assistant`
   - Category: **Productivity**
   - Secondary Category: **Utilities**
2. Left sidebar → **Pricing and Availability**
   - Price: Free (or configure subscriptions)
   - Availability: All countries (or select specific ones)
3. Left sidebar → **1.0 Prepare for Submission** (under iOS or macOS)
   - **Screenshots** — upload for each required device:
     - iPhone 6.7" display (1290 x 2796 px)
     - iPad 12.9" 3rd gen (2048 x 2732 px) — if supporting iPad
     - Mac (1280 x 800 px minimum)
   - **Description** — paste from `docs/store-localization.md`
   - **Keywords** — `AI,browser,assistant,chatgpt,claude,gemini,automation,web,copilot`
   - **Support URL** — `https://gyoz.ai`
   - **Privacy Policy URL** — `https://gyoz.ai/privacy` (required)
   - **App Review Information** → Notes for reviewer:
     ```
     This is a Safari Web Extension. After installing, enable it in
     Safari → Settings → Extensions → gyoza. The extension adds a
     floating AI bubble on web pages.
     ```
   - Add contact info (phone + email for Apple reviewer)

---

## B. First Manual Upload (do this to verify everything works)

### B1. Build the Safari extension locally

```bash
cd packages/extension
bun run build:safari
```

This runs: generate locales → WXT build → safari-web-extension-converter → safari-localize.

### B2. Open the Xcode project

```bash
open safari-app/gyoza/gyoza.xcodeproj
```

### B3. Archive and upload the macOS app

1. In Xcode top bar, select scheme: **gyoza (macOS)**
2. Select destination: **Any Mac**
3. Menu → **Product** → **Archive** (wait for it to build)
4. The **Organizer** window opens automatically showing your archive
5. Click **Distribute App**
6. Select **App Store Connect** → **Next**
7. Select **Upload** → **Next**
8. Signing: **Automatically manage signing** → **Next**
9. Review summary → **Upload**
10. Wait for "Upload Successful" message

### B4. Archive and upload the iOS app

1. In Xcode top bar, select scheme: **gyoza (iOS)**
2. Select destination: **Any iOS Device (arm64)**
3. Menu → **Product** → **Archive** (wait for it to build)
4. Organizer opens → **Distribute App**
5. Same steps as macOS: **App Store Connect** → **Upload** → auto signing → **Upload**

### B5. Submit for review

1. Open https://appstoreconnect.apple.com/apps → select **gyoza**
2. Wait ~15 minutes for Apple to finish processing your builds
3. Go to **1.0 Prepare for Submission** under iOS
4. Scroll to **Build** section → click **+** → select the build you just uploaded
5. Repeat for the macOS version
6. Scroll to top → **Submit for Review**
7. Answer the export compliance question (usually "No" for encryption)
8. Wait 1-3 days for Apple review

---

## C. Set Up Automated Deployment (GitHub Actions)

After the first manual upload works, set up CI so every release auto-publishes.

### C1. Encode your secrets

Run these on your Mac:

```bash
# Encode the .p12 certificate
base64 -i /path/to/your-certificate.p12 | pbcopy
echo "Copied! Paste as APPLE_CERTIFICATE_BASE64"

# Encode the .p8 API key
base64 -i /path/to/AuthKey_XXXXXXXX.p8 | pbcopy
echo "Copied! Paste as APPLE_API_KEY_BASE64"
```

### C2. Add secrets to GitHub

1. Open https://github.com/gyoz-ai/web-copilot/settings/secrets/actions
2. Click **New repository secret** for each:

| Secret name | Value |
|-------------|-------|
| `APPLE_CERTIFICATE_BASE64` | The base64 of your .p12 file (from step C1) |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the .p12 |
| `APPLE_API_KEY_BASE64` | The base64 of your .p8 file (from step C1) |
| `APPLE_API_KEY_ID` | The Key ID from step A2 (e.g. `ABC123DEFG`) |
| `APPLE_API_ISSUER_ID` | The Issuer ID from step A2 |
| `APPLE_TEAM_ID` | `QF7B5DW2R7` |

### C3. Add the bundle ID variable

1. Open https://github.com/gyoz-ai/web-copilot/settings/variables/actions
2. Click **New repository variable**
3. Name: `APPLE_BUNDLE_ID` → Value: `com.gyoz.ai`

(This is important — the workflow defaults to `ai.gyoz.safari` if not set, which won't match your App Store app.)

### C4. Test the automated release

```bash
# From terminal:
gh workflow run release.yml -f bump=patch

# Or: GitHub → Actions → "Release Extension" → Run workflow → select "patch"
```

The workflow will:
1. Bump version in `wxt.config.ts` and `package.json`
2. Build + publish Chrome and Firefox extensions
3. Build Safari extension on a macOS runner
4. Sign with your certificate
5. Upload macOS + iOS builds to App Store Connect
6. You still need to manually select the build and submit for review in App Store Connect

---

## D. Subsequent Releases (ongoing)

After everything is set up, releasing a new Safari version is just:

1. Run the release workflow: `gh workflow run release.yml -f bump=patch`
2. Wait for the workflow to complete (~10-15 min)
3. Open https://appstoreconnect.apple.com/apps → select **gyoza**
4. Wait for build processing (~15 min after upload)
5. Go to the new version → **Build** → select the new build
6. Click **Submit for Review**

That's it. Steps 1-2 are automated, steps 3-6 are ~2 minutes of clicking.

---

## Troubleshooting

**"No accounts with App Store Connect access"** in Xcode
→ Xcode → Settings → Accounts → add your Apple ID

**"No signing certificate" error**
→ Make sure the .cer is installed in Keychain AND you see it under My Certificates

**Build stuck in "Processing" in App Store Connect**
→ Normal, can take 5-30 minutes. Refresh the page.

**"Missing compliance" warning**
→ Go to App Information → add export compliance info (usually: "No" to using non-standard encryption)

**Provisioning profile errors in CI**
→ The workflow uses `-allowProvisioningUpdates` which auto-creates profiles. Make sure `APPLE_TEAM_ID` is correct and the API key has enough permissions.

**Version mismatch between extension and App Store**
→ Extension uses `0.0.x` versions. App Store uses `MARKETING_VERSION` (currently `1.0`). These are independent — the extension version is the browser extension version, the App Store version is the iOS/macOS app wrapper version.
