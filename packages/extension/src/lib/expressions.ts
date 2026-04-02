/** All supported avatar expressions — must match the set_expression tool enum. */
export const EXPRESSIONS = [
  "neutral",
  "happy",
  "thinking",
  "surprised",
  "confused",
  "excited",
  "concerned",
  "proud",
] as const;

export type Expression = (typeof EXPRESSIONS)[number];

export const DEFAULT_EXPRESSION: Expression = "neutral";
export const DEFAULT_AVATAR = "gyoza";

/**
 * Resolve the avatar image URL for a given expression and talking state.
 *
 * Layout:  /avatars/{avatar}/{expression}.png        — idle
 *          /avatars/{avatar}/{expression}-talking.gif — talking
 */
export function getAvatarUrl(
  expression: Expression,
  isTalking: boolean,
  avatar: string = DEFAULT_AVATAR,
): string {
  const file = isTalking ? `${expression}-talking.gif` : `${expression}.jpeg`;
  return `/avatars/${avatar}/${file}`;
}
