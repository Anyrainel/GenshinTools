import { describe, expect, it } from "vitest";
import type { Achievement } from "@/data/types";
import {
  achievementMatchesFilters,
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
    reward: 5,
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

describe("achievementMatchesFilters", () => {
  const berryPicker: Achievement = {
    ...achievement(2, 2, 1, "5.0"),
    name: "Berry Picker",
    description: "Find the hidden berries.",
  };

  it("treats empty search and chip groups as no filter", () => {
    expect(
      achievementMatchesFilters(
        berryPicker,
        "   ",
        new Set(),
        new Set(),
        new Set()
      )
    ).toBe(true);
  });

  it("matches every whitespace-separated search term across item text", () => {
    expect(
      achievementMatchesFilters(
        berryPicker,
        "  HIDDEN   picker  ",
        new Set(),
        new Set(),
        new Set()
      )
    ).toBe(true);
    expect(
      achievementMatchesFilters(
        berryPicker,
        "hidden apple",
        new Set(),
        new Set(),
        new Set()
      )
    ).toBe(false);
  });

  it("ignores contradictory chip filters while item search is active", () => {
    expect(
      achievementMatchesFilters(
        berryPicker,
        "hidden picker",
        new Set(["unfinished"]),
        new Set([4]),
        new Set([berryPicker.id])
      )
    ).toBe(true);
  });

  it("applies status and major-version chips to an individual item", () => {
    expect(
      achievementMatchesFilters(
        berryPicker,
        " \t ",
        new Set(["finished"]),
        new Set([5]),
        new Set([berryPicker.id])
      )
    ).toBe(true);
    expect(
      achievementMatchesFilters(
        berryPicker,
        "",
        new Set(["unfinished"]),
        new Set([5]),
        new Set([berryPicker.id])
      )
    ).toBe(false);
    expect(
      achievementMatchesFilters(
        berryPicker,
        "",
        new Set(["finished"]),
        new Set([4]),
        new Set([berryPicker.id])
      )
    ).toBe(false);
  });
});
