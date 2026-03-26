// ─── Page Context Extractor ─────────────────────────────────────────────────────
// Extracts actionable elements and text content from the DOM for LLM context.
// Much smaller than raw HTML — only what the AI needs to understand the page.

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
    }>;
  }>;
  inputs: Array<{
    selector: string;
    name: string;
    type: string;
    label?: string;
    placeholder?: string;
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

  if (captureAll || types.includes("buttons")) {
    document
      .querySelectorAll(
        'button, [role="button"], input[type="submit"], input[type="button"]',
      )
      .forEach((el, i) => {
        const text = (
          el.textContent ||
          (el as HTMLInputElement).value ||
          ""
        ).trim();
        if (!text) return;
        const selector = buildSelector(el, `button-${i}`);
        ctx.buttons.push({
          selector,
          text: text.slice(0, 100),
          type: el.getAttribute("type") || undefined,
        });
      });
  }

  if (captureAll || types.includes("links")) {
    document.querySelectorAll("a[href]").forEach((el, i) => {
      const text = (el.textContent || "").trim();
      const href = el.getAttribute("href") || "";
      if (!text || href.startsWith("#") || href.startsWith("javascript:"))
        return;
      ctx.links.push({
        selector: buildSelector(el, `link-${i}`),
        text: text.slice(0, 100),
        href,
      });
    });
  }

  if (captureAll || types.includes("forms")) {
    document.querySelectorAll("form").forEach((form, fi) => {
      const fields: PageContext["forms"][0]["fields"] = [];

      form.querySelectorAll("input, select, textarea").forEach((field, ii) => {
        const input = field as HTMLInputElement;
        const name = input.name || input.id || "";
        const type = input.type || field.tagName.toLowerCase();
        if (type === "hidden" || type === "submit") return;

        const label = findLabel(input);
        fields.push({
          selector: buildSelector(field, `field-${fi}-${ii}`),
          name,
          type,
          label: label?.slice(0, 100),
          placeholder: input.placeholder?.slice(0, 100) || undefined,
        });
      });

      ctx.forms.push({
        selector: buildSelector(form, `form-${fi}`),
        action: form.getAttribute("action") || undefined,
        method: form.getAttribute("method") || undefined,
        fields,
      });
    });
  }

  if (captureAll || types.includes("inputs")) {
    // Standalone inputs not inside forms
    document
      .querySelectorAll(
        "input:not(form input), select:not(form select), textarea:not(form textarea)",
      )
      .forEach((el, i) => {
        const input = el as HTMLInputElement;
        if (input.type === "hidden") return;
        const label = findLabel(input);
        ctx.inputs.push({
          selector: buildSelector(el, `input-${i}`),
          name: input.name || input.id || "",
          type: input.type || el.tagName.toLowerCase(),
          label: label?.slice(0, 100),
          placeholder: input.placeholder?.slice(0, 100) || undefined,
        });
      });
  }

  if (captureAll || types.includes("headings")) {
    document.querySelectorAll("h1, h2, h3, h4").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (!text) return;
      const level = parseInt(el.tagName[1]);
      ctx.headings.push({ level, text: text.slice(0, 200) });
    });
  }

  if (captureAll || types.includes("images")) {
    document.querySelectorAll("img[alt]").forEach((el) => {
      const img = el as HTMLImageElement;
      if (!img.alt) return;
      ctx.images.push({
        alt: img.alt.slice(0, 100),
        src: img.src.slice(0, 200),
      });
    });
  }

  if (captureAll || types.includes("textContent")) {
    // Get visible text, skip scripts/styles/framework noise
    const SKIP_TAGS = new Set([
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "SVG",
      "ASTRO-ISLAND",
    ]);
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest("script, style, noscript, svg"))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    const texts: string[] = [];
    let totalLen = 0;
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

