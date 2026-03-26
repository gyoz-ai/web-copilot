import type { LLMProvider, Message } from './types'
import type { ActionResponse } from '@gyoz-ai/engine'

const PLATFORM_URL = 'https://api.gyoz.ai'

export class ManagedProvider implements LLMProvider {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  async query(
    system: string,
    messages: Message[],
    schema: Record<string, unknown>,
  ): Promise<ActionResponse> {
    const response = await fetch(`${PLATFORM_URL}/v1/inference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ system, messages, schema }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Platform error' }))
      throw new Error((error as { error?: string }).error || `Platform returned ${response.status}`)
    }

    return response.json()
  }
}
