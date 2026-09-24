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
    expect(english.achievements).toHaveLength(1844);
    expect(new Set(english.achievements.map((entry) => entry.id)).size).toBe(
      1844
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
});
