// ─── Page Context Extractor ─────────────────────────────────────────────────────
// Single capture source powered by html-screen-capture-js.
// captureCleanHtml() returns the full clean HTML snapshot.
// capturePageContext() parses that same snapshot to extract structured elements
// (buttons, links, forms, etc.) — ensuring consistency between both outputs.
// A short-lived cache avoids re-capturing when both are called in the same turn.

import { capture, OutputType, LogLevel } from "html-screen-capture-js";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface PageContext {
  buttons: Array<{ selector: string; text: string; type?: string }>;
  links: Array<{ selector: string; text: string; href: string }>;
  forms: Array<{
    selector: string;
    action?: string;
    method?: string;
    fields: Array<{
      selector: string;
      name: string;
      type: string;
      label?: string;
      placeholder?: string;
      value?: string;
    }>;
  }>;
  inputs: Array<{
    selector: string;
    name: string;
    type: string;
    label?: string;
    placeholder?: string;
    value?: string;
  }>;
  headings: Array<{ level: number; text: string }>;
  images: Array<{ alt: string; src: string }>;
  textContent: string;
}

export type SnapshotType =
  | "buttons"
  | "links"
  | "forms"
  | "inputs"
  | "headings"
  | "images"
  | "textContent"
  | "all";

// ─── Content hash ─────────────────────────────────────────────────────────────

function quickHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

let _cachedContextResult: {
  hash: string;
  url: string;
  result: PageContext;
} | null = null;

export function getContextHash(): string | null {
  return _cachedContextResult?.hash ?? null;
}

// ─── Progressive HTML stripping ───────────────────────────────────────────────

export function stripToFit(
  html: string,
  maxChars: number,
): { html: string; strippedLevels: string[] } {
  const levels: Array<{ name: string; strip: (h: string) => string }> = [
    {
      name: "data-attributes",
      strip: (h) => h.replace(/ data-[a-z-]+="[^"]*"/g, ""),
    },
    {
      name: "inline-styles",
      strip: (h) => h.replace(/ style="[^"]*"/g, ""),
    },
    {
      name: "hidden-elements",
      strip: (h) =>
        h.replace(
          /<[^>]+(?:display:\s*none|aria-hidden="true")[^>]*>[\s\S]*?<\/[^>]+>/gi,
          "",
        ),
    },
    {
      name: "whitespace",
      strip: (h) => h.replace(/\s{2,}/g, " "),
    },
    {
      name: "svg-content",
      strip: (h) => h.replace(/<svg[\s\S]*?<\/svg>/gi, "<svg/>"),
    },
  ];

  let result = html;
  const applied: string[] = [];

  for (const level of levels) {
    if (result.length <= maxChars) break;
    result = level.strip(result);
    applied.push(level.name);
  }

  if (result.length > maxChars) {
    result = result.slice(0, maxChars) + "\n<!-- truncated -->";
  }

  return { html: result, strippedLevels: applied };
}

// ─── Shared capture cache ───────────────────────────────────────────────────────
// Dedup only — prevents double capture when captureCleanHtml and capturePageContext
// are called in the same turn. 50ms is enough to dedup without returning stale data.

let _cache: { doc: Document; ts: number } | null = null;
const CACHE_TTL = 50;

function getCapturedDoc(): Document {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL) return _cache.doc;

  // Bake live form values into DOM attributes before capture
  bakeFormValues();

  // The library's TS types are incomplete — computedStyleKeyValuePairsOfIgnoredElements
  // exists at runtime but is missing from the published Options interface.
  const raw = capture(OutputType.STRING, document, {
    cssSelectorsOfIgnoredElements: [
      "#gyozai-extension-root",
      "noscript",
      "iframe",
      "template",
    ],
    tagsOfSkippedElementsForChildTreeCssHandling: ["svg"],
    imageQualityForDataUrl: 0.01,
    logLevel: LogLevel.OFF,
    // Filters hidden elements at capture time (not in typed Options but works at runtime)
    computedStyleKeyValuePairsOfIgnoredElements: {
      display: "none",
      visibility: "hidden",
    },
  } as Parameters<typeof capture>[2]) as string;

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");

  _cache = { doc, ts: now };
  return doc;
}

// ─── Full HTML snapshot ─────────────────────────────────────────────────────────

export function captureCleanHtml(maxLength: number = 60000): string {
  if (typeof document === "undefined") return "";

  const doc = getCapturedDoc();
  let html = doc.body.innerHTML;

  if (html.length > maxLength) {
    html = html.slice(0, maxLength) + "\n<!-- truncated -->";
  }
  return html;
}

// ─── Structured page context ────────────────────────────────────────────────────
// Parses the captured document to extract actionable elements.
// Selectors are resolved against the LIVE DOM so they work with click/execute_js.

