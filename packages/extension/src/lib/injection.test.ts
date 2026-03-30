import { describe, expect, test, beforeEach, mock } from "bun:test";
import {
  waitForBody,
  injectWidget,
  ensureWidget,
  watchForRemoval,
} from "./injection";

// Bun uses happy-dom by default when running tests — DOM APIs are available.

const MOCK_STYLES = ".test { color: red; }";
const HOST_ID = "gyozai-extension-root";

function noopRender(_container: HTMLDivElement) {}

function trackingRender(calls: HTMLDivElement[]) {
  return (container: HTMLDivElement) => {
    calls.push(container);
  };
}

describe("waitForBody", () => {
  test("resolves immediately when document.body already exists", async () => {
    const body = await waitForBody();
    expect(body).toBe(document.body);
  });

  test("rejects when body is not available within timeout", async () => {
    // Save original body
    const origBody = document.body;
    // Remove body temporarily
    document.documentElement.removeChild(document.body);

    try {
      await expect(waitForBody(50)).rejects.toThrow(
        "document.body not available within timeout",
      );
    } finally {
      // Restore body
      document.documentElement.appendChild(origBody);
    }
  });

  test("timeout error includes descriptive message", async () => {
    const origBody = document.body;
    document.documentElement.removeChild(document.body);

    try {
      const err = await waitForBody(50).catch((e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain(
        "document.body not available within timeout",
      );
    } finally {
      document.documentElement.appendChild(origBody);
    }
  });
});

describe("injectWidget", () => {
  beforeEach(() => {
    // Clean up any leftover host elements
    document.getElementById(HOST_ID)?.remove();
  });

  test("creates host element with shadow DOM in body", () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    expect(host.id).toBe(HOST_ID);
    expect(host.parentElement).toBe(document.body);
    expect(host.shadowRoot).not.toBeNull();
  });

  test("injects styles into shadow DOM", () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    // happy-dom doesn't fully support querySelector on shadow roots,
    // so access children directly
    const style = host.shadowRoot!.childNodes[0] as HTMLStyleElement;
    expect(style.tagName).toBe("STYLE");
    expect(style.textContent).toBe(MOCK_STYLES);
  });

  test("calls renderWidget with the shadow container div", () => {
    const calls: HTMLDivElement[] = [];
    injectWidget(document.body, MOCK_STYLES, trackingRender(calls));
    expect(calls).toHaveLength(1);
    expect(calls[0].tagName).toBe("DIV");
    // The container should be inside the shadow root
    expect(calls[0].parentNode).toBe(
      document.getElementById(HOST_ID)!.shadowRoot,
    );
  });

  test("removes stale host before creating a new one", () => {
    // Create first host
    const first = injectWidget(document.body, MOCK_STYLES, noopRender);
    expect(first.isConnected).toBe(true);

    // Inject again — should replace, not duplicate
    const second = injectWidget(document.body, MOCK_STYLES, noopRender);
    expect(second.isConnected).toBe(true);
    expect(first.isConnected).toBe(false); // old one was removed
    // Only one host in the body
    const hosts = Array.from(document.body.children).filter(
      (el) => el.id === HOST_ID,
    );
    expect(hosts).toHaveLength(1);
  });

  test("calls renderWidget each time (fresh React tree on re-inject)", () => {
    const calls: HTMLDivElement[] = [];
    const render = trackingRender(calls);
    injectWidget(document.body, MOCK_STYLES, render);
    injectWidget(document.body, MOCK_STYLES, render);
    expect(calls).toHaveLength(2);
    // Each call should get a different container (new shadow DOM)
    expect(calls[0]).not.toBe(calls[1]);
  });
});

describe("ensureWidget", () => {
  beforeEach(() => {
    document.getElementById(HOST_ID)?.remove();
  });

  test("returns existing host if it is connected", () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    const calls: HTMLDivElement[] = [];
    const result = ensureWidget(MOCK_STYLES, trackingRender(calls));
    expect(result).toBe(host);
    // Should NOT have called renderWidget again
    expect(calls).toHaveLength(0);
  });

  test("re-injects and returns new host if old one was removed", () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    host.remove();

    const calls: HTMLDivElement[] = [];
    const result = ensureWidget(MOCK_STYLES, trackingRender(calls));
    expect(result).not.toBeNull();
    expect(result!.id).toBe(HOST_ID);
    expect(result!.isConnected).toBe(true);
    expect(calls).toHaveLength(1);
  });

  test("returns null when document.body is unavailable", () => {
    const origBody = document.body;
    document.documentElement.removeChild(document.body);

    try {
      const result = ensureWidget(MOCK_STYLES, noopRender);
      expect(result).toBeNull();
    } finally {
      document.documentElement.appendChild(origBody);
    }
  });
});

describe("watchForRemoval", () => {
  beforeEach(() => {
    document.getElementById(HOST_ID)?.remove();
  });

  test("re-injects widget when host is removed from DOM", async () => {
    const calls: HTMLDivElement[] = [];
    const render = trackingRender(calls);
    const host = injectWidget(document.body, MOCK_STYLES, render);
    watchForRemoval(host, MOCK_STYLES, render);

    // Remove the host (simulating SPA body replacement)
    host.remove();

    // MutationObserver callbacks are async — wait a tick
    await new Promise((r) => setTimeout(r, 10));

    // Widget should have been re-injected
    const newHost = document.getElementById(HOST_ID);
    expect(newHost).not.toBeNull();
    expect(newHost!.isConnected).toBe(true);
    // renderWidget should have been called again (initial + re-inject)
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  test("re-injects on popstate when host is missing", async () => {
    const calls: HTMLDivElement[] = [];
    const render = trackingRender(calls);
    const host = injectWidget(document.body, MOCK_STYLES, render);
    watchForRemoval(host, MOCK_STYLES, render);

    // Simulate: SPA removed host, then popstate fires
    host.remove();
    window.dispatchEvent(new Event("popstate"));

    // Wait for the 50ms delay + processing
    await new Promise((r) => setTimeout(r, 100));

    const newHost = document.getElementById(HOST_ID);
    expect(newHost).not.toBeNull();
    expect(newHost!.isConnected).toBe(true);
  });

  test("re-injects on gyozai:navchange event when host is missing", async () => {
    const calls: HTMLDivElement[] = [];
    const render = trackingRender(calls);
    const host = injectWidget(document.body, MOCK_STYLES, render);
    watchForRemoval(host, MOCK_STYLES, render);

    host.remove();
    window.dispatchEvent(new Event("gyozai:navchange"));

    await new Promise((r) => setTimeout(r, 100));

    const newHost = document.getElementById(HOST_ID);
    expect(newHost).not.toBeNull();
    expect(newHost!.isConnected).toBe(true);
  });

  test("does not re-inject if host is still connected", async () => {
    const calls: HTMLDivElement[] = [];
    const render = trackingRender(calls);
    const host = injectWidget(document.body, MOCK_STYLES, render);
    watchForRemoval(host, MOCK_STYLES, render);

    const callsBefore = calls.length;

    // Fire nav event without removing host
    window.dispatchEvent(new Event("gyozai:navchange"));
    await new Promise((r) => setTimeout(r, 100));

    // renderWidget should NOT have been called again
    expect(calls.length).toBe(callsBefore);
    expect(document.getElementById(HOST_ID)).toBe(host);
  });
});
