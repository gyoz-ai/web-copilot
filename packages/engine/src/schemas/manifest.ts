import { z } from 'zod/v4'

// ─── Sitemap Manifest Schema ────────────────────────────────────────────────────
// XML sitemap fed as context TO Claude (not output by Claude).
// These schemas validate the parsed representation after XML → object conversion.

export const RouteSchema = z.object({
  path: z.string(),
  name: z.string(),
  description: z.string().optional(),
  params: z.string().optional(),
})

export const UiElementSchema = z.object({
  route: z.string(),
  selector: z.string(),
  type: z.enum(['button', 'link', 'input', 'form', 'select', 'toggle']),
  label: z.string(),
  action: z.string().optional(),
})

export const ApiEndpointSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  description: z.string().optional(),
  auth: z.enum(['required', 'optional', 'none']).optional(),
})

export const PageDescriptionSchema = z.object({
  route: z.string(),
  summary: z.string(),
})

export const ManifestSchema = z.object({
  version: z.number().int().positive(),
  domain: z.string(),
  prefix: z.string().optional(),
  generated: z.string().optional(),
  routes: z.array(RouteSchema),
  uiElements: z.array(UiElementSchema).optional().default([]),
  apiEndpoints: z.array(ApiEndpointSchema).optional().default([]),
  pageDescriptions: z.array(PageDescriptionSchema).optional().default([]),
})

// ─── Types ──────────────────────────────────────────────────────────────────────

export type Route = z.infer<typeof RouteSchema>
export type UiElement = z.infer<typeof UiElementSchema>
export type ApiEndpoint = z.infer<typeof ApiEndpointSchema>
export type PageDescription = z.infer<typeof PageDescriptionSchema>
export type Manifest = z.infer<typeof ManifestSchema>
