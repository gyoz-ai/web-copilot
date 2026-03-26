import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, Message } from './types'
import type { ActionResponse } from '@gyoz-ai/engine'

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
    this.model = model
  }

  async query(
    system: string,
    messages: Message[],
    schema: Record<string, unknown>,
  ): Promise<ActionResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      output_config: {
        format: {
          type: 'json_schema' as const,
          schema,
        },
      },
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    return JSON.parse(textBlock.text)
  }
}
