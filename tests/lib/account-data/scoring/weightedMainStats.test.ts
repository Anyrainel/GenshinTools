/**
 * Unit tests for weighted main-stat valuation in the scoreUp scoring path:
 * - getTargetMainStatWeightsForSlot (effective weight per accepted main stat)
 * - scoreSlotWithMainStatWeights (weighted main + substat slot score)
 * - computeWeightedCrDeduction (CR cap with per-source credit rates)
 * - scoreWithBuilds resolver form (build-dependent CR budget)
 */

import { describe, expect, it } from "vitest";
import { SUBSTAT_COEFFICIENTS } from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/enums";
import type {
  ArtifactData,
  Build,
  CharacterData,
  GlobalStatWeights,
} from "@/data/types";
import {
  getTargetMainStatsForSlot,
  getTargetMainStatWeightsForSlot,
  type StatWeightMap,
  scoreMainStat,
  scoreSlot,
  scoreSlotWithMainStatWeights,
  scoreWithBuilds,
} from "@/lib/artifact/scoring/artifactScore";
import { MAIN_STAT_CD_EQUIV_5STAR } from "@/lib/artifact/scoring/constants";
import {
  computeCrDeduction,
  computeWeightedCrDeduction,
} from "@/lib/artifact/scoring/utils";

const GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 100,
  flatHp: 100,
  flatDef: 100,
};

function makeBuild(overrides?: Partial<Build>): Build {
  return {
    id: "test-build",
    characterId: "test-char",
    name: "test",
    visible: true,
    composition: "4pc",
    artifactSet: "set_b",
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
    normalizer: 1,
    ...overrides,
  };
}

function artifact(
  slot: Slot,
  mainStatKey: MainStat,
  substats: Partial<Record<SubStat, number>> = {},
  overrides: Partial<ArtifactData> = {}
): ArtifactData {
  return {
    id: `art-${slot}-${mainStatKey}`,
    setKey: "set_b",
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey,
    lock: false,
    substats,
    ...overrides,
  };
}

describe("getTargetMainStatWeightsForSlot", () => {
  it("flower and plume return fixed hp/atk at weight 100", () => {
    const build = makeBuild();
    const flower = getTargetMainStatWeightsForSlot("flower", build);
    expect(flower.size).toBe(1);
    expect(flower.get("hp")).toBe(100);

    const plume = getTargetMainStatWeightsForSlot("plume", build);
    expect(plume.size).toBe(1);
    expect(plume.get("atk")).toBe(100);
  });

  it("recommended path carries each per-slot main stat at the build's weight", () => {
    const build = makeBuild({
      sandsWeights: [
        { stat: "atk%", weight: 100 },
        { stat: "er", weight: 75 },
      ],
    });
    const sands = getTargetMainStatWeightsForSlot("sands", build);
    expect(sands.size).toBe(2);
    expect(sands.get("atk%")).toBe(100);
    expect(sands.get("er")).toBe(75);
  });

  it("cdEquiv override scales the weight by cdEquiv / MAIN_STAT_CD_EQUIV_5STAR", () => {
    const build = makeBuild({
      gobletWeights: [{ stat: "pyro%", weight: 100, cdEquiv: 70 }],
    });
    const goblet = getTargetMainStatWeightsForSlot("goblet", build);
    expect(goblet.size).toBe(1);
    expect(goblet.get("pyro%")).toBeCloseTo(
      (100 * 70) / MAIN_STAT_CD_EQUIV_5STAR,
      8
    );
  });

  it("DPS cr/cd circlet expansion gives the missing crit stat weight 100", () => {
    const build = makeBuild({
      roles: ["dps"],
      circletWeights: [{ stat: "cr", weight: 100 }],
    });
    const circlet = getTargetMainStatWeightsForSlot("circlet", build);
    expect(circlet.size).toBe(2);
    expect(circlet.get("cr")).toBe(100);
    expect(circlet.get("cd")).toBe(100);
  });

  it("equipped main stat with positive substat weight falls back to weight 100", () => {
    const build = makeBuild({ sandsWeights: [] });
    const equipped = artifact("sands", "em");
    const sands = getTargetMainStatWeightsForSlot("sands", build, equipped);
    expect(sands.size).toBe(1);
    expect(sands.get("em")).toBe(100);
  });

  it("weight>40 substat fallback assigns 100 each and excludes flat hp/atk/def", () => {
    const build = makeBuild({
      circletWeights: [],
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 95 },
        { stat: "atk%", weight: 80 },
        { stat: "hp%", weight: 60 },
        { stat: "def%", weight: 50 },
        { stat: "er", weight: 15 },
      ],
    });
    const circlet = getTargetMainStatWeightsForSlot("circlet", build);
    expect(circlet.size).toBe(5);
    for (const stat of ["cr", "cd", "atk%", "hp%", "def%"] as const) {
      expect(circlet.get(stat)).toBe(100);
    }
    // Regression: flat stats inherit weight from their % counterpart
    // (atk=80, hp=60, def=50 here) and used to leak into the fallback.
    const keys = [...circlet.keys()] as string[];
    expect(keys).not.toContain("atk");
    expect(keys).not.toContain("hp");
    expect(keys).not.toContain("def");
    expect(keys).not.toContain("er");
  });

  it("weight>40 fallback keeps em — a valid main stat, unlike flat hp/atk/def", () => {
    // Regression: em used to be dropped because isFlatStat (a display-format
    // predicate) counts em as flat, leaving EM-weighted builds with no
    // per-slot main weights an empty target set.
    const build = makeBuild({
      circletWeights: [],
      substats: [
        { stat: "em", weight: 100 },
        { stat: "er", weight: 15 },
      ],
    });
    const circlet = getTargetMainStatWeightsForSlot("circlet", build);
    expect(circlet.get("em")).toBe(100);
    expect(circlet.size).toBe(1);

    const legacy = getTargetMainStatsForSlot("circlet", build);
    expect(legacy.has("em")).toBe(true);
    expect(legacy.size).toBe(1);
  });
});

