import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ExtensionSettings } from "../storage";
import type { ProviderResult } from "./types";
import { ManagedProvider } from "./managed";

export type { Message, LegacyLLMProvider, ProviderResult } from "./types";

export function createProvider(settings: ExtensionSettings): ProviderResult {
  // Managed mode → legacy structured-output provider
  if (settings.mode === "managed") {
    if (!settings.managedToken) {
      throw new Error("Not signed in to gyoza platform");
    }
    return {
      type: "legacy",
      provider: new ManagedProvider(settings.managedToken),
    };
  }

  // BYOK mode → Vercel AI SDK model
  if (!settings.apiKey) {
    throw new Error("API key is required for BYOK mode");
  }

  switch (settings.provider) {
    case "claude": {
      const anthropic = createAnthropic({
        apiKey: settings.apiKey,
        headers: {
          "anthropic-dangerous-direct-browser-access": "true",
        },
      });
      return { type: "model", model: anthropic(settings.model) };
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: settings.apiKey,
      });
      return { type: "model", model: openai(settings.model) };
    }
    case "gemini": {
      const google = createGoogleGenerativeAI({
        apiKey: settings.apiKey,
      });
      return { type: "model", model: google(settings.model) };
    }
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
