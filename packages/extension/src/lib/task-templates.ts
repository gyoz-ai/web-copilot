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
    systemPromptAddition: `You are translating this page. Use get_page_context with fullPage first, then use click and fill_input tools to interact with language selectors. If no language selector exists, explain to the user that translation requires page-level controls.`,
    defaultCapabilities: { click: true, navigate: false },
  },
  "explain-ui": {
    name: "Explain UI",
    description: "Explain what elements on the page do",
    systemPromptAddition: `You are explaining this page's interface. Use get_page_context to understand the layout, then highlight_ui to point at elements as you explain them.`,
    defaultCapabilities: { highlightUi: true, click: false },
  },
  "fill-form": {
    name: "Fill Form",
    description: "Help fill out a form on the page",
    systemPromptAddition: `You are helping fill a form. Use get_page_context to understand the form fields, clarify any ambiguous fields with the user, then use the narrow interaction tools (fill_input, select_option, toggle_checkbox) to fill them.`,
    defaultCapabilities: { click: true },
  },
};
