export const ENGINE_VERSION = "0.0.1";

export * from "./schemas";
export { createEngine } from "./engine";
export { DEFAULT_CAPABILITIES } from "./engine";
export { capturePageContext, formatPageContext } from "./page-context";
export type { PageContext, SnapshotType } from "./page-context";
export type {
  EngineConfig,
  QueryOptions,
  EngineError,
  QueryResult,
  Engine,
  Capabilities,
} from "./engine";
