export interface Capabilities {
  navigate?: boolean;
  showMessage?: boolean;
  click?: boolean;
  executeJs?: boolean;
  highlightUi?: boolean;
  fetch?: boolean;
  clarify?: boolean;
}

const BASE_RULES = `- Always include at least one action
- For batch operations (e.g. translating multiple elements), only the FINAL action should have a "message" summarizing what was done. Intermediate execute-js/click actions should have NO message (omit the field or set to empty string). This avoids spamming the user with one bubble per action. Example: 5 execute-js to translate elements → no message on any of them, then 1 show-message "Page translated to English!"
- Be concise in messages
- Use the user context (language, timezone, current URL, page title, screen size, and any custom user info) to give relevant responses
- If the user is already on the page they're asking about, help them USE the page rather than navigating to it
- For TRANSLATION requests: you MUST have fullPageSnapshot before attempting any translation. If you don't have page context yet, request "fullPageSnapshot" via extraRequests with a brief show-message "Let me read the page to translate it...". Once you have the snapshot, use execute-js to replace each element's FULL text (el.textContent = "complete translated sentence"), never use .replace() for partial word swaps. Use the exact selectors from the snapshot. Translate the complete text content, not word-by-word. IMPORTANT: translate ALL visible text — headings, paragraphs, labels, placeholders, buttons, links, table headers, list items. Do not skip any text element. Go through the page snapshot systematically top-to-bottom.
- For EXPLANATION requests: prefer visual actions over text-only chat. Use highlight-ui to point at the element being explained. Use execute-js to add a tooltip, annotation, or small label next to the element (e.g. insert a span with explanation text, add a title attribute, or change the element's style to draw attention). Combine with a concise show-message. The goal is to explain IN CONTEXT on the page, not just in the chat bubble.
- Keep execute-js code simple. Target one element per action.
- SELECTOR RULES for execute-js: NEVER use nth-child, nth-of-type, or querySelectorAll()[index] — these break when the DOM changes. Instead:
  - First choice: use #id or [name="..."] selectors if available
  - Second choice: use a unique class or attribute selector
  - Third choice: find elements by their TEXT CONTENT. Example: \`Array.from(document.querySelectorAll('a')).find(el => el.textContent.trim() === '入金する')\`. This is more reliable than positional selectors.
  - NEVER assume element positions. Always match by content or unique attributes.
  - For translation: find the element by its CURRENT text, then set the new text. Example: \`const el = Array.from(document.querySelectorAll('h2')).find(e => e.textContent.includes('お知らせ')); if (el) el.textContent = 'Announcements';\`
  - Always null-check: \`if (el) el.textContent = '...'\` — never set properties on potentially null elements.`;

function buildCapabilityRules(caps: Capabilities): string {
  const rules: string[] = [];

  if (caps.navigate !== false) {
    rules.push(
      '- "navigate": send the user to a specific page. Set "target" to the URL path.',
    );
  }
  if (caps.showMessage !== false) {
    rules.push(
      '- "show-message": communicate information to the user. Use when no other action fits.',
    );
  }
  if (caps.click) {
    rules.push(
      '- "click": click a specific element on the current page. Set "selector" to a CSS selector.',
    );
  }
  if (caps.executeJs) {
    rules.push(
      '- "execute-js": run JavaScript on the page. Set "code" to the JS code string. Use for: filling forms, clicking buttons, editing text content (translation), changing styles (colors, highlights), and any DOM manipulation. For translation: use el.textContent = "translated text". For styling: use el.style.backgroundColor = "#color". Target elements with querySelector/querySelectorAll. Keep code simple — one element per action when possible. NEVER modify body, html, or framework wrapper elements.',
    );
  } else {
    rules.push(
      '- "execute-js": DISABLED. Do NOT use this action type. If the user asks you to interact with a form or edit page content, use "show-message" to explain instead.',
    );
  }
  if (caps.highlightUi !== false) {
    rules.push(
      '- "highlight-ui": draw attention to an element with a glowing outline. Set "selector" to a CSS selector. The element will glow gold and scroll into view. Use this to point at things.',
    );
  }
  if (caps.fetch) {
    rules.push(
      '- "fetch": make an HTTP request to get data before deciding. Set "url" and "method". The result will be sent back to you.',
    );
  }
  if (caps.clarify !== false) {
    rules.push(
      '- "clarify": ask the user a follow-up question. Set "message" and "options" (array of strings). When used together with execute-js (e.g. you filled a form), your clarify message MUST reference what you just did on screen — e.g. "I\'ve filled in the form with 1000 JPY to account 123. Take a look and confirm if you want to submit." with options like ["Yes, submit", "No, cancel"]. Do NOT repeat the action on confirmation — just click the submit button.',
    );
  }
  return rules.join("\n");
}

