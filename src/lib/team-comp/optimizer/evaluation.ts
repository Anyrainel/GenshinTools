/**
 * Damage evaluation functions for the B&B optimizer.
 *
 * - evaluateBuild: evaluate a complete 5-piece artifact build (cold path)
 * - evaluateUpperBoundCompiled: compute an optimistic upper bound using compiled expression
 */

import type { ArtifactData, MainStat } from "@/data/types";
import { getMainStatValueAtLevel } from "@/lib/account-data/scoring/utils";
import type { OptimizerContext, TeamBuild } from "../damageCalc";
import { hasOffFieldParts } from "../damageCalc";
import { StatSheet } from "../damageModels";
import type { ArtifactVarLookup, CompiledTeamDamage } from "../formulaCompiler";
import { fillVarsFromRawStats } from "../formulaCompiler";
import type {
  CalcContext,
  DamageResult,
  ReactionOverride,
  StatKey,
} from "../types";
import type { ConstraintChecker } from "./constraintChecker";
import type { ArtifactTuple } from "./types";

// ─── Off-Field Stats ───

/** Compute team stats with a non-formula character on-field (for off-field formula parts). */
export function getOffFieldStats(
  teamBuild: TeamBuild,
  formulaCharId: string,
  formulaId: string,
  sheets: Record<string, StatSheet>,
  calcContext: CalcContext
): Record<string, StatSheet> | undefined {
  if (!hasOffFieldParts(teamBuild, formulaCharId, formulaId)) return undefined;
  const otherCharId = Object.keys(teamBuild.charBuilds).find(
    (id) => id !== formulaCharId
  );
  if (!otherCharId) return undefined;
  return teamBuild.getTeamStats(sheets, otherCharId, calcContext);
}

// ─── Core Evaluation ───

/** Evaluate a complete 5-piece build using the domain-object path (cold path only). */
export function evaluateBuild(
  pieces: ArtifactTuple,
  teamBuild: TeamBuild,
  swapCharId: string,
  formulaCharId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcTargetId: string,
  calcContext: CalcContext,
  constraints: ConstraintChecker,
  reactionOverride?: ReactionOverride,
  optCtx?: OptimizerContext
): { damage: number; result: DamageResult | null } {
  const charSheet = StatSheet.fromArtifacts(pieces);

  const postStats = optCtx
    ? teamBuild.getTeamStatsFast(charSheet, optCtx)
    : teamBuild.getTeamStats(
        { ...baseSheets, [swapCharId]: charSheet },
        calcTargetId,
        calcContext
      );

  const er = postStats[constraints.charId]?.get("er", null) ?? 0;
  const cr = postStats[constraints.charId]?.get("cr", null) ?? 0;
  if (!constraints.isFeasibleByStats(er, cr)) {
    return { damage: -1, result: null };
  }

  const updatedSheets = { ...baseSheets, [swapCharId]: charSheet };
  const offFieldStats = getOffFieldStats(
    teamBuild,
    formulaCharId,
    formulaId,
    updatedSheets,
    calcContext
  );

  const dmgRes = teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride,
    offFieldStats
  );
  return { damage: dmgRes.totalDamage, result: dmgRes };
}

// ─── Compiled Evaluation ───

/**
 * Evaluate upper bound using the compiled damage expression.
 * Fills vars from real pieces + super-artifact raw stats.
 */
export function evaluateUpperBoundCompiled(
  /** Full 5-element pieces array; only elements [0..piecesCount) are used. */
  pieces: (ArtifactData | null)[],
  /** Number of real pieces to read from the start of pieces array. */
  piecesCount: number,
  superStatsRemaining: Partial<Record<StatKey, number>>[],
  /** Number of entries to read from superStatsRemaining (avoids .slice() allocation). */
  remainingCount: number,
  compiled: CompiledTeamDamage,
  lookup: ArtifactVarLookup,
  charIdx: number,
  reusableVars: Float64Array
): number {
  reusableVars.fill(0);
  // Fill vars from first piecesCount real pieces (avoids pieces.slice() allocation)
  for (let i = 0; i < piecesCount; i++) {
    const art = pieces[i];
    if (!art) continue;
    const mainKey = art.mainStatKey;
    if (mainKey) {
      const idx = lookup.keyToIdx.get(mainKey);
      if (idx !== undefined) {
        const displayVal = getMainStatValueAtLevel(
          mainKey as MainStat,
          art.rarity,
          art.level
        );
        reusableVars[idx] += lookup.keyIsPct.get(mainKey)
          ? displayVal / 100
          : displayVal;
      }
    }
    if (art.substats) {
      for (const subKey of Object.keys(art.substats)) {
        const subVal = art.substats[subKey as keyof typeof art.substats];
        if (!subVal) continue;
        const idx = lookup.keyToIdx.get(subKey);
        if (idx !== undefined) {
          reusableVars[idx] += lookup.keyIsPct.get(subKey)
            ? subVal / 100
            : subVal;
        }
      }
    }
  }
  fillVarsFromRawStats(
    superStatsRemaining,
    remainingCount,
    compiled.varMapping,
    charIdx,
    reusableVars
  );
  // Skip ER/CR constraint checks for upper bound (optimistic)
  return compiled.evaluate(reusableVars);
}
