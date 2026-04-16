import type { LanguageModel } from "ai";

// Provider result — single model (BYOK) or dual model (managed with execution endpoint)
export type ProviderResult =
  | { type: "model"; model: LanguageModel }
  | { type: "dual"; chatModel: LanguageModel; executionModel: LanguageModel };