export function capturePageContext(
  types: SnapshotType[] = ["all"],
): PageContext {
  const captureAll = types.includes("all");

  const ctx: PageContext = {
    buttons: [],
    links: [],
    forms: [],
    inputs: [],
    headings: [],
    images: [],
    textContent: "",
  };

  if (typeof document === "undefined") return ctx;

  const doc = getCapturedDoc();
  const body = doc.body;

  if (captureAll || types.includes("buttons")) {
    body
      .querySelectorAll(
        'button, [role="button"], input[type="submit"], input[type="button"]',
      )
      .forEach((el, i) => {
        if (isLiveElementHidden(el)) return;
        const text = (el.textContent || el.getAttribute("value") || "").trim();
        if (!text) return;
        ctx.buttons.push({
          selector: resolveLiveSelector(el, `button-${i}`),
          text: text.slice(0, 100),
          type: el.getAttribute("type") || undefined,
        });
      });
  }

  if (captureAll || types.includes("links")) {
    body.querySelectorAll("a[href]").forEach((el, i) => {
      if (isLiveElementHidden(el)) return;
      const text = (el.textContent || "").trim();
      const href = el.getAttribute("href") || "";
      if (!text || href.startsWith("#") || href.startsWith("javascript:"))
        return;
      ctx.links.push({
        selector: resolveLiveSelector(el, `link-${i}`),
        text: text.slice(0, 100),
        href,
      });
    });
  }

  if (captureAll || types.includes("forms")) {
    body.querySelectorAll("form").forEach((form, fi) => {
      if (isLiveElementHidden(form)) return;
      const fields: PageContext["forms"][0]["fields"] = [];

      form.querySelectorAll("input, select, textarea").forEach((field, ii) => {
        const name = field.getAttribute("name") || field.id || "";
        const type = field.getAttribute("type") || field.tagName.toLowerCase();
        if (type === "hidden" || type === "submit") return;

        fields.push({
          selector: resolveLiveSelector(field, `field-${fi}-${ii}`),
          name,
          type,
          label: findLabelInDoc(field, doc)?.slice(0, 100),
          placeholder:
            field.getAttribute("placeholder")?.slice(0, 100) || undefined,
          value: field.getAttribute("value")?.slice(0, 200) || undefined,
        });
      });

      ctx.forms.push({
        selector: resolveLiveSelector(form, `form-${fi}`),
        action: form.getAttribute("action") || undefined,
        method: form.getAttribute("method") || undefined,
        fields,
      });
    });
  }

  if (captureAll || types.includes("inputs")) {
    // Standalone inputs not inside forms
    body
      .querySelectorAll(
        "input:not(form input), select:not(form select), textarea:not(form textarea)",
      )
      .forEach((el, i) => {
        if (isLiveElementHidden(el)) return;
        const type = el.getAttribute("type") || el.tagName.toLowerCase();
        if (type === "hidden") return;
        ctx.inputs.push({
          selector: resolveLiveSelector(el, `input-${i}`),
          name: el.getAttribute("name") || el.id || "",
          type,
          label: findLabelInDoc(el, doc)?.slice(0, 100),
          placeholder:
            el.getAttribute("placeholder")?.slice(0, 100) || undefined,
          value: el.getAttribute("value")?.slice(0, 200) || undefined,
        });
      });
  }

  if (captureAll || types.includes("headings")) {
    body.querySelectorAll("h1, h2, h3, h4").forEach((el) => {
      if (isLiveElementHidden(el)) return;
      const text = (el.textContent || "").trim();
      if (!text) return;
      const level = parseInt(el.tagName[1]);
      ctx.headings.push({ level, text: text.slice(0, 200) });
    });
  }

  if (captureAll || types.includes("images")) {
    body.querySelectorAll("img[alt]").forEach((el) => {
      const alt = el.getAttribute("alt") || "";
      if (!alt) return;
      ctx.images.push({
        alt: alt.slice(0, 100),
        src: (el.getAttribute("src") || "").slice(0, 200),
      });
    });
  }

  if (captureAll || types.includes("textContent")) {
    const texts: string[] = [];
    let totalLen = 0;
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        // The library already stripped scripts/styles; skip any remnants
        if (parent.closest("script, style, svg"))
          return NodeFilter.FILTER_REJECT;
        // Skip text inside hidden elements
        if (isLiveElementHidden(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode() && totalLen < 5000) {
      const text = (walker.currentNode.textContent || "").trim();
      if (text.length > 2) {
        texts.push(text);
        totalLen += text.length;
      }
    }
    ctx.textContent = texts.join(" ").slice(0, 5000);
  }

  return ctx;
}

// ─── Hidden element detection ───────────────────────────────────────────────────

/**
 * Check if a live DOM element is effectively hidden via CSS tricks
 * that bypass the html-screen-capture-js display:none / visibility:hidden filter.
 */
export function isEffectivelyHidden(el: Element): boolean {
  if (typeof window === "undefined") return false;

  // aria-hidden
  if (el.getAttribute("aria-hidden") === "true") return true;

  const style = window.getComputedStyle(el);

  // Opacity zero
  if (style.opacity === "0") return true;

  // Zero dimensions
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return true;

  // Offscreen positioning (100px buffer for legitimate sticky/fixed elements)
  if (
    rect.right < 0 ||
    rect.bottom < 0 ||
    rect.left > window.innerWidth + 100 ||
    rect.top > window.innerHeight + 100
  )
    return true;

  // Clip-path hiding
  const clipPath = style.clipPath || "";
  if (
    clipPath === "inset(100%)" ||
    clipPath === "circle(0)" ||
    clipPath === "circle(0px)" ||
    clipPath === "polygon(0 0, 0 0, 0 0, 0 0)" ||
    clipPath === "polygon(0px 0px, 0px 0px, 0px 0px, 0px 0px)"
  )
    return true;

  // Legacy clip rect
  if (style.clip === "rect(0px, 0px, 0px, 0px)") return true;

  return false;
}

/**
 * Look up the live DOM counterpart of a captured element by text+tag
 * and check if it's effectively hidden.
 */
function isLiveElementHidden(capturedEl: Element): boolean {
  if (typeof document === "undefined") return false;

  // Try ID first
  if (capturedEl.id) {
    const live = document.getElementById(capturedEl.id);
    return live ? isEffectivelyHidden(live) : false;
  }

  // Try name
  const name = capturedEl.getAttribute("name");
  if (name) {
    const live = document.querySelector(`[name="${name}"]`);
    return live ? isEffectivelyHidden(live) : false;
  }

  // Match by text+tag (same logic as resolveLiveSelector)
  const tag = capturedEl.tagName.toLowerCase();
  const text = (capturedEl.textContent || "").trim();
  if (!text) return false;

  const candidates = document.querySelectorAll(tag);
  for (const liveEl of Array.from(candidates)) {
    if ((liveEl.textContent || "").trim() === text) {
      return isEffectivelyHidden(liveEl);
    }
  }
  return false;
}

// ─── XML escaping for untrusted page content ───────────────────────────────────

/** Escape XML special characters to prevent prompt injection via page content. */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Format page context as compact XML for LLM prompt ──────────────────────────

export function formatPageContext(ctx: PageContext): string {
  const parts: string[] = [];

  if (ctx.headings.length > 0) {
    parts.push("<page-headings>");
    ctx.headings.forEach((h) =>
      parts.push(`  <h${h.level}>${escapeXml(h.text)}</h${h.level}>`),
    );
    parts.push("</page-headings>");
  }

  if (ctx.buttons.length > 0) {
    parts.push("<page-buttons>");
    ctx.buttons.forEach((b) =>
      parts.push(
        `  <button selector="${escapeXml(b.selector)}">${escapeXml(b.text)}</button>`,
      ),
    );
    parts.push("</page-buttons>");
  }

  if (ctx.links.length > 0) {
    parts.push("<page-links>");
    ctx.links.forEach((l) =>
      parts.push(
        `  <link href="${escapeXml(l.href)}" selector="${escapeXml(l.selector)}">${escapeXml(l.text)}</link>`,
      ),
    );
    parts.push("</page-links>");
  }

  if (ctx.forms.length > 0) {
    parts.push("<page-forms>");
    ctx.forms.forEach((f) => {
      parts.push(
        `  <form selector="${escapeXml(f.selector)}" action="${escapeXml(f.action || "")}" method="${escapeXml(f.method || "")}">`,
      );
      f.fields.forEach((field) => {
        const attrs = [
          `name="${escapeXml(field.name)}"`,
          `type="${escapeXml(field.type)}"`,
          `selector="${escapeXml(field.selector)}"`,
        ];
        if (field.label) attrs.push(`label="${escapeXml(field.label)}"`);
        if (field.placeholder)
          attrs.push(`placeholder="${escapeXml(field.placeholder)}"`);
        if (field.value) attrs.push(`value="${escapeXml(field.value)}"`);
        parts.push(`    <field ${attrs.join(" ")} />`);
      });
      parts.push("  </form>");
    });
    parts.push("</page-forms>");
  }

  if (ctx.inputs.length > 0) {
    parts.push("<page-inputs>");
    ctx.inputs.forEach((inp) => {
      const attrs = [
        `name="${escapeXml(inp.name)}"`,
        `type="${escapeXml(inp.type)}"`,
        `selector="${escapeXml(inp.selector)}"`,
      ];
      if (inp.label) attrs.push(`label="${escapeXml(inp.label)}"`);
      if (inp.placeholder)
        attrs.push(`placeholder="${escapeXml(inp.placeholder)}"`);
      if (inp.value) attrs.push(`value="${escapeXml(inp.value)}"`);
      parts.push(`  <input ${attrs.join(" ")} />`);
    });
    parts.push("</page-inputs>");
  }

  if (ctx.textContent) {
    parts.push(`<page-text>${escapeXml(ctx.textContent)}</page-text>`);
  }

  return parts.join("\n");
}

// ─── Selector helpers ───────────────────────────────────────────────────────────
// Elements are found in the captured document but selectors must target the
// LIVE DOM (for click / execute_js tools). IDs and names work across both DOMs.
// For elements without ID/name, we match by text+tag in the live DOM and tag
// them with data-gyozai.

function resolveLiveSelector(capturedEl: Element, fallback: string): string {
  // ID and name selectors work in both captured and live DOM
  if (capturedEl.id) return `#${capturedEl.id}`;
  const name = capturedEl.getAttribute("name");
  if (name) return `[name="${name}"]`;

  if (typeof document === "undefined") return `[data-gyozai="${fallback}"]`;

  // Match back to live DOM by text content + tag.
  // Use ancestor text as context to disambiguate identical buttons
  // (e.g. multiple "Install" buttons in different recipe cards).
  const tag = capturedEl.tagName.toLowerCase();
  const text = (capturedEl.textContent || "").trim();
  const ancestorText = getAncestorContext(capturedEl);

  if (text) {
    const candidates = document.querySelectorAll(tag);
    let bestMatch: Element | null = null;

    for (const liveEl of Array.from(candidates)) {
      // Skip elements already matched to a different fallback
      if (liveEl.hasAttribute("data-gyozai")) continue;
      if ((liveEl.textContent || "").trim() !== text) continue;

      // If we have ancestor context, prefer the candidate whose ancestor matches
      if (ancestorText) {
        const liveAncestor = getAncestorContext(liveEl);
        if (liveAncestor === ancestorText) {
          bestMatch = liveEl;
          break; // exact ancestor match — use it
        }
      }
      // Otherwise take the first unmatched candidate
      if (!bestMatch) bestMatch = liveEl;
    }

    if (bestMatch) {
      bestMatch.setAttribute("data-gyozai", fallback);
      return `[data-gyozai="${fallback}"]`;
    }
  }

  // No live DOM match found — return an unmatched selector so click
  // fails safely rather than hitting the wrong element.
  return `[data-gyozai="${fallback}"]`;
}

/** Get a short text fingerprint from the nearest meaningful ancestor
 *  (card, list-item, section, etc.) for disambiguating identical buttons. */
function getAncestorContext(el: Element): string {
  let node = el.parentElement;
  // Walk up a few levels to find an ancestor with enough unique text
  for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
    if (node.tagName === "BODY") break;
    const t = (node.textContent || "").trim();
    // Need enough text to be meaningful, but not the whole page
    if (t.length > 20 && t.length < 2000) return t.slice(0, 200);
  }
  return "";
}

