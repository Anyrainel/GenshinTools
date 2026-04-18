import type {
  Build,
  BuildGroup,
  GlobalStatWeights,
  TierAssignment,
} from "@/data/types";
import { evaluateAllBuilds } from "@/lib/account-data/buildEvaluation";
import {
  DEFAULT_TIER_THRESHOLDS,
  generateResourceSuggestions,
} from "@/lib/account-data/resourceTips";

const ZERO_MIN_DIFF = { S: 0, A: 0, B: 0, C: 0, D: 0, Pool: 0 } as const;
import { describe, expect, it } from "vitest";
import { createAccountData } from "../../fixtures";

const GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 30,
  flatHp: 30,
  flatDef: 30,
};

function createBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: "test-build",
    name: "",
    visible: true,
    composition: "4pc",
    sandsWeights: [{ stat: "atk%", weight: 100 }],
    gobletWeights: [{ stat: "pyro%", weight: 100 }],
    circletWeights: [{ stat: "cd", weight: 100 }],
    normalizer: 0,
    substats: [
      { stat: "cd", weight: 100 },
      { stat: "cr", weight: 100 },
      { stat: "atk%", weight: 90 },
      { stat: "em", weight: 50 },
    ],
    artifactSet: "fragment_of_harmonic_whimsy",
    characterId: "arlecchino",
    roles: ["dps"],
    ...overrides,
  };
}

function createBuildGroup(characterId: string, builds: Build[]): BuildGroup {
  return { characterId, builds };
}

describe("generateResourceSuggestions", () => {
  const emptyAccount = createAccountData();
  const build = createBuild();
  const groups = [createBuildGroup("arlecchino", [build])];

  it("returns empty array when there are no builds/setGroups", () => {
    const result = generateResourceSuggestions(
      [],
      emptyAccount,
      {},
      DEFAULT_TIER_THRESHOLDS,
      ZERO_MIN_DIFF,
      GLOBAL_CONFIG
    );
    expect(result).toEqual([]);
  });

  it("returns suggestions for a zero-completeness build (below threshold)", () => {
    const setGroups = evaluateAllBuilds(
      groups,
      emptyAccount,
      GLOBAL_CONFIG,
      false
    );
    // Completeness is 0 (empty account) — well below any tier threshold
    const result = generateResourceSuggestions(
      setGroups,
      emptyAccount,
      {},
      DEFAULT_TIER_THRESHOLDS,
      ZERO_MIN_DIFF,
      GLOBAL_CONFIG
    );
    expect(result.length).toBeGreaterThan(0);
    // All suggestions are sorted by expectedScoreGain descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].expectedScoreGain).toBeGreaterThanOrEqual(
        result[i].expectedScoreGain
      );
    }
    // Untiered character defaults to Pool tier
    expect(result[0].tier).toBe("Pool");
    // v1 without reroll sources → all craft suggestions
    expect(result.every((s) => s.kind === "craft")).toBe(true);
    // Each suggestion has reasonable numeric fields
    for (const s of result) {
      expect(s.expectedScoreGain).toBeGreaterThan(0);
      // pUpgrade is -1 (pending) — real value computed async by UI layer.
      expect(s.pUpgrade).toBe(-1);
      expect(s.lockedSubs).toHaveLength(2);
      expect(s.lockedSubs[0]).not.toBe(s.lockedSubs[1]);
    }
  });

  it("filters out builds whose tier threshold is zero", () => {
    const setGroups = evaluateAllBuilds(
      groups,
      emptyAccount,
      GLOBAL_CONFIG,
      false
    );
    const zeroThresholds = {
      S: 0,
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      Pool: 0,
    } as const;
    const result = generateResourceSuggestions(
      setGroups,
      emptyAccount,
      {},
      zeroThresholds,
      ZERO_MIN_DIFF,
      GLOBAL_CONFIG
    );
    expect(result).toEqual([]);
  });

  it("respects tier assignments from tierAssignments map", () => {
    const setGroups = evaluateAllBuilds(
      groups,
      emptyAccount,
      GLOBAL_CONFIG,
      false
    );
    const tierAssignments: TierAssignment = {
      arlecchino: { tier: "S", position: 0 },
    };
    const result = generateResourceSuggestions(
      setGroups,
      emptyAccount,
      tierAssignments,
      DEFAULT_TIER_THRESHOLDS,
      ZERO_MIN_DIFF,
      GLOBAL_CONFIG
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s.tier === "S")).toBe(true);
  });
});
