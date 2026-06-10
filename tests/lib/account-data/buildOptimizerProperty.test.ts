import { describe, expect, it } from "vitest";
import type { MainStat, Slot, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import {
  type BuildOptimizerConfig,
  enumerateBuilds,
  type OptimizedBuild,
  optimizeBuild,
  scoreFullBuild,
} from "@/lib/account-data/buildOptimizer";
import type { CandidateArtifact } from "@/lib/account-data/candidatePool";
import type { CrBudgetResult } from "@/lib/account-data/maxCrBuff";
import { enumerateConcreteTwoPieceSetPairs } from "@/lib/account-data/setConstraints";
import type { StatWeightMap } from "@/lib/artifact/scoring/artifactScore";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function crBudget(totalNonArtifactCr: number): CrBudgetResult {
  return {
    baseCr: 0.05,
    ascensionCr: 0,
    characterBuffCr: 0,
    weaponSecondaryCr: 0,
    weaponPassiveCr: 0,
    artifactSetCr: 0,
    totalNonArtifactCr,
  };
}

function candidate(
  slot: Slot,
  id: string,
  setKey: string,
  mainStatKey: MainStat,
  substats: Partial<Record<SubStat, number>>
): CandidateArtifact {
  return {
    id,
    setKey,
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey,
    lock: false,
    substats,
    source: "swap",
    sourceArtifactId: id,
  };
}

const FOUR_PC_SET = "OnSet";
const OFF_SET = "OffSet";
const TWO_PC_REAL_KEYS = [
  "gladiators_finale",
  "shimenawas_reminiscence",
  "tenacity_of_the_millelith",
  "vourukashas_glow",
] as const;

const SUB_STAT_RANGES: ReadonlyArray<readonly [SubStat, number]> = [
  ["cr", 25],
  ["cd", 40],
  ["atk%", 30],
  ["em", 80],
  ["er", 30],
];

function randomSubstats(rng: () => number): Partial<Record<SubStat, number>> {
  const pool = [...SUB_STAT_RANGES];
  const count = 2 + Math.floor(rng() * 3);
  const subs: Partial<Record<SubStat, number>> = {};
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [stat, max] = pool[idx];
    pool.splice(idx, 1);
    subs[stat] = Math.round(rng() * max * 10) / 10;
  }
  return subs;
}

function randomSetKey(
  rng: () => number,
  composition: "4pc" | "2pc+2pc"
): string {
  if (composition === "4pc") return rng() < 0.7 ? FOUR_PC_SET : OFF_SET;
  return rng() < 0.9 ? pick(rng, TWO_PC_REAL_KEYS) : OFF_SET;
}

function randomCircletMain(rng: () => number): MainStat {
  const r = rng();
  if (r < 0.3) return "cr";
  if (r < 0.7) return "cd";
  return "atk%";
}

function randomInstance(
  rng: () => number,
  composition: "4pc" | "2pc+2pc",
  crWeight: 80 | 100
): BuildOptimizerConfig {
  const weights: StatWeightMap = { cr: crWeight, cd: 100, "atk%": 80, em: 60 };
  const targetMainStatWeights: Record<Slot, ReadonlyMap<string, number>> = {
    flower: new Map([["hp", 100]]),
    plume: new Map([["atk", 100]]),
    sands: new Map([["atk%", 100]]),
    goblet: new Map([["atk%", 100]]),
    circlet: new Map([
      ["cr", crWeight],
      ["cd", 100],
    ]),
  };
  const candidates = {} as Record<Slot, CandidateArtifact[]>;
  for (const slot of allSlots) {
    const count = 3 + Math.floor(rng() * 3);
    const list: CandidateArtifact[] = [];
    for (let i = 0; i < count; i++) {
      const mainStatKey: MainStat =
        slot === "flower"
          ? "hp"
          : slot === "plume"
            ? "atk"
            : slot === "circlet"
              ? randomCircletMain(rng)
              : "atk%";
      list.push(
        candidate(
          slot,
          `${slot}-${i}`,
          randomSetKey(rng, composition),
          mainStatKey,
          randomSubstats(rng)
        )
      );
    }
    candidates[slot] = list;
  }
  return {
    weights,
    candidates,
    crBudget: crBudget(pick(rng, [0.05, 0.5, 0.9])),
    targetMainStatWeights,
    setConstraint:
      composition === "4pc"
        ? { composition, artifactSet: FOUR_PC_SET }
        : { composition, halfSet1: "atk%-18", halfSet2: "hp%-20" },
  };
}

