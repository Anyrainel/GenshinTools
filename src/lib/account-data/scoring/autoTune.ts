/**
 * Auto-Tuning Engine for Build Weights
 *
 * Uses the real TeamBuild damage calculator for marginal analysis.
 * Algorithm: constrained greedy allocation at midpoint.
 *
 * 1. Construct baseline artifact stats (main stats only, no substats)
 * 2. Constrained greedy-allocate substat rolls respecting artifact rules
 * 3. Compute weights at the midpoint of the allocation
 * 4. Normalize weights to 0-100 scale
 */

import { AVG_SUBSTAT_ROLL } from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/types";
import {
  buildSheetFromMainAndSubs,
  constrainedGreedyAllocate,
  emptySubRolls,
  flattenAllocation,
  getRollValues,
} from "@/lib/team-comp/constrainedGreedy";
import type { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  ReactionOverride,
  StatKey,
} from "@/lib/team-comp/types";
import type { AutoTuneResult } from "./utils";
import {
  AVG_ROLL_CD_EQUIV,
  IDEAL_ROLL_DISTRIBUTION,
  SUBSTAT_BUDGET_ROLLS,
} from "./utils";
export { computeIdealScore } from "./utils";

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

/** A formula with an optional weight (count in the rotation) and per-formula reaction. */
export type WeightedFormula = {
  formulaId: string;
  count: number;
  reaction?: ReactionOverride;
};

/**
 * Evaluate damage for a given artifact stat configuration.
 * Sums damage across all provided formulas, weighted by count.
 * Each formula carries its own reaction override.
 */
function evalDamage(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulas: WeightedFormula[],
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext
): number {
  const teamStats = teamBuild.getTeamStats(artifactStats, dpsCharId, ctx);
  let total = 0;
  for (const { formulaId, count, reaction } of formulas) {
    const result = teamBuild.getDamageResult(
      dpsCharId,
      formulaId,
      teamStats,
      ctx,
      reaction
    );
    total += result.totalDamage * count;
  }
  return total;
}

/**
 * Compute marginal damage gain for +1 avg roll of each substat.
 */
function computeMarginals(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulas: WeightedFormula[],
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext,
  baseDamage: number
): Record<SubStat, number> {
  const marginals = {} as Record<SubStat, number>;
  const baseSheet = artifactStats[dpsCharId] ?? new StatSheet([]);

  for (const stat of TUNABLE_SUBSTATS) {
    const delta = (AVG_SUBSTAT_ROLL as Record<string, number>)[stat];
    if (!delta) {
      marginals[stat] = 0;
      continue;
    }

    const tweaked = {
      ...artifactStats,
      [dpsCharId]: baseSheet.withDelta(stat as StatKey, delta),
    };
    const dmg = evalDamage(teamBuild, dpsCharId, formulas, tweaked, ctx);
    marginals[stat] = dmg - baseDamage;
  }

  return marginals;
}

/**
 * Apply a flat roll allocation to a base sheet and return the resulting StatSheet.
 */
export function applyAllocation(
  baseSheet: StatSheet,
  allocation: Record<SubStat, number>,
  fraction = 1
): StatSheet {
  let sheet = baseSheet;
  for (const stat of TUNABLE_SUBSTATS) {
    const rolls = Math.round(allocation[stat] * fraction);
    const delta = (AVG_SUBSTAT_ROLL as Record<string, number>)[stat];
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
  formulas: WeightedFormula[],
  baseArtifactStats: Record<string, StatSheet>,
  allocation: Record<SubStat, number>,
  ctx: CalcContext
): Record<SubStat, number> {
  const baseSheet = baseArtifactStats[dpsCharId] ?? new StatSheet([]);
  const midpointSheet = applyAllocation(baseSheet, allocation, 0.5);

  const midpointStats = { ...baseArtifactStats, [dpsCharId]: midpointSheet };
  const baseDmg = evalDamage(
    teamBuild,
    dpsCharId,
    formulas,
    midpointStats,
    ctx
  );
  const marginals = computeMarginals(
    teamBuild,
    dpsCharId,
    formulas,
    midpointStats,
    ctx,
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

/** Convert plain formula IDs to weighted formulas (count=1 each, optional shared reaction). */
export function toWeightedFormulas(
  formulaIds: string[],
  reaction?: ReactionOverride
): WeightedFormula[] {
  return formulaIds.map((formulaId) => ({ formulaId, count: 1, reaction }));
}

/**
 * Main auto-tuning function using the real TeamBuild damage calculator.
 *
 * Uses constrained greedy allocation that respects real artifact rules:
 * - 4 distinct substats per artifact
 * - Main stat / substat exclusion
 * - Per-stat and per-artifact roll caps
 *
 * @param teamBuild - Constructed TeamBuild with full team + buff resolution
 * @param dpsCharId - The DPS character to optimize
 * @param formulas - Weighted formulas (formulaId + count + per-formula reaction)
 * @param mainStats - Main stats per artifact slot
 * @param baseArtifactStats - Artifact stats for all team members (teammates' sheets)
 * @param ctx - Calc context (enemy level, res, etc.)
 */
export function autoTuneWeights(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulas: WeightedFormula[],
  mainStats: Record<Slot, MainStat>,
  baseArtifactStats: Record<string, StatSheet>,
  ctx: CalcContext = DEFAULT_CALC_CTX
): AutoTuneResult {
  const rv = getRollValues();

  // Build baseline sheet from main stats only (no substats)
  const baseSheet = buildSheetFromMainAndSubs(mainStats, emptySubRolls(), rv);
  const baseStats = { ...baseArtifactStats, [dpsCharId]: baseSheet };

  // Step 1: Constrained greedy allocation
  const perSlotAllocation = constrainedGreedyAllocate({
    charId: dpsCharId,
    mainStats,
    currentSheets: baseStats,
    evalDamage: (sheets) =>
      evalDamage(teamBuild, dpsCharId, formulas, sheets, ctx),
    rv,
  });

  // Flatten per-slot allocation into per-stat totals
  const allocation = flattenAllocation(perSlotAllocation);

  // Step 2: Midpoint weights
  const weights = computeMidpointWeights(
    teamBuild,
    dpsCharId,
    formulas,
    baseStats,
    allocation,
    ctx
  );

  // Step 3: Midpoint marginals (for debugging/display)
  const midpointSheet = applyAllocation(baseSheet, allocation, 0.5);
  const midStats = { ...baseStats, [dpsCharId]: midpointSheet };
  const midDmg = evalDamage(teamBuild, dpsCharId, formulas, midStats, ctx);
  const midpointMarginals = computeMarginals(
    teamBuild,
    dpsCharId,
    formulas,
    midStats,
    ctx,
    midDmg
  );

  // Step 4: Final damage (full allocation applied)
  const finalSheet = applyAllocation(baseSheet, allocation);
  const finalStats = { ...baseStats, [dpsCharId]: finalSheet };
  const finalDamage = evalDamage(
    teamBuild,
    dpsCharId,
    formulas,
    finalStats,
    ctx
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
  formulas: WeightedFormula[],
  artifactStats: Record<string, StatSheet>,
  ctx: CalcContext = DEFAULT_CALC_CTX
): number {
  return evalDamage(teamBuild, dpsCharId, formulas, artifactStats, ctx);
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
