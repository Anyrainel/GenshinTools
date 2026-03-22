/**
 * Single source of truth for ER/CR constraint checking.
 *
 * Replaces the scattered erFloor/crFloor computations and inline
 * feasibility checks across DFS, evaluation, and team orchestration.
 */

import type { TeamBuild } from "../damageCalc";
import { StatSheet } from "../damageModels";
import type { CompiledTeamDamage } from "../formulaCompiler";
import type { CalcContext, OptFailReason } from "../types";
import { getArtifactCr, getArtifactEr } from "./artifactScoring";
import type { ArtifactTuple, PreparedSlotData } from "./types";

export class ConstraintChecker {
  readonly charId: string;
  readonly hasEr: boolean;
  readonly hasCr: boolean;
  readonly active: boolean;
  readonly minEr: number;
  readonly minCr: number;
  readonly erFloor: number;
  readonly crFloor: number;
  readonly erGap: number;
  readonly crGap: number;

  constructor(
    teamBuild: TeamBuild,
    charId: string,
    baseSheets: Record<string, StatSheet>,
    calcTargetId: string,
    calcContext: CalcContext,
    minEr: number,
    minCr: number
  ) {
    this.charId = charId;
    this.minEr = minEr;
    this.minCr = minCr;
    this.hasEr = minEr > 0;
    this.hasCr = minCr > 0;
    this.active = this.hasEr || this.hasCr;

    if (this.active) {
      const blSheets = { ...baseSheets, [charId]: new StatSheet([]) };
      const blStats = teamBuild.getTeamStats(
        blSheets,
        calcTargetId,
        calcContext
      );
      this.erFloor = this.hasEr ? (blStats[charId]?.get("er", null) ?? 0) : 0;
      this.crFloor = this.hasCr ? (blStats[charId]?.get("cr", null) ?? 0) : 0;
    } else {
      this.erFloor = 0;
      this.crFloor = 0;
    }

    this.erGap = this.hasEr ? Math.max(0, this.minEr - this.erFloor) : 0;
    this.crGap = this.hasCr ? Math.max(0, this.minCr - this.crFloor) : 0;
  }

  /** DFS pruning: can remaining slots possibly meet constraints? */
  canMeet(
    cumEr: number,
    cumCr: number,
    suffixMaxEr: number,
    suffixMaxCr: number
  ): boolean {
    if (this.hasEr && this.erFloor + cumEr + suffixMaxEr < this.minEr)
      return false;
    if (this.hasCr && this.crFloor + cumCr + suffixMaxCr < this.minCr)
      return false;
    return true;
  }

  /** Leaf check using artifact ER/CR sums (scoreFn path). */
  isFeasibleByArtifacts(pieces: ArtifactTuple): boolean {
    if (this.hasEr) {
      let artEr = 0;
      for (const p of pieces) artEr += getArtifactEr(p);
      if (this.erFloor + artEr < this.minEr) return false;
    }
    if (this.hasCr) {
      let artCr = 0;
      for (const p of pieces) artCr += getArtifactCr(p);
      if (this.crFloor + artCr < this.minCr) return false;
    }
    return true;
  }

  /** Leaf check using post-stat ER/CR values (standard evaluation path). */
  isFeasibleByStats(er: number, cr: number): boolean {
    if (this.hasEr && er < this.minEr) return false;
    if (this.hasCr && cr < this.minCr) return false;
    return true;
  }

  /** Leaf check using compiled constraint expressions (compiled DFS path). */
  isFeasibleCompiled(
    compiled: CompiledTeamDamage,
    vars: Float64Array
  ): boolean {
    if (compiled.evaluateEr && compiled.evaluateEr(vars) < 0) return false;
    if (compiled.evaluateCr && compiled.evaluateCr(vars) < 0) return false;
    return true;
  }

  /** After B&B: explain why no feasible build was found. */
  diagnoseFailure(slotData: PreparedSlotData[]): OptFailReason | undefined {
    if (!this.active) return undefined;
    if (this.hasEr) {
      let maxEr = 0;
      for (let s = 0; s < 5; s++) maxEr += slotData[s].slotSuperArtifact.maxEr;
      if (this.erFloor + maxEr < this.minEr) {
        return {
          kind: "er-unmet",
          minEr: this.minEr,
          bestEr: this.erFloor + maxEr,
        };
      }
    }
    if (this.hasCr) {
      let maxCr = 0;
      for (let s = 0; s < 5; s++) maxCr += slotData[s].slotSuperArtifact.maxCr;
      if (this.crFloor + maxCr < this.minCr) {
        return {
          kind: "cr-unmet",
          minCr: this.minCr,
          bestCr: this.crFloor + maxCr,
        };
      }
    }
    return undefined;
  }
}

/** Boost ER/CR weights proportionally to the constraint gap.
 *  Pass `referenceMaxWeight` to use a consistent scale across multiple weight sets. */
export function boostWeightsForConstraints(
  constraints: ConstraintChecker,
  weights: Record<string, number>,
  referenceMaxWeight?: number
): Record<string, number> | null {
  if (constraints.erGap <= 0 && constraints.crGap <= 0) return null;

  const maxWeight =
    referenceMaxWeight ??
    Math.max(0, ...Object.values(weights).map((v) => Math.abs(v ?? 0)));
  if (maxWeight <= 0) return null;

  const boosted = { ...weights };
  if (constraints.erGap > 0) {
    const syntheticEr = Math.min(constraints.erGap, 1.5) * maxWeight;
    boosted.er = Math.max(boosted.er ?? 0, syntheticEr);
  }
  if (constraints.crGap > 0) {
    const syntheticCr = constraints.crGap * maxWeight;
    boosted.cr = Math.max(boosted.cr ?? 0, syntheticCr);
  }
  return boosted;
}
