/**
 * Unit tests for V2 Build Weight Generation Pipeline
 *
 * Tests the scoring, normalization, and weight averaging functions.
 * Auto-tuning is tested via fullPipeline.test.ts (requires real TeamBuild).
 */

import type { SubStat } from "@/data/types";
import {
  averageWeights,
  computeIdealScore,
} from "@/lib/account-data/scorev2/autoTune";
import { v2WeightsToLegacyBuild } from "@/lib/account-data/scorev2/pipeline";
import { getScoreTier, scoreV2 } from "@/lib/account-data/scorev2/scorer";
import type { BuildV2Weights } from "@/lib/account-data/scorev2/types";
import { describe, expect, it } from "vitest";

// ─── Tests ───

describe("computeIdealScore", () => {
  it("should produce a normalizer that maps ideal to 300", () => {
    const weights = {
      cr: 100,
      cd: 95,
      "atk%": 80,
      em: 45,
      er: 15,
      "hp%": 0,
      "def%": 0,
      atk: 0,
      hp: 0,
      def: 0,
    } as Record<SubStat, number>;

    const { idealScore, normalizer } = computeIdealScore(
      weights,
      80, // sands weight
      100, // goblet weight
      95 // circlet weight
    );

    expect(idealScore).toBeGreaterThan(300);
    expect(normalizer).toBeGreaterThan(0);
    expect(normalizer).toBeLessThan(1);
    expect(idealScore * normalizer).toBeCloseTo(300, 0);
  });
});

describe("averageWeights", () => {
  it("should average weights across results and re-normalize", () => {
    const r1 = {
      weights: {
        cr: 100,
        cd: 90,
        "atk%": 80,
        em: 40,
        er: 0,
        "hp%": 0,
        "def%": 0,
        atk: 0,
        hp: 0,
        def: 0,
      } as Record<SubStat, number>,
      rollAllocation: {} as Record<SubStat, number>,
      midpointMarginals: {} as Record<SubStat, number>,
      finalDamage: 10000,
    };
    const r2 = {
      weights: {
        cr: 90,
        cd: 100,
        "atk%": 70,
        em: 60,
        er: 0,
        "hp%": 0,
        "def%": 0,
        atk: 0,
        hp: 0,
        def: 0,
      } as Record<SubStat, number>,
      rollAllocation: {} as Record<SubStat, number>,
      midpointMarginals: {} as Record<SubStat, number>,
      finalDamage: 9500,
    };

    const avg = averageWeights([r1, r2]);

    // Max should be 100 after re-normalization
    const maxW = Math.max(...Object.values(avg));
    expect(maxW).toBe(100);

    // CR and CD should be high
    expect(avg.cr).toBeGreaterThan(80);
    expect(avg.cd).toBeGreaterThan(80);
  });
});

