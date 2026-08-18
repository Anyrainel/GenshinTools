import { describe, expect, it } from "vitest";
import type { Achievement } from "@/data/types";
import {
  achievementSeriesMatchesFilters,
  buildAchievementVideoSearchUrl,
  groupAchievementSeries,
} from "@/lib/achievement/utils";

function achievement(
  id: number,
  order: number,
  previousId?: number,
  version = "5.0"
): Achievement {
  return {
    id,
    name: `Achievement ${id}`,
    description: `Description ${id}`,
    categoryId: 1,
    order,
    version,
    ...(previousId === undefined ? {} : { previousId }),
  };
}

describe("buildAchievementVideoSearchUrl", () => {
  it("adds the localized game name to each site's search query", () => {
    expect(buildAchievementVideoSearchUrl("youtube", "Explorer", "en")).toBe(
      "https://www.youtube.com/results?search_query=Explorer%20Genshin%20Impact"
    );
    expect(buildAchievementVideoSearchUrl("bilibili", "探索者", "zh")).toBe(
      "https://search.bilibili.com/all?keyword=%E6%8E%A2%E7%B4%A2%E8%80%85%20%E5%8E%9F%E7%A5%9E"
    );
  });
});

describe("groupAchievementSeries", () => {
  it("groups predecessor chains and preserves achievement order", () => {
    expect(
      groupAchievementSeries([
        achievement(30, 3, 20),
        achievement(10, 1),
        achievement(40, 4),
        achievement(20, 2, 10),
      ]).map((series) => series.map((item) => item.id))
    ).toEqual([[10, 20, 30], [40]]);
  });

  it("does not loop forever on corrupt predecessor cycles", () => {
    expect(
      groupAchievementSeries([achievement(1, 1, 2), achievement(2, 2, 1)])
    ).toHaveLength(2);
  });
});

describe("achievementSeriesMatchesFilters", () => {
  const series = [
    achievement(1, 1, undefined, "4.8"),
    achievement(2, 2, 1, "5.0"),
  ];

  it("treats an empty chip group as no filter", () => {
    expect(
      achievementSeriesMatchesFilters(
        series,
        "",
        new Set(),
        new Set(),
        new Set()
      )
    ).toBe(true);
  });

  it("matches status, major version, and text against any series step", () => {
    expect(
      achievementSeriesMatchesFilters(
        series,
        "description 2",
        new Set(["finished"]),
        new Set([5]),
        new Set([2])
      )
    ).toBe(true);
    expect(
      achievementSeriesMatchesFilters(
        series,
        "description 2",
        new Set(["unfinished"]),
        new Set([4]),
        new Set([2])
      )
    ).toBe(false);
  });
});
