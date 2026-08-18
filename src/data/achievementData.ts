import type { AchievementData, AchievementReferenceData } from "./types";

export function expandAchievementReferenceData(
  reference: AchievementReferenceData
): AchievementData {
  return {
    categories: reference.categories,
    achievements: reference.achievements.map((achievement) => {
      if (typeof achievement.description === "string") {
        return { ...achievement, description: achievement.description };
      }

      const [templateId, ...params] = achievement.description;
      const template = reference.descriptionTemplates[templateId];
      if (template === undefined) {
        throw new Error(
          `Missing achievement description template ${templateId}`
        );
      }

      const description = template.replace(
        /\{(\d+)\}/g,
        (placeholder, index) => {
          const value = params[Number(index)];
          if (value === undefined) {
            throw new Error(
              `Missing value for ${placeholder} in achievement ${achievement.id}`
            );
          }
          return String(value);
        }
      );

      return { ...achievement, description };
    }),
  };
}
