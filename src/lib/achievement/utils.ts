import type { Language } from "@/data/enums";
import type { Achievement, AchievementCategory } from "@/data/types";

function textMatchesQuery(text: string, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return (
    normalizedQuery.length === 0 ||
    text.toLocaleLowerCase().includes(normalizedQuery)
  );
}

export function buildAchievementVideoSearchUrl(
  site: "youtube" | "bilibili",
  achievementName: string,
  language: Language
): string {
  const gameName = language === "zh" ? "原神" : "Genshin Impact";
  const query = encodeURIComponent(`${achievementName} ${gameName}`);
  return site === "youtube"
    ? `https://www.youtube.com/results?search_query=${query}`
    : `https://search.bilibili.com/all?keyword=${query}`;
}

export function groupAchievementSeries(
  achievements: readonly Achievement[]
): Achievement[][] {
  const byId = new Map(
    achievements.map((achievement) => [achievement.id, achievement])
  );
  const sorted = [...achievements].sort(
    (left, right) => left.order - right.order || left.id - right.id
  );
  const groups = new Map<number, Achievement[]>();

  for (const achievement of sorted) {
    let root = achievement;
    const visited = new Set<number>([achievement.id]);
    while (root.previousId !== undefined) {
      const previous = byId.get(root.previousId);
      if (!previous || visited.has(previous.id)) break;
      visited.add(previous.id);
      root = previous;
    }

    const group = groups.get(root.id);
    if (group) group.push(achievement);
    else groups.set(root.id, [achievement]);
  }

  return [...groups.values()].map((series) =>
    series.sort((left, right) => left.order - right.order || left.id - right.id)
  );
}

export function achievementCategoryMatchesStatusFilter(
  achievements: readonly Achievement[],
  statuses: ReadonlySet<"unfinished" | "finished">,
  earnedIds: ReadonlySet<number>
): boolean {
  if (statuses.size !== 1 || !statuses.has("unfinished")) return true;
  return achievements.some((achievement) => !earnedIds.has(achievement.id));
}

export function achievementCategoryNameMatchesQuery(
  category: AchievementCategory,
  query: string
): boolean {
  return textMatchesQuery(category.name, query);
}

export function achievementCategoryMatchesQuery(
  category: AchievementCategory,
  achievements: readonly Achievement[],
  query: string
): boolean {
  if (achievementCategoryNameMatchesQuery(category, query)) return true;
  return achievements.some((achievement) =>
    textMatchesQuery(`${achievement.name}\n${achievement.description}`, query)
  );
}

export function achievementSeriesMatchesFilters(
  series: readonly Achievement[],
  query: string,
  statuses: ReadonlySet<"unfinished" | "finished">,
  versions: ReadonlySet<number>,
  earnedIds: ReadonlySet<number>
): boolean {
  return series.some((achievement) => {
    const finished = earnedIds.has(achievement.id);
    if (
      statuses.size > 0 &&
      !statuses.has(finished ? "finished" : "unfinished")
    ) {
      return false;
    }

    if (versions.size > 0) {
      const majorVersion = Number.parseInt(achievement.version ?? "", 10);
      if (!versions.has(majorVersion)) return false;
    }

    return textMatchesQuery(
      `${achievement.name}\n${achievement.description}`,
      query
    );
  });
}
