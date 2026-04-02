import { describe, expect, test } from "bun:test";
import { ConversationHistory } from "./conversation-history";

describe("ConversationHistory", () => {
  test("appends and retrieves entries", () => {
    const history = new ConversationHistory();
    history.append({ role: "user", content: "hello" });
    history.append({ role: "assistant", content: "hi there" });

    const entries = history.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].role).toBe("user");
    expect(entries[1].content).toBe("hi there");
  });

  test("appendTurn adds user + assistant pair", () => {
    const history = new ConversationHistory();
    history.appendTurn("what is this?", "This is a page about...");

    const entries = history.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ role: "user", content: "what is this?" });
    expect(entries[1]).toEqual({
      role: "assistant",
      content: "This is a page about...",
    });
  });

  test("appendTurn skips empty assistant summary", () => {
    const history = new ConversationHistory();
    history.appendTurn("hello", "");

    const entries = history.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].role).toBe("user");
  });

  test("trims by message count", () => {
    const history = new ConversationHistory({ maxMessages: 4 });
    for (let i = 0; i < 10; i++) {
      history.append({ role: "user", content: `msg ${i}` });
    }

    const entries = history.getEntries();
    expect(entries).toHaveLength(4);
    expect(entries[0].content).toBe("msg 6");
    expect(entries[3].content).toBe("msg 9");
  });

  test("trims by estimated token count", () => {
    const history = new ConversationHistory({
      maxMessages: 100,
      maxEstimatedTokens: 10, // Very low — forces trimming
    });
    // Each 40-char message ≈ 10 tokens
    history.append({ role: "user", content: "a".repeat(40) });
    history.append({ role: "assistant", content: "b".repeat(40) });
    history.append({ role: "user", content: "c".repeat(40) });
    history.append({ role: "assistant", content: "d".repeat(40) });

    // Should trim to 2 entries (minimum)
    const entries = history.getEntries();
    expect(entries.length).toBeLessThanOrEqual(4);
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  test("load replaces existing entries", () => {
    const history = new ConversationHistory();
    history.append({ role: "user", content: "old" });

    history.load([
      { role: "user", content: "new1" },
      { role: "assistant", content: "new2" },
    ]);

    const entries = history.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].content).toBe("new1");
  });

  test("clear removes all entries", () => {
    const history = new ConversationHistory();
    history.append({ role: "user", content: "test" });
    history.clear();

    expect(history.getEntries()).toHaveLength(0);
  });

  test("toMessages returns proper format", () => {
    const history = new ConversationHistory();
    history.append({ role: "user", content: "q1" });
    history.append({ role: "assistant", content: "a1" });

    const messages = history.toMessages();
    expect(messages).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
    ]);
  });

  test("getEntries returns a copy (not mutable reference)", () => {
    const history = new ConversationHistory();
    history.append({ role: "user", content: "original" });

    const entries = history.getEntries();
    entries.push({ role: "assistant", content: "injected" });

    expect(history.getEntries()).toHaveLength(1);
  });
});

describe("buildAssistantSummary", () => {
  test("includes tool names and messages", () => {
    const summary = ConversationHistory.buildAssistantSummary(
      [
        { tool: "click" },
        { tool: "navigate" },
        { tool: "show_message" },
        { tool: "set_expression" },
      ],
      ["I clicked the button", "Navigated to settings"],
    );

    expect(summary).toContain("[click]");
    expect(summary).toContain("[navigate]");
    expect(summary).not.toContain("[show_message]");
    expect(summary).not.toContain("[set_expression]");
    expect(summary).toContain("I clicked the button");
  });

  test("truncates messages to 300 chars", () => {
    const longMsg = "a".repeat(500);
    const summary = ConversationHistory.buildAssistantSummary([], [longMsg]);
    expect(summary.length).toBeLessThanOrEqual(301);
  });

  test("returns empty string for no tools and no messages", () => {
    const summary = ConversationHistory.buildAssistantSummary([], []);
    expect(summary).toBe("");
  });
});

describe("prepareCompaction", () => {
  test("returns empty toSummarize for short history", () => {
    const history = new ConversationHistory();
    history.appendTurn("q1", "a1");
    history.appendTurn("q2", "a2");

    const { toSummarize, toKeep } = history.prepareCompaction(4);
    expect(toSummarize).toHaveLength(0);
    expect(toKeep).toHaveLength(4);
  });

  test("splits correctly for long history", () => {
    const history = new ConversationHistory();
    for (let i = 0; i < 10; i++) {
      history.appendTurn(`q${i}`, `a${i}`);
    }

    const { toSummarize, toKeep } = history.prepareCompaction(4);
    expect(toKeep).toHaveLength(8); // 4 turns × 2 entries
    expect(toSummarize).toHaveLength(12); // remaining entries
  });
});

describe("applyCompaction", () => {
  test("replaces old entries with summary", () => {
    const history = new ConversationHistory();
    for (let i = 0; i < 10; i++) {
      history.appendTurn(`q${i}`, `a${i}`);
    }

    history.applyCompaction("User asked 6 questions about navigation.", 4);

    const entries = history.getEntries();
    expect(entries[0].role).toBe("assistant");
    expect(entries[0].content).toContain("Previous conversation summary");
    expect(entries[0].content).toContain("navigation");
    // Should have summary + 8 kept entries
    expect(entries).toHaveLength(9);
  });
});

describe("microcompact", () => {
  test("truncates old large assistant entries", () => {
    const history = new ConversationHistory();
    history.append({
      role: "assistant",
      content: "Page context captured\n" + "x".repeat(2000),
    });
    history.append({ role: "user", content: "q2" });
    history.append({ role: "assistant", content: "short" });
    history.append({ role: "user", content: "q3" });
    history.append({ role: "assistant", content: "recent" });

    history.microcompact();

    const entries = history.getEntries();
    expect(entries[0].content).toContain("[truncated]");
    expect(entries[0].content.length).toBeLessThan(200);
    // Recent entries should be untouched
    expect(entries[4].content).toBe("recent");
  });

  test("leaves short entries untouched", () => {
    const history = new ConversationHistory();
    history.append({ role: "assistant", content: "short message" });
    history.append({ role: "user", content: "q" });
    history.append({ role: "assistant", content: "also short" });

    history.microcompact();

    expect(history.getEntries()[0].content).toBe("short message");
  });
});
