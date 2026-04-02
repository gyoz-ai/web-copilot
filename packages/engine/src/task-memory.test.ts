import { describe, expect, test } from "bun:test";
import { createEmptyTaskMemory, formatTaskMemory } from "./task-memory";

describe("createEmptyTaskMemory", () => {
  test("returns all fields initialized", () => {
    const memory = createEmptyTaskMemory();
    expect(memory.goal).toBeNull();
    expect(memory.pagesVisited).toEqual([]);
    expect(memory.factsFound).toEqual([]);
    expect(memory.formsTouched).toEqual([]);
    expect(memory.pendingClarification).toBeNull();
    expect(memory.previousFailures).toEqual([]);
    expect(memory.navigationChain).toEqual([]);
  });
});

describe("formatTaskMemory", () => {
  test("returns null for empty memory", () => {
    const memory = createEmptyTaskMemory();
    expect(formatTaskMemory(memory)).toBeNull();
  });

  test("includes goal when set", () => {
    const memory = createEmptyTaskMemory();
    memory.goal = "Find the cheapest flight to Tokyo";
    const result = formatTaskMemory(memory);
    expect(result).toContain("Goal: Find the cheapest flight to Tokyo");
  });

  test("includes pages visited", () => {
    const memory = createEmptyTaskMemory();
    memory.pagesVisited = [
      {
        url: "https://example.com/flights",
        title: "Flights Page",
        summary: "List of available flights",
      },
    ];
    const result = formatTaskMemory(memory);
    expect(result).toContain("Pages visited:");
    expect(result).toContain("Flights Page");
    expect(result).toContain("https://example.com/flights");
  });

  test("includes facts found", () => {
    const memory = createEmptyTaskMemory();
    memory.factsFound = [
      {
        key: "cheapest_price",
        value: "$450",
        source: "search results",
      },
    ];
    const result = formatTaskMemory(memory);
    expect(result).toContain("Known facts:");
    expect(result).toContain("cheapest_price: $450");
  });

  test("includes previous failures", () => {
    const memory = createEmptyTaskMemory();
    memory.previousFailures = [
      {
        action: "click submit",
        error: "Element not found",
        strategy: "Try text-based matching",
      },
    ];
    const result = formatTaskMemory(memory);
    expect(result).toContain("Previous failures:");
    expect(result).toContain("click submit: Element not found");
  });

  test("combines multiple sections with double newlines", () => {
    const memory = createEmptyTaskMemory();
    memory.goal = "Test goal";
    memory.factsFound = [{ key: "k", value: "v", source: "s" }];
    const result = formatTaskMemory(memory)!;
    expect(result).toContain("\n\n");
    expect(result.split("\n\n")).toHaveLength(2);
  });
});
