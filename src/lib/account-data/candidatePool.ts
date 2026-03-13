/**
 * Builds per-slot candidate lists of synthetic ArtifactData objects tagged with their source.
 */
import { maxSubstatRolls, statPools } from "@/data/constants";
import type {
  ArtifactData,
  GlobalStatWeights,
  MainStat,
  Rarity,
  Slot,
  SubStat,
  TierAssignment,
} from "@/data/types";
import { allSlots } from "@/data/types";
import {
  MAX_LEVEL_BY_RARITY,
  getAllSubstats,
  getExpectedRollValue,
} from "./artifactProjection";
import {
  type BuildMatchResult,
  type StatWeightMap,
  calculateStatScore,
  getTargetMainStatsForSlot,
  scoreSlot,
} from "./artifactScore";

// ─── Types ───

export type CandidateSource =
  | "current"
  | "swap"
  | "upgrade"
  | "reroll"
  | "farm";

export type CandidateArtifact = ArtifactData & {
  source: CandidateSource;
  sourceArtifactId?: string;
  donorCharacterId?: string;
};

// ─── Substat Projection Helpers ───

/**
 * Project an artifact's substats to max level, returning concrete stat values.
 * Mirrors getProjectedScore logic but produces stats instead of a score.
 */
function projectArtifactSubstats(
  artifact: ArtifactData,
  buildMatch: BuildMatchResult,
  luckMultiplier: number
): Partial<Record<SubStat, number>> {
  const maxLevel = MAX_LEVEL_BY_RARITY[artifact.rarity] ?? 20;
  const result: Partial<Record<SubStat, number>> = { ...artifact.substats };

  if (artifact.level >= maxLevel) return result;

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

  if (remainingRolls === 0 && !has4thStatUnlock) return result;

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

  if (has4thStatUnlock) {
    const unactivated = weightedStats.find((s) => s.isUnactivated);
    if (unactivated) {
      const val = getExpectedRollValue(
        unactivated.stat,
        artifact.rarity,
        luckMultiplier
      );
      result[unactivated.stat] = (result[unactivated.stat] ?? 0) + val;
    }
  }

  if (remainingRolls > 0) {
    const rollCounts =
      remainingRolls >= 5
        ? [1.5, 1.5, 1, 1].map((base) => base + (remainingRolls - 5) / 4)
        : Array<number>(4).fill(remainingRolls / 4);

    for (let i = 0; i < 4; i++) {
      const stat = weightedStats[i].stat;
      const val = getExpectedRollValue(stat, artifact.rarity, luckMultiplier);
      result[stat] = (result[stat] ?? 0) + rollCounts[i] * val;
    }
  }

  return result;
}

/**
 * Redistribute substats via reroll (elixir), returning expected stat values.
 * Mirrors calculateRerollExpectedScore logic.
 */
function rerollArtifactSubstats(
  artifact: ArtifactData,
  buildMatch: BuildMatchResult,
  luckMultiplier: number
): Partial<Record<SubStat, number>> {
  const allSubs = getAllSubstats(artifact);
  if (allSubs.length < 4) return { ...artifact.substats };

  const rarity = artifact.rarity;
  const weightedStats = allSubs
    .map((stat) => ({
      stat,
      weight: (buildMatch.statWeights[stat] || 0) / 100,
    }))
    .sort((a, b) => b.weight - a.weight);

  const getInitialValue = (stat: SubStat): number =>
    artifact.initialValues?.[stat] ??
    getExpectedRollValue(stat, rarity, luckMultiplier);

  const totalRolls = artifact.totalRolls ?? 8;
  const result: Partial<Record<SubStat, number>> = {};

  if (totalRolls === 8) {
    for (const { stat } of weightedStats.slice(0, 4)) {
      result[stat] =
        getInitialValue(stat) +
        getExpectedRollValue(stat, rarity, luckMultiplier);
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const { stat } = weightedStats[i];
      result[stat] =
        getInitialValue(stat) +
        1.5 * getExpectedRollValue(stat, rarity, luckMultiplier);
    }
    for (let i = 2; i < 4; i++) {
      const { stat } = weightedStats[i];
      result[stat] =
        getInitialValue(stat) +
        getExpectedRollValue(stat, rarity, luckMultiplier);
    }
  }

  return result;
}

/**
 * Construct farmed artifact substats.
 *
 * Uses a conservative [2, 2, 2, 2] roll distribution (8 total rolls = 3-line
 * start artifact with 5 upgrades). The old [2.5, 2.5, 2, 2] assumed a 4-line
 * start (9 total rolls) which is rare and inflated farm estimates.
 */
