export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ClarifyState {
  message: string;
  options: string[];
}

export interface ActionResult {
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
  error?: string;
}

export type ViewMode = "chat" | "history";
