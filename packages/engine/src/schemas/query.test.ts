import { describe, expect, test } from 'bun:test'
import { validateQuery } from './validation'

describe('QueryPayloadSchema', () => {
  test('validates manifest-mode query', () => {
    const result = validateQuery({
      query: 'where is dairy?',
      manifestMode: true,
      sitemapXml: '<gyozai-manifest>...</gyozai-manifest>',
    })
    expect(result.success).toBe(true)
  })

  test('validates manifest-mode query without sitemap (sitemap optional in schema)', () => {
    const result = validateQuery({
      query: 'where is dairy?',
      manifestMode: true,
    })
    expect(result.success).toBe(true)
  })

  test('validates no-manifest-mode query with htmlSnapshot', () => {
    const result = validateQuery({
      query: 'find a cooking video',
      manifestMode: false,
      htmlSnapshot: '<body><h1>Videos</h1></body>',
    })
    expect(result.success).toBe(true)
  })

  test('rejects no-manifest-mode without htmlSnapshot', () => {
    const result = validateQuery({
      query: 'find a cooking video',
      manifestMode: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('htmlSnapshot')
  })

  test('rejects empty query', () => {
    const result = validateQuery({
      query: '',
      manifestMode: true,
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing required fields', () => {
    const result = validateQuery({})
    expect(result.success).toBe(false)
  })

  test('validates query with conversation history', () => {
    const result = validateQuery({
      query: 'now show me bakery',
      manifestMode: true,
      conversationHistory: [
        { role: 'user', content: 'where is dairy?' },
        { role: 'assistant', content: 'navigating to dairy' },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.conversationHistory).toHaveLength(2)
  })
})
