import { describe, expect, test } from "bun:test";
import { estimateTokens } from "./token-count";

describe("estimateTokens", () => {
  test("estimates English text at ~4 chars per token", () => {
    const text = "Hello, this is a test string for token counting.";
    const tokens = estimateTokens(text);
    // 49 chars / 4 ≈ 13 tokens
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(20);
  });

  test("estimates CJK text at ~2 chars per token", () => {
    // CJK-heavy text (Japanese)
    const text = "これはテストの文字列です。トークンカウントをテストします。";
    const tokens = estimateTokens(text);
    // With CJK ratio > 0.3, uses 2 chars/token
    // 28 chars / 2 = 14
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(20);
  });

  test("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  test("handles single character", () => {
    expect(estimateTokens("a")).toBe(1);
  });

  test("handles mixed CJK and English", () => {
    // If CJK ratio is <= 0.3, uses 4 chars/token
    const text = "Hello world こんにちは this is mostly English text";
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(5);
  });
});
