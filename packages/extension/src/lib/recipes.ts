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
  xml: string;
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
): Promise<{ xml: string; names: string[] } | null> {
  const recipes = await getRecipes();
  const enabled = recipes.filter((r) => r.domain === domain && r.enabled);
  if (enabled.length === 0) return null;
  return {
    xml: enabled.map((r) => r.xml).join("\n\n"),
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
 * Import a recipe XML file. Domain is auto-inferred from the XML's
 * domain="..." attribute. Supports multiple recipes per domain.
 */
export async function importRecipeFromFile(
  filename: string,
  xmlContent: string,
): Promise<void> {
  const domainMatch = xmlContent.match(/domain="([^"]+)"/);
  const nameMatch = xmlContent.match(
    /<gyozai-manifest[^>]*>[\s\S]*?<route[^>]*name="([^"]+)"/,
  );

  // Generate deterministic ID from content hash
  const id = await hashContent(xmlContent);
  const domain = domainMatch?.[1] || filename.replace(".xml", "");
  const name = nameMatch?.[1] || filename.replace(".xml", "");

  // If recipe with same ID exists, replace it (same recipe, updated version)
  const existing = await getRecipes();
  const existingIdx = existing.findIndex((r) => r.id === id);
  if (existingIdx >= 0) {
    existing[existingIdx] = {
      id,
      domain,
      name,
      xml: xmlContent,
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
    xml: xmlContent,
    enabled: true,
    installedAt: new Date().toISOString(),
  });
}
