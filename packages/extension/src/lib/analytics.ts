import { logger } from "./logger";

type Outcome =
  | "task_completed"
  | "task_blocked_ambiguity"
  | "recovered_after_failure"
  | "required_clarification"
  | "user_abandoned";

export function trackOutcome(
  outcome: Outcome,
  metadata?: Record<string, unknown>,
): void {
  // For now, just log to structured logger
  logger.info("query", `Outcome: ${outcome}`, metadata);
  // Future: send to analytics endpoint
}