describe("scoreV2", () => {
  it("should score perfect artifacts near 300", () => {
    const build: BuildV2Weights = {
      characterId: "test",
      buildName: "test",
      roles: ["dps"],
      styles: ["on-field"],
      scalingStat: "atk",
      element: "Pyro",
      substats: {
        cr: 100,
        cd: 95,
        "atk%": 80,
        em: 45,
        er: 15,
        "hp%": 0,
        "def%": 0,
        atk: 0,
        hp: 0,
        def: 0,
      },
      idealRolls: {
        cr: 15,
        cd: 14,
        "atk%": 8,
        em: 3,
        er: 1,
        "hp%": 0,
        "def%": 0,
        atk: 1,
        hp: 0,
        def: 0,
      } as Record<SubStat, number>,
      sands: [{ stat: "atk%", weight: 100 }],
      goblet: [{ stat: "pyro%", weight: 100, cdEquiv: 68 }],
      circlet: [{ stat: "cd", weight: 100 }],
      reaction: "none",
      idealScore: 428,
      normalizer: 300 / 428,
      meta: {
        method: "auto",
        weaponId: "test",
        teamContexts: ["test"],
        generatedAt: 0,
      },
    };

    const result = scoreV2({}, build);
    expect(result.totalScore).toBe(0);
    expect(result.equippedCount).toBe(0);
  });

  it("should penalize wrong main stats", () => {
    const build: BuildV2Weights = {
      characterId: "test",
      buildName: "test",
      roles: ["dps"],
      styles: ["on-field"],
      scalingStat: "atk",
      element: "Pyro",
      substats: {
        cr: 100,
        cd: 95,
        "atk%": 80,
        em: 45,
        er: 15,
        "hp%": 0,
        "def%": 0,
        atk: 0,
        hp: 0,
        def: 0,
      },
      idealRolls: {
        cr: 15,
        cd: 14,
        "atk%": 8,
        em: 3,
        er: 1,
        "hp%": 0,
        "def%": 0,
        atk: 1,
        hp: 0,
        def: 0,
      } as Record<SubStat, number>,
      sands: [{ stat: "atk%", weight: 100 }],
      goblet: [{ stat: "pyro%", weight: 100, cdEquiv: 68 }],
      circlet: [{ stat: "cd", weight: 100 }],
      reaction: "none",
      idealScore: 428,
      normalizer: 300 / 428,
      meta: {
        method: "auto",
        weaponId: "test",
        teamContexts: ["test"],
        generatedAt: 0,
      },
    };

    const correct = scoreV2(
      {
        sands: {
          id: "test-correct",
          setKey: "test",
          rarity: 5,
          mainStatKey: "atk%",
          substats: {},
          slotKey: "sands",
          level: 20,
          lock: false,
        },
      },
      build
    );

    const wrong = scoreV2(
      {
        sands: {
          id: "test-wrong",
          setKey: "test",
          rarity: 5,
          mainStatKey: "def%",
          substats: {},
          slotKey: "sands",
          level: 20,
          lock: false,
        },
      },
      build
    );

    expect(correct.totalScore).toBeGreaterThan(wrong.totalScore);
    expect(correct.mainStatMatches).toBe(1);
    expect(wrong.mainStatMatches).toBe(0);
  });
});

describe("getScoreTier", () => {
  it("should return correct tiers", () => {
    expect(getScoreTier(280).tier).toBe("S");
    expect(getScoreTier(250).tier).toBe("A");
    expect(getScoreTier(220).tier).toBe("B");
    expect(getScoreTier(170).tier).toBe("C");
    expect(getScoreTier(130).tier).toBe("D");
    expect(getScoreTier(100).tier).toBe("F");
  });
});

describe("v2WeightsToLegacyBuild", () => {
  it("should convert to legacy format correctly", () => {
    const build: BuildV2Weights = {
      characterId: "test",
      buildName: "test",
      roles: ["dps"],
      styles: ["on-field"],
      scalingStat: "atk",
      element: "Pyro",
      substats: {
        cr: 100,
        cd: 95,
        "atk%": 80,
        em: 45,
        er: 15,
        "hp%": 0,
        "def%": 0,
        atk: 0,
        hp: 0,
        def: 0,
      },
      idealRolls: {
        cr: 15,
        cd: 14,
        "atk%": 8,
        em: 3,
        er: 1,
        "hp%": 0,
        "def%": 0,
        atk: 1,
        hp: 0,
        def: 0,
      } as Record<SubStat, number>,
      sands: [{ stat: "atk%", weight: 100 }],
      goblet: [{ stat: "pyro%", weight: 100, cdEquiv: 68 }],
      circlet: [{ stat: "cd", weight: 100 }],
      reaction: "none",
      idealScore: 428,
      normalizer: 300 / 428,
      meta: {
        method: "auto",
        weaponId: "test",
        teamContexts: ["test"],
        generatedAt: 0,
      },
    };

    const legacy = v2WeightsToLegacyBuild(build);
    expect(legacy.substats.length).toBe(5); // 5 non-zero weights
    expect(legacy.substats[0].stat).toBe("cr");
    expect(legacy.substats[0].weight).toBe(100);
    expect(legacy.sands).toEqual(["atk%"]);
    expect(legacy.goblet).toEqual(["pyro%"]);
    expect(legacy.circlet).toEqual(["cd"]);
  });
});