function signatureOf(artifacts: Record<Slot, CandidateArtifact>): string {
  return allSlots
    .map((slot) => artifacts[slot].id)
    .sort()
    .join("|");
}

interface RankedBuild {
  signature: string;
  score: number;
}

/**
 * Exhaustive enumeration of every slot combination honoring the set
 * constraint, scored with scoreFullBuild, unique by id signature,
 * sorted by score descending.
 */
function bruteForceUniqueRanking(config: BuildOptimizerConfig): RankedBuild[] {
  const { setConstraint } = config;
  const availableSetKeys = new Set<string>();
  for (const slot of allSlots) {
    for (const cand of config.candidates[slot]) {
      availableSetKeys.add(cand.setKey);
    }
  }
  const concretePairs =
    setConstraint.composition === "2pc+2pc"
      ? enumerateConcreteTwoPieceSetPairs(
          setConstraint.halfSet1,
          setConstraint.halfSet2,
          availableSetKeys
        )
      : [];

  const isFeasible = (combo: Record<Slot, CandidateArtifact>): boolean => {
    const counts = new Map<string, number>();
    for (const slot of allSlots) {
      const key = combo[slot].setKey;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (setConstraint.composition === "4pc") {
      return (
        setConstraint.artifactSet != null &&
        (counts.get(setConstraint.artifactSet) ?? 0) >= 4
      );
    }
    return concretePairs.some(
      (pair) =>
        (counts.get(pair.halfSet1SetKey) ?? 0) >= 2 &&
        (counts.get(pair.halfSet2SetKey) ?? 0) >= 2
    );
  };

  const ranked: RankedBuild[] = [];
  const combo = {} as Record<Slot, CandidateArtifact>;
  const recurse = (depth: number): void => {
    if (depth === allSlots.length) {
      if (!isFeasible(combo)) return;
      const { finalScore } = scoreFullBuild(
        combo,
        config.weights,
        config.targetMainStatWeights,
        config.crBudget
      );
      ranked.push({ signature: signatureOf(combo), score: finalScore });
      return;
    }
    const slot = allSlots[depth];
    for (const cand of config.candidates[slot]) {
      combo[slot] = cand;
      recurse(depth + 1);
    }
  };
  recurse(0);
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function expectBuildMatchesRecompute(
  build: OptimizedBuild,
  config: BuildOptimizerConfig
): void {
  const recomputed = scoreFullBuild(
    build.artifacts,
    config.weights,
    config.targetMainStatWeights,
    config.crBudget
  );
  expect(build.finalScore).toBeCloseTo(recomputed.finalScore, 8);
  expect(build.rawScore).toBeCloseTo(recomputed.rawScore, 8);
  expect(build.totalArtifactCr).toBeCloseTo(recomputed.totalArtifactCr, 8);
}

describe("buildOptimizer seeded property tests", () => {
  it("top-1 finalScore equals the brute-force optimum on random 4pc instances", () => {
    const rng = mulberry32(0x4a11ce);
    let feasibleInstances = 0;
    for (let i = 0; i < 30; i++) {
      const config = randomInstance(rng, "4pc", i % 2 === 0 ? 100 : 80);
      const result = optimizeBuild({ ...config, topN: 1 });
      const ranked = bruteForceUniqueRanking(config);
      if (ranked.length === 0) {
        expect(result.builds).toHaveLength(0);
      } else {
        feasibleInstances++;
        expect(result.builds.length).toBeGreaterThan(0);
        expect(result.builds[0].finalScore).toBeCloseTo(ranked[0].score, 8);
      }
    }
    expect(feasibleInstances).toBeGreaterThan(15);
  });

  it("top-1 finalScore equals the brute-force optimum on random 2pc+2pc instances", () => {
    const rng = mulberry32(0xb0bacafe);
    let feasibleInstances = 0;
    for (let i = 0; i < 30; i++) {
      const config = randomInstance(rng, "2pc+2pc", i % 2 === 0 ? 100 : 80);
      const result = optimizeBuild({ ...config, topN: 1 });
      const ranked = bruteForceUniqueRanking(config);
      if (ranked.length === 0) {
        expect(result.builds).toHaveLength(0);
      } else {
        feasibleInstances++;
        expect(result.builds.length).toBeGreaterThan(0);
        expect(result.builds[0].finalScore).toBeCloseTo(ranked[0].score, 8);
      }
    }
    expect(feasibleInstances).toBeGreaterThan(15);
  });

  it("enumerateBuilds(k) returns min(k, unique feasible) builds with unique signatures matching brute-force rank scores", () => {
    const rng = mulberry32(0xdeadbeef);
    const k = 5;
    let multiBuildInstances = 0;
    for (let i = 0; i < 12; i++) {
      const config = randomInstance(rng, "4pc", i % 2 === 0 ? 100 : 80);
      const result = enumerateBuilds(config, k);
      const ranked = bruteForceUniqueRanking(config);
      expect(result.builds.length).toBe(Math.min(k, ranked.length));
      if (result.builds.length > 1) multiBuildInstances++;
      const signatures = new Set(
        result.builds.map((build) => signatureOf(build.artifacts))
      );
      expect(signatures.size).toBe(result.builds.length);
      for (let rank = 0; rank < result.builds.length; rank++) {
        expect(result.builds[rank].finalScore).toBeCloseTo(
          ranked[rank].score,
          8
        );
      }
    }
    expect(multiBuildInstances).toBeGreaterThan(5);
  });

  it("all-on-set 4pc with one off-set flower alternative yields 2 unique builds at k=2 (starvation regression)", () => {
    const config: BuildOptimizerConfig = {
      weights: { cr: 100, cd: 100, "atk%": 80 },
      candidates: {
        flower: [
          candidate("flower", "f-on", FOUR_PC_SET, "hp", { cd: 20, cr: 5 }),
          candidate("flower", "f-off", OFF_SET, "hp", { cd: 30, cr: 8 }),
        ],
        plume: [candidate("plume", "p1", FOUR_PC_SET, "atk", { cd: 20 })],
        sands: [candidate("sands", "s1", FOUR_PC_SET, "atk%", { cd: 20 })],
        goblet: [candidate("goblet", "g1", FOUR_PC_SET, "atk%", { cd: 20 })],
        circlet: [candidate("circlet", "c1", FOUR_PC_SET, "cd", { cr: 10 })],
      },
      crBudget: crBudget(0.05),
      targetMainStatWeights: {
        flower: new Map([["hp", 100]]),
        plume: new Map([["atk", 100]]),
        sands: new Map([["atk%", 100]]),
        goblet: new Map([["atk%", 100]]),
        circlet: new Map([
          ["cr", 100],
          ["cd", 100],
        ]),
      },
      setConstraint: { composition: "4pc", artifactSet: FOUR_PC_SET },
    };

    const result = enumerateBuilds(config, 2);
    expect(result.builds).toHaveLength(2);
    const flowers = new Set(
      result.builds.map((build) => build.artifacts.flower.id)
    );
    expect(flowers).toEqual(new Set(["f-on", "f-off"]));

    const ranked = bruteForceUniqueRanking(config);
    expect(ranked).toHaveLength(2);
    expect(result.builds[0].finalScore).toBeCloseTo(ranked[0].score, 8);
    expect(result.builds[1].finalScore).toBeCloseTo(ranked[1].score, 8);
  });

  it("a fully-over-cap CR circlet main at weight 80 nets exactly zero versus an off-target main", () => {
    const weights: StatWeightMap = { cr: 80, cd: 100, "atk%": 80 };
    const targets: Record<Slot, ReadonlyMap<string, number>> = {
      flower: new Map([["hp", 100]]),
      plume: new Map([["atk", 100]]),
      sands: new Map([["atk%", 100]]),
      goblet: new Map([["atk%", 100]]),
      circlet: new Map([
        ["cr", 80],
        ["cd", 100],
      ]),
    };
    const base = {
      flower: candidate("flower", "f", "S", "hp", { cd: 20, cr: 10 }),
      plume: candidate("plume", "p", "S", "atk", { cd: 15, cr: 8 }),
      sands: candidate("sands", "s", "S", "atk%", { cd: 12 }),
      goblet: candidate("goblet", "g", "S", "atk%", { "atk%": 10 }),
    };
    const crMainBuild = {
      ...base,
      circlet: candidate("circlet", "c-cr", "S", "cr", { cd: 18 }),
    } as Record<Slot, CandidateArtifact>;
    const offMainBuild = {
      ...base,
      circlet: candidate("circlet", "c-off", "S", "hp%", { cd: 18 }),
    } as Record<Slot, CandidateArtifact>;

    const zeroBudget = crBudget(1.0);
    expect(
      scoreFullBuild(crMainBuild, weights, targets, zeroBudget).finalScore
    ).toBeCloseTo(
      scoreFullBuild(offMainBuild, weights, targets, zeroBudget).finalScore,
      10
    );

    const halfBudget = crBudget(0.5);
    const crMainSubsFill = {
      ...crMainBuild,
      flower: candidate("flower", "f", "S", "hp", { cd: 20, cr: 30 }),
      plume: candidate("plume", "p", "S", "atk", { cd: 15, cr: 20 }),
    } as Record<Slot, CandidateArtifact>;
    const offMainSubsFill = {
      ...crMainSubsFill,
      circlet: offMainBuild.circlet,
    } as Record<Slot, CandidateArtifact>;
    expect(
      scoreFullBuild(crMainSubsFill, weights, targets, halfBudget).finalScore
    ).toBeCloseTo(
      scoreFullBuild(offMainSubsFill, weights, targets, halfBudget).finalScore,
      10
    );
  });

  it("every build returned by optimizeBuild recomputes to the same finalScore via scoreFullBuild", () => {
    const rng = mulberry32(0x5eed);
    let buildsChecked = 0;
    for (let i = 0; i < 16; i++) {
      const composition = i % 2 === 0 ? "4pc" : "2pc+2pc";
      const config = randomInstance(rng, composition, i % 4 < 2 ? 100 : 80);
      const result = optimizeBuild({ ...config, topN: 4 });
      for (const build of result.builds) {
        expectBuildMatchesRecompute(build, config);
        buildsChecked++;
      }
    }
    expect(buildsChecked).toBeGreaterThan(20);
  });

  it("artifact prices change ranking inputs but never the reported finalScore", () => {
    const rng = mulberry32(0x90ce55);
    let pricedBuildsChecked = 0;
    for (let i = 0; i < 12; i++) {
      const config = randomInstance(rng, "4pc", i % 2 === 0 ? 100 : 80);
      const prices = new Map<string, number>();
      for (const slot of allSlots) {
        for (const cand of config.candidates[slot]) {
          if (rng() < 0.5) {
            prices.set(cand.id, Math.round(rng() * 200) / 10);
          }
        }
      }
      const result = optimizeBuild({
        ...config,
        artifactPrices: prices,
        topN: 3,
      });
      for (const build of result.builds) {
        expectBuildMatchesRecompute(build, config);
        let totalPrice = 0;
        for (const slot of allSlots) {
          totalPrice += prices.get(build.artifacts[slot].id) ?? 0;
        }
        expect(build.adjustedScore).toBeCloseTo(
          build.finalScore - totalPrice,
          8
        );
        pricedBuildsChecked++;
      }
    }
    expect(pricedBuildsChecked).toBeGreaterThan(10);
  });
});