function findLabelInDoc(input: Element, doc: Document): string | undefined {
  if (input.id) {
    const label = doc.querySelector(`label[for="${input.id}"]`);
    if (label) return (label.textContent || "").trim();
  }
  const parent = input.closest("label");
  if (parent) return (parent.textContent || "").trim();
  return input.getAttribute("aria-label") || undefined;
}

// ─── Form value baking ──────────────────────────────────────────────────────────
// Sets current form values as HTML attributes on the LIVE DOM so the library
// captures them (it reads attributes, not JS properties).

function bakeFormValues(): void {
  document.querySelectorAll("input, textarea, select").forEach((el) => {
    if (el.tagName === "SELECT") {
      const sel = el as HTMLSelectElement;
      for (const opt of Array.from(sel.options)) {
        if (opt.selected) opt.setAttribute("selected", "selected");
        else opt.removeAttribute("selected");
      }
    } else if (el.tagName === "TEXTAREA") {
      (el as HTMLTextAreaElement).textContent = (
        el as HTMLTextAreaElement
      ).value;
    } else {
      const inp = el as HTMLInputElement;
      if (inp.type === "checkbox" || inp.type === "radio") {
        if (inp.checked) inp.setAttribute("checked", "checked");
        else inp.removeAttribute("checked");
      } else {
        inp.setAttribute("value", inp.value);
      }
    }
  });
}
