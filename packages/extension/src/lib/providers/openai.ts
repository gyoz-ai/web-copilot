import OpenAI from "openai";
import type { LLMProvider, Message } from "./types";
import type { ActionResponse } from "@gyoz-ai/engine";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async query(
    system: string,
    messages: Message[],
    schema: Record<string, unknown>,
  ): Promise<ActionResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "action_response",
          strict: true,
          schema,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from OpenAI");

    return JSON.parse(content);
  }
}
