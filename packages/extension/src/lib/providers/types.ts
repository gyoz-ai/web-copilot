import type { LanguageModel } from "ai";

// Provider result — always a Vercel AI SDK model (both BYOK and managed)
export type ProviderResult = { type: "model"; model: LanguageModel };
