import { defineConfig } from "wxt";
import path from "path";

export default defineConfig({
  srcDir: "src",
  webExt: {
    chromiumProfile: path.resolve(__dirname, ".chrome-profile"),
    keepProfileChanges: true,
  },
  manifest: {
    name: "gyozAI — AI Website Navigator",
    description:
      "AI that navigates any website for you. Ask questions, get answers, let AI click and navigate.",
    version: "0.0.1",
    permissions: ["activeTab", "storage", "scripting"],
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
