/**
 * Auto-Tuning Engine for V2 Build Weights
 *
 * Uses the real TeamBuild damage calculator for marginal analysis.
 * Algorithm: greedy allocation at midpoint (see ArtifactScoreV2.md).
 *
 * 1. Construct baseline artifact stats (main stats only, no substats)
 * 2. Greedy-allocate substat rolls using real damage evaluation (sum of all formulas)
 * 3. Compute weights at the midpoint of the allocation
 * 4. Normalize weights to 0-100 scale
 */

import type { SubStat } from "@/data/types";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import { AVG_SUBSTAT_ROLL } from "@/lib/team-comp/inspection";
import type {
  CalcContext,
  ReactionOverride,
  StatKey,
} from "@/lib/team-comp/types";
import type { AutoTuneResult } from "./types";
import { SUBSTAT_BUDGET_ROLLS } from "./types";

/** Substat keys eligible for roll allocation */
export const TUNABLE_SUBSTATS: SubStat[] = [
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "em",
  "er",
  "atk",
  "hp",
  "def",
];

/** Default calc context for weight generation */
export const DEFAULT_CALC_CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 10,
  assumeCrit: false,
};

/**
 * Evaluate damage for a given artifact stat configuration.
 * Sums damage across all provided formula IDs.
 */
function evalDamage(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulaIds: string[],
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride
): number {
  const teamStats = teamBuild.getTeamStats(artifactStats, dpsCharId, ctx);
  let total = 0;
  for (const formulaId of formulaIds) {
    const result = teamBuild.getDamageResult(
      dpsCharId,
      formulaId,
      teamStats,
      ctx,
      reactionOverride
    );
    total += result.totalDamage;
  }
  return total;
}

/**
 * Compute marginal damage gain for +1 avg roll of each substat.
 */
function computeMarginals(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulaIds: string[],
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext,
  reactionOverride: ReactionOverride | undefined,
  baseDamage: number
): Record<SubStat, number> {
  const marginals = {} as Record<SubStat, number>;
  const baseSheet = artifactStats[dpsCharId] ?? new StatSheet([]);

  for (const stat of TUNABLE_SUBSTATS) {
    const delta = AVG_SUBSTAT_ROLL[stat as StatKey];
    if (!delta) {
      marginals[stat] = 0;
      continue;
    }

    const tweaked = {
      ...artifactStats,
      [dpsCharId]: baseSheet.withDelta(stat as StatKey, delta),
    };
    const dmg = evalDamage(
      teamBuild,
      dpsCharId,
      formulaIds,
      tweaked,
      ctx,
      reactionOverride
    );
    marginals[stat] = dmg - baseDamage;
  }

  return marginals;
}

/**
 * Greedy-allocate substat rolls to maximize damage.
 * At each step, adds one avg roll of the stat with highest marginal gain.
 */
function greedyAllocate(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulaIds: string[],
  baseArtifactStats: Record<string, StatSheet>,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  totalRolls: number = SUBSTAT_BUDGET_ROLLS
): Record<SubStat, number> {
  const allocation = {} as Record<SubStat, number>;
  for (const s of TUNABLE_SUBSTATS) allocation[s] = 0;

  let currentStats = { ...baseArtifactStats };

  for (let i = 0; i < totalRolls; i++) {
    const baseDmg = evalDamage(
      teamBuild,
      dpsCharId,
      formulaIds,
      currentStats,
      ctx,
      reactionOverride
    );
    const marginals = computeMarginals(
      teamBuild,
      dpsCharId,
      formulaIds,
      currentStats,
      ctx,
      reactionOverride,
      baseDmg
    );

    // Find stat with highest marginal gain
    let bestStat: SubStat = "cr";
    let bestGain = Number.NEGATIVE_INFINITY;
    for (const stat of TUNABLE_SUBSTATS) {
      if (marginals[stat] > bestGain) {
        bestGain = marginals[stat];
        bestStat = stat;
      }
    }

    // Allocate one roll
    allocation[bestStat]++;
    const delta = AVG_SUBSTAT_ROLL[bestStat as StatKey]!;
    const baseSheet = currentStats[dpsCharId] ?? new StatSheet([]);
    currentStats = {
      ...currentStats,
      [dpsCharId]: baseSheet.withDelta(bestStat as StatKey, delta),
    };
  }

  return allocation;
}

/**
 * Apply a roll allocation to a base sheet and return the resulting StatSheet.
 */
export function applyAllocation(
  baseSheet: StatSheet,
  allocation: Record<SubStat, number>,
  fraction = 1
): StatSheet {
  let sheet = baseSheet;
  for (const stat of TUNABLE_SUBSTATS) {
    const rolls = Math.round(allocation[stat] * fraction);
    const delta = AVG_SUBSTAT_ROLL[stat as StatKey];
    if (rolls > 0 && delta) {
      sheet = sheet.withDelta(stat as StatKey, delta * rolls);
    }
  }
  return sheet;
}

/**
 * Compute midpoint weights: halve allocation, apply as substats,
 * compute marginals at that operating point, normalize to 0-100.
 */
