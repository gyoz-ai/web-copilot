import { describe, expect, test } from "bun:test";
import { validateResponse } from "./validation";

describe("ActionResponseSchema", () => {
  test("validates a navigate action", () => {
    const result = validateResponse({
      actions: [
        { type: "navigate", target: "/dairy", message: "Going to dairy." },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actions[0].type).toBe("navigate");
      expect(result.data.actions[0].target).toBe("/dairy");
    }
  });

  test("validates a show-message action", () => {
    const result = validateResponse({
      actions: [{ type: "show-message", message: "Here is some info." }],
    });
    expect(result.success).toBe(true);
  });

  test("validates all action types", () => {
    for (const type of [
      "navigate",
      "click",
      "execute-js",
      "show-message",
      "highlight-ui",
      "fetch",
      "clarify",
    ] as const) {
      const result = validateResponse({ actions: [{ type }] });
      expect(result.success).toBe(true);
    }
  });

  test("validates a fetch action with url and method", () => {
    const result = validateResponse({
      actions: [
        {
          type: "fetch",
          url: "/api/search?q=pasta",
          method: "GET",
          message: "Searching...",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actions[0].url).toBe("/api/search?q=pasta");
      expect(result.data.actions[0].method).toBe("GET");
    }
  });

  test("validates a clarify action with options", () => {
    const result = validateResponse({
      actions: [
        {
          type: "clarify",
          message: "Which pasta?",
          options: ["Mancini Spaghetti", "De Cecco Penne", "Barilla Fusilli"],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actions[0].options).toHaveLength(3);
      expect(result.data.actions[0].options![0]).toBe("Mancini Spaghetti");
    }
  });

  test("validates multi-action response", () => {
    const result = validateResponse({
      actions: [
        { type: "navigate", target: "/settings" },
        { type: "show-message", message: "Here are your settings." },
        { type: "highlight-ui", selector: "#billing-tab" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.actions).toHaveLength(3);
  });

  test("rejects empty actions array", () => {
    const result = validateResponse({ actions: [] });
    expect(result.success).toBe(false);
  });

  test("rejects invalid action type", () => {
    const result = validateResponse({ actions: [{ type: "teleport" }] });
    expect(result.success).toBe(false);
  });

  test("rejects missing actions field", () => {
    const result = validateResponse({});
    expect(result.success).toBe(false);
  });
});
