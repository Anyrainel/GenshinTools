/**
 * Damage evaluation functions for the B&B optimizer.
 *
 * - evaluateBuild: evaluate a complete 5-piece artifact build
 * - evaluateUpperBound: compute an optimistic upper bound using super-artifacts
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
import type { ArtifactTuple, BnBContext, SuperArtifact } from "./types";

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

export function evaluateBuild(
  pieces: ArtifactTuple,
  ctx: BnBContext
): { damage: number; result: DamageResult | null } {
  const {
    teamBuild,
    swapCharId,
    formulaCharId,
    formulaId,
    baseSheets,
    calcTargetId,
    calcContext,
    constraints,
    reactionOverride,
    scoreFn,
    optCtx,
  } = ctx;

  const charSheet = StatSheet.fromArtifacts(pieces);

  if (scoreFn) {
    if (!constraints.isFeasibleByArtifacts(pieces))
      return { damage: -1, result: null };
    const updatedSheets = { ...baseSheets, [swapCharId]: charSheet };
    return { damage: scoreFn(updatedSheets, calcTargetId), result: null };
  }

  const postStats = optCtx
    ? teamBuild.getTeamStatsFast(charSheet, optCtx)
    : teamBuild.getTeamStats(
        { ...baseSheets, [swapCharId]: charSheet },
        calcTargetId,
        calcContext
      );

  if (
    !constraints.isFeasibleByStats(
      postStats[constraints.charId]?.get("er", null) ?? 0,
      postStats[constraints.charId]?.get("cr", null) ?? 0
    )
  ) {
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

export function evaluateUpperBound(
  realPieces: (ArtifactData | null)[],
  superStatsRemaining: Partial<Record<StatKey, number>>[],
  ctx: BnBContext
): number {
  const {
    teamBuild,
    swapCharId,
    formulaCharId,
    formulaId,
    baseSheets,
    calcTargetId,
    calcContext,
    reactionOverride,
    scoreFn,
    optCtx,
  } = ctx;

  const realArts = realPieces.filter((a): a is ArtifactData => a != null);
  let sheet = StatSheet.fromArtifacts(realArts);
  for (const ss of superStatsRemaining) {
    if (Object.keys(ss).length > 0) sheet = sheet.merge(StatSheet.fromRaw(ss));
  }

  if (scoreFn) {
    const updatedSheets = { ...baseSheets, [swapCharId]: sheet };
    return scoreFn(updatedSheets, calcTargetId);
  }

  const postStats = optCtx
    ? teamBuild.getTeamStatsFast(sheet, optCtx)
    : teamBuild.getTeamStats(
        { ...baseSheets, [swapCharId]: sheet },
        calcTargetId,
        calcContext
      );
  const updatedSheets = { ...baseSheets, [swapCharId]: sheet };
  const offFieldStats = getOffFieldStats(
    teamBuild,
    formulaCharId,
    formulaId,
    updatedSheets,
    calcContext
  );

  return teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride,
    offFieldStats
  ).totalDamage;
}

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
