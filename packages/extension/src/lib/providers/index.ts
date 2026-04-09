import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ExtensionSettings } from "../storage";
import type { ProviderResult } from "./types";

export type { ProviderResult } from "./types";

const PLATFORM_URL = "https://gyoz.ai/v1/ai";

export function createProvider(settings: ExtensionSettings): ProviderResult {
  // Managed mode → OpenAI-compatible proxy (same streamText() path as BYOK)
  if (settings.mode === "managed") {
    if (!settings.managedToken) {
      throw new Error("Not signed in to gyoza platform");
    }
    const managed = createOpenAI({
      baseURL: PLATFORM_URL,
      apiKey: settings.managedToken,
    });
    return { type: "model", model: managed.chat(settings.model) };
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
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