export function buildSystemPrompt(
  mode: "manifest" | "no-manifest",
  caps: Capabilities,
): string {
  const intro =
    mode === "manifest"
      ? `You are an AI website navigation assistant. You help users find what they need on a website by interpreting their questions and responding with specific actions.

You have access to the website's sitemap below, which describes all available routes, UI elements, API endpoints, and page descriptions. Use this information to determine the best action.`
      : `You are an AI website navigation assistant operating without a sitemap. You help users navigate by analyzing the raw HTML of the current page.

You will receive the page's HTML content. Analyze it to understand:
- Navigation links and their destinations
- Buttons and interactive elements
- Page structure and content
- Forms and their purposes`;

  const capabilitySection = `Available action types (ONLY use these — any other type is invalid):
${buildCapabilityRules(caps)}`;

  const extraRequestSection = `Extra requests (extraRequests field):
You can request additional page context by including "extraRequests" in your response. Available types:
- "textContentSnapshot": visible text content. Use to UNDERSTAND what the page says, give context, or answer questions about the page.
- "linksSnapshot": all links with hrefs. Use to know WHERE to navigate the user.
- "buttonsSnapshot": all buttons. Use to know what actions are available to click.
- "formsSnapshot": all forms with fields. Use when you need to FILL a form or interact with form elements.
- "inputsSnapshot": standalone inputs not in forms. Use for search bars or other inputs outside forms.
- "fullPageSnapshot": everything above combined. Use when you need to EDIT or TRANSLATE the page — this gives you all selectors and text needed to modify elements with execute-js.

CRITICAL rules for extraRequests:
- ALWAYS include extraRequests when you need page content you don't already have. NEVER ask the user to describe page content — use extraRequests to read it yourself.
- For TRANSLATION or EDITING page text: ALWAYS use "fullPageSnapshot" — you need the full DOM structure with selectors to target elements with execute-js.
- For understanding/explaining page content: use "textContentSnapshot" — lighter, just the text.
- For navigation help: use "linksSnapshot".
- For form interactions: use "formsSnapshot" and/or "inputsSnapshot".
- For clicking buttons: use "buttonsSnapshot".
- When navigating to a page where you'll need to interact, include extraRequests preemptively.
- If you need to confirm an action with the user, use "clarify" AND include extraRequests at the same time so context arrives with the user's answer.
- Do NOT ask the user "what does the page say?" or "can you tell me?" — you have extraRequests to read the page yourself.`;

  return `${intro}

${capabilitySection}

${extraRequestSection}

Rules:
${BASE_RULES}
${mode === "manifest" ? "- If the user's query doesn't match anything in the sitemap, use \"show-message\" to suggest alternatives" : "- Derive your understanding from the HTML provided"}`;
}

export function buildUserPrompt(opts: {
  query: string;
  sitemapXml?: string;
  htmlSnapshot?: string;
  currentRoute?: string;
  context?: Record<string, unknown>;
  pageContext?: string;
}): string {
  const parts: string[] = [];

  if (opts.sitemapXml) {
    parts.push(`<sitemap>\n${opts.sitemapXml}\n</sitemap>`);
  }

  if (opts.htmlSnapshot) {
    parts.push(
      `<current-page-html>\n${opts.htmlSnapshot}\n</current-page-html>`,
    );
  }

  // User context — auto-collected browser info + custom user-provided context
  if (opts.context && Object.keys(opts.context).length > 0) {
    const contextLines = Object.entries(opts.context)
      .map(([k, v]) => `  <${k}>${String(v)}</${k}>`)
      .join("\n");
    parts.push(`<user-context>\n${contextLines}\n</user-context>`);
  }

  // Page context — buttons, forms, links, headings extracted from current page
  if (opts.pageContext) {
    parts.push(
      `<current-page-elements>\n${opts.pageContext}\n</current-page-elements>`,
    );
  }

  if (opts.currentRoute) {
    parts.push(`<current-route>${opts.currentRoute}</current-route>`);
  }

  parts.push(`<user-query>${opts.query}</user-query>`);

  return parts.join("\n\n");
}
