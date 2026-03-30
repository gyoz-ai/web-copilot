import type { LanguageModel } from "ai";
import type { ActionResponse } from "@gyoz-ai/engine";

// Message format for conversation history
export interface Message {
  role: "user" | "assistant";
  content: string;
}

// Legacy provider interface — only used by ManagedProvider (structured output mode)
export interface LegacyLLMProvider {
  query(
    system: string,
    messages: Message[],
    schema: Record<string, unknown>,
  ): Promise<ActionResponse>;
}

// Provider result — either a Vercel AI SDK model (BYOK) or legacy provider (managed)
export type ProviderResult =
  | { type: "model"; model: LanguageModel }
  | { type: "legacy"; provider: LegacyLLMProvider };