function farmArtifactSubstats(
  mainStat: MainStat,
  buildMatch: BuildMatchResult,
  rarity: Rarity,
  luckMultiplier: number
): Partial<Record<SubStat, number>> {
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

  // Conservative: 3-line start, 8 total rolls, evenly distributed
  const rollDistribution = [2, 2, 2, 2];
  const result: Partial<Record<SubStat, number>> = {};

  for (let i = 0; i < 4; i++) {
    const stat = weightedStats[i].stat;
    const val = getExpectedRollValue(stat, rarity, luckMultiplier);
    result[stat] = rollDistribution[i] * val;
  }

  return result;
}

// ─── Main Pool Builder ───

/**
 * Build per-slot candidate lists for the optimizer.
 */
export function buildCandidatePool(
  char: { key: string; artifacts: Partial<Record<Slot, ArtifactData>> },
  buildMatch: BuildMatchResult,
  allArtifacts: (ArtifactData & { location?: string })[],
  tierAssignments: TierAssignment,
  luckMultiplier: number
): Record<Slot, CandidateArtifact[]> {
  const result = {} as Record<Slot, CandidateArtifact[]>;

  for (const slot of allSlots) {
    const candidates: CandidateArtifact[] = [];
    const equipped = char.artifacts[slot];
    const targetMainStats = getTargetMainStatsForSlot(
      slot,
      buildMatch.build,
      equipped ?? undefined
    );

    // 1. Current artifact → projected to max level
    if (equipped) {
      const projected = projectArtifactSubstats(
        equipped,
        buildMatch,
        luckMultiplier
      );
      candidates.push({
        ...equipped,
        substats: projected,
        level: MAX_LEVEL_BY_RARITY[equipped.rarity] ?? 20,
        source: "current",
        sourceArtifactId: equipped.id,
      });
    }

    // 2. Swap + Upgrade candidates from inventory and stealable artifacts
    for (const art of allArtifacts) {
      if (art.slotKey !== slot) continue;
      if (!targetMainStats.has(art.mainStatKey)) continue;
      if (art.id === equipped?.id) continue;

      // Only steal from Pool tier
      if (art.location && tierAssignments[art.location]?.tier !== "Pool")
        continue;

      const maxLevel = MAX_LEVEL_BY_RARITY[art.rarity] ?? 20;

      if (art.level === maxLevel) {
        // Swap candidate (already at max)
        candidates.push({
          ...art,
          source: "swap",
          sourceArtifactId: art.id,
          donorCharacterId: art.location,
        });
      } else {
        // Upgrade candidate (project to max)
        const projected = projectArtifactSubstats(
          art,
          buildMatch,
          luckMultiplier
        );
        candidates.push({
          ...art,
          substats: projected,
          level: maxLevel,
          source: "upgrade",
          sourceArtifactId: art.id,
          donorCharacterId: art.location,
        });
      }
    }

    // 3. Reroll candidate (any max-level 5★ with 4+ substats)
    //    The optimizer will only pick this if the redistributed substats actually beat current.
    //    Gate: must have a 0-weight substat OR 9+ total rolls (high base value).
    if (equipped && equipped.rarity === 5) {
      const maxLevel = MAX_LEVEL_BY_RARITY[equipped.rarity] ?? 20;
      if (equipped.level === maxLevel) {
        const allSubs = getAllSubstats(equipped);
        if (allSubs.length >= 4) {
          const hasBadSubstat = allSubs.some(
            (s) => (buildMatch.statWeights[s] || 0) === 0
          );
          const hasHighRolls = (equipped.totalRolls ?? 8) >= 9;
          if (hasBadSubstat || hasHighRolls) {
            const rerolled = rerollArtifactSubstats(
              equipped,
              buildMatch,
              luckMultiplier
            );
            candidates.push({
              ...equipped,
              substats: rerolled,
              source: "reroll",
              sourceArtifactId: equipped.id,
              id: `synth-reroll-${char.key}-${slot}`,
            });
          }
        }
      }
    }

    // 4. Farm candidates — one per target main stat
    if (equipped && targetMainStats.size > 0) {
      const rarity = (equipped.rarity as Rarity) || 5;
      const setKey = equipped.setKey;

      for (const mainStat of targetMainStats) {
        const farmed = farmArtifactSubstats(
          mainStat,
          buildMatch,
          rarity,
          luckMultiplier
        );
        candidates.push({
          id: `synth-farm-${char.key}-${slot}-${setKey}-${mainStat}`,
          setKey,
          slotKey: slot,
          level: MAX_LEVEL_BY_RARITY[rarity] ?? 20,
          rarity,
          mainStatKey: mainStat,
          lock: false,
          substats: farmed,
          source: "farm",
        });
      }
    }

    result[slot] = candidates;
  }

  return result;
}
