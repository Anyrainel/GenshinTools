/**
 * Damage evaluation functions for the B&B optimizer.
 *
 * - evaluateBuild: evaluate a complete 5-piece artifact build
 * - evaluateUpperBound: compute an optimistic upper bound using super-artifacts
 */

import type { ArtifactData } from "@/data/types";
import { getMainStatValueAtLevel } from "@/lib/account-data/scoring/utils";
import type { OptimizerContext, TeamBuild } from "../damageCalc";
import { hasOffFieldParts } from "../damageCalc";
import { StatSheet } from "../damageModels";
import type { ArtifactVarLookup, CompiledTeamDamage } from "../formulaCompiler";
import {
  fillVarsFromArtifactsFast,
  fillVarsFromRawStats,
} from "../formulaCompiler";
import type {
  CalcContext,
  DamageResult,
  ReactionOverride,
  StatKey,
} from "../types";
import type { ArtifactTuple, BnBContext, SuperArtifact } from "./types";

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
    erCheckCharId,
    minEr,
    minCr,
    reactionOverride,
    scoreFn,
    optCtx,
  } = ctx;

  const charSheet = StatSheet.fromArtifacts(pieces);

  if (scoreFn) {
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

  if (minEr > 0) {
    const er = postStats[erCheckCharId]?.get("er", null) ?? 0;
    if (er < minEr) return { damage: -1, result: null };
  }
  if (minCr > 0) {
    const cr = postStats[erCheckCharId]?.get("cr", null) ?? 0;
    if (cr < minCr) return { damage: -1, result: null };
  }

  // Compute off-field stats if the formula has off-field parts
  let offFieldStats: Record<string, StatSheet> | undefined;
  if (hasOffFieldParts(teamBuild, formulaCharId, formulaId)) {
    const otherCharId = Object.keys(teamBuild.charBuilds).find(
      (id) => id !== formulaCharId
    );
    if (otherCharId) {
      offFieldStats = teamBuild.getTeamStats(
        { ...baseSheets, [swapCharId]: charSheet },
        otherCharId,
        calcContext
      );
    }
  }

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
 * Evaluate a build using the compiled damage expression.
 * Much faster than evaluateBuild: ~20-50 arithmetic ops, zero allocations.
 *
 * @param pieces - The 5-piece artifact tuple
 * @param compiled - Pre-compiled damage expression
 * @param charIdx - The character index in the team (for VarMapping)
 * @param reusableVars - Pre-allocated Float64Array (reused across calls)
 */
export function evaluateBuildCompiled(
  pieces: ArtifactTuple,
  compiled: CompiledTeamDamage,
  lookup: ArtifactVarLookup,
  reusableVars: Float64Array
): { damage: number } {
  // Zero the vars array
  reusableVars.fill(0);

  // Fill vars from artifacts (fast path — no StatSheet construction)
  fillVarsFromArtifactsFast(pieces, lookup, reusableVars);

  // Check ER constraint
  if (compiled.evaluateEr) {
    const er = compiled.evaluateEr(reusableVars);
    if (er < 0) return { damage: -1 }; // ER check encoded as threshold in the expr
  }

  // Check CR constraint
  if (compiled.evaluateCr) {
    const cr = compiled.evaluateCr(reusableVars);
    if (cr < 0) return { damage: -1 };
  }

  // Evaluate damage
  const damage = compiled.evaluate(reusableVars);
  return { damage };
}

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
  // Compute off-field stats if the formula has off-field parts
  let offFieldStats: Record<string, StatSheet> | undefined;
  if (hasOffFieldParts(teamBuild, formulaCharId, formulaId)) {
    const otherCharId = Object.keys(teamBuild.charBuilds).find(
      (id) => id !== formulaCharId
    );
    if (otherCharId) {
      offFieldStats = teamBuild.getTeamStats(
        { ...baseSheets, [swapCharId]: sheet },
        otherCharId,
        calcContext
      );
    }
  }

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
          mainKey as import("@/data/types").MainStat,
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
