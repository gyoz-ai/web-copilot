export type ContextLevel = "light" | "interactive" | "full";

export interface ContextSnapshot {
  level: ContextLevel;
  url: string;
  hash: string;
  content: string;
  capturedAt: number;
}

export class ContextManager {
  private lastSnapshot: ContextSnapshot | null = null;

  /** Decide what context level to provide for this turn */
  decideLevel(opts: {
    isFirstTurn: boolean;
    pageUrl: string;
    lastPageUrl: string | null;
    lastActionFailed: boolean;
    userQueryLooksStructural: boolean;
  }): ContextLevel {
    if (opts.isFirstTurn) return "full";
    if (opts.lastActionFailed) return "full";
    if (opts.pageUrl !== opts.lastPageUrl) return "full";
    if (opts.userQueryLooksStructural) return "interactive";
    return "light";
  }

  /** Check if cached snapshot is still valid */
  isCacheValid(currentUrl: string, currentHash: string): boolean {
    if (!this.lastSnapshot) return false;
    return (
      this.lastSnapshot.url === currentUrl &&
      this.lastSnapshot.hash === currentHash
    );
  }

  /** Store a snapshot */
  cacheSnapshot(snapshot: ContextSnapshot): void {
    this.lastSnapshot = snapshot;
  }

  /** Get diff message when content hasn't changed */
  getUnchangedMessage(): string {
    return "[Page context unchanged from previous turn]";
  }

  /** Simple heuristic: does the query ask about page structure? */
  static looksStructural(query: string): boolean {
    const patterns = [
      /what.*(button|link|form|input|field)/i,
      /where.*(is|are)/i,
      /how many/i,
      /list.*(all|every)/i,
      /show me/i,
      /find.*(on|in).*page/i,
    ];
    return patterns.some((p) => p.test(query));
  }
}
