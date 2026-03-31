import { describe, expect, it } from "bun:test";
import {
  EXPRESSIONS,
  DEFAULT_EXPRESSION,
  DEFAULT_AVATAR,
  getAvatarUrl,
  type Expression,
} from "./expressions";

describe("expressions", () => {
  describe("EXPRESSIONS", () => {
    it("contains all 8 expected expressions", () => {
      expect(EXPRESSIONS).toEqual([
        "neutral",
        "happy",
        "thinking",
        "surprised",
        "confused",
        "excited",
        "concerned",
        "proud",
      ]);
    });

    it("has neutral as the default expression", () => {
      expect(DEFAULT_EXPRESSION).toBe("neutral");
    });

    it("has gyoza as the default avatar", () => {
      expect(DEFAULT_AVATAR).toBe("gyoza");
    });
  });

  describe("getAvatarUrl", () => {
    it("returns static PNG path when not talking", () => {
      expect(getAvatarUrl("neutral", false)).toBe(
        "/avatars/gyoza/neutral.jpeg",
      );
    });

    it("returns talking GIF path when talking", () => {
      expect(getAvatarUrl("neutral", true)).toBe(
        "/avatars/gyoza/neutral-talking.gif",
      );
    });

    it("resolves all expressions correctly when idle", () => {
      for (const expr of EXPRESSIONS) {
        expect(getAvatarUrl(expr, false)).toBe(`/avatars/gyoza/${expr}.jpeg`);
      }
    });

    it("resolves all expressions correctly when talking", () => {
      for (const expr of EXPRESSIONS) {
        expect(getAvatarUrl(expr, true)).toBe(
          `/avatars/gyoza/${expr}-talking.gif`,
        );
      }
    });

    it("uses custom avatar folder when specified", () => {
      expect(getAvatarUrl("happy", false, "mochi")).toBe(
        "/avatars/mochi/happy.jpeg",
      );
      expect(getAvatarUrl("happy", true, "mochi")).toBe(
        "/avatars/mochi/happy-talking.gif",
      );
    });

    it("defaults to gyoza avatar when avatar param omitted", () => {
      const url = getAvatarUrl("excited", false);
      expect(url).toContain("/gyoza/");
    });
  });
});