describe("scoreSlotWithMainStatWeights", () => {
  const weights: StatWeightMap = { cr: 100, cd: 100, "atk%": 80 };

  it("main stat contributes scoreMainStat scaled linearly by weight/100", () => {
    const sands = artifact("sands", "atk%", { cr: 7.8, cd: 14.0 });
    const subOnly = scoreSlot(sands, weights);
    const full = scoreSlotWithMainStatWeights(
      sands,
      weights,
      new Map([["atk%", 100]])
    );
    const half = scoreSlotWithMainStatWeights(
      sands,
      weights,
      new Map([["atk%", 50]])
    );
    const mainAtLevel = scoreMainStat("atk%", 5, 20);
    expect(full - subOnly).toBeCloseTo(mainAtLevel, 8);
    expect(half - subOnly).toBeCloseTo(mainAtLevel / 2, 8);
  });

  it("flat hp/atk main stats contribute nothing even when weighted", () => {
    const flower = artifact("flower", "hp", { cr: 7.0, cd: 7.8 });
    const plume = artifact("plume", "atk", { cr: 3.5, cd: 21.0 });
    expect(
      scoreSlotWithMainStatWeights(flower, weights, new Map([["hp", 100]]))
    ).toBeCloseTo(scoreSlot(flower, weights), 8);
    expect(
      scoreSlotWithMainStatWeights(plume, weights, new Map([["atk", 100]]))
    ).toBeCloseTo(scoreSlot(plume, weights), 8);
  });

  it("weight 0 or missing main stat yields substats only", () => {
    const goblet = artifact("goblet", "pyro%", { cr: 7.0, cd: 14.8 });
    const subOnly = scoreSlot(goblet, weights);
    expect(scoreSlotWithMainStatWeights(goblet, weights, new Map())).toBe(
      subOnly
    );
    expect(
      scoreSlotWithMainStatWeights(goblet, weights, new Map([["pyro%", 0]]))
    ).toBe(subOnly);
  });

  it("scoreMainStat at 5-star +20 is within 0.1 of MAIN_STAT_CD_EQUIV_5STAR for all main stats", () => {
    const stats: MainStat[] = [
      "atk%",
      "em",
      "er",
      "cr",
      "cd",
      "pyro%",
      "phys%",
      "heal%",
    ];
    for (const stat of stats) {
      expect(
        Math.abs(scoreMainStat(stat, 5, 20) - MAIN_STAT_CD_EQUIV_5STAR)
      ).toBeLessThan(0.1);
    }
  });
});

