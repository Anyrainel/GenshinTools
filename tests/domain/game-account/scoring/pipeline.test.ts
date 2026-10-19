/**
 * Unit tests for Build Weight Generation Pipeline
 *
 * Tests the scoring, normalization, and weight averaging functions.
 * Auto-tuning is tested via fullPipeline.test.ts (requires real TeamBuild).
 */

import { describe, expect, it } from "vitest";
import { scoreWithBuilds } from "@/domain/build/artifact/scoring/artifactScore";
import { computeIdealScore } from "@/domain/build/artifact/scoring/utils";
import type { Slot, SubStat } from "@/domain/enums";
import type { ArtifactData, Build } from "@/domain/models";
import { averageWeights } from "@/services/builds/auto-tune/autoTune";

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

describe("scoreWithBuilds", () => {
  it("should score empty artifacts as 0", () => {
    const build = makeBuild();
    const result = scoreWithBuilds(
      {
        key: "test",
        level: 90,
        constellation: 0,
        talent: { auto: 1, skill: 1, burst: 1 },
        artifacts: {},
      },
      [build],
      { flatAtk: 30, flatHp: 30, flatDef: 30 }
    )!;
    expect(result.normalized.normalizedScore).toBe(0);
    expect(result.substatScore.isComplete).toBe(false);
  });

  it("should penalize wrong main stats", () => {
    const build = makeBuild();

    const score = (artifacts: Partial<Record<Slot, ArtifactData>>) =>
      scoreWithBuilds(
        {
          key: "test",
          level: 90,
          constellation: 0,
          talent: { auto: 1, skill: 1, burst: 1 },
          artifacts,
        },
        [build],
        { flatAtk: 30, flatHp: 30, flatDef: 30 }
      )!;
    const correct = score({
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
    });

    const wrong = score({
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
    });

    expect(correct.normalized.normalizedScore).toBeGreaterThan(
      wrong.normalized.normalizedScore
    );
    expect(correct.buildMatch.mainStatMatches).toBe(1);
    expect(wrong.buildMatch.mainStatMatches).toBe(0);
  });
});
