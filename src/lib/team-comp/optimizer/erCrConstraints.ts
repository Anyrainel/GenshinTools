/**
 * Shared ER/CR constraint utilities for the optimizer and artifact generator.
 *
 * Both systems need to:
 * 1. Compute how much ER/CR artifacts must provide (the "gap")
 * 2. Determine whether forced main stats (ER sands / CR circlet) are needed
 * 3. Pre-fill substat rolls to meet remaining constraints
 */

import { getMainStatValue } from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import { toInternal } from "@/lib/artifact/scoring/utils";

import { StatSheet } from "../calc/statSheet";
import type { TeamBuild } from "../calc/teamBuild";
import type { CalcContext } from "../types";

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
 * @param rarity - artifact rarity
 * @param rv - roll values in display format
 * @param maxRollsPerSlot - per-artifact substat roll budget for this rarity
 * @param maxRollsPerStat - max rolls on one substat line for this rarity
 * @returns `null` if infeasible, otherwise per-slot pre-fill rolls
 */
export function computeSubstatPreFill(
  erGapAfterMain: number,
  crGapAfterMain: number,
  mainStats: Record<Slot, MainStat>,
  rarity: 4 | 5,
  rv: Record<SubStat, number>,
  maxRollsPerSlot: number,
  maxRollsPerStat: number
): Record<Slot, Partial<Record<SubStat, number>>> | null {
  const result: Record<Slot, Partial<Record<SubStat, number>>> = {
    flower: {},
    plume: {},
    sands: {},
    goblet: {},
    circlet: {},
  };

  // Each artifact must have exactly 4 distinct substats. Pre-fill must reserve
  // 1 roll per unchosen substat so the greedy allocator can reach 4 distinct stats.
  const MAX_SUBSTATS_PER_SLOT = 4;

  /** Max pre-fill rolls for a slot given how many distinct stats are already chosen. */
  const slotBudget = (slot: Slot): number => {
    const numChosen = Object.keys(result[slot]).length;
    const reserved = MAX_SUBSTATS_PER_SLOT - numChosen;
    const usedRolls = Object.values(result[slot]).reduce(
      (a, b) => a + (b ?? 0),
      0
    );
    return maxRollsPerSlot - usedRolls - reserved;
  };

  // Pre-fill ER
  if (erGapAfterMain > 0) {
    const erRollInternal = toInternal("er", rv.er);
    if (erRollInternal <= 0) return null;
    let erNeeded = Math.ceil(erGapAfterMain / erRollInternal);

    for (const slot of allSlots) {
      if (erNeeded <= 0) break;
      if ((mainStats[slot] as string) === "er") continue; // can't sub ER where ER is main
      const rolls = Math.min(erNeeded, maxRollsPerStat, slotBudget(slot));
      if (rolls <= 0) continue;
      result[slot].er = rolls;
      erNeeded -= rolls;
    }
    if (erNeeded > 0) return null; // infeasible
  }

  // Pre-fill CR
  if (crGapAfterMain > 0) {
    const crRollInternal = toInternal("cr", rv.cr);
    if (crRollInternal <= 0) return null;
    let crNeeded = Math.ceil(crGapAfterMain / crRollInternal);

    for (const slot of allSlots) {
      if (crNeeded <= 0) break;
      if ((mainStats[slot] as string) === "cr") continue;
      const available = Math.min(crNeeded, maxRollsPerStat, slotBudget(slot));
      if (available <= 0) continue;
      result[slot].cr = available;
      crNeeded -= available;
    }
    if (crNeeded > 0) return null; // infeasible
  }

  return result;
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
