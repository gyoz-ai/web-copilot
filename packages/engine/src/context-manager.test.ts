import { describe, expect, test } from "bun:test";
import { ContextManager } from "./context-manager";

describe("ContextManager.decideLevel", () => {
  test("returns 'full' for first turn", () => {
    const cm = new ContextManager();
    expect(
      cm.decideLevel({
        isFirstTurn: true,
        pageUrl: "http://example.com",
        lastPageUrl: null,
        lastActionFailed: false,
        userQueryLooksStructural: false,
      }),
    ).toBe("full");
  });

  test("returns 'full' when last action failed", () => {
    const cm = new ContextManager();
    expect(
      cm.decideLevel({
        isFirstTurn: false,
        pageUrl: "http://example.com",
        lastPageUrl: "http://example.com",
        lastActionFailed: true,
        userQueryLooksStructural: false,
      }),
    ).toBe("full");
  });

  test("returns 'full' when page URL changed", () => {
    const cm = new ContextManager();
    expect(
      cm.decideLevel({
        isFirstTurn: false,
        pageUrl: "http://example.com/new",
        lastPageUrl: "http://example.com/old",
        lastActionFailed: false,
        userQueryLooksStructural: false,
      }),
    ).toBe("full");
  });

  test("returns 'interactive' for structural queries on same page", () => {
    const cm = new ContextManager();
    expect(
      cm.decideLevel({
        isFirstTurn: false,
        pageUrl: "http://example.com",
        lastPageUrl: "http://example.com",
        lastActionFailed: false,
        userQueryLooksStructural: true,
      }),
    ).toBe("interactive");
  });

  test("returns 'light' for non-structural queries on same page", () => {
    const cm = new ContextManager();
    expect(
      cm.decideLevel({
        isFirstTurn: false,
        pageUrl: "http://example.com",
        lastPageUrl: "http://example.com",
        lastActionFailed: false,
        userQueryLooksStructural: false,
      }),
    ).toBe("light");
  });
});

describe("ContextManager.looksStructural", () => {
  test("matches structural queries", () => {
    expect(
      ContextManager.looksStructural("what buttons are on this page"),
    ).toBe(true);
    expect(ContextManager.looksStructural("where is the login form")).toBe(
      true,
    );
    expect(ContextManager.looksStructural("how many links are there")).toBe(
      true,
    );
    expect(ContextManager.looksStructural("list all the inputs")).toBe(true);
    expect(ContextManager.looksStructural("show me the navigation")).toBe(true);
    expect(
      ContextManager.looksStructural("find the search bar on this page"),
    ).toBe(true);
  });

  test("does not match non-structural queries", () => {
    expect(ContextManager.looksStructural("translate this page")).toBe(false);
    expect(ContextManager.looksStructural("click the submit button")).toBe(
      false,
    );
    expect(ContextManager.looksStructural("fill in my name")).toBe(false);
  });
});

describe("ContextManager cache", () => {
  test("isCacheValid returns false when no snapshot cached", () => {
    const cm = new ContextManager();
    expect(cm.isCacheValid("http://example.com", "abc123")).toBe(false);
  });

  test("isCacheValid returns true for matching URL and hash", () => {
    const cm = new ContextManager();
    cm.cacheSnapshot({
      level: "full",
      url: "http://example.com",
      hash: "abc123",
      content: "<html>...</html>",
      capturedAt: Date.now(),
    });

    expect(cm.isCacheValid("http://example.com", "abc123")).toBe(true);
  });

  test("isCacheValid returns false for different URL", () => {
    const cm = new ContextManager();
    cm.cacheSnapshot({
      level: "full",
      url: "http://example.com",
      hash: "abc123",
      content: "<html>...</html>",
      capturedAt: Date.now(),
    });

    expect(cm.isCacheValid("http://other.com", "abc123")).toBe(false);
  });

  test("isCacheValid returns false for different hash", () => {
    const cm = new ContextManager();
    cm.cacheSnapshot({
      level: "full",
      url: "http://example.com",
      hash: "abc123",
      content: "<html>...</html>",
      capturedAt: Date.now(),
    });

    expect(cm.isCacheValid("http://example.com", "different")).toBe(false);
  });

  test("getUnchangedMessage returns expected string", () => {
    const cm = new ContextManager();
    expect(cm.getUnchangedMessage()).toContain("unchanged");
  });
});
