import { browser } from "wxt/browser";
export type ResolveResult =
  | {
      found: true;
      resolved: ResolvedElement;
    }
  | {
      found: false;
      candidates: Array<{ text: string; selector: string }>;
      error: string;
    };

export interface ResolvedElement {
  strategy: "text_match" | "aria_label" | "css_selector" | "scroll_retry";
  selector: string;
  element: string; // tagName + text preview
}

/**
 * Resolve an element using a fallback chain.
 * Executes in the MAIN world via browser.scripting.executeScript.
 */
export async function resolveElement(
  tabId: number,
  opts: {
    selector?: string;
    text?: string;
    label?: string;
    tag?: string;
    nearText?: string;
  },
): Promise<ResolveResult> {
  const result = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (
      selector: string | null,
      text: string | null,
      label: string | null,
      tag: string | null,
      nearText: string | null,
    ) => {
      const searchText = text || label;

      // Strategy 1: Text content match
      if (searchText) {
        const searchTag = tag || "*";
        const candidates = Array.from(
          document.querySelectorAll(searchTag),
        ) as HTMLElement[];
        const matches = candidates.filter(
          (e) => e.textContent?.trim() === searchText,
        );

        if (matches.length === 1) {
          const el = matches[0];
          const fallbackId = `gyozai-resolved-${Date.now()}`;
          el.setAttribute("data-gyozai-resolved", fallbackId);
          return {
            found: true as const,
            resolved: {
              strategy: "text_match" as const,
              selector: `[data-gyozai-resolved="${fallbackId}"]`,
              element: `<${el.tagName.toLowerCase()}> "${el.textContent?.trim().slice(0, 60)}"`,
            },
          };
        }

        // Disambiguate with nearText
        if (matches.length > 1 && nearText) {
          let best: HTMLElement | null = null;
          let bestLen = Infinity;
          for (const el of matches) {
            let node: HTMLElement | null = el.parentElement;
            for (let d = 0; node && d < 8; d++) {
              const nodeText = node.textContent || "";
              if (nodeText.toLowerCase().includes(nearText.toLowerCase())) {
                if (nodeText.length < bestLen) {
                  bestLen = nodeText.length;
                  best = el;
                }
                break;
              }
              node = node.parentElement;
            }
          }
          if (best) {
            const fallbackId = `gyozai-resolved-${Date.now()}`;
            best.setAttribute("data-gyozai-resolved", fallbackId);
            return {
              found: true as const,
              resolved: {
                strategy: "text_match" as const,
                selector: `[data-gyozai-resolved="${fallbackId}"]`,
                element: `<${best.tagName.toLowerCase()}> "${best.textContent?.trim().slice(0, 60)}"`,
              },
            };
          }
        }

        // If single match with near_text not needed
        if (matches.length > 0 && !nearText) {
          const el = matches[0];
          const fallbackId = `gyozai-resolved-${Date.now()}`;
          el.setAttribute("data-gyozai-resolved", fallbackId);
          return {
            found: true as const,
            resolved: {
              strategy: "text_match" as const,
              selector: `[data-gyozai-resolved="${fallbackId}"]`,
              element: `<${el.tagName.toLowerCase()}> "${el.textContent?.trim().slice(0, 60)}"`,
            },
          };
        }
      }

      // Strategy 2: Aria-label match
      if (searchText) {
        const ariaMatches = Array.from(
          document.querySelectorAll(`[aria-label]`),
        ).filter((el) =>
          el
            .getAttribute("aria-label")
            ?.toLowerCase()
            .includes(searchText.toLowerCase()),
        ) as HTMLElement[];

        if (ariaMatches.length > 0) {
          const el = ariaMatches[0];
          const fallbackId = `gyozai-resolved-${Date.now()}`;
          el.setAttribute("data-gyozai-resolved", fallbackId);
          return {
            found: true as const,
            resolved: {
              strategy: "aria_label" as const,
              selector: `[data-gyozai-resolved="${fallbackId}"]`,
              element: `<${el.tagName.toLowerCase()}> aria-label="${el.getAttribute("aria-label")}"`,
            },
          };
        }
      }

      // Strategy 3: CSS selector
      if (selector) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) {
          return {
            found: true as const,
            resolved: {
              strategy: "css_selector" as const,
              selector,
              element: `<${el.tagName.toLowerCase()}> "${(el.textContent || "").trim().slice(0, 60)}"`,
            },
          };
        }

        // Strategy 4: Scroll and retry
        // Try scrolling down and checking again
        window.scrollBy(0, 500);
        const retryEl = document.querySelector(selector) as HTMLElement | null;
        if (retryEl) {
          return {
            found: true as const,
            resolved: {
              strategy: "scroll_retry" as const,
              selector,
              element: `<${retryEl.tagName.toLowerCase()}> "${(retryEl.textContent || "").trim().slice(0, 60)}"`,
            },
          };
        }
      }

      // All strategies failed — gather candidates
      const candidateList: Array<{ text: string; selector: string }> = [];
      if (searchText) {
        const searchTag = tag || "*";
        const partialMatches = Array.from(document.querySelectorAll(searchTag))
          .filter((el) =>
            el.textContent?.toLowerCase().includes(searchText.toLowerCase()),
          )
          .slice(0, 5);
        for (const el of partialMatches) {
          const fallbackId = `gyozai-candidate-${candidateList.length}`;
          (el as HTMLElement).setAttribute("data-gyozai-candidate", fallbackId);
          candidateList.push({
            text: (el.textContent || "").trim().slice(0, 80),
            selector: `[data-gyozai-candidate="${fallbackId}"]`,
          });
        }
      }

      return {
        found: false as const,
        candidates: candidateList,
        error: `Could not find element matching ${JSON.stringify({ selector, text, label, tag, nearText })}`,
      };
    },
    args: [
      opts.selector || null,
      opts.text || null,
      opts.label || null,
      opts.tag || null,
      opts.nearText || null,
    ],
  });

  return result?.[0]?.result as ResolveResult;
}
