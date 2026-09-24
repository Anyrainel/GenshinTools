import type {
  AchievementData,
  AchievementReferenceData,
  AchievementReferenceText,
} from "./types";

export function expandAchievementReferenceData(
  logic: AchievementReferenceData,
  text: AchievementReferenceText
): AchievementData {
  const result: AchievementData = { categories: [], achievements: [] };
  const ids = new Set<number>();
  for (const category of logic.categories) {
    const name = text.categories[category.id];
    if (!name)
      throw new Error(`Missing achievement category text ${category.id}`);
    result.categories.push({ id: category.id, order: category.order, name });
    for (const group of category.achievements) {
      if (!group.length) throw new Error("Empty achievement display group");
      for (const entry of group) {
        if (ids.has(entry.id))
          throw new Error(`Duplicate achievement ${entry.id}`);
        ids.add(entry.id);
        const localized = text.achievements[entry.id];
        if (!localized?.name || !localized.desc)
          throw new Error(`Missing achievement text ${entry.id}`);
        let description = localized.desc;
        if (typeof description !== "string") {
          const [templateId, ...params] = description;
          const template = text.descriptionTemplates?.[templateId];
          if (template === undefined)
            throw new Error(
              `Missing achievement description template ${templateId}`
            );
          description = template.replace(/\{(\d+)\}/g, (placeholder, index) => {
            const value = params[Number(index)];
            if (value === undefined)
              throw new Error(
                `Missing value for ${placeholder} in achievement ${entry.id}`
              );
            return String(value);
          });
        }
        result.achievements.push({
          ...entry,
          categoryId: category.id,
          name: localized.name,
          description,
          ...(group.length > 1 ? { groupId: group[0].id } : {}),
        });
      }
    }
  }
  return result;
}
