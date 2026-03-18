/**
 * Damage evaluation functions for the B&B optimizer.
 *
 * - evaluateBuild: evaluate a complete 5-piece artifact build
 * - evaluateUpperBound: compute an optimistic upper bound using super-artifacts
 */

import type { ArtifactData } from "@/data/types";
import type { OptimizerContext, TeamBuild } from "../damageCalc";
import { StatSheet } from "../damageModels";
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
    targetEr,
    targetCr,
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

  if (targetEr > 0) {
    const er = postStats[erCheckCharId]?.get("er") ?? 0;
    if (er < targetEr) return { damage: -1, result: null };
  }
  if (targetCr > 0) {
    const cr = postStats[erCheckCharId]?.get("cr") ?? 0;
    if (cr < targetCr) return { damage: -1, result: null };
  }

  const dmgRes = teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride
  );
  return { damage: dmgRes.totalDamage, result: dmgRes };
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
  return teamBuild.getDamageResult(
    formulaCharId,
    formulaId,
    postStats,
    calcContext,
    reactionOverride
  ).totalDamage;
}
