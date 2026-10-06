import { describe, expect, it } from "vitest";
import { expandAchievementReferenceData } from "@/data/achievementData";
import logic from "@/data/game/achievements.json";
import en from "@/data/game/achievements_en.json";
import zh from "@/data/game/achievements_zh.json";
import type { AchievementReferenceText } from "@/data/types";

describe("published split achievement data", () => {
  it("joins every title and description in both languages to the same groups", () => {
    const english = expandAchievementReferenceData(
      logic,
      en as AchievementReferenceText
    );
    const chinese = expandAchievementReferenceData(
      logic,
      zh as AchievementReferenceText
    );
    expect(english.categories).toHaveLength(73);
    expect(english.achievements).toHaveLength(1854);
    expect(new Set(english.achievements.map((entry) => entry.id)).size).toBe(
      1854
    );
    expect(
      english.achievements.map(({ id, groupId }) => [id, groupId])
    ).toEqual(chinese.achievements.map(({ id, groupId }) => [id, groupId]));
    expect(
      logic.categories
        .flatMap((category) => category.achievements)
        .filter((group) => group.length === 3)
    ).toHaveLength(148);
    expect(
      english.achievements.every(
        (entry) => entry.name && entry.description && entry.version
      )
    ).toBe(true);
  });

  it("includes the 7.1 definitions in both languages and preserves the legacy exclusion", () => {
    for (const text of [en, zh]) {
      const data = expandAchievementReferenceData(
        logic,
        text as AchievementReferenceText
      );
      const byId = new Map(data.achievements.map((entry) => [entry.id, entry]));
      const addedIds = [
        81732, 82312, 84399, 84400, 84401, 84402, 84403, 84404, 84405, 84406,
      ];
      expect(
        data.achievements.filter((entry) => entry.version === "7.1")
      ).toHaveLength(10);
      for (const id of addedIds) {
        expect(byId.get(id)).toMatchObject({ version: "7.1" });
      }
      expect(byId.has(84517)).toBe(false);
    }
  });
});
