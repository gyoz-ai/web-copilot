import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import type { ExtensionSettings } from "../storage";
import type { ProviderResult } from "./types";

export type { ProviderResult } from "./types";

const PLATFORM_URL = "https://gyoz.ai/v1/ai";

export function createProvider(settings: ExtensionSettings): ProviderResult {
  // Managed mode → single model. The user-selected model handles every
  // step (tools + narration). Earlier dual-model split (Cerebras
  // execution worker + chat narrator) was removed because the chat
  // phase silently hung after task_complete.
  if (settings.mode === "managed") {
    if (!settings.managedToken) {
      throw new Error("Not signed in to gyoza platform");
    }
    const chatProvider = createOpenAI({
      baseURL: PLATFORM_URL,
      apiKey: settings.managedToken,
    });
    return { type: "model", model: chatProvider.chat(settings.model) };
  }

  // BYOK mode → Vercel AI SDK model (direct to provider)
  const apiKey = settings.apiKeys[settings.provider];
  if (!apiKey) {
    throw new Error("API key is required for BYOK mode");
  }

  switch (settings.provider) {
    case "claude": {
      const anthropic = createAnthropic({
        apiKey,
        headers: {
          "anthropic-dangerous-direct-browser-access": "true",
        },
      });
      return { type: "model", model: anthropic(settings.model) };
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey,
      });
      return { type: "model", model: openai(settings.model) };
    }
    case "gemini": {
      const google = createGoogleGenerativeAI({
        apiKey,
      });
      return { type: "model", model: google(settings.model) };
    }
    case "xai": {
      const xai = createXai({
        apiKey,
      });
      return { type: "model", model: xai(settings.model) };
    }
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
