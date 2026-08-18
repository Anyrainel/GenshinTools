import type { Achievement } from "@/data/types";

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

export function achievementSeriesMatchesFilters(
  series: readonly Achievement[],
  query: string,
  statuses: ReadonlySet<"unfinished" | "finished">,
  versions: ReadonlySet<number>,
  earnedIds: ReadonlySet<number>
): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
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

    if (!normalizedQuery) return true;
    return `${achievement.name}\n${achievement.description}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
}
