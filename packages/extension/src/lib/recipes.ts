import { browser } from "wxt/browser";
import { storageGet } from "./storage";
// ─── Recipe Frontmatter ─────────────────────────────────────────────────────

export interface RecipeMeta {
  name?: string;
  version?: string;
  domain?: string;
  routes?: string[];
  capabilities?: string[];
  model?: string;
  maxSteps?: number;
}

export function parseFrontmatter(content: string): {
  meta: RecipeMeta;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2];
  const meta: RecipeMeta = {};

  for (const line of yamlBlock.split("\n")) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const k = key.trim();
    if (k === "name") meta.name = value;
    if (k === "version") meta.version = value;
    if (k === "domain") meta.domain = value;
    if (k === "model") meta.model = value;
    if (k === "maxSteps") meta.maxSteps = parseInt(value, 10);
    if (k === "routes") {
      try {
        meta.routes = JSON.parse(value);
      } catch {
        /* skip malformed */
      }
    }
    if (k === "capabilities") {
      try {
        meta.capabilities = JSON.parse(value);
      } catch {
        /* skip malformed */
      }
    }
  }

  return { meta, body };
}

export function extractPlaybooks(recipeBody: string): string | null {
  const match = recipeBody.match(
    /## Playbooks\n([\s\S]*?)(?=\n## [^P]|\n---|$)/,
  );
  return match ? match[1].trim() : null;
}

// ─── Recipe content validation ──────────────────────────────────────────────

/** Max recipe size (50KB) to prevent abuse. */
const MAX_RECIPE_SIZE = 50_000;

/** Patterns that indicate prompt injection attempts in recipe content. */
const INJECTION_PATTERNS = [
  // LLM control tokens
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\|endoftext\|>/i,
  /<system>/i,
  /<\/system>/i,
  // Common prompt injection phrases
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+(a|an)\b/i,
  /new\s+system\s+prompt/i,
  /override\s+(system|previous)\s+(prompt|instructions)/i,
  /reveal\s+(your|the)\s+(system\s+)?prompt/i,
  /output\s+(your|the)\s+(system\s+)?prompt/i,
];

export interface RecipeValidationResult {
  valid: boolean;
  reason?: string;
}

/** Validate recipe content for prompt injection patterns and size limits. */
export function validateRecipeContent(content: string): RecipeValidationResult {
  if (content.length > MAX_RECIPE_SIZE) {
    return { valid: false, reason: "Recipe exceeds maximum size limit" };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      return {
        valid: false,
        reason: `Recipe contains suspicious content matching: ${pattern.source}`,
      };
    }
  }

  return { valid: true };
}

// ─── Content hashing ────────────────────────────────────────────────────────

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export interface StoredRecipe {
  id: string;
  domain: string;
  name: string;
  content: string;
  enabled: boolean;
  installedAt: string;
}

export async function getRecipes(): Promise<StoredRecipe[]> {
  const result = await storageGet("gyozai_recipes");
  return result.gyozai_recipes || [];
}

/** Get ALL enabled recipes for a domain, merged into one recipe string */
export async function getMergedRecipeForDomain(
  domain: string,
): Promise<{ content: string; names: string[] } | null> {
  const recipes = await getRecipes();
  const enabled = recipes.filter((r) => r.domain === domain && r.enabled);
  if (enabled.length === 0) return null;
  return {
    content: enabled.map((r) => r.content).join("\n\n"),
    names: enabled.map((r) => r.name),
  };
}

/** Get all recipes for a specific domain */
export async function getRecipesForDomain(
  domain: string,
): Promise<StoredRecipe[]> {
  const recipes = await getRecipes();
  return recipes.filter((r) => r.domain === domain);
}

export async function toggleRecipe(id: string): Promise<boolean> {
  const recipes = await getRecipes();
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) return false;
  recipe.enabled = !recipe.enabled;
  await browser.storage.local.set({ gyozai_recipes: recipes });
  return recipe.enabled;
}

export async function addRecipe(recipe: StoredRecipe): Promise<void> {
  const recipes = await getRecipes();
  recipes.push(recipe);
  await browser.storage.local.set({ gyozai_recipes: recipes });
}

export async function removeRecipe(id: string): Promise<void> {
  const recipes = await getRecipes();
  const filtered = recipes.filter((r) => r.id !== id);
  await browser.storage.local.set({ gyozai_recipes: filtered });
}

/**
 * Check if a recipe with the same content hash already exists.
 */
export async function recipeExists(recipeContent: string): Promise<boolean> {
  const id = await hashContent(recipeContent);
  const recipes = await getRecipes();
  return recipes.some((r) => r.id === id);
}

/**
 * Import a recipe file. Domain is auto-inferred from the content.
 * Supports both llms.txt Markdown format and legacy XML.
 * Supports multiple recipes per domain.
 */
export async function importRecipeFromFile(
  filename: string,
  recipeContent: string,
  overrideDomain?: string,
): Promise<void> {
  // Validate recipe content before importing
  const validation = validateRecipeContent(recipeContent);
  if (!validation.valid) {
    console.warn(
      `[gyoza:recipes] Rejected recipe "${filename}": ${validation.reason}`,
    );
    return;
  }

  let domain: string | undefined = overrideDomain;
  let name: string | undefined;

  // Try llms.txt Markdown format first: extract from blockquote and H1
  const h1Match = recipeContent.match(/^#\s+(.+)$/m);
  const domainBlockquoteMatch = recipeContent.match(
    /^>\s*domain:\s*([^\s|]+)/m,
  );

  if (h1Match) {
    name = h1Match[1].trim();
  }
  if (!domain && domainBlockquoteMatch) {
    domain = domainBlockquoteMatch[1].trim();
  }

  // Fallback to legacy XML parsing
  if (!domain) {
    const xmlDomainMatch = recipeContent.match(/domain="([^"]+)"/);
    domain = xmlDomainMatch?.[1];
  }
  if (!name) {
    const xmlNameMatch = recipeContent.match(
      /<gyozai-manifest[^>]*>[\s\S]*?<route[^>]*name="([^"]+)"/,
    );
    name = xmlNameMatch?.[1];
  }

  // Generate deterministic ID from content hash
  const id = await hashContent(recipeContent);
  const cleanFilename = filename.replace(/\.(xml|txt|md)$/, "");
  domain = domain || cleanFilename;
  name = name || cleanFilename;

  // If recipe with same ID exists, replace it (same recipe, updated version)
  const existing = await getRecipes();
  const existingIdx = existing.findIndex((r) => r.id === id);
  if (existingIdx >= 0) {
    existing[existingIdx] = {
      id,
      domain,
      name,
      content: recipeContent,
      enabled: true,
      installedAt: new Date().toISOString(),
    };
    await browser.storage.local.set({ gyozai_recipes: existing });
    return;
  }

  await addRecipe({
    id,
    domain,
    name,
    content: recipeContent,
    enabled: true,
    installedAt: new Date().toISOString(),
  });
}
