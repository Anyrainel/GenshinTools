import type { Language } from "@/data/enums";
import type { Achievement } from "@/data/types";
import { itemMatchesArchiveFilterScope } from "@/lib/archiveFilters";

function getSearchTerms(query: string): string[] {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
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
  const sorted = [...achievements].sort(
    (left, right) => left.order - right.order || left.id - right.id
  );
  const groups = new Map<number, Achievement[]>();

  for (const achievement of sorted) {
    const groupId = achievement.groupId ?? achievement.id;
    const group = groups.get(groupId);
    if (group) group.push(achievement);
    else groups.set(groupId, [achievement]);
  }

  return [...groups.values()].map((series) =>
    series.sort((left, right) => left.order - right.order || left.id - right.id)
  );
}

export function achievementMatchesFilters(
  achievement: Achievement,
  query: string,
  statuses: ReadonlySet<"unfinished" | "finished">,
  versions: ReadonlySet<number>,
  earnedIds: ReadonlySet<number>
): boolean {
  return itemMatchesArchiveFilterScope(
    achievement,
    query,
    (item, normalizedSearch) => {
      const searchTerms = getSearchTerms(normalizedSearch);
      const searchText =
        `${item.name}\n${item.description}`.toLocaleLowerCase();
      return searchTerms.every((term) => searchText.includes(term));
    },
    (item) => {
      const finished = earnedIds.has(item.id);
      if (
        statuses.size > 0 &&
        !statuses.has(finished ? "finished" : "unfinished")
      ) {
        return false;
      }

      if (versions.size > 0) {
        const majorVersion = Number.parseInt(item.version ?? "", 10);
        if (!versions.has(majorVersion)) return false;
      }

      return true;
    }
  );
}
