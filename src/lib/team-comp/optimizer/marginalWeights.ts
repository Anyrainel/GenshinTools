/**
 * Marginal-gain weight computation for the carry character.
 *
 * Evaluates the damage delta from +1 avg roll of each substat and from
 * adding each possible main stat. This gives context-aware weights that
 * account for CR capping, team buffs, and formula-specific stat valuation.
 *
 * Substat marginals delegate to the shared computeSubstatMarginals loop;
 * main-stat marginals and disagreement detection remain optimizer-specific.
 */

import { MAIN_STAT_VALUES_5STAR, statPools } from "@/data/constants";
import type { MainStat, SubStat } from "@/data/types";
import { toInternal } from "@/lib/account-data/scoring/utils";
import {
  type BuildMatchResult,
  getTargetMainStatsForSlot,
} from "../../account-data/artifactScore";
import type { DamageEvalFn } from "../constrainedGreedy";
import { StatSheet } from "../damageModels";
import { computeSubstatMarginals } from "../marginalGains";
import type { StatKey } from "../types";
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
  evalDamageFn: DamageEvalFn,
  charId: string,
  baseSheets: Record<string, StatSheet>,
  buildMatch: BuildMatchResult | null | undefined,
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

  // Baseline damage at the operating point
  const baseDamage = evalDamageFn(sheets);
  if (baseDamage <= 0) return null;

  // Substat marginals via shared loop (returns absolute deltas)
  const rawDeltas = computeSubstatMarginals(evalDamageFn, sheets, baseDamage, [
    charId,
  ]);
  const charDeltas = rawDeltas[charId] ?? {};

  // Normalize substats to 0-100 scale
  let maxMarginal = 0;
  for (const val of Object.values(charDeltas)) {
    if (val > maxMarginal) maxMarginal = val;
  }
  const substatWeights: Record<string, number> = {};
  for (const stat of MARGINAL_SUBSTATS) {
    substatWeights[stat] =
      maxMarginal > 0
        ? Math.round(
            (Math.max(0, charDeltas[stat as StatKey] ?? 0) / maxMarginal) * 100
          )
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
      const dmg = evalDamageFn(msSheets);
      slotMarginals[mainStat] = Math.max(0, dmg - baseDamage);
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
