import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import type { ExtensionSettings } from "../storage";

const PLATFORM_URL = "https://gyoz.ai/v1/ai";

export function createProvider(settings: ExtensionSettings): LanguageModel {
  if (settings.mode === "managed") {
    if (!settings.managedToken) {
      throw new Error("Not signed in to gyoza platform");
    }
    const platform = createOpenAI({
      baseURL: PLATFORM_URL,
      apiKey: settings.managedToken,
    });
    return platform.chat(settings.model);
  }

  // BYOK — direct to provider with user's API key
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
      return anthropic(settings.model);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(settings.model);
    }
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(settings.model);
    }
    case "xai": {
      const xai = createXai({ apiKey });
      return xai(settings.model);
    }
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
