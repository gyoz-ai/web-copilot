import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  manifest: {
    name: "gyozAI — AI Website Navigator",
    description:
      "AI that navigates any website for you. Ask questions, get answers, let AI click and navigate.",
    version: "0.0.1",
    icons: {
      128: "/icon-128.png",
    },
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
