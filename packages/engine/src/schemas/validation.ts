import { ManifestSchema, type Manifest } from './manifest'
import { QueryPayloadSchema, type QueryPayload } from './query'
import { ActionResponseSchema, type ActionResponse } from './actions'

type ValidationResult<T> = { success: true; data: T } | { success: false; error: string }

export function validateManifest(data: unknown): ValidationResult<Manifest> {
  const result = ManifestSchema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: formatError(result.error) }
}

export function validateQuery(data: unknown): ValidationResult<QueryPayload> {
  const result = QueryPayloadSchema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: formatError(result.error) }
}

export function validateResponse(data: unknown): ValidationResult<ActionResponse> {
  const result = ActionResponseSchema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return { success: false, error: formatError(result.error) }
}

function formatError(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: Array<{ message: string; path: Array<string | number> }> })
      .issues
    return issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  }
  return String(error)
}
