import type { ActionResponse } from '@gyoz-ai/engine'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMProvider {
  query(
    system: string,
    messages: Message[],
    schema: Record<string, unknown>,
  ): Promise<ActionResponse>
}
