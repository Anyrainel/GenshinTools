/**
 * Artifact Scoring: Shared Constants & Utilities
 *
 * Clean interfaces for artifact stat data, derived from official game data.
 * All display-format constants come from @/data/constants (derived from artifact_stat.json).
 * This module provides scoring-specific derived values and format conversion helpers.
 */

import {
  avgSubstatRolls,
  mainStatLevelValues,
  maxSubstatRolls,
  SUBSTAT_COEFFICIENTS,
  substatRollTiers,
} from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/enums";
import { isFlatStat } from "@/data/utils";
import {
  AVG_ROLL_CD_EQUIV,
  IDEAL_ROLL_DISTRIBUTION,
  MAIN_STAT_CD_EQUIV_5STAR,
} from "./constants";

/** Convert a display-format stat value to StatSheet-internal format (pct stats ÷ 100) */
export function toInternal(stat: string, displayValue: number): number {
  return isFlatStat(stat) ? displayValue : displayValue / 100;
}

/**
 * Get the 4 roll tier values for a substat (display format).
 * Index 0 = lowest tier, index 3 = highest tier.
 */
export function getSubstatRollTiers(
  stat: SubStat,
  rarity: 4 | 5 = 5
): readonly [number, number, number, number] {
  return substatRollTiers[rarity][stat];
}

/** Get the max substat roll value (display format) */
export function getSubstatMaxRoll(stat: SubStat, rarity: 4 | 5 = 5): number {
  return maxSubstatRolls[rarity][stat];
}

/** Get the average substat roll value (display format) */
export function getSubstatAvgRoll(stat: SubStat, rarity: 4 | 5 = 5): number {
  return avgSubstatRolls[rarity][stat];
}

// ─── Main stat accessors ───

/**
 * Get the main stat value at a specific level (display format).
 * Direct table lookup — no interpolation.
 */
export function getMainStatValueAtLevel(
  stat: MainStat,
  rarity: number,
  level: number
): number {
  const r = rarity === 4 ? 4 : 5;
  const table = mainStatLevelValues[r][stat];
  if (!table) return 0;
  const maxLevel = r === 4 ? 16 : 20;
  const idx = Math.max(0, Math.min(level, maxLevel));
  return table[idx] ?? 0;
}

// ─── Shared Scoring Utilities ───

/**
 * Compute the ideal score for a build (for normalization to 300).
 * Pure function — no dependency on the damage calculator.
 */
export function computeIdealScore(
  weights: Record<SubStat, number>,
  sandsWeight: number,
  gobletWeight: number,
  circletWeight: number,
  sandsCdEquiv = MAIN_STAT_CD_EQUIV_5STAR,
  gobletCdEquiv = MAIN_STAT_CD_EQUIV_5STAR,
  circletCdEquiv = MAIN_STAT_CD_EQUIV_5STAR
): { idealScore: number; normalizer: number } {
  // Main stat contribution
  const mainStatScore =
    sandsCdEquiv * (sandsWeight / 100) +
    gobletCdEquiv * (gobletWeight / 100) +
    circletCdEquiv * (circletWeight / 100);

  // Substat contribution: distribute ideal rolls across top 4 stats
  const sortedWeights = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  let substatScore = 0;
  for (let i = 0; i < Math.min(sortedWeights.length, 4); i++) {
    const [, weight] = sortedWeights[i];
    substatScore +=
      IDEAL_ROLL_DISTRIBUTION[i] * AVG_ROLL_CD_EQUIV * (weight / 100);
  }

  const idealScore = mainStatScore + substatScore;
  const normalizer = idealScore > 0 ? 300 / idealScore : 1;

  return { idealScore, normalizer };
}

/**
 * Compute the CR score deduction for artifacts exceeding the CR budget.
 * Shared between both scorers.
 *
 * @param totalArtifactCr Total CR from artifacts (decimal, e.g. 0.45 for 45%)
 * @param nonArtifactCr CR from non-artifact sources (decimal)
 * @param crWeight The build's CR weight (0-100)
 */
export function computeCrDeduction(
  totalArtifactCr: number,
  nonArtifactCr: number,
  crWeight: number
): number {
  const artifactCrBudget = 1.0 - nonArtifactCr;
  const excessCr = Math.max(0, totalArtifactCr - artifactCrBudget);
  if (excessCr <= 0) return 0;
  return excessCr * 100 * SUBSTAT_COEFFICIENTS.cr * (crWeight / 100);
} /** Create empty sub rolls record */

export function emptySubRolls(): Record<
  Slot,
  Partial<Record<SubStat, number>>
> {
  return {
    flower: {},
    plume: {},
    sands: {},
    goblet: {},
    circlet: {},
  };
} // ─── Roll value helpers ───
/**
 * Get roll values per stat in display format for a given rarity.
 * When multiplier is provided, returns max × multiplier (for generator quality scaling).
 * When omitted, returns exact averages from game data.
 */

export function getRollValues(
  multiplier?: number,
  rarity: 4 | 5 = 5
): Record<SubStat, number> {
  if (multiplier != null) {
    return Object.fromEntries(
      Object.entries(maxSubstatRolls[rarity]).map(([k, v]) => [
        k,
        v * multiplier,
      ])
    ) as Record<SubStat, number>;
  }
  return { ...avgSubstatRolls[rarity] };
}
/** Convert a display-format roll value to StatSheet-internal representation */

export function rollToInternal(
  stat: SubStat,
  rolls: number,
  rv: Record<SubStat, number>
): number {
  return toInternal(stat, rv[stat] * rolls);
}
