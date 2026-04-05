import { defineConfig } from "wxt";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  srcDir: "src",
  // Alias React → Preact (3KB vs 130KB) for instant popup/widget load
  vite: () => ({
    resolve: {
      alias: {
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
      },
    },
    build: {
      // Generate source maps as separate files (not inlined)
      // Stripped from the zip but uploaded to GitHub Release as artifacts
      sourcemap: "hidden",
    },
  }),
  dev: {
    server: {
      port: 3100,
    },
  },
  webExt: {
    chromiumProfile: resolve(__dirname, ".chrome-profile"),
    keepProfileChanges: true,
  },
  manifest: {
    name: "gyoza",
    description:
      "AI companion for the browser. Ask questions, get answers, and let AI click and navigate for you.",
    version: "0.0.11",
    browser_specific_settings: {
      gecko: {
        id: "gyoza@gyoz.ai",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["none"],
        },
      },
      gecko_android: {
        strict_min_version: "142.0",
      },
    },
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      128: "/icon-128.png",
    },
    permissions: [
      "activeTab",
      "tabs",
      "storage",
      "scripting",
      "notifications",
      "cookies",
      "webNavigation",
    ],
    host_permissions: ["https://gyoz.ai/*"],
    web_accessible_resources: [
      {
        resources: [
          "/icon-128.png",
          "/icon-talking.gif",
          "/avatars/*/*.jpeg",
          "/avatars/*/*.gif",
          "/fonts/*.css",
          "/fonts/*.woff2",
        ],
        matches: ["<all_urls>"],
      },
    ],
    commands: {
      toggle_widget: {
        suggested_key: {
          default: "Ctrl+Shift+E",
          mac: "Command+Shift+E",
        },
        description: "Toggle gyoza widget",
      },
    },
  },
  modules: ["@wxt-dev/module-react"],
});
