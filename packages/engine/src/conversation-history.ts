export interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export class ConversationHistory {
  private entries: HistoryEntry[] = [];
  private maxMessages: number;
  private maxEstimatedTokens: number;

  constructor(opts?: { maxMessages?: number; maxEstimatedTokens?: number }) {
    this.maxMessages = opts?.maxMessages ?? 50;
    this.maxEstimatedTokens = opts?.maxEstimatedTokens ?? 30_000;
  }

  append(entry: HistoryEntry): void {
    this.entries.push(entry);
    this.trim();
  }

  /** Append user query + assistant summary (tool calls + messages) in one shot */
  appendTurn(userQuery: string, assistantSummary: string): void {
    this.append({ role: "user", content: userQuery });
    if (assistantSummary) {
      this.append({ role: "assistant", content: assistantSummary });
    }
  }

  /** Build tool summary string: "[click] [navigate] some message text" */
  static buildAssistantSummary(
    toolCalls: Array<{ tool: string }>,
    messages: string[],
  ): string {
    const toolPart = toolCalls
      .filter(
        (tc) => tc.tool !== "show_message" && tc.tool !== "set_expression",
      )
      .map((tc) => `[${tc.tool}]`)
      .join(" ");
    const msgPart = messages.join("\n\n").slice(0, 300);
    return [toolPart, msgPart].filter(Boolean).join("\n");
  }

  getEntries(): HistoryEntry[] {
    return [...this.entries];
  }

  load(entries: HistoryEntry[]): void {
    this.entries = [...entries];
    this.trim();
  }

  clear(): void {
    this.entries = [];
  }

  private trim(): void {
    // Trim by count
    while (this.entries.length > this.maxMessages) {
      this.entries.shift();
    }
    // Trim by token estimate
    let totalTokens = 0;
    for (const e of this.entries) {
      totalTokens += Math.ceil(e.content.length / 4);
    }
    while (totalTokens > this.maxEstimatedTokens && this.entries.length > 2) {
      const removed = this.entries.shift()!;
      totalTokens -= Math.ceil(removed.content.length / 4);
    }
  }

  toMessages(): Array<{ role: "user" | "assistant"; content: string }> {
    return this.entries.map((e) => ({ role: e.role, content: e.content }));
  }

  /** Prepare old messages for compaction. Returns entries to summarize and entries to keep. */
  prepareCompaction(keepRecentTurns: number = 4): {
    toSummarize: HistoryEntry[];
    toKeep: HistoryEntry[];
  } {
    if (this.entries.length <= keepRecentTurns * 2) {
      return { toSummarize: [], toKeep: [...this.entries] };
    }
    const keepCount = keepRecentTurns * 2;
    const toKeep = this.entries.slice(-keepCount);
    const toSummarize = this.entries.slice(0, -keepCount);
    return { toSummarize, toKeep };
  }

  /** Apply compaction — replace old entries with a single summary */
  applyCompaction(summary: string, keepRecentTurns: number = 4): void {
    const { toKeep } = this.prepareCompaction(keepRecentTurns);
    this.entries = [
      {
        role: "assistant",
        content: `[Previous conversation summary: ${summary}]`,
      },
      ...toKeep,
    ];
  }

  /** Replace large tool results in older history with compact summaries */
  microcompact(): void {
    const toolResultPatterns: Array<{
      pattern: RegExp;
      replacement: (m: string) => string;
    }> = [
      {
        pattern: /Page context captured.*$/s,
        replacement: (m) => m.split("\n")[0] + " [truncated]",
      },
      {
        pattern: /JS executed.*$/s,
        replacement: (m) => m.slice(0, 200) + "... [truncated]",
      },
      {
        pattern: /Fetched URL.*$/s,
        replacement: (m) => m.slice(0, 500) + "... [truncated]",
      },
    ];
    // Only compact entries older than the last 4
    for (let i = 0; i < Math.max(0, this.entries.length - 4); i++) {
      const entry = this.entries[i];
      if (entry.role === "assistant" && entry.content.length > 1000) {
        for (const { pattern, replacement } of toolResultPatterns) {
          if (pattern.test(entry.content)) {
            entry.content = replacement(entry.content);
            break;
          }
        }
      }
    }
  }
}
