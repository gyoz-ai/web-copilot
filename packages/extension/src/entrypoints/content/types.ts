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
