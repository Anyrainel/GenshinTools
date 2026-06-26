import { describe, expect, it } from "vitest";
import type { EvalBuild } from "@/lib/account-data/buildEvaluation";
import {
  type ResourceSuggestion,
  summarizeResourceSuggestionsBySet,
} from "@/lib/account-data/resourceTips";

function makeSuggestion(
  overrides: Partial<ResourceSuggestion> & Pick<ResourceSuggestion, "setId">
): ResourceSuggestion {
  return {
    kind: "craft",
    actionBadge: { type: "count", value: 1 },
    characterIds: ["hu_tao"],
    tier: "S",
    buildKey: "build-1",
    evalBuild: { artifactSet: overrides.setId } as EvalBuild,
    slot: "flower",
    mainStat: "hp%",
    displayStats: { main: "hp%", subs: ["cr", "cd"] },
    lockedSubs: ["cr", "cd"],
    expectedScoreGain: 10,
    baselineScore: 50,
    pUpgrade: -1,
    ...overrides,
  };
}

describe("summarizeResourceSuggestionsBySet", () => {
  it("returns count and average gain per set, sorted by avg gain desc", () => {
    const summaries = summarizeResourceSuggestionsBySet([
      makeSuggestion({
        setId: "emblem_of_severed_fate",
        expectedScoreGain: 20,
      }),
      makeSuggestion({
        setId: "emblem_of_severed_fate",
        expectedScoreGain: 10,
      }),
      makeSuggestion({
        setId: "crimson_witch_of_flames",
        expectedScoreGain: 30,
      }),
    ]);

    expect(summaries).toEqual([
      {
        setId: "crimson_witch_of_flames",
        count: 1,
        avgExpectedScoreGain: 30,
      },
      {
        setId: "emblem_of_severed_fate",
        count: 2,
        avgExpectedScoreGain: 15,
      },
    ]);
  });

  it("returns an empty array when there are no suggestions", () => {
    expect(summarizeResourceSuggestionsBySet([])).toEqual([]);
  });
});
