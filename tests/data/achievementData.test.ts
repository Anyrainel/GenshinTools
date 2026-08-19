import { describe, expect, it } from "vitest";
import { expandAchievementReferenceData } from "@/data/achievementData";

describe("expandAchievementReferenceData", () => {
  it("expands compact localized descriptions with positional values", () => {
    const result = expandAchievementReferenceData({
      categories: [{ id: 1, name: "Category", order: 1 }],
      descriptionTemplates: ["Follow {0} Seelie and open {1} chests."],
      achievements: [
        {
          id: 1,
          name: "Explorer",
          description: [0, 8, 10],
          categoryId: 1,
          order: 1,
          reward: 5,
        },
      ],
    });

    expect(result.achievements[0]?.description).toBe(
      "Follow 8 Seelie and open 10 chests."
    );
    expect(result.achievements[0]?.reward).toBe(5);
  });

  it("fails loudly for corrupt template references or missing values", () => {
    const base = {
      categories: [],
      achievements: [
        {
          id: 1,
          name: "Broken",
          description: [0] as [number],
          categoryId: 1,
          order: 1,
          reward: 5,
        },
      ],
    };

    expect(() =>
      expandAchievementReferenceData({ ...base, descriptionTemplates: [] })
    ).toThrow("Missing achievement description template 0");
    expect(() =>
      expandAchievementReferenceData({
        ...base,
        descriptionTemplates: ["Complete {0} trials."],
      })
    ).toThrow("Missing value for {0} in achievement 1");
  });
});
