import { describe, expect, it } from "bun:test";
import { SUPPORTED_LOCALES, getTranslations, type LocaleCode } from "./i18n";

describe("i18n", () => {
  describe("popup_sticky_chat translations", () => {
    it("every supported locale has popup_sticky_chat defined", () => {
      for (const { code } of SUPPORTED_LOCALES) {
        const tr = getTranslations(code as LocaleCode);
        expect(tr.popup_sticky_chat).toBeTruthy();
        expect(typeof tr.popup_sticky_chat).toBe("string");
      }
    });

    it("every supported locale has popup_sticky_chat_desc defined", () => {
      for (const { code } of SUPPORTED_LOCALES) {
        const tr = getTranslations(code as LocaleCode);
        expect(tr.popup_sticky_chat_desc).toBeTruthy();
        expect(typeof tr.popup_sticky_chat_desc).toBe("string");
      }
    });

    it("English translations have expected values", () => {
      const en = getTranslations("en");
      expect(en.popup_sticky_chat).toBe("Sticky Chat");
      expect(en.popup_sticky_chat_desc).toContain("Keep chatbox open");
    });

    it("non-English locales differ from English where fully translated", () => {
      const en = getTranslations("en");
      // Full locales (not spread-based) should have unique translations
      const fullLocales: LocaleCode[] = [
        "pt-BR",
        "es",
        "fr",
        "de",
        "ja",
        "ko",
        "zh-CN",
      ];
      for (const code of fullLocales) {
        const tr = getTranslations(code);
        expect(tr.popup_sticky_chat).not.toBe(en.popup_sticky_chat);
      }
    });
  });
});
