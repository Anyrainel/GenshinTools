/**
 * Single source of truth for ER/CR constraint checking.
 *
 * Replaces the scattered erFloor/crFloor computations and inline
 * feasibility checks across DFS, evaluation, and team orchestration.
 */

import { isSelfReceiver } from "../calc/fieldState";
import type { CompiledTeamDamage } from "../calc/formulaCompiler";
import { ScalingBuff } from "../calc/statBuff";
import { StatSheet } from "../calc/statSheet";
import type { TeamBuild } from "../calc/teamBuild";
import type { CalcContext, OptFailReason, StatKey } from "../types";
import { getArtifactCr, getArtifactEr } from "./artifactScoring";
import type { ArtifactTuple, PreparedSlotData } from "./types";

/** Assumed EM from 3 artifact main stats (sands+goblet+circlet L20). */
const ESTIMATED_3EM_MAIN = 3 * 186.5;

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

  /**
   * @param charId The character whose ER/CR is constrained. Stats are computed
   *   with this character on-field: ER/CR matter when they cast their
   *   skill/burst (= they are on-field at that moment).
   */
  constructor(
    teamBuild: TeamBuild,
    charId: string,
    baseSheets: Record<string, StatSheet>,
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
      const blStats = teamBuild.getTeamStats(blSheets, charId, calcContext);
      const rawErFloor = this.hasEr
        ? (blStats[charId]?.get("er", null) ?? 0)
        : 0;
      const rawCrFloor = this.hasCr
        ? (blStats[charId]?.get("cr", null) ?? 0)
        : 0;

      // Adjust for scaling ER/CR buffs whose contribution grows with artifacts.
      // The raw floor only captures the scaling at empty sheets; we estimate
      // the likely artifact-boosted contribution so the constraint model is
      // less conservative (avoids over-requiring ER/CR from artifacts).
      const bonus = estimateScalingBonus(teamBuild, charId, blStats);
      this.erFloor = rawErFloor + bonus.er;
      this.crFloor = rawCrFloor + bonus.cr;
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
    if (compiled.evaluateEr) {
      const erVal = compiled.evaluateEr(vars);
      if (erVal < 0) return false;
    }
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

/**
 * Estimate the additional ER/CR floor contribution from scaling buffs that
 * grows with artifact stats, beyond what empty-sheet getTeamStats provides.
 *
 * Known scaling ER/CR buffs:
 *   Characters: traveler_electro (ER→ER team), rosaria (CR→CR other),
 *               nahida (EM→CR self), nilou C6 (HP→CR self), sigewinne C6 (HP→CR self)
 *   Weapons:    xiphos_moonlight (EM→ER self+other)
 *
 * Strategy:
 *   - Capped buffs: use cap as the estimated contribution, subtract what
 *     empty sheets already provide (to avoid double-counting).
 *   - Uncapped EM→ER (xiphos): estimate with 3 EM main stats.
 *   - ER→ER (traveler_electro): empty sheets already capture scale × baseER,
 *     which is a reasonable pre-artifact estimate. No extra adjustment.
 */
function estimateScalingBonus(
  teamBuild: TeamBuild,
  constraintCharId: string,
  emptyStats: Record<string, StatSheet>
): { er: number; cr: number } {
  let bonusEr = 0;
  let bonusCr = 0;

  for (const [providerCharId, build] of Object.entries(teamBuild.charBuilds)) {
    // Collect scaling buffs from character + weapon
    const allBuffs = [...build.charBase.buffs, ...build.weaponBase.buffs];

    for (const buff of allBuffs) {
      if (!(buff instanceof ScalingBuff)) continue;
      const outKey = buff.outputKey;
      if (outKey !== "er" && outKey !== "cr") continue;

      // Does this buff reach the constraint character?
      const receiver = buff.target.receiver;
      const reachesConstraint =
        (providerCharId === constraintCharId && isSelfReceiver(receiver)) ||
        receiver === "team" ||
        (receiver === "other" && providerCharId !== constraintCharId);
      if (!reachesConstraint) continue;

      // Compute what empty sheets already contribute (already in rawFloor)
      const providerStats = emptyStats[providerCharId];
      if (!providerStats) continue;
      const emptyInput = buff.threshold
        ? Math.max(0, providerStats.get(buff.inputKey, null) - buff.threshold)
        : providerStats.get(buff.inputKey, null);
      const emptyContribution = Math.min(
        emptyInput * buff.scale,
        buff.cap ?? Number.POSITIVE_INFINITY
      );

      let estimatedContribution: number;
      if (buff.cap != null) {
        // Capped: assume the buff hits cap with real artifacts
        estimatedContribution = buff.cap;
      } else if (buff.inputKey === "em") {
        // Uncapped EM-based (xiphos_moonlight): estimate EM with 3 main stats
        const baseEm = providerStats.get("em" as StatKey, null);
        const estimatedEm = baseEm + ESTIMATED_3EM_MAIN;
        const estInput = buff.threshold
          ? Math.max(0, estimatedEm - buff.threshold)
          : estimatedEm;
        estimatedContribution = estInput * buff.scale;
      } else {
        // Uncapped non-EM (e.g. traveler_electro ER→ER): the empty-sheet
        // value is a reasonable pre-artifact estimate. No extra adjustment.
        continue;
      }

      const extra = Math.max(0, estimatedContribution - emptyContribution);
      if (outKey === "er") bonusEr += extra;
      else bonusCr += extra;
    }
  }

  return { er: bonusEr, cr: bonusCr };
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