// Format page context as compact text for LLM prompt
export function formatPageContext(ctx: PageContext): string {
  const parts: string[] = [];

  if (ctx.headings.length > 0) {
    parts.push("<page-headings>");
    ctx.headings.forEach((h) =>
      parts.push(`  <h${h.level}>${h.text}</h${h.level}>`),
    );
    parts.push("</page-headings>");
  }

  if (ctx.buttons.length > 0) {
    parts.push("<page-buttons>");
    ctx.buttons.forEach((b) =>
      parts.push(`  <button selector="${b.selector}">${b.text}</button>`),
    );
    parts.push("</page-buttons>");
  }

  if (ctx.links.length > 0) {
    parts.push("<page-links>");
    ctx.links.forEach((l) =>
      parts.push(
        `  <link href="${l.href}" selector="${l.selector}">${l.text}</link>`,
      ),
    );
    parts.push("</page-links>");
  }

  if (ctx.forms.length > 0) {
    parts.push("<page-forms>");
    ctx.forms.forEach((f) => {
      parts.push(
        `  <form selector="${f.selector}" action="${f.action || ""}" method="${f.method || ""}">`,
      );
      f.fields.forEach((field) => {
        const attrs = [
          `name="${field.name}"`,
          `type="${field.type}"`,
          `selector="${field.selector}"`,
        ];
        if (field.label) attrs.push(`label="${field.label}"`);
        if (field.placeholder) attrs.push(`placeholder="${field.placeholder}"`);
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
        `name="${inp.name}"`,
        `type="${inp.type}"`,
        `selector="${inp.selector}"`,
      ];
      if (inp.label) attrs.push(`label="${inp.label}"`);
      if (inp.placeholder) attrs.push(`placeholder="${inp.placeholder}"`);
      parts.push(`  <input ${attrs.join(" ")} />`);
    });
    parts.push("</page-inputs>");
  }

  if (ctx.textContent) {
    parts.push(`<page-text>${ctx.textContent}</page-text>`);
  }

  return parts.join("\n");
}

function buildSelector(el: Element, fallback: string): string {
  if (el.id) return `#${el.id}`;
  if (el.getAttribute("name")) return `[name="${el.getAttribute("name")}"]`;

  // Try to build a unique path using nth-child
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === el.tagName,
    );
    if (siblings.length === 1) {
      const parentSel = buildParentSelector(parent);
      if (parentSel) return `${parentSel} > ${tag}`;
    } else {
      const idx = siblings.indexOf(el) + 1;
      const parentSel = buildParentSelector(parent);
      if (parentSel) return `${parentSel} > ${tag}:nth-child(${idx})`;
    }
  }

  // Fallback: use data attribute (engine tags elements it can't selector)
  el.setAttribute("data-gyozai", fallback);
  return `[data-gyozai="${fallback}"]`;
}

function buildParentSelector(el: Element): string | null {
  if (el.id) return `#${el.id}`;
  if (el.tagName === "BODY") return "body";
  if (el.tagName === "MAIN") return "main";
  const tag = el.tagName.toLowerCase();
  // Use safe classes only (no special chars like / : [ ])
  if (el.className && typeof el.className === "string") {
    const safeCls = el.className
      .split(" ")
      .filter((c) => c && !/[/:\[\]()#>~+]/.test(c))
      .slice(0, 2);
    if (safeCls.length > 0) return `${tag}.${safeCls.join(".")}`;
  }
  return tag;
}

function findLabel(input: HTMLInputElement): string | undefined {
  // Check for associated label
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return (label.textContent || "").trim();
  }
  // Check parent label
  const parent = input.closest("label");
  if (parent) return (parent.textContent || "").trim();
  // Check aria-label
  return input.getAttribute("aria-label") || undefined;
}

// ─── Clean Page Snapshot (HTML → Markdown via Turndown) ──────────────────────
// Converts the page to Markdown for LLM context using Turndown.
// Much more token-efficient than raw HTML. Preserves:
// - Headings, links, lists, bold/italic, images, forms
// Strips all scripts, styles, SVGs, CSS noise.
// LLMs understand Markdown natively — trained on tons of it.

import TurndownService from "turndown";

export function captureCleanHtml(maxLength: number = 30000): string {
  if (typeof document === "undefined") return "";

  // Clone body and strip noise before converting
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      "script, style, noscript, svg, link, meta, template, iframe, #gyozai-extension-root",
    )
    .forEach((el) => el.remove());

  // Remove all inline styles and class attributes to reduce noise
  clone.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("style");
    el.removeAttribute("class");
    // Remove data-* attributes
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
      if (attr.name.startsWith("data-") && attr.name !== "data-gyozai") {
        el.removeAttribute(attr.name);
      }
    }
  });

  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  // Add custom rules for form elements (turndown ignores them by default)
  turndown.addRule("input", {
    filter: ["input", "textarea", "select"],
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const type = el.getAttribute("type") || el.tagName.toLowerCase();
      const id = el.getAttribute("id") || "";
      const name = el.getAttribute("name") || "";
      const placeholder = el.getAttribute("placeholder") || "";
      const parts = [`[${type}`];
      if (id) parts.push(`id="${id}"`);
      if (name) parts.push(`name="${name}"`);
      if (placeholder) parts.push(`placeholder="${placeholder}"`);
      return parts.join(" ") + "]\n";
    },
  });

  turndown.addRule("button", {
    filter: "button",
    replacement: (content, node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute("id") || "";
      const type = el.getAttribute("type") || "button";
      return `[button${id ? ` id="${id}"` : ""} type="${type}"]: ${content.trim()}\n`;
    },
  });

  turndown.addRule("form", {
    filter: "form",
    replacement: (content, node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute("id") || "";
      const action = el.getAttribute("action") || "";
      return `\n---form${id ? ` id="${id}"` : ""}${action ? ` action="${action}"` : ""}---\n${content}\n---/form---\n`;
    },
  });

  let markdown = turndown.turndown(clone.innerHTML);

  // Clean up excessive whitespace
  markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

  // Truncate if needed
  if (markdown.length > maxLength) {
    markdown = markdown.slice(0, maxLength) + "\n\n[truncated]";
  }

  return markdown;
}
