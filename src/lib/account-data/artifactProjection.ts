import { statPools } from "@/data/constants";
import type {
  ArtifactData,
  GlobalStatWeights,
  LuckExpectation,
  MainStat,
  Rarity,
  SubStat,
} from "@/data/types";
import {
  type BuildMatchResult,
  calculateStatScore,
  scoreSlot,
} from "./artifactScore";
import {
  getSubstatAvgRoll,
  getSubstatMaxRoll,
  getSubstatRollTiers,
} from "./scoring/utils";

export const MAX_LEVEL_BY_RARITY: Record<Rarity, number> = {
  5: 20,
  4: 16,
  3: 12,
  2: 8,
  1: 4,
};

/**
 * Get the expected roll value for a substat based on quality expectation.
 * - "cautious" → tier 2 (2nd lowest of 4 tiers)
 * - "balanced" → exact average of all 4 tiers (default)
 * - "hopeful"  → tier 3 (2nd highest of 4 tiers)
 */
export function getExpectedRollValue(
  stat: SubStat,
  rarity: Rarity,
  quality: LuckExpectation = "balanced"
): number {
  const r = rarity === 4 || rarity === 5 ? rarity : 5;
  if (quality === "balanced") {
    return getSubstatAvgRoll(stat, r as 4 | 5);
  }
  const tiers = getSubstatRollTiers(stat, r as 4 | 5);
  // cautious = tier index 1, hopeful = tier index 2
  return tiers[quality === "cautious" ? 1 : 2];
}

/** Combines activated and unactivated substats into a deduplicated list. */
export function getAllSubstats(artifact: ArtifactData): SubStat[] {
  const substats = Object.keys(artifact.substats || {}) as SubStat[];
  const unactivated = Object.keys(
    artifact.unactivatedSubstats || {}
  ) as SubStat[];
  return Array.from(new Set([...substats, ...unactivated]));
}

/**
 * Projects the expected score of an artifact when leveled to max level.
 * If already at max level, returns the current score.
 */
export function getProjectedScore(
  artifact: ArtifactData,
  buildMatch: BuildMatchResult,
  globalConfig: GlobalStatWeights,
  quality: LuckExpectation = "balanced"
): number {
  const currentScore = scoreSlot(
    artifact,
    buildMatch.statWeights,
    globalConfig
  );
  const maxLevel = MAX_LEVEL_BY_RARITY[artifact.rarity] ?? 20;

  if (artifact.level >= maxLevel) return currentScore;

  const activatedSubstats = Object.keys(artifact.substats || {}) as SubStat[];
  const unactivatedSubstats = Object.keys(
    artifact.unactivatedSubstats || {}
  ) as SubStat[];

  const has3Lines =
    activatedSubstats.length === 3 && unactivatedSubstats.length > 0;
  const totalPossibleRolls = maxLevel / 4;
  const rollsReceived = Math.floor(artifact.level / 4);
  const has4thStatUnlock = has3Lines && artifact.level < 4;
  const remainingRolls =
    totalPossibleRolls - rollsReceived - (has4thStatUnlock ? 1 : 0);

  if (remainingRolls === 0 && !has4thStatUnlock) return currentScore;

  const weightedStats = getAllSubstats(artifact).map((stat) => ({
    stat,
    weight: (buildMatch.statWeights[stat] || 0) / 100,
    isUnactivated: unactivatedSubstats.includes(stat),
  }));

  while (weightedStats.length < 4) {
    weightedStats.push({
      stat: "hp" as SubStat,
      weight: 0,
      isUnactivated: true,
    });
  }
  weightedStats.sort((a, b) => b.weight - a.weight);

  let expectedGain = 0;

  if (has4thStatUnlock) {
    const unactivated = weightedStats.find((s) => s.isUnactivated);
    if (unactivated) {
      const val = getExpectedRollValue(
        unactivated.stat,
        artifact.rarity,
        quality
      );
      expectedGain += calculateStatScore(
        unactivated.stat,
        val,
        buildMatch.statWeights,
        globalConfig
      ).score;
    }
  }

  if (remainingRolls > 0) {
    // For 5+ remaining rolls: favor top 2 substats (1.5 rolls each), even split for rest
    // For fewer rolls: distribute evenly
    const rollCounts =
      remainingRolls >= 5
        ? [1.5, 1.5, 1, 1].map((base) => base + (remainingRolls - 5) / 4)
        : Array<number>(4).fill(remainingRolls / 4);

    for (let i = 0; i < 4; i++) {
      const stat = weightedStats[i].stat;
      const val = getExpectedRollValue(stat, artifact.rarity, quality);
      expectedGain += calculateStatScore(
        stat,
        rollCounts[i] * val,
        buildMatch.statWeights,
        globalConfig
      ).score;
    }
  }

  return currentScore + expectedGain;
}

