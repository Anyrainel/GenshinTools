/**
 * Auto-Tuning Engine for Build Weights
 *
 * Uses compiled AST evaluation for marginal analysis (~100x faster than domain objects).
 * Algorithm: constrained greedy allocation at midpoint.
 *
 * 1. Construct baseline artifact stats (main stats only, no substats)
 * 2. Constrained greedy-allocate substat rolls respecting artifact rules
 * 3. Compute weights at the midpoint of the allocation
 * 4. Normalize weights to 0-100 scale
 */

import type { MainStat, Slot, SubStat } from "@/data/types";
import {
  compileComboTeamDamage,
  makeCompiledEvalDamage,
} from "@/lib/team-comp/calc/formulaCompiler";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import type { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  type DamageEvalFn,
  buildSheetFromMainAndSubs,
  constrainedGreedyAllocate,
  emptySubRolls,
  flattenAllocation,
  getRollValues,
} from "@/lib/team-comp/generator/constrainedGreedy";
import type {
  CalcContext,
  ComboFormula,
  FormulaOverride,
  StatKey,
} from "@/lib/team-comp/types";
import type { AutoTuneResult } from "./utils";
import { AVG_SUBSTAT_ROLL } from "./utils";
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
};

/** A formula with an optional weight (count in the rotation) and per-formula reaction. */
export type WeightedFormula = {
  formulaId: string;
  count: number;
  reaction?: FormulaOverride;
};

/** Build a ComboFormula from WeightedFormula[] for a given DPS character. */
export function buildAutoTuneCombo(
  charId: string,
  formulas: WeightedFormula[]
): ComboFormula {
  return {
    id: "__autotune__",
    label: { zh: "", en: "" },
    lines: formulas.map((f) => ({
      charId,
      formulaId: f.formulaId,
      count: f.count,
      reaction: f.reaction,
    })),
  };
}

/**
 * Compile a DamageEvalFn from a TeamBuild + WeightedFormula[].
 *
 * Compiles the full damage pipeline into a single JS function.
 * The returned callback takes `Record<string, StatSheet>` and reads only
 * the DPS character's sheet — teammates' stats are baked into constants.
 */
export function compileAutoTuneEval(
  teamBuild: TeamBuild,
  dpsCharId: string,
  formulas: WeightedFormula[],
  baseArtifactStats: Record<string, StatSheet>,
  ctx: CalcContext = DEFAULT_CALC_CTX
): DamageEvalFn {
  const combo = buildAutoTuneCombo(dpsCharId, formulas);
  const compiled = compileComboTeamDamage(
    teamBuild,
    combo,
    dpsCharId,
    baseArtifactStats,
    ctx
  );
  const charIdx = compiled.charIdxMap?.get(dpsCharId) ?? 0;
  const vars = new Float64Array(compiled.numVars);
  return makeCompiledEvalDamage(dpsCharId, compiled, charIdx, vars);
}

/**
 * Compute marginal damage gain for +1 avg roll of each substat.
 */
function computeMarginals(
  evalDamageFn: DamageEvalFn,
  dpsCharId: string,
  artifactStats: Record<string, StatSheet>,
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
    const dmg = evalDamageFn(tweaked);
    marginals[stat] = dmg - baseDamage;
  }

  return marginals;
}

/**
 * Apply a flat roll allocation to a base sheet and return the resulting StatSheet.
 */
function applyAllocation(
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
  evalDamageFn: DamageEvalFn,
  dpsCharId: string,
  baseArtifactStats: Record<string, StatSheet>,
  allocation: Record<SubStat, number>
): Record<SubStat, number> {
  const baseSheet = baseArtifactStats[dpsCharId] ?? new StatSheet([]);
  const midpointSheet = applyAllocation(baseSheet, allocation, 0.5);

  const midpointStats = { ...baseArtifactStats, [dpsCharId]: midpointSheet };
  const baseDmg = evalDamageFn(midpointStats);
  const marginals = computeMarginals(
    evalDamageFn,
    dpsCharId,
    midpointStats,
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
  reaction?: FormulaOverride
): WeightedFormula[] {
  return formulaIds.map((formulaId) => ({ formulaId, count: 1, reaction }));
}

/**
 * Main auto-tuning function.
 *
 * Uses constrained greedy allocation that respects real artifact rules:
 * - 4 distinct substats per artifact
 * - Main stat / substat exclusion
 * - Per-stat and per-artifact roll caps
 *
 * @param dpsCharId - The DPS character to optimize
 * @param mainStats - Main stats per artifact slot
 * @param baseArtifactStats - Artifact stats for all team members (teammates' sheets)
 * @param evalDamageFn - Compiled damage evaluator (from compileAutoTuneEval)
 */
export function autoTuneWeights(
  dpsCharId: string,
  mainStats: Record<Slot, MainStat>,
  baseArtifactStats: Record<string, StatSheet>,
  evalDamageFn: DamageEvalFn
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
    evalDamage: evalDamageFn,
    rv,
  });

  // Flatten per-slot allocation into per-stat totals
  const allocation = flattenAllocation(perSlotAllocation);

  // Step 2: Midpoint weights
  const weights = computeMidpointWeights(
    evalDamageFn,
    dpsCharId,
    baseStats,
    allocation
  );

  // Step 3: Midpoint marginals (for debugging/display)
  const midpointSheet = applyAllocation(baseSheet, allocation, 0.5);
  const midStats = { ...baseStats, [dpsCharId]: midpointSheet };
  const midDmg = evalDamageFn(midStats);
  const midpointMarginals = computeMarginals(
    evalDamageFn,
    dpsCharId,
    midStats,
    midDmg
  );

  // Step 4: Final damage (full allocation applied)
  const finalSheet = applyAllocation(baseSheet, allocation);
  const finalStats = { ...baseStats, [dpsCharId]: finalSheet };
  const finalDamage = evalDamageFn(finalStats);

  return {
    weights,
    rollAllocation: allocation,
    midpointMarginals,
    finalDamage,
  };
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
