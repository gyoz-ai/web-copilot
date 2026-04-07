import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import {
  waitForBody,
  injectWidget,
  watchForRemoval,
  hideWidgetHost,
  showWidgetHost,
  HOST_ID,
} from "./injection";

// Bun uses happy-dom by default when running tests — DOM APIs are available.

const MOCK_STYLES = ".test { color: red; }";

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

describe("watchForRemoval", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    document.getElementById(HOST_ID)?.remove();
    cleanup = undefined;
  });

  afterEach(() => {
    cleanup?.();
  });

  test("re-attaches SAME host element when removed from DOM", async () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    cleanup = watchForRemoval(host);

    // Remove the host (simulating SPA body replacement)
    host.remove();
    expect(host.isConnected).toBe(false);

    // MutationObserver callbacks are async — wait a tick
    await new Promise((r) => setTimeout(r, 10));

    // The SAME host element should be back in the DOM (not a new one)
    expect(host.isConnected).toBe(true);
    expect(document.getElementById(HOST_ID)).toBe(host);
  });

  test("preserves shadow DOM content after re-attach", async () => {
    const calls: HTMLDivElement[] = [];
    const host = injectWidget(
      document.body,
      MOCK_STYLES,
      trackingRender(calls),
    );
    cleanup = watchForRemoval(host);

    const shadowChildCount = host.shadowRoot!.childNodes.length;

    host.remove();
    await new Promise((r) => setTimeout(r, 10));

    // Shadow DOM should still have the same children (style + container)
    expect(host.shadowRoot!.childNodes.length).toBe(shadowChildCount);
    // renderWidget should NOT have been called again — only the initial call
    expect(calls).toHaveLength(1);
  });

  test("re-attaches on popstate when host is missing", async () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    cleanup = watchForRemoval(host);

    host.remove();
    window.dispatchEvent(new Event("popstate"));

    await new Promise((r) => setTimeout(r, 100));

    expect(host.isConnected).toBe(true);
    expect(document.getElementById(HOST_ID)).toBe(host);
  });

  test("re-attaches on gyozai:navchange event when host is missing", async () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    cleanup = watchForRemoval(host);

    host.remove();
    window.dispatchEvent(new Event("gyozai:navchange"));

    await new Promise((r) => setTimeout(r, 100));

    expect(host.isConnected).toBe(true);
  });

  test("dispatches gyozai:reattached event when host is re-appended", async () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    cleanup = watchForRemoval(host);

    let reattachedFired = false;
    window.addEventListener(
      "gyozai:reattached",
      () => {
        reattachedFired = true;
      },
      { once: true },
    );

    host.remove();
    window.dispatchEvent(new Event("gyozai:navchange"));

    await new Promise((r) => setTimeout(r, 100));

    expect(host.isConnected).toBe(true);
    expect(reattachedFired).toBe(true);
  });

  test("does not dispatch gyozai:reattached when host is still connected", async () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    cleanup = watchForRemoval(host);

    let reattachedFired = false;
    window.addEventListener(
      "gyozai:reattached",
      () => {
        reattachedFired = true;
      },
      { once: true },
    );

    // Fire nav event without removing host
    window.dispatchEvent(new Event("gyozai:navchange"));
    await new Promise((r) => setTimeout(r, 100));

    expect(reattachedFired).toBe(false);
  });

  test("does not re-attach if host is still connected", async () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    cleanup = watchForRemoval(host);

    // Fire nav event without removing host
    window.dispatchEvent(new Event("gyozai:navchange"));
    await new Promise((r) => setTimeout(r, 100));

    // Same host, still in DOM
    expect(document.getElementById(HOST_ID)).toBe(host);
  });
});

describe("hideWidgetHost / showWidgetHost", () => {
  beforeEach(() => {
    document.getElementById(HOST_ID)?.remove();
  });

  test("hides and restores widget host", () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    expect(host.style.display).toBe("");

    const prev = hideWidgetHost();
    expect(host.style.display).toBe("none");

    showWidgetHost(prev);
    expect(host.style.display).toBe("");
  });

  test("returns empty string and no-ops when host does not exist", () => {
    const prev = hideWidgetHost();
    expect(prev).toBe("");
    // Should not throw
    showWidgetHost(prev);
  });

  test("host stays connected when hidden (watchForRemoval safety)", () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    hideWidgetHost();
    expect(host.isConnected).toBe(true);
  });

  test("preserves existing display value through hide/show cycle", () => {
    const host = injectWidget(document.body, MOCK_STYLES, noopRender);
    host.style.display = "block";

    const prev = hideWidgetHost();
    expect(prev).toBe("block");
    expect(host.style.display).toBe("none");

    showWidgetHost(prev);
    expect(host.style.display).toBe("block");
  });
});
