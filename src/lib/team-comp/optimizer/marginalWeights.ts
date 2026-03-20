/**
 * Marginal-gain weight computation for the carry character.
 *
 * Evaluates the damage delta from +1 avg roll of each substat and from
 * adding each possible main stat. This gives context-aware weights that
 * account for CR capping, team buffs, and formula-specific stat valuation.
 *
 * Cost: ~20 damage evaluations (10 substats + ~10 main stats).
 */

import { MAIN_STAT_VALUES_5STAR, statPools } from "@/data/constants";
import type { MainStat, SubStat } from "@/data/types";
import { AVG_SUBSTAT_ROLL, toInternal } from "@/lib/account-data/scoring/utils";
import {
  type BuildMatchResult,
  getTargetMainStatsForSlot,
} from "../../account-data/artifactScore";
import type { TeamBuild } from "../damageCalc";
import { hasOffFieldParts } from "../damageCalc";
import { StatSheet } from "../damageModels";
import type { CalcContext, ReactionOverride, StatKey } from "../types";
import type { MarginalWeights } from "./types";

const MARGINAL_SUBSTATS: SubStat[] = [
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

const VARIABLE_SLOT_POOLS: Record<string, readonly MainStat[]> = {
  sands: statPools.sands,
  goblet: statPools.goblet,
  circlet: statPools.circlet,
};

export function computeMarginalWeights(
  teamBuild: TeamBuild,
  charId: string,
  formulaId: string,
  baseSheets: Record<string, StatSheet>,
  calcContext: CalcContext,
  buildMatch: BuildMatchResult | null | undefined,
  reactionOverride?: ReactionOverride,
  operatingPointSheet?: StatSheet
): MarginalWeights | null {
  // Operating point: use provided sheet (e.g. from warm-start) or synthetic midpoint
  let baseSheet: StatSheet;
  if (operatingPointSheet) {
    baseSheet = operatingPointSheet;
  } else {
    baseSheet = new StatSheet([]);
    if (buildMatch) {
      for (const slot of ["sands", "goblet", "circlet"] as const) {
        const rec = getTargetMainStatsForSlot(slot, buildMatch.build);
        if (rec.size > 0) {
          const mainStat = rec.values().next().value as MainStat;
          const value = MAIN_STAT_VALUES_5STAR[mainStat];
          if (value) {
            baseSheet = baseSheet.withDelta(
              mainStat as StatKey,
              toInternal(mainStat, value) * 0.5
            );
          }
        }
      }
    }
  }

  const sheets = { ...baseSheets, [charId]: baseSheet };

  // Precompute off-field target (if needed)
  const needsOffField = hasOffFieldParts(teamBuild, charId, formulaId);
  const offFieldCalcTarget = needsOffField
    ? Object.keys(teamBuild.charBuilds).find((id) => id !== charId)
    : undefined;

  const getOffField = (s: Record<string, StatSheet>) =>
    offFieldCalcTarget
      ? teamBuild.getTeamStats(s, offFieldCalcTarget, calcContext)
      : undefined;

  // Baseline damage at the operating point
  const teamStats = teamBuild.getTeamStats(sheets, charId, calcContext);
  let baseDamage: number;
  try {
    const result = teamBuild.getDamageResult(
      charId,
      formulaId,
      teamStats,
      calcContext,
      reactionOverride,
      getOffField(sheets)
    );
    baseDamage = result.totalDamage;
  } catch {
    return null;
  }
  if (baseDamage <= 0) return null;

  // Substat marginals: damage delta from +1 average roll of each substat
  const subMarginals: Record<string, number> = {};
  let maxMarginal = 0;
  for (const stat of MARGINAL_SUBSTATS) {
    const delta = AVG_SUBSTAT_ROLL[stat];
    if (!delta) {
      subMarginals[stat] = 0;
      continue;
    }
    const tweakedSheet = baseSheet.withDelta(stat as StatKey, delta);
    const tweakedSheets = { ...baseSheets, [charId]: tweakedSheet };
    const ts = teamBuild.getTeamStats(tweakedSheets, charId, calcContext);
    try {
      const r = teamBuild.getDamageResult(
        charId,
        formulaId,
        ts,
        calcContext,
        reactionOverride,
        getOffField(tweakedSheets)
      );
      subMarginals[stat] = Math.max(0, r.totalDamage - baseDamage);
    } catch {
      subMarginals[stat] = 0;
    }
    if (subMarginals[stat] > maxMarginal) maxMarginal = subMarginals[stat];
  }

  // Normalize substats to 0-100 scale
  const substatWeights: Record<string, number> = {};
  for (const stat of MARGINAL_SUBSTATS) {
    substatWeights[stat] =
      maxMarginal > 0
        ? Math.round((subMarginals[stat] / maxMarginal) * 100)
        : 0;
  }

  // Main stat marginals for variable slots (sands/goblet/circlet)
  const mainStatMarginals: Record<string, Record<string, number>> = {};
  for (const [slot, pool] of Object.entries(VARIABLE_SLOT_POOLS)) {
    const slotMarginals: Record<string, number> = {};
    let slotMax = 0;
    for (const mainStat of pool) {
      const value = MAIN_STAT_VALUES_5STAR[mainStat];
      if (!value) {
        slotMarginals[mainStat] = 0;
        continue;
      }
      const internalVal = toInternal(mainStat, value);
      const msSheet = baseSheet.withDelta(mainStat as StatKey, internalVal);
      const msSheets = { ...baseSheets, [charId]: msSheet };
      const ts = teamBuild.getTeamStats(msSheets, charId, calcContext);
      try {
        const r = teamBuild.getDamageResult(
          charId,
          formulaId,
          ts,
          calcContext,
          reactionOverride,
          getOffField(msSheets)
        );
        slotMarginals[mainStat] = Math.max(0, r.totalDamage - baseDamage);
      } catch {
        slotMarginals[mainStat] = 0;
      }
      if (slotMarginals[mainStat] > slotMax) slotMax = slotMarginals[mainStat];
    }
    // Normalize: best main stat → 1.0
    for (const mainStat of pool) {
      slotMarginals[mainStat] =
        slotMax > 0 ? slotMarginals[mainStat] / slotMax : 0;
    }
    mainStatMarginals[slot] = slotMarginals;
  }

  // Detect main stat disagreements
  let hasMainStatDisagreement = false;
  if (buildMatch) {
    for (const slot of ["sands", "goblet", "circlet"] as const) {
      const rec = getTargetMainStatsForSlot(slot, buildMatch.build);
      const slotM = mainStatMarginals[slot];
      if (!slotM || rec.size === 0) continue;
      let bestMain = "";
      let bestVal = 0;
      for (const [ms, val] of Object.entries(slotM)) {
        if (val > bestVal) {
          bestVal = val;
          bestMain = ms;
        }
      }
      if (bestMain && !rec.has(bestMain as MainStat)) {
        hasMainStatDisagreement = true;
        break;
      }
    }
  }

  return { substatWeights, mainStatMarginals, hasMainStatDisagreement };
}
