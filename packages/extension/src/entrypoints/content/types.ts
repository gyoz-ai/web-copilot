export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** "tool-status" for action indicators, default is regular chat */
  type?: "chat" | "tool-status";
}

export interface ClarifyState {
  message: string;
  options: string[];
}

// New agent-based result from background worker (BYOK tool-calling mode)
export interface AgentResult {
  messages: string[];
  clarify?: { message: string; options: string[] } | null;
  expression?: string | null;
  navigated?: boolean;
  error?: string;
  toolCalls?: Array<{
    tool: string;
    args: Record<string, unknown>;
  }>;
  /** True when streaming events were sent — content script should not duplicate UI updates */
  streamed?: boolean;
  // Legacy fields (managed mode only — content script dispatches these)
  actions?: Array<{
    type: string;
    target?: string;
    selector?: string;
    code?: string;
    message?: string;
    url?: string;
    method?: string;
    options?: string[];
  }>;
  extraRequests?: string[];
  autoContinue?: boolean;
}

export type ViewMode = "chat" | "history";

// ─── Streaming events (background → content script) ──────────────────────────

export interface StreamEventMessage {
  type: "gyozai_stream_event";
  queryId: string;
  event: StreamEvent;
}

export type StreamEvent =
  | { kind: "message"; content: string }
  | { kind: "tool-status"; content: string }
  | { kind: "expression"; face: string }
  | { kind: "clarify"; message: string; options: string[] };
