import { z } from "zod/v4";

// ─── Action Response Schema ─────────────────────────────────────────────────────
// This is the JSON schema Claude is constrained to output via output_config.format.
// Guaranteed valid by Claude's constrained decoding — no parsing errors possible.

export const ACTION_TYPES = [
  "navigate",
  "click",
  "execute-js",
  "show-message",
  "highlight-ui",
  "fetch",
  "clarify",
] as const;

export const ActionSchema = z.object({
  type: z.enum(ACTION_TYPES),
  target: z.string().optional(), // navigate: URL path
  selector: z.string().optional(), // click, highlight-ui: CSS selector
  code: z.string().optional(), // execute-js: JS code string
  message: z.string().optional(), // user-facing message
  url: z.string().optional(), // fetch: URL to request
  method: z.string().optional(), // fetch: HTTP method (GET, POST, etc.)
  options: z.array(z.string()).optional(), // clarify: options for user to pick from
});

export const EXTRA_REQUEST_TYPES = [
  "buttonsSnapshot",
  "linksSnapshot",
  "formsSnapshot",
  "inputsSnapshot",
  "textContentSnapshot",
  "fullPageSnapshot",
] as const;

export const ActionResponseSchema = z.object({
  actions: z.array(ActionSchema).min(1),
  // AI can request additional page context before its next response
  extraRequests: z.array(z.enum(EXTRA_REQUEST_TYPES)).optional(),
  // AI explicitly says whether the engine should auto-continue after dispatching
  // these actions (e.g. after capturing extraRequests context). If true, the engine
  // will re-query with the captured context. If false/omitted, it stops and waits.
  autoContinue: z.boolean().optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ActionType = (typeof ACTION_TYPES)[number];
export type Action = z.infer<typeof ActionSchema>;
export type ActionResponse = z.infer<typeof ActionResponseSchema>;