describe("computeWeightedCrDeduction", () => {
  const crCoeff = SUBSTAT_COEFFICIENTS.cr;

  it("single source matches computeCrDeduction exactly", () => {
    expect(
      computeWeightedCrDeduction([{ amount: 0.5, weightPct: 80 }], 0.6)
    ).toBeCloseTo(computeCrDeduction(0.5, 0.6, 80), 10);
    // Under budget: both deduct nothing
    expect(
      computeWeightedCrDeduction([{ amount: 0.3, weightPct: 80 }], 0.6)
    ).toBe(computeCrDeduction(0.3, 0.6, 80));
  });

  it("over cap, adding CR to a source raises the deduction by exactly that source's credit rate", () => {
    // Budget = 0.6, source A (weight 100) already spills over → B fully excess
    const base = [
      { amount: 0.7, weightPct: 100 },
      { amount: 0.3, weightPct: 60 },
    ];
    const baseDeduction = computeWeightedCrDeduction(base, 0.4);

    const moreA = computeWeightedCrDeduction(
      [
        { amount: 0.75, weightPct: 100 },
        { amount: 0.3, weightPct: 60 },
      ],
      0.4
    );
    expect(moreA - baseDeduction).toBeCloseTo(
      0.05 * 100 * crCoeff * (100 / 100),
      10
    );

    const moreB = computeWeightedCrDeduction(
      [
        { amount: 0.7, weightPct: 100 },
        { amount: 0.35, weightPct: 60 },
      ],
      0.4
    );
    expect(moreB - baseDeduction).toBeCloseTo(
      0.05 * 100 * crCoeff * (60 / 100),
      10
    );
  });

  it("budget keeps the higher-weighted source first regardless of input order", () => {
    // Budget = 0.7: the 100-weight 0.5 is kept whole, the 60-weight source
    // keeps 0.2 and its remaining 0.2 is deducted at its own 60% rate.
    const sources = [
      { amount: 0.4, weightPct: 60 },
      { amount: 0.5, weightPct: 100 },
    ];
    const expected = 0.2 * 100 * crCoeff * (60 / 100);
    expect(computeWeightedCrDeduction(sources, 0.3)).toBeCloseTo(expected, 10);
    expect(computeWeightedCrDeduction([...sources].reverse(), 0.3)).toBeCloseTo(
      expected,
      10
    );
    // Deducting the low-weight excess is cheaper than spilling the
    // high-weight source would have been.
    expect(expected).toBeLessThan(0.2 * 100 * crCoeff * (100 / 100));
  });

  it("nonArtifactCr > 1 clamps the budget to 0 and deducts exactly what was credited", () => {
    const sources = [
      { amount: 0.3, weightPct: 100 },
      { amount: 0.2, weightPct: 50 },
    ];
    const totalCredit =
      0.3 * 100 * crCoeff * (100 / 100) + 0.2 * 100 * crCoeff * (50 / 100);
    expect(computeWeightedCrDeduction(sources, 1.5)).toBeCloseTo(
      totalCredit,
      10
    );
  });
});

describe("scoreWithBuilds resolver form", () => {
  // 3 pieces of set_b equipped, 30.0 total CR substat (0.30 decimal)
  const char: CharacterData = {
    key: "test-char",
    constellation: 0,
    level: 90,
    talent: { auto: 9, skill: 9, burst: 9 },
    artifacts: {
      flower: artifact("flower", "hp", { cr: 10.5, cd: 14.0 }, { id: "f1" }),
      plume: artifact("plume", "atk", { cr: 10.5, cd: 7.0 }, { id: "p1" }),
      sands: artifact("sands", "atk%", { cr: 9.0, cd: 7.0 }, { id: "s1" }),
    },
  };
  const buildA = makeBuild({ id: "build-a", artifactSet: "set_a" });
  const buildB = makeBuild({ id: "build-b", artifactSet: "set_b" });

  it("resolver receives the matched build and its return clamps the substat score", () => {
    const resolverCalls: string[] = [];
    const resolved = scoreWithBuilds(
      char,
      [buildA, buildB],
      GLOBAL_CONFIG,
      (build) => {
        resolverCalls.push(build.id);
        return 0.9;
      }
    )!;
    expect(resolved.buildMatch.build.id).toBe("build-b");
    expect(resolverCalls).toEqual(["build-b"]);

    const numberForm = scoreWithBuilds(
      char,
      [buildA, buildB],
      GLOBAL_CONFIG,
      0.9
    )!;
    expect(resolved.substatScore.subScore).toBeCloseTo(
      numberForm.substatScore.subScore,
      10
    );

    // Budget 0.1 against 0.30 artifact CR → 0.20 excess deducted at cr weight 100
    const unclamped = scoreWithBuilds(char, [buildA, buildB], GLOBAL_CONFIG)!;
    expect(resolved.substatScore.subScore).toBeLessThan(
      unclamped.substatScore.subScore
    );
    expect(
      unclamped.substatScore.subScore - resolved.substatScore.subScore
    ).toBeCloseTo(computeCrDeduction(0.3, 0.9, 100), 6);
  });
});
