import { z } from "zod/v4";

// ─── Query Payload Schema ───────────────────────────────────────────────────────
// What the browser engine sends to the proxy server.

export const QueryPayloadSchema = z
  .object({
    query: z.string().min(1),
    manifestMode: z.boolean(),
    recipe: z.string().optional(),
    htmlSnapshot: z.string().optional(),
    currentRoute: z.string().optional(),
    conversationHistory: z
      .array(z.object({ role: z.string(), content: z.string() }))
      .optional()
      .default([]),
  })
  .refine((data) => data.manifestMode || data.htmlSnapshot, {
    message: "htmlSnapshot is required when manifestMode is false",
  });

// ─── Types ──────────────────────────────────────────────────────────────────────

export type QueryPayload = z.infer<typeof QueryPayloadSchema>;
