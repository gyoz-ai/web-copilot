import { defineConfig } from "wxt";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  srcDir: "src",
  webExt: {
    chromiumProfile: resolve(__dirname, ".chrome-profile"),
    keepProfileChanges: true,
  },
  manifest: {
    name: "gyozAI — AI Website Navigator",
    description:
      "AI that navigates any website for you. Ask questions, get answers, let AI click and navigate.",
    version: "0.0.1",
    icons: {
      128: "/icon-128.png",
    },
    permissions: ["activeTab", "storage", "scripting"],
    web_accessible_resources: [
      {
        resources: ["/icon-128.png"],
        matches: ["<all_urls>"],
      },
    ],
    commands: {
      _execute_action: {
        suggested_key: {
          default: "Ctrl+Shift+G",
          mac: "Command+Shift+G",
        },
        description: "Open gyozAI assistant",
      },
    },
  },
  modules: ["@wxt-dev/module-react"],
});
