import { describe, expect, it } from "vitest";
import { expandAchievementReferenceData } from "@/data/achievementData";
import type { AchievementReferenceData, AchievementReferenceText } from "@/data/types";

const logic: AchievementReferenceData = { categories: [{ id: 0, order: 1, achievements: [[
  { id: 1, order: 1, reward: 5 }, { id: 2, order: 2, reward: 10 },
]] }] };
const text: AchievementReferenceText = {
  categories: { "0": "Category" }, descriptionTemplates: ["Follow {0} Seelie."],
  achievements: { "1": { name: "Explorer", desc: [0, 8] }, "2": { name: "Explorer", desc: "More exploration." } },
};
describe("split achievement ingestion", () => {
  it("joins category names and descriptions while retaining nested groups", () => {
    const result = expandAchievementReferenceData(logic, text);
    expect(result.categories[0]).toEqual({ id: 0, order: 1, name: "Category" });
    expect(result.achievements[0]).toMatchObject({ description: "Follow 8 Seelie.", categoryId: 0, groupId: 1 });
    expect(result.achievements[1]).toMatchObject({ groupId: 1, reward: 10 });
  });
  it("rejects missing translations and corrupt template parameters", () => {
    expect(() => expandAchievementReferenceData(logic, { ...text, categories: {} })).toThrow("category text");
    expect(() => expandAchievementReferenceData(logic, { ...text, achievements: {} })).toThrow("achievement text");
    expect(() => expandAchievementReferenceData(logic, { ...text, descriptionTemplates: [] })).toThrow("template 0");
    expect(() => expandAchievementReferenceData(logic, { ...text, descriptionTemplates: ["Need {1}"] })).toThrow("Missing value");
  });
});
