export function handlePatchHistory(
  sender: chrome.runtime.MessageSender,
  sendResponse: (result: unknown) => void,
): void {
  const tabId = sender.tab?.id;
  if (tabId == null) {
    sendResponse({ ok: false });
    return;
  }
  browser.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        if (
          (window as unknown as Record<string, unknown>).__gyozai_nav_patched__
        )
          return;
        (window as unknown as Record<string, unknown>).__gyozai_nav_patched__ =
          true;
        const E = "gyozai:navchange";
        const oP = history.pushState.bind(history);
        const oR = history.replaceState.bind(history);
        history.pushState = function (...args: Parameters<typeof oP>) {
          const r = oP(...args);
          window.dispatchEvent(new Event(E));
          return r;
        };
        history.replaceState = function (...args: Parameters<typeof oR>) {
          const r = oR(...args);
          window.dispatchEvent(new Event(E));
          return r;
        };
      },
    })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
}

export function handleLegacyExec(
  message: { code: string },
  sendResponse: (result: unknown) => void,
): void {
  browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (!tab?.id) {
      sendResponse({ error: "No active tab" });
      return;
    }
    browser.scripting
      .executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: (code: string) => {
          try {
            const fixedCode = code.replace(
              /querySelector(?:All)?\(\s*['"]([^'"]+)['"]\s*\)/g,
              (match, selector: string) => {
                const fixed = selector.replace(
                  /#([^.\s#\[>~+,]+)/g,
                  (_: string, id: string) => {
                    if (/[^a-zA-Z0-9_-]/.test(id)) {
                      return "#" + CSS.escape(id);
                    }
                    return "#" + id;
                  },
                );
                if (fixed !== selector) {
                  return match.replace(selector, fixed);
                }
                return match;
              },
            );
            new Function(fixedCode)();
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : String(e);
          }
        },
        args: [message.code],
      })
      .then((results) => {
        const error = results?.[0]?.result;
        sendResponse(error ? { error } : { ok: true });
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });
  });
}
