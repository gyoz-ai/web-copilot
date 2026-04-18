import { describe, expect, it } from "bun:test";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "./storage";

describe("storage", () => {
  describe("DEFAULT_SETTINGS", () => {
    it("has stickyChat defaulting to false", () => {
      expect(DEFAULT_SETTINGS.stickyChat).toBe(false);
    });

    it("stickyChat is a boolean field on ExtensionSettings", () => {
      const settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
      expect(typeof settings.stickyChat).toBe("boolean");
    });

    it("preserves all expected default values", () => {
      expect(DEFAULT_SETTINGS.mode).toBe("managed");
      expect(DEFAULT_SETTINGS.yoloMode).toBe(true);
      expect(DEFAULT_SETTINGS.chatOnly).toBe(false);
      expect(DEFAULT_SETTINGS.stickyChat).toBe(false);
      expect(DEFAULT_SETTINGS.autoImportRecipes).toBe(true);
      expect(DEFAULT_SETTINGS.theme).toBe("dark");
      expect(DEFAULT_SETTINGS.agentSize).toBe("medium");
      expect(DEFAULT_SETTINGS.typingAnimation).toBe(true);
      expect(DEFAULT_SETTINGS.typingSound).toBe(true);
      expect(DEFAULT_SETTINGS.bubbleOpacity).toBe(0.85);
      expect(DEFAULT_SETTINGS.panelOpacity).toBe(0.45);
    });

    it("includes xai in default apiKeys", () => {
      expect(DEFAULT_SETTINGS.apiKeys).toHaveProperty("xai");
      expect(DEFAULT_SETTINGS.apiKeys.xai).toBe("");
    });

    it("supports all four providers in ProviderKey type", () => {
      const settings: ExtensionSettings = { ...DEFAULT_SETTINGS };
      const providers: Array<ExtensionSettings["provider"]> = [
        "claude",
        "openai",
        "gemini",
        "xai",
      ];
      for (const p of providers) {
        settings.provider = p;
        expect(settings.apiKeys[p]).toBe("");
      }
    });

    it("stickyChat can be toggled independently", () => {
      const withSticky: ExtensionSettings = {
        ...DEFAULT_SETTINGS,
        stickyChat: true,
      };
      expect(withSticky.stickyChat).toBe(true);
      // Other settings remain unchanged
      expect(withSticky.chatOnly).toBe(false);
      expect(withSticky.yoloMode).toBe(true);
    });
  });
});
