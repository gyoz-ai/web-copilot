import type { LLMProvider } from "./types";
import type { ExtensionSettings } from "../storage";
import { ClaudeProvider } from "./claude";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { ManagedProvider } from "./managed";

export type { LLMProvider, Message } from "./types";

export function createProvider(settings: ExtensionSettings): LLMProvider {
  if (settings.mode === "managed") {
    if (!settings.managedToken) {
      throw new Error("Not signed in to gyoza platform");
    }
    return new ManagedProvider(settings.managedToken);
  }

  if (!settings.apiKey) {
    throw new Error("API key is required for BYOK mode");
  }

  switch (settings.provider) {
    case "claude":
      return new ClaudeProvider(settings.apiKey, settings.model);
    case "openai":
      return new OpenAIProvider(settings.apiKey, settings.model);
    case "gemini":
      return new GeminiProvider(settings.apiKey, settings.model);
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