/**
 * Expected score of a freshly farmed artifact at max level,
 * assuming ideal substat distribution from the given main stat pool.
 */
export function calculateFarmExpectedScore(
  mainStat: MainStat,
  buildMatch: BuildMatchResult,
  globalConfig: GlobalStatWeights,
  rarity: Rarity = 5,
  quality: LuckExpectation = "balanced"
): number {
  const pool = statPools.substat.filter((s) => s !== mainStat) as SubStat[];
  const weightedStats = pool
    .map((stat) => ({
      stat,
      weight: (buildMatch.statWeights[stat] || 0) / 100,
    }))
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  while (weightedStats.length < 4) {
    weightedStats.push({ stat: "hp" as SubStat, weight: 0 });
  }

  // Top 2: 1 initial + 1.5 upgrades = 2.5 total rolls
  // Bottom 2: 1 initial + 1 upgrade = 2 total rolls
  const rollDistribution = [2.5, 2.5, 2, 2];
  return weightedStats.reduce((sum, { stat }, i) => {
    const val = getExpectedRollValue(stat, rarity, quality);
    return (
      sum +
      calculateStatScore(
        stat,
        rollDistribution[i] * val,
        buildMatch.statWeights,
        globalConfig
      ).score
    );
  }, 0);
}

/**
 * Expected score after rerolling an artifact's substats (via elixir/reset).
 * Uses recorded initial values when available; otherwise assumes expected roll.
 */
export function calculateRerollExpectedScore(
  artifact: ArtifactData,
  buildMatch: BuildMatchResult,
  globalConfig: GlobalStatWeights,
  quality: LuckExpectation = "balanced"
): number {
  const allSubstats = getAllSubstats(artifact);
  if (allSubstats.length < 4) return 0;

  const rarity = artifact.rarity;
  const weightedStats = allSubstats
    .map((stat) => ({
      stat,
      weight: (buildMatch.statWeights[stat] || 0) / 100,
    }))
    .sort((a, b) => b.weight - a.weight);

  const getInitialValue = (stat: SubStat): number =>
    artifact.initialValues?.[stat] ??
    getExpectedRollValue(stat, rarity, quality);

  const totalRolls = artifact.totalRolls ?? 8;
  let expectedScore = 0;

  if (totalRolls === 8) {
    // 3-line start: each stat gets initial + 1 upgrade
    for (const { stat } of weightedStats.slice(0, 4)) {
      const val =
        getInitialValue(stat) + getExpectedRollValue(stat, rarity, quality);
      expectedScore += calculateStatScore(
        stat,
        val,
        buildMatch.statWeights,
        globalConfig
      ).score;
    }
  } else {
    // 4-line start: top 2 get initial + 1.5 upgrades, bottom 2 get initial + 1 upgrade
    for (let i = 0; i < 2; i++) {
      const { stat } = weightedStats[i];
      const val =
        getInitialValue(stat) +
        1.5 * getExpectedRollValue(stat, rarity, quality);
      expectedScore += calculateStatScore(
        stat,
        val,
        buildMatch.statWeights,
        globalConfig
      ).score;
    }
    for (let i = 2; i < 4; i++) {
      const { stat } = weightedStats[i];
      const val =
        getInitialValue(stat) + getExpectedRollValue(stat, rarity, quality);
      expectedScore += calculateStatScore(
        stat,
        val,
        buildMatch.statWeights,
        globalConfig
      ).score;
    }
  }

  return expectedScore;
}
