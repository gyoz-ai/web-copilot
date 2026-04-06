export const ENGINE_VERSION = "0.0.1";

export * from "./schemas";
export { createEngine } from "./engine";
export { DEFAULT_CAPABILITIES } from "./engine";
export {
  capturePageContext,
  formatPageContext,
  captureCleanHtml,
  getContextHash,
  stripToFit,
  escapeXml,
  isEffectivelyHidden,
} from "./page-context";
export type { PageContext, SnapshotType } from "./page-context";
export type {
  EngineConfig,
  QueryOptions,
  EngineError,
  QueryResult as LegacyQueryResult,
  Engine,
  Capabilities,
} from "./engine";

// ─── New architecture exports ────────────────────────────────────────────────

export { QueryEngine } from "./query-engine";
export type {
  QueryEngineConfig,
  QueryInput,
  QueryResult,
  QueryError,
  StreamEvent,
  LLMProvider,
  LegacyProvider,
  BYOKProvider,
  UserPromptParams,
} from "./query-engine";

export { ConversationHistory } from "./conversation-history";
export type { HistoryEntry } from "./conversation-history";

export type {
  ToolOutcome,
  ToolContext,
  BrowserToolDescriptor,
  ToolRegistry,
} from "./tool";

export { ContextManager } from "./context-manager";
export type { ContextLevel, ContextSnapshot } from "./context-manager";

export { createEmptyTaskMemory, formatTaskMemory } from "./task-memory";
export type { TaskMemory } from "./task-memory";

export { estimateTokens } from "./token-count";
