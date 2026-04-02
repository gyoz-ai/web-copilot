import { describe, expect, test, mock, beforeEach } from "bun:test";
import { createEngine } from "./engine";

// Mock fetch globally
const originalFetch = globalThis.fetch;

function mockFetch(response: unknown, status = 200) {
  globalThis.fetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createEngine", () => {
  test("creates an engine with query and destroy methods", () => {
    const engine = createEngine({ proxyUrl: "http://localhost:3001" });
    expect(engine.query).toBeFunction();
    expect(engine.destroy).toBeFunction();
    expect(engine.getHistory).toBeFunction();
  });
});

describe("engine.query", () => {
  test("sends POST to proxy and dispatches navigate action", async () => {
    const navigated: string[] = [];
    const messages: string[] = [];

    mockFetch({
      actions: [
        { type: "navigate", target: "/dairy", message: "Going to dairy." },
      ],
    });

    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      manifestMode: true,
      recipe: "<manifest />",
      onNavigate: (t) => navigated.push(t),
      onMessage: (m) => messages.push(m),
    });

    const result = await engine.query("where is dairy?");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe("navigate");
    expect(navigated).toEqual(["/dairy"]);
    expect(messages).toEqual(["Going to dairy."]);
  });

  test("sends correct payload to proxy", async () => {
    let capturedBody: unknown;

    globalThis.fetch = mock((url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            actions: [{ type: "show-message", message: "ok" }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }) as unknown as typeof fetch;

    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      manifestMode: true,
      recipe: "<test-recipe />",
    });

    await engine.query("test query", { currentRoute: "/page" });

    const body = capturedBody as Record<string, unknown>;
    expect(body.query).toBe("test query");
    expect(body.manifestMode).toBe(true);
    expect(body.recipe).toBe("<test-recipe />");
    expect(body.currentRoute).toBe("/page");
    expect(body.conversationHistory).toEqual([]);
  });

  test("dispatches show-message action", async () => {
    const messages: string[] = [];

    mockFetch({
      actions: [{ type: "show-message", message: "Here is some info." }],
    });

    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onMessage: (m) => messages.push(m),
    });

    await engine.query("tell me something");
    expect(messages).toEqual(["Here is some info."]);
  });

  test("dispatches click action", async () => {
    const clicked: string[] = [];

    mockFetch({
      actions: [
        { type: "click", selector: "#buy-btn", message: "Clicking buy." },
      ],
    });

    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onClick: (s) => clicked.push(s),
    });

    await engine.query("click buy");
    expect(clicked).toEqual(["#buy-btn"]);
  });

  test("dispatches multiple actions in order", async () => {
    const log: string[] = [];

    mockFetch({
      actions: [
        { type: "show-message", message: "Step 1" },
        { type: "navigate", target: "/settings" },
        { type: "show-message", message: "Step 3" },
      ],
    });

    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onMessage: (m) => log.push(`msg:${m}`),
      onNavigate: (t) => log.push(`nav:${t}`),
    });

    await engine.query("go to settings");
    // Messages dispatch first, then other actions
    expect(log).toEqual(["msg:Step 1", "msg:Step 3", "nav:/settings"]);
  });

  test("calls onAction for every action (catch-all)", async () => {
    const actions: string[] = [];

    mockFetch({
      actions: [
        { type: "navigate", target: "/x" },
        { type: "show-message", message: "hi" },
      ],
    });

    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onAction: (a) => actions.push(a.type),
    });

    await engine.query("test");
    // show-message dispatches first, then other actions
    expect(actions).toEqual(["show-message", "navigate"]);
  });

  test("maintains conversation history across queries", async () => {
    mockFetch({
      actions: [{ type: "show-message", message: "Found dairy." }],
    });

    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
    });

    await engine.query("where is dairy?");
    expect(engine.getHistory()).toEqual([
      { role: "user", content: "where is dairy?" },
      { role: "assistant", content: "Found dairy." },
    ]);

    mockFetch({
      actions: [{ type: "show-message", message: "Here is bakery." }],
    });

    await engine.query("now bakery");
    expect(engine.getHistory()).toHaveLength(4);
    expect(engine.getHistory()[2]).toEqual({
      role: "user",
      content: "now bakery",
    });
  });

  test("caps conversation history at 20 messages", async () => {
    mockFetch({
      actions: [{ type: "show-message", message: "ok" }],
    });

    const engine = createEngine({ proxyUrl: "http://localhost:3001" });

    for (let i = 0; i < 15; i++) {
      await engine.query(`query ${i}`);
    }

    expect(engine.getHistory().length).toBeLessThanOrEqual(20);
  });
});

