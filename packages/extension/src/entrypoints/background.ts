import { z } from "zod/v4";
import { ActionResponseSchema } from "@gyoz-ai/engine";
import {
  getSettings,
  getConversationHistory,
  saveConversationHistory,
} from "../lib/storage";
import { getRecipeForDomain } from "../lib/recipes";
import { createProvider } from "../lib/providers";
import { buildSystemPrompt, buildUserPrompt } from "../lib/prompts";

// Pre-compute JSON schema for structured output
const actionJsonSchema = z.toJSONSchema(ActionResponseSchema, {
  target: "jsonSchema7",
});

export default defineBackground(() => {
  console.log("[gyozai] Background worker started");

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "gyozai_query") {
      handleQuery(message)
        .then(sendResponse)
        .catch((err) => {
          console.error("[gyozai] Query error:", err);
          sendResponse({
            error: err instanceof Error ? err.message : "Unknown error",
          });
        });
      return true;
    }

    if (message.type === "gyozai_get_recipe") {
      getRecipeForDomain(message.domain).then(sendResponse);
      return true;
    }

    if (message.type === "gyozai_clear_history") {
      saveConversationHistory([]).then(() => {
        console.log("[gyozai] Conversation history cleared");
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === "gyozai_open_popup") {
      chrome.action.openPopup();
      return false;
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === "_execute_action") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "gyozai_toggle" });
        }
      });
    }
  });
});

async function handleQuery(message: {
  query: string;
  manifestMode: boolean;
  sitemapXml?: string;
  htmlSnapshot?: string;
  currentRoute?: string;
  pageContext?: string;
  context?: Record<string, unknown>;
  capabilities?: Record<string, boolean>;
}) {
  const settings = await getSettings();
  const provider = createProvider(settings);
  const history = await getConversationHistory();

  const caps = message.capabilities || {};
  const mode = message.manifestMode ? "manifest" : "no-manifest";
  const systemPrompt = buildSystemPrompt(
    mode as "manifest" | "no-manifest",
    caps,
  );
  const userPrompt = buildUserPrompt({
    query: message.query,
    sitemapXml: message.sitemapXml,
    htmlSnapshot: message.htmlSnapshot,
    currentRoute: message.currentRoute,
    context: message.context,
    pageContext: message.pageContext,
  });

  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: userPrompt },
  ];

  // ─── Log request ───────────────────
  console.group(
    `%c[gyozai] BACKGROUND → LLM`,
    "color: #E8950A; font-weight: bold",
  );
  console.log(
    "  Provider:",
    settings.provider,
    "| Model:",
    settings.model,
    "| Mode:",
    settings.mode,
  );
  console.log("  Query:", message.query.slice(0, 100));
  console.log("  Manifest mode:", message.manifestMode);
  console.log("  Conversation history:", history.length, "messages");
  console.log("  System prompt:", systemPrompt.slice(0, 100) + "...");
  console.log("  User prompt:", userPrompt.slice(0, 150) + "...");
  if (message.pageContext) {
    console.log("  Page context:", message.pageContext.length, "chars");
  }

  const start = Date.now();
  const result = await provider.query(
    systemPrompt,
    messages,
    actionJsonSchema as Record<string, unknown>,
  );
  const ms = Date.now() - start;

  // ─── Log response ──────────────────
  console.log(`  ⏱ Response in ${ms}ms`);
  console.log("  Actions:");
  for (const action of result.actions) {
    const parts = [`    → ${action.type}`];
    if (action.target) parts.push(`target="${action.target}"`);
    if (action.selector) parts.push(`selector="${action.selector}"`);
    if (action.url) parts.push(`url="${action.url}"`);
    if (action.code) parts.push(`code="${(action.code || "").slice(0, 60)}"`);
    if (action.message)
      parts.push(`msg="${(action.message || "").slice(0, 80)}"`);
    if (action.options) parts.push(`options=[${action.options.join(", ")}]`);
    console.log(parts.join(" "));
  }
  const extraReqs = (result as { extraRequests?: string[] }).extraRequests;
  if (extraReqs?.length) {
    console.log("  Extra requests:", extraReqs.join(", "));
  }
  console.groupEnd();

  // Update conversation history
  history.push({ role: "user", content: message.query });
  const assistantMsg = result.actions
    .map((a) => a.message)
    .filter(Boolean)
    .join(" ");
  if (assistantMsg) {
    history.push({ role: "assistant", content: assistantMsg });
  }
  await saveConversationHistory(history);

  return result;
}
