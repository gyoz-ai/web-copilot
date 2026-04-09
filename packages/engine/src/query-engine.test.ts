import { describe, expect, test, mock } from "bun:test";
import {
  QueryEngine,
  type QueryEngineConfig,
  type QueryError,
} from "./query-engine";

function createMockConfig(
  overrides?: Partial<QueryEngineConfig>,
): QueryEngineConfig {
  return {
    provider: {
      type: "legacy",
      query: mock(async () => ({
        actions: [{ type: "show-message", message: "Hello" }],
      })),
    },
    systemPromptBuilder: () => "system prompt",
    userPromptBuilder: (params) => params.query,
    jsonSchema: { type: "object" },
    ...overrides,
  };
}

describe("QueryEngine", () => {
  test("creates engine and runs legacy query", async () => {
    const config = createMockConfig();
    const engine = new QueryEngine(config);

    const result = await engine.query({
      query: "hello",
      manifestMode: true,
    });

    expect(result.messages).toContain("Hello");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].tool).toBe("show-message");
  });

  test("postProcess adds 'Done.' when no messages", async () => {
    const config = createMockConfig({
      provider: {
        type: "legacy",
        query: mock(async () => ({
          actions: [{ type: "navigate", target: "/page" }],
        })),
      },
    });
    const engine = new QueryEngine(config);

    const result = await engine.query({
      query: "go there",
      manifestMode: true,
    });

    expect(result.messages).toContain("Done.");
  });

  test("postProcess does not add 'Done.' when clarify is present", async () => {
    const config = createMockConfig({
      provider: {
        type: "legacy",
        query: mock(async () => ({
          actions: [
            {
              type: "clarify",
              message: "Which page?",
              options: ["A", "B"],
            },
          ],
        })),
      },
    });
    const engine = new QueryEngine(config);

    const result = await engine.query({
      query: "go somewhere",
      manifestMode: true,
    });

    expect(result.messages).not.toContain("Done.");
    expect(result.clarify).toBeTruthy();
  });

  test("recordTurn updates history", async () => {
    const engine = new QueryEngine(createMockConfig());

    engine.recordTurn("hello", {
      messages: ["Hi there!"],
      toolCalls: [{ tool: "show_message", args: {} }],
    });

    const history = engine.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("hello");
  });

  test("loadHistory and getHistory work correctly", () => {
    const engine = new QueryEngine(createMockConfig());
    engine.loadHistory([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
    ]);

    const history = engine.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe("q1");
  });

  test("reset clears history", () => {
    const engine = new QueryEngine(createMockConfig());
    engine.loadHistory([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
    ]);

    engine.reset();
    expect(engine.getHistory()).toHaveLength(0);
  });
});

describe("QueryEngine retry logic", () => {
  test("retries on 429 errors", async () => {
    let callCount = 0;
    const config = createMockConfig({
      provider: {
        type: "legacy",
        query: mock(async () => {
          callCount++;
          if (callCount < 3) {
            const err = new Error("Rate limited") as Error & {
              status: number;
            };
            err.status = 429;
            throw err;
          }
          return { actions: [{ type: "show-message", message: "ok" }] };
        }),
      },
    });

    const retries: number[] = [];
    config.onRetry = (attempt) => retries.push(attempt);

    const engine = new QueryEngine(config);
    const result = await engine.query({ query: "test", manifestMode: true });

    expect(result.messages).toContain("ok");
    expect(callCount).toBe(3);
    expect(retries).toEqual([1, 2]);
  });

  test("does not retry on 401 errors", async () => {
    const config = createMockConfig({
      provider: {
        type: "legacy",
        query: mock(async () => {
          const err = new Error("Unauthorized") as Error & { status: number };
          err.status = 401;
          throw err;
        }),
      },
    });

    const errors: QueryError[] = [];
    config.onError = (err) => errors.push(err);

    const engine = new QueryEngine(config);
    await expect(
      engine.query({ query: "test", manifestMode: true }),
    ).rejects.toThrow("Unauthorized");

    expect(errors).toHaveLength(1);
    expect(errors[0].retryable).toBe(false);
  });

  test("classifies resource exhaustion correctly", async () => {
    const config = createMockConfig({
      provider: {
        type: "legacy",
        query: mock(async () => {
          const err = new Error("exceeded your current quota") as Error & {
            status: number;
          };
          err.status = 402;
          throw err;
        }),
      },
    });

    const errors: QueryError[] = [];
    config.onError = (err) => errors.push(err);

    const engine = new QueryEngine(config);
    await expect(
      engine.query({ query: "test", manifestMode: true }),
    ).rejects.toThrow();

    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("resource_exhausted");
    expect(errors[0].retryable).toBe(false);
  });

  test("classifies network errors as retryable", async () => {
    let callCount = 0;
    const config = createMockConfig({
      provider: {
        type: "legacy",
        query: mock(async () => {
          callCount++;
          if (callCount < 2) {
            throw new Error("fetch failed");
          }
          return { actions: [{ type: "show-message", message: "recovered" }] };
        }),
      },
    });

    const engine = new QueryEngine(config);
    const result = await engine.query({ query: "test", manifestMode: true });

    expect(result.messages).toContain("recovered");
    expect(callCount).toBe(2);
  });
});

describe("QueryEngine BYOK mode", () => {
  test("delegates to BYOK provider query method", async () => {
    const byokQuery = mock(async () => ({
      text: "final text",
      toolCalls: [{ tool: "show_message", args: { message: "Hello" } }],
    }));

    const config = createMockConfig({
      provider: {
        type: "byok",
        query: byokQuery,
      },
      tools: { show_message: {} },
    });

    const engine = new QueryEngine(config);
    const result = await engine.query({ query: "hello", manifestMode: true });

    expect(byokQuery).toHaveBeenCalled();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.streamed).toBe(true);
  });
});
