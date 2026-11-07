/**
 * Shared ER/CR constraint utilities for the optimizer and artifact generator.
 *
 * Both systems need to:
 * 1. Compute how much ER/CR artifacts must provide (the "gap")
 * 2. Determine whether forced main stats (ER sands / CR circlet) are needed
 * 3. Pre-fill substat rolls to meet remaining constraints
 */

import type { FlexSlotConfig } from "@/domain/build/artifact/scoring/sheetBuilder";
import { toInternal } from "@/domain/build/artifact/scoring/utils";
import { getMainStatValue } from "@/domain/build/statUtils";
import type { CalcContext } from "@/domain/combat/damage/types";
import type { MainStat, Slot, SubStat } from "@/domain/enums";
import { allSlots } from "@/domain/enums";
import type { OptFailReason } from "@/domain/team/types";
import { StatSheet } from "../damage/core/statSheet";
import type { TeamBuild } from "../damage/core/teamBuild";

// ─── Gap Computation ───

export interface ErCrGap {
  /** ER that artifacts must provide (internal, e.g. 0.518 = 51.8%). 0 if no gap. */
  erGap: number;
  /** CR that artifacts must provide (internal, e.g. 0.311 = 31.1%). 0 if no gap. */
  crGap: number;
}

/**
 * Compute how much ER/CR the artifact set must contribute to meet the thresholds.
 * gap = max(0, minX - baselineX), where baseline is the character's stat with empty artifacts.
 *
 * Stats are computed with charId on-field: ER/CR matter when the character
 * casts their skill/burst (= they are on-field at that moment).
 */
export function computeErCrGap(
  teamBuild: TeamBuild,
  charId: string,
  baseSheets: Record<string, StatSheet>,
  calcContext: CalcContext,
  minEr: number,
  minCr: number
): ErCrGap {
  if (minEr <= 0 && minCr <= 0) return { erGap: 0, crGap: 0 };

  const blSheets = { ...baseSheets, [charId]: new StatSheet([]) };
  const blStats = teamBuild.getTeamStats(blSheets, charId, calcContext);
  const baseEr = blStats[charId]?.get("er", null) ?? 0;
  const baseCr = blStats[charId]?.get("cr", null) ?? 0;

  return {
    erGap: minEr > 0 ? Math.max(0, minEr - baseEr) : 0,
    crGap: minCr > 0 ? Math.max(0, minCr - baseCr) : 0,
  };
}

/** Validate the actual panel in each constrained character's own on-field context. */
export function getErCrConstraintFailures(
  teamBuild: TeamBuild,
  sheets: Record<string, StatSheet>,
  calcContext: CalcContext,
  perChar?: Record<string, { minEr: number; minCr: number }>
): Record<string, Extract<OptFailReason, { kind: "er-unmet" | "cr-unmet" }>> {
  const failures: Record<
    string,
    Extract<OptFailReason, { kind: "er-unmet" | "cr-unmet" }>
  > = {};
  for (const [charId, { minEr, minCr }] of Object.entries(perChar ?? {})) {
    if (!teamBuild.charBuilds[charId] || (minEr <= 0 && minCr <= 0)) continue;
    const stats = teamBuild.getTeamStats(sheets, charId, calcContext)[charId];
    const er = stats.get("er", null);
    const cr = stats.get("cr", null);
    if (minEr > 0 && er < minEr - 1e-6) {
      failures[charId] = { kind: "er-unmet", minEr, bestEr: er };
    } else if (minCr > 0 && cr < minCr - 1e-6) {
      failures[charId] = { kind: "cr-unmet", minCr, bestCr: cr };
    }
  }
  return failures;
}

// ─── Main Stat Thresholds ───

/** ER main stat value (sands) in internal format for a given rarity. */
export function erMainStatInternal(rarity: 4 | 5 = 5): number {
  return toInternal("er", getMainStatValue("er", rarity));
}

/** CR main stat value (circlet) in internal format for a given rarity. */
export function crMainStatInternal(rarity: 4 | 5 = 5): number {
  return toInternal("cr", getMainStatValue("cr", rarity));
}

// ─── Substat Pre-fill ───

/**
 * Compute how many ER/CR substat rolls to pre-allocate before damage-greedy allocation.
 *
 * @param erGapAfterMain - remaining ER gap after main stats (internal)
 * @param crGapAfterMain - remaining CR gap after main stats (internal)
 * @param mainStats - chosen main stats (to exclude ER/CR substats from slots with matching mains)
 * @param rv - roll values in display format
 * @param maxRollsPerSlot - per-artifact substat roll budget for this rarity
 * @param maxRollsPerStat - max rolls on one substat line for this rarity
 * @returns `null` if infeasible, otherwise per-slot pre-fill rolls
 */