describe("fetch action", () => {
  test("calls httpClient and re-queries with fetch result", async () => {
    let callCount = 0;
    const httpClientCalls: string[] = [];

    globalThis.fetch = mock(() => {
      callCount++;
      // First call: proxy returns fetch action
      // Second call (re-query): proxy returns navigate
      const response =
        callCount === 1
          ? {
              actions: [
                {
                  type: "fetch",
                  url: "/api/search?q=pasta",
                  method: "GET",
                  message: "Searching...",
                },
              ],
            }
          : {
              actions: [
                {
                  type: "navigate",
                  target: "/product/mancini",
                  message: "Found it!",
                },
              ],
            };

      return Promise.resolve(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;

    const navigated: string[] = [];
    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      capabilities: { fetch: true },
      httpClient: async (url, method) => {
        httpClientCalls.push(`${method}:${url}`);
        return { results: [{ name: "Mancini Spaghetti" }] };
      },
      onNavigate: (t) => navigated.push(t),
    });

    await engine.query("find me pasta");
    expect(httpClientCalls).toEqual(["GET:/api/search?q=pasta"]);
    expect(navigated).toEqual(["/product/mancini"]);
  });

  test("fetch action without httpClient skips fetch and dispatches normally", async () => {
    mockFetch({
      actions: [
        { type: "fetch", url: "/api/search", method: "GET" },
        { type: "show-message", message: "No http client available" },
      ],
    });

    const messages: string[] = [];
    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      capabilities: { fetch: true },
      // no httpClient provided — fetch action passes through without re-query
      onMessage: (m) => messages.push(m),
    });

    const result = await engine.query("test");
    // Without httpClient, fetch action is dispatched normally (no re-query)
    expect(result.actions).toHaveLength(2);
  });
});

describe("clarify action", () => {
  test("calls onClarify with message and options", async () => {
    mockFetch({
      actions: [
        {
          type: "clarify",
          message: "Multiple types of pasta found. Which one?",
          options: ["Mancini Spaghetti", "De Cecco Penne", "Barilla Fusilli"],
        },
      ],
    });

    const clarifications: Array<{ message: string; options: string[] }> = [];
    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onClarify: (msg, opts) =>
        clarifications.push({ message: msg, options: opts }),
    });

    await engine.query("find me pasta");
    expect(clarifications).toHaveLength(1);
    expect(clarifications[0].message).toContain("pasta");
    expect(clarifications[0].options).toEqual([
      "Mancini Spaghetti",
      "De Cecco Penne",
      "Barilla Fusilli",
    ]);
  });

  test("clarify with empty options calls onClarify with empty array", async () => {
    mockFetch({
      actions: [{ type: "clarify", message: "Could you be more specific?" }],
    });

    const clarifications: Array<{ options: string[] }> = [];
    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onClarify: (_, opts) => clarifications.push({ options: opts }),
    });

    await engine.query("test");
    expect(clarifications[0].options).toEqual([]);
  });
});

describe("error handling", () => {
  test("calls onError on network failure", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("Connection refused")),
    ) as unknown as typeof fetch;

    const errors: string[] = [];
    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onError: (e) => errors.push(e.type),
    });

    await expect(engine.query("test")).rejects.toMatchObject({
      type: "network",
    });
    expect(errors).toEqual(["network"]);
  });

  test("calls onError on proxy error (4xx/5xx)", async () => {
    mockFetch({ error: "Rate limit exceeded" }, 429);

    const errors: string[] = [];
    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onError: (e) => errors.push(`${e.type}:${e.status}`),
    });

    await expect(engine.query("test")).rejects.toMatchObject({
      type: "proxy",
      status: 429,
    });
    expect(errors).toEqual(["proxy:429"]);
  });

  test("calls onError on invalid response", async () => {
    mockFetch({ invalid: "data" });

    const errors: string[] = [];
    const engine = createEngine({
      proxyUrl: "http://localhost:3001",
      onError: (e) => errors.push(e.type),
    });

    await expect(engine.query("test")).rejects.toMatchObject({
      type: "validation",
    });
    expect(errors).toEqual(["validation"]);
  });

  test("throws after destroy", async () => {
    const engine = createEngine({ proxyUrl: "http://localhost:3001" });
    engine.destroy();
    await expect(engine.query("test")).rejects.toThrow("destroyed");
  });
});
