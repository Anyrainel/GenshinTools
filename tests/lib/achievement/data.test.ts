import { describe, expect, it } from "vitest";
import achievementEn from "@/data/game/achievement_en.json";
import achievementZh from "@/data/game/achievement_zh.json";

describe("achievement reference data", () => {
  it("keeps bilingual metadata structurally aligned and fully versioned", () => {
    expect(achievementEn.categories).toHaveLength(73);
    expect(achievementEn.achievements).toHaveLength(1844);
    expect(achievementZh.categories).toHaveLength(
      achievementEn.categories.length
    );
    expect(achievementZh.achievements).toHaveLength(
      achievementEn.achievements.length
    );

    expect(achievementZh.categories.map((category) => category.id)).toEqual(
      achievementEn.categories.map((category) => category.id)
    );
    expect(
      achievementZh.achievements.map((achievement) => achievement.id)
    ).toEqual(achievementEn.achievements.map((achievement) => achievement.id));
    expect(
      achievementEn.achievements.every((achievement) =>
        /^[1-7]\.\d+$/.test(achievement.version)
      )
    ).toBe(true);
  });

  it("references existing categories and predecessor achievements", () => {
    const categoryIds = new Set(
      achievementEn.categories.map((category) => category.id)
    );
    const achievementIds = new Set(
      achievementEn.achievements.map((achievement) => achievement.id)
    );

    for (const achievement of achievementEn.achievements) {
      expect(categoryIds.has(achievement.categoryId)).toBe(true);
      if (achievement.previousId !== undefined) {
        expect(achievementIds.has(achievement.previousId)).toBe(true);
      }
    }
  });
});
