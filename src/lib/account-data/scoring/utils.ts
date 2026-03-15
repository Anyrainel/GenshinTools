/**
 * Artifact Scoring: Shared Constants & Utilities
 *
 * Re-exports artifact constants from @/data/constants and provides
 * scoring-specific derived constants and pure functions.
 * No dependency on the damage calculator.
 */

import {
  AVERAGE_ROLL_MULTIPLIER,
  MAIN_STAT_VALUES_4STAR,
  MAIN_STAT_VALUES_5STAR,
  SUBSTAT_COEFFICIENTS,
  getMainStatValue,
  maxSubstatRolls,
} from "@/data/constants";
import type { MainStat, SubStat } from "@/data/types";

// Re-export canonical constants so existing importers don't break
export {
  MAIN_STAT_VALUES_4STAR,
  MAIN_STAT_VALUES_5STAR,
  SUBSTAT_COEFFICIENTS,
  getMainStatValue,
};

/** Max roll values per substat (5-star). Alias for maxSubstatRolls[5]. */
export const MAX_ROLLS_5STAR: Record<SubStat, number> =
  maxSubstatRolls[5] as Record<SubStat, number>;

/** One average roll of a stat in display form (value = maxRoll × 0.85) */
export const AVG_ROLL_VALUES: Record<SubStat, number> = Object.fromEntries(
  Object.entries(maxSubstatRolls[5]).map(([k, v]) => [
    k,
    v * AVERAGE_ROLL_MULTIPLIER,
  ])
) as Record<SubStat, number>;

/**
 * CD-equivalent of one average roll = 7.77 × 0.85 = 6.6045
 * (Same for all stats by design — the coefficient normalizes them.)
 */
export const AVG_ROLL_CD_EQUIV =
  maxSubstatRolls[5].cd * AVERAGE_ROLL_MULTIPLIER;

/** CD-equivalent of a 5-star main stat at Lv.20 ≈ 62.1 */
export const MAIN_STAT_CD_EQUIV_5STAR = 62.1;

/** CD-equivalent of a 4-star main stat at Lv.16 ≈ 46.4 */
export const MAIN_STAT_CD_EQUIV_4STAR = 46.4;

/** Reference substat budget: 40 average rolls for 5 artifacts */
export const SUBSTAT_BUDGET_ROLLS = 40;

/**
 * Ideal roll distribution across top-4 weighted substats.
 * Based on: 5 artifacts, each with 4 substats, top-end (all start with 4 lines)
 * ≈ [22, 10, 5, 5] rolls across the top 4 stats.
 */
export const IDEAL_ROLL_DISTRIBUTION = [22, 10, 5, 5];

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
}

// ─── Team Context for Auto-Tuning ───

/** Per-member build info for display purposes */
export type TeamMemberBuild = {
  weapon: string;
  /** Artifact set IDs: 1 entry = 4pc, 2 entries = 2+2 */
  artifacts: string[];
};

export type TeamContext = {
  name: string;
  /** The 4 character IDs */
  characters: [string, string, string, string];
  /** Index of the on-field DPS in the characters array */
  dpsIndex: number;
  /** Primary reaction for the team */
  reaction: string;
  /** Weapon ID for the DPS character */
  dpsWeaponId: string;
  /** Per-member builds: weapons + artifact sets (parallel to characters array) */
  builds: [TeamMemberBuild, TeamMemberBuild, TeamMemberBuild, TeamMemberBuild];
};

/** Result of the auto-tuning pipeline for a single main-stat combo + team context */
export type AutoTuneResult = {
  weights: Record<SubStat, number>;
  rollAllocation: Record<SubStat, number>;
  midpointMarginals: Record<SubStat, number>;
  /** Total damage after applying full greedy allocation (sum of all formulas) */
  finalDamage: number;
};