function computeMidpointWeights(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulaIds: string[],
  baseArtifactStats: Record<string, StatSheet>,
  allocation: Record<SubStat, number>,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride
): Record<SubStat, number> {
  const baseSheet = baseArtifactStats[dpsCharId] ?? new StatSheet([]);
  const midpointSheet = applyAllocation(baseSheet, allocation, 0.5);

  const midpointStats = { ...baseArtifactStats, [dpsCharId]: midpointSheet };
  const baseDmg = evalDamage(
    teamBuild,
    dpsCharId,
    formulaIds,
    midpointStats,
    ctx,
    reactionOverride
  );
  const marginals = computeMarginals(
    teamBuild,
    dpsCharId,
    formulaIds,
    midpointStats,
    ctx,
    reactionOverride,
    baseDmg
  );

  // Normalize: highest marginal → 100
  let maxMarginal = 0;
  for (const stat of TUNABLE_SUBSTATS) {
    if (marginals[stat] > maxMarginal) maxMarginal = marginals[stat];
  }

  const weights = {} as Record<SubStat, number>;
  for (const stat of TUNABLE_SUBSTATS) {
    weights[stat] =
      maxMarginal > 0 ? Math.round((marginals[stat] / maxMarginal) * 100) : 0;
  }

  return weights;
}

/**
 * Main auto-tuning function using the real TeamBuild damage calculator.
 *
 * @param teamBuild - Constructed TeamBuild with full team + buff resolution
 * @param dpsCharId - The DPS character to optimize
 * @param formulaIds - All damage formula IDs to sum for evaluation
 * @param baseArtifactStats - Artifact stats with main stats only (no substats)
 * @param ctx - Calc context (enemy level, res, etc.)
 * @param reactionOverride - Optional reaction override
 */
export function autoTuneWeights(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulaIds: string[],
  baseArtifactStats: Record<string, StatSheet>,
  ctx: CalcContext = DEFAULT_CALC_CTX,
  reactionOverride?: ReactionOverride
): AutoTuneResult {
  // Step 1: Greedy allocation
  const allocation = greedyAllocate(
    teamBuild,
    dpsCharId,
    formulaIds,
    baseArtifactStats,
    ctx,
    reactionOverride
  );

  // Step 2: Midpoint weights
  const weights = computeMidpointWeights(
    teamBuild,
    dpsCharId,
    formulaIds,
    baseArtifactStats,
    allocation,
    ctx,
    reactionOverride
  );

  // Step 3: Midpoint marginals (for debugging/display)
  const baseSheet = baseArtifactStats[dpsCharId] ?? new StatSheet([]);
  const midpointSheet = applyAllocation(baseSheet, allocation, 0.5);
  const midStats = { ...baseArtifactStats, [dpsCharId]: midpointSheet };
  const midDmg = evalDamage(
    teamBuild,
    dpsCharId,
    formulaIds,
    midStats,
    ctx,
    reactionOverride
  );
  const midpointMarginals = computeMarginals(
    teamBuild,
    dpsCharId,
    formulaIds,
    midStats,
    ctx,
    reactionOverride,
    midDmg
  );

  // Step 4: Final damage (full allocation applied)
  const finalSheet = applyAllocation(baseSheet, allocation);
  const finalStats = { ...baseArtifactStats, [dpsCharId]: finalSheet };
  const finalDamage = evalDamage(
    teamBuild,
    dpsCharId,
    formulaIds,
    finalStats,
    ctx,
    reactionOverride
  );

  return {
    weights,
    rollAllocation: allocation,
    midpointMarginals,
    finalDamage,
  };
}

/**
 * Evaluate baseline damage with no substats (for quick combo comparison).
 */
export function evalBaselineDamage(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulaIds: string[],
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext = DEFAULT_CALC_CTX,
  reactionOverride?: ReactionOverride
): number {
  return evalDamage(
    teamBuild,
    dpsCharId,
    formulaIds,
    artifactStats,
    ctx,
    reactionOverride
  );
}

/**
 * Compute the ideal score for a build (for normalization to 300).
 * This function is independent of the damage calculator.
 */
export function computeIdealScore(
  weights: Record<SubStat, number>,
  sandsWeight: number,
  gobletWeight: number,
  circletWeight: number,
  sandsCdEquiv = 62.1,
  gobletCdEquiv = 62.1,
  circletCdEquiv = 62.1
): { idealScore: number; normalizer: number } {
  // Main stat contribution
  const mainStatScore =
    sandsCdEquiv * (sandsWeight / 100) +
    gobletCdEquiv * (gobletWeight / 100) +
    circletCdEquiv * (circletWeight / 100);

  // Substat contribution: distribute [22, 10, 5, 5] rolls across top 4 stats
  const sortedWeights = Object.entries(weights)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  const rollDistribution = [22, 10, 5, 5];
  let substatScore = 0;
  for (let i = 0; i < Math.min(sortedWeights.length, 4); i++) {
    const [, weight] = sortedWeights[i];
    const rolls = rollDistribution[i];
    substatScore += rolls * 6.6045 * (weight / 100);
  }

  const idealScore = mainStatScore + substatScore;
  const normalizer = idealScore > 0 ? 300 / idealScore : 1;

  return { idealScore, normalizer };
}

/**
 * Average weights across multiple auto-tune results.
 * Re-normalizes so the highest weight is 100.
 */
export function averageWeights(
  results: AutoTuneResult[]
): Record<SubStat, number> {
  if (results.length === 0) return {} as Record<SubStat, number>;

  const averaged = {} as Record<SubStat, number>;
  for (const stat of TUNABLE_SUBSTATS) {
    const sum = results.reduce((acc, r) => acc + (r.weights[stat] || 0), 0);
    averaged[stat] = Math.round(sum / results.length);
  }

  // Re-normalize so the highest weight is 100
  const maxWeight = Math.max(...Object.values(averaged));
  if (maxWeight > 0 && maxWeight !== 100) {
    for (const stat of TUNABLE_SUBSTATS) {
      averaged[stat] = Math.round((averaged[stat] / maxWeight) * 100);
    }
  }

  return averaged;
}
