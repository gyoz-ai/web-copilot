export interface StoredRecipe {
  domain: string;
  name: string;
  xml: string;
  installedAt: string;
}

export async function getRecipes(): Promise<StoredRecipe[]> {
  const result = await chrome.storage.local.get("gyozai_recipes");
  return result.gyozai_recipes || [];
}

export async function getRecipeForDomain(
  domain: string,
): Promise<StoredRecipe | null> {
  const recipes = await getRecipes();
  return recipes.find((r) => r.domain === domain) || null;
}

export async function getRecipesForDomain(
  domain: string,
): Promise<StoredRecipe[]> {
  const recipes = await getRecipes();
  return recipes.filter((r) => r.domain === domain);
}

export async function saveRecipe(recipe: StoredRecipe): Promise<void> {
  const recipes = await getRecipes();
  const existing = recipes.findIndex((r) => r.domain === recipe.domain);
  if (existing >= 0) {
    recipes[existing] = recipe;
  } else {
    recipes.push(recipe);
  }
  await chrome.storage.local.set({ gyozai_recipes: recipes });
}

export async function removeRecipe(domain: string): Promise<void> {
  const recipes = await getRecipes();
  const filtered = recipes.filter((r) => r.domain !== domain);
  await chrome.storage.local.set({ gyozai_recipes: filtered });
}

/**
 * Import a recipe XML file. Domain is auto-inferred from the XML's
 * domain="..." attribute. Falls back to filename if not found.
 */
export async function importRecipeFromFile(
  filename: string,
  xmlContent: string,
): Promise<void> {
  const domainMatch = xmlContent.match(/domain="([^"]+)"/);
  const nameMatch = xmlContent.match(
    /<gyozai-manifest[^>]*>[\s\S]*?<route[^>]*name="([^"]+)"/,
  );

  const domain = domainMatch?.[1] || filename.replace(".xml", "");
  const name = nameMatch?.[1] || filename.replace(".xml", "");

  await saveRecipe({
    domain,
    name,
    xml: xmlContent,
    installedAt: new Date().toISOString(),
  });
}
