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
  const result = await chrome.storage.local.get("gyozai_recipes");
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
  await chrome.storage.local.set({ gyozai_recipes: recipes });
  return recipe.enabled;
}

export async function addRecipe(recipe: StoredRecipe): Promise<void> {
  const recipes = await getRecipes();
  recipes.push(recipe);
  await chrome.storage.local.set({ gyozai_recipes: recipes });
}

export async function removeRecipe(id: string): Promise<void> {
  const recipes = await getRecipes();
  const filtered = recipes.filter((r) => r.id !== id);
  await chrome.storage.local.set({ gyozai_recipes: filtered });
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
): Promise<void> {
  let domain: string | undefined;
  let name: string | undefined;

  // Try llms.txt Markdown format first: extract from blockquote and H1
  const h1Match = recipeContent.match(/^#\s+(.+)$/m);
  const domainBlockquoteMatch = recipeContent.match(
    /^>\s*domain:\s*([^\s|]+)/m,
  );

  if (h1Match) {
    name = h1Match[1].trim();
  }
  if (domainBlockquoteMatch) {
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
    await chrome.storage.local.set({ gyozai_recipes: existing });
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
