export type ToolOutcome<T = unknown> =
  | { status: "success"; data: T }
  | { status: "soft_failure"; error: string; retryable: true }
  | { status: "hard_failure"; error: string; retryable: false }
  | { status: "navigation_started"; target: string }
  | { status: "needs_user_input"; prompt: string; options?: string[] }
  | { status: "stale_context"; message: string };

export interface ToolContext {
  tabId: number;
  pageUrl: string;
}

export interface BrowserToolDescriptor {
  name: string;
  description: string;

  // Behavior metadata
  pageChange: boolean;
  mutatesPage: boolean;
  requiresFreshContext: boolean;
  isConcurrencySafe: boolean;

  // Result budgeting
  maxResultChars: number;
}

/** Mapping of tool name → descriptor for all registered tools */
export type ToolRegistry = Record<string, BrowserToolDescriptor>;
