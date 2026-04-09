import { Window } from "happy-dom";

const window = new Window({ url: "https://localhost:8080" });

// Register DOM globals
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  try {
    Object.defineProperty(globalThis, key, {
      value: (window as any)[key],
      configurable: true,
      writable: true,
    });
  } catch {
    // Some properties are non-configurable
  }
}

// Ensure critical globals
(globalThis as any).document = window.document;
(globalThis as any).window = window;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).HTMLDivElement = window.HTMLDivElement;
(globalThis as any).MutationObserver = window.MutationObserver;
(globalThis as any).Event = window.Event;
(globalThis as any).history = window.history;
(globalThis as any).setTimeout = window.setTimeout.bind(window);
(globalThis as any).clearTimeout = window.clearTimeout.bind(window);
