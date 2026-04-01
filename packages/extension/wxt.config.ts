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
      minify: "terser",
      terserOptions: {
        compress: { drop_console: false },
      },
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
    name: "gyoza — AI Browser Copilot",
    description:
      "AI that navigates any website for you. Ask questions, get answers, let AI click and navigate.",
    version: "0.0.1",
    icons: {
      16: "/icon-16.png",
      32: "/icon-32.png",
      48: "/icon-48.png",
      128: "/icon-128.png",
    },
    permissions: ["activeTab", "tabs", "storage", "scripting", "notifications"],
    web_accessible_resources: [
      {
        resources: [
          "/icon-128.png",
          "/icon-talking.gif",
          "/avatars/*/*.jpeg",
          "/avatars/*/*.gif",
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