export function computeSubstatPreFill(
  erGapAfterMain: number,
  crGapAfterMain: number,
  mainStats: Record<Slot, MainStat>,
  rv: Record<SubStat, number>,
  maxRollsPerSlot: number,
  maxRollsPerStat: number,
  flex?: FlexSlotConfig
): Record<Slot, Partial<Record<SubStat, number>>> | null {
  const result: Record<Slot, Partial<Record<SubStat, number>>> = {
    flower: {},
    plume: {},
    sands: {},
    goblet: {},
    circlet: {},
  };

  // Work in hundredths of a displayed percent, matching synthesized artifacts.
  // This also prevents a threshold from being met only before display rounding.
  const contribution = (value: number, rolls: number) =>
    Math.round(Number((value * rolls).toFixed(2)) * 100);
  const targetEr = Math.max(0, Math.ceil(erGapAfterMain * 10000 - 1e-6));
  const targetCr = Math.max(0, Math.ceil(crGapAfterMain * 10000 - 1e-6));
  const options = allSlots.map((slot) => {
    const slotRv = flex?.slot === slot ? flex.rv : rv;
    const budget = flex?.slot === slot ? flex.maxRolls : maxRollsPerSlot;
    const cap = flex?.slot === slot ? flex.statCap : maxRollsPerStat;
    const erCap = mainStats[slot] === "er" ? 0 : cap;
    const crCap = mainStats[slot] === "cr" ? 0 : cap;
    const variants: {
      er: number;
      cr: number;
      erRolls: number;
      crRolls: number;
    }[] = [];
    for (let erRolls = erCap; erRolls >= 0; erRolls--) {
      for (let crRolls = crCap; crRolls >= 0; crRolls--) {
        const reserved = 4 - Number(erRolls > 0) - Number(crRolls > 0);
        if (erRolls + crRolls + reserved > budget) continue;
        variants.push({
          er: contribution(slotRv.er, erRolls),
          cr: contribution(slotRv.cr, crRolls),
          erRolls,
          crRolls,
        });
      }
    }
    return variants;
  });
  const suffixEr = new Array<number>(6).fill(0);
  const suffixCr = new Array<number>(6).fill(0);
  for (let index = 4; index >= 0; index--) {
    suffixEr[index] =
      suffixEr[index + 1] + Math.max(0, ...options[index].map((v) => v.er));
    suffixCr[index] =
      suffixCr[index + 1] + Math.max(0, ...options[index].map((v) => v.cr));
  }
  const misses = new Set<string>();
  const visit = (index: number, er: number, cr: number): boolean => {
    if (er <= 0 && cr <= 0) return true;
    if (index === 5 || er > suffixEr[index] || cr > suffixCr[index])
      return false;
    const key = `${index}|${er}|${cr}`;
    if (misses.has(key)) return false;
    const slotRv = flex?.slot === allSlots[index] ? flex.rv : rv;
    for (const variant of options[index]) {
      // Never spend extra rolls after this constraint is already filled.
      if ((er <= 0 && variant.erRolls > 0) || (cr <= 0 && variant.crRolls > 0))
        continue;
      if (
        variant.erRolls > 0 &&
        contribution(slotRv.er, variant.erRolls - 1) >= er
      )
        continue;
      if (
        variant.crRolls > 0 &&
        contribution(slotRv.cr, variant.crRolls - 1) >= cr
      )
        continue;
      const nextEr = Math.max(0, er - variant.er);
      const nextCr = Math.max(0, cr - variant.cr);
      if (!visit(index + 1, nextEr, nextCr)) continue;
      if (variant.erRolls) result[allSlots[index]].er = variant.erRolls;
      if (variant.crRolls) result[allSlots[index]].cr = variant.crRolls;
      return true;
    }
    misses.add(key);
    return false;
  };
  return visit(0, targetEr, targetCr) ? result : null;
}

/**
 * Compute the remaining ER/CR gap after accounting for main stat choices.
 */
export function erCrGapAfterMainStats(
  gap: ErCrGap,
  mainStats: Record<Slot, MainStat>,
  rarity: 4 | 5,
  flex?: { slot: Slot }
): { erRemaining: number; crRemaining: number } {
  let erFromMain = 0;
  let crFromMain = 0;
  for (const slot of allSlots) {
    const r = flex?.slot === slot ? 5 : rarity;
    if (mainStats[slot] === "er")
      erFromMain += toInternal("er", getMainStatValue("er", r));
    if (mainStats[slot] === "cr")
      crFromMain += toInternal("cr", getMainStatValue("cr", r));
  }
  return {
    erRemaining: Math.max(0, gap.erGap - erFromMain),
    crRemaining: Math.max(0, gap.crGap - crFromMain),
  };
}

// ─── ER-20 Half-Set Fallback ───

/** The half-set ID for the +20% ER 2pc bonus. */
export const ER_20_HALF_SET_ID = "er-20";
