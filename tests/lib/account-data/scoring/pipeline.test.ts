/**
 * Unit tests for Build Weight Generation Pipeline
 *
 * Tests the scoring, normalization, and weight averaging functions.
 * Auto-tuning is tested via fullPipeline.test.ts (requires real TeamBuild).
 */

import type { Build, SubStat } from "@/data/types";
import {
  averageWeights,
  computeIdealScore,
} from "@/lib/artifact-builds/auto-tune/autoTune";
import { scoreNormalized } from "@/lib/artifact/scoring/scorer";
import { describe, expect, it } from "vitest";

/** Helper: create a minimal Build for scoring tests. */
function makeBuild(overrides?: Partial<Build>): Build {
  const normalizer = 300 / 428;
  return {
    id: "test",
    characterId: "test",
    name: "test",
    visible: true,
    composition: "4pc",
    roles: ["dps"],
    styles: ["on-field"],
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 95 },
      { stat: "atk%", weight: 80 },
      { stat: "em", weight: 45 },
      { stat: "er", weight: 15 },
    ],
    sandsWeights: [{ stat: "atk%", weight: 100 }],
    gobletWeights: [{ stat: "pyro%", weight: 100 }],
    circletWeights: [{ stat: "cd", weight: 100 }],
    normalizer,
    ...overrides,
  };
}

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

describe("scoreNormalized", () => {
  it("should score empty artifacts as 0", () => {
    const build = makeBuild();
    const result = scoreNormalized({}, build);
    expect(result.totalScore).toBe(0);
    expect(result.equippedCount).toBe(0);
  });

  it("should penalize wrong main stats", () => {
    const build = makeBuild();

    const correct = scoreNormalized(
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

    const wrong = scoreNormalized(
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
