import { describe, expect, it } from "vitest";

import {
  erPercentToInternal,
  findMatchingTeams,
} from "@/lib/ercalc/teamStoreIntegration";
import type { Team } from "@/stores/useTeamStore";

// Minimal Team mock for testing
function mockTeam(id: string, chars: (string | null)[]): Team {
  return {
    id,
    name: "",
    characters: chars,
    weapons: [null, null, null, null],
    artifacts: [null, null, null, null],
    reactions: [],
    opts: {},
    minEr: {},
    selectedFormula: null,
    optimizationResult: null,
    formulaMode: "single",
    combos: [],
    selectedCombo: null,
  };
}

describe("findMatchingTeams", () => {
  const teams: Team[] = [
    mockTeam("t1", ["bennett", "xiangling", "xingqiu", "sucrose"]),
    mockTeam("t2", ["raiden_shogun", "bennett", "xiangling", "xingqiu"]),
    mockTeam("t3", ["hu_tao", "xingqiu", "yelan", "zhongli"]),
  ];

  it("finds exact character match (order-independent)", () => {
    // Same chars, different order
    const result = findMatchingTeams(teams, [
      "sucrose",
      "bennett",
      "xiangling",
      "xingqiu",
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
  });

  it("returns empty for no match", () => {
    const result = findMatchingTeams(teams, [
      "ganyu",
      "mona",
      "venti",
      "diona",
    ]);
    expect(result).toHaveLength(0);
  });

  it("handles partial match (wrong count)", () => {
    const result = findMatchingTeams(teams, [
      "bennett",
      "xiangling",
      "xingqiu",
    ]);
    expect(result).toHaveLength(0); // 3 chars doesn't match 4-char teams
  });
});

describe("erPercentToInternal", () => {
  it("converts 183% to 1.83", () => {
    expect(erPercentToInternal(183)).toBe(1.83);
  });

  it("rounds up fractional ER", () => {
    expect(erPercentToInternal(183.4)).toBe(1.84);
  });

  it("converts 100% to 1.0", () => {
    expect(erPercentToInternal(100)).toBe(1);
  });
});
