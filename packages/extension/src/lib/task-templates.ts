import type { Capabilities } from "@gyoz-ai/engine";

export interface TaskTemplate {
  name: string;
  description: string;
  systemPromptAddition: string;
  defaultCapabilities: Partial<Capabilities>;
}

export const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  "translate-page": {
    name: "Translate Page",
    description: "Translate visible page content",
    systemPromptAddition: `You are translating this page. Use get_page_context with fullPage first, then execute_js to replace text nodes. Preserve HTML structure. Work section by section.`,
    defaultCapabilities: { executeJs: true, click: false, navigate: false },
  },
  "explain-ui": {
    name: "Explain UI",
    description: "Explain what elements on the page do",
    systemPromptAddition: `You are explaining this page's interface. Use get_page_context to understand the layout, then highlight_ui to point at elements as you explain them.`,
    defaultCapabilities: { highlightUi: true, click: false, executeJs: false },
  },
  "fill-form": {
    name: "Fill Form",
    description: "Help fill out a form on the page",
    systemPromptAddition: `You are helping fill a form. Use get_page_context to understand the form fields, clarify any ambiguous fields with the user, then use the narrow interaction tools (fill_input, select_option, toggle_checkbox) to fill them. Use execute_js only as a last resort.`,
    defaultCapabilities: { executeJs: true, click: true },
  },
};
