import type { LanguageModel } from "ai";

// Provider always returns a single model. Earlier dual-model variant
// (execution worker + chat narrator) was removed because the chat
// phase silently hung; one model handles every step now.
export type ProviderResult = { type: "model"; model: LanguageModel };
