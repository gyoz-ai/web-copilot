import { describe, expect, test } from "bun:test";
import { validateManifest } from "./validation";

describe("ManifestSchema", () => {
  test("validates a complete manifest", () => {
    const result = validateManifest({
      version: 1,
      domain: "localhost:4321",
      prefix: "/demos/grocery",
      routes: [
        { path: "/", name: "Home", description: "Landing page" },
        { path: "/category/:slug", name: "Category", params: "slug" },
      ],
      uiElements: [
        {
          route: "/",
          selector: "#add-to-cart",
          type: "button",
          label: "Add to Cart",
        },
      ],
      apiEndpoints: [
        { method: "POST", path: "/api/cart/add", description: "Add item" },
      ],
      pageDescriptions: [{ route: "/", summary: "Home page" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.routes).toHaveLength(2);
      expect(result.data.uiElements).toHaveLength(1);
      expect(result.data.apiEndpoints).toHaveLength(1);
    }
  });

  test("validates minimal manifest (routes only)", () => {
    const result = validateManifest({
      version: 1,
      domain: "example.com",
      routes: [{ path: "/", name: "Home" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.uiElements).toEqual([]);
      expect(result.data.apiEndpoints).toEqual([]);
      expect(result.data.pageDescriptions).toEqual([]);
    }
  });

  test("rejects manifest missing domain", () => {
    const result = validateManifest({ version: 1, routes: [] });
    expect(result.success).toBe(false);
  });

  test("rejects invalid ui element type", () => {
    const result = validateManifest({
      version: 1,
      domain: "x.com",
      routes: [{ path: "/", name: "Home" }],
      uiElements: [{ route: "/", selector: "#x", type: "invalid", label: "X" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid API method", () => {
    const result = validateManifest({
      version: 1,
      domain: "x.com",
      routes: [{ path: "/", name: "Home" }],
      apiEndpoints: [{ method: "YEET", path: "/api" }],
    });
    expect(result.success).toBe(false);
  });
});
