/**
 * Constrained Greedy Substat Allocation
 *
 * Shared greedy hill-climbing algorithm that respects real artifact constraints:
 * - Each artifact has at most 4 distinct substats
 * - Substats cannot match the slot's main stat
 * - Per-stat roll cap per artifact (5★: 6, 4★: 4)
 * - Per-artifact total roll cap (5★: 9, 4★: 7)
 *
 * Used by both idealArtifactGen (full ideal artifact generation) and
 * autoTune (scoring weight generation).
 */

import { isPctStat } from "@/components/team-comp/displayFormatters";
import {
  AVERAGE_ROLL_MULTIPLIER,
  getMainStatValue,
  maxSubstatRolls,
  statPools,
} from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";

import { StatSheet } from "./damageModels";
import type { StatKey } from "./types";

// ─── Constants ───

const MAX_SUBSTATS_PER_SLOT = 4;
const allSubstats: readonly SubStat[] = statPools.substat;

// 5★: 4 initial + 5 upgrades = 9; 4★: 3 initial + 1 unlock + 3 upgrades = 7
function rollsPerArtifact(rarity: 4 | 5): number {
  return rarity === 5 ? 9 : 7;
}

// 5★: 1 initial + up to 5 upgrades = 6; 4★: 1 initial + up to 3 upgrades = 4
function maxRollsPerStat(rarity: 4 | 5): number {
  return rarity === 5 ? 6 : 4;
}

// ─── Roll value helpers ───

/** Compute per-stat roll values for a given multiplier and rarity */
export function getRollValues(
  multiplier: number = AVERAGE_ROLL_MULTIPLIER,
  rarity: 4 | 5 = 5
): Record<SubStat, number> {
  const rv = {} as Record<SubStat, number>;
  for (const [stat, maxVal] of Object.entries(maxSubstatRolls[rarity])) {
    rv[stat as SubStat] = maxVal * multiplier;
  }
  return rv;
}

/** Convert a roll value to StatSheet-internal representation (percent stats / 100) */
export function rollToInternal(
  stat: SubStat,
  rolls: number,
  rv: Record<SubStat, number>
): number {
  const raw = rv[stat] * rolls;
  return isPctStat(stat) ? raw / 100 : raw;
}

// ─── Sheet building ───

/**
 * Build a StatSheet from main stats and substat rolls.
 * Main stat values come from getMainStatValue (display form),
 * converted to internal representation (pct stats / 100).
 */
export function buildSheetFromMainAndSubs(
  mainStats: Record<Slot, MainStat>,
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5
): StatSheet {
  const combined: Partial<Record<StatKey, number>> = {};

  for (const slot of allSlots) {
    // Main stat
    const ms = mainStats[slot];
    const rawVal = getMainStatValue(ms, rarity);
    if (rawVal) {
      const mainVal = isPctStat(ms) ? rawVal / 100 : rawVal;
      combined[ms as StatKey] = (combined[ms as StatKey] ?? 0) + mainVal;
    }

    // Substats
    const slotSubs = subRolls[slot];
    for (const [stat, rolls] of Object.entries(slotSubs)) {
      if (!rolls) continue;
      const val = rollToInternal(stat as SubStat, rolls, rv);
      combined[stat as StatKey] = (combined[stat as StatKey] ?? 0) + val;
    }
  }

  return StatSheet.fromRaw(combined);
}

/** Create empty sub rolls record */
export function emptySubRolls(): Record<
  Slot,
  Partial<Record<SubStat, number>>
> {
  return {
    flower: {},
    plume: {},
    sands: {},
    goblet: {},
    circlet: {},
  };
}

// ─── Core: Constrained Greedy Allocation ───

/** Callback type for evaluating damage given stat sheets */
export type DamageEvalFn = (sheets: Record<string, StatSheet>) => number;

export interface ConstrainedGreedyOptions {
  /** Character ID to allocate substats for */
  charId: string;
  /** Main stats per slot */
  mainStats: Record<Slot, MainStat>;
  /** Current stat sheets for all team members */
  currentSheets: Record<string, StatSheet>;
  /** Damage evaluation callback */
  evalDamage: DamageEvalFn;
  /** Roll values per substat */
  rv: Record<SubStat, number>;
  /** Artifact rarity (default: 5) */
  rarity?: 4 | 5;
}

/**
 * Constrained greedy substat allocation that respects artifact rules.
 *
 * At each step:
 * 1. Compute marginal damage gain for every placeable substat
 * 2. Pick the stat with highest gain
 * 3. Find a slot that can accept it (respecting per-slot constraints)
 * 4. If no slot can accept the best stat, try the next best
 * 5. Allocate one roll and repeat
 *
 * Returns per-slot substat roll counts.
 */
export function constrainedGreedyAllocate(
  opts: ConstrainedGreedyOptions
): Record<Slot, Partial<Record<SubStat, number>>> {
  const { charId, mainStats, currentSheets, evalDamage, rv } = opts;
  const rarity = opts.rarity ?? 5;

  const subRolls = emptySubRolls();
  const maxRolls = rollsPerArtifact(rarity);
  const totalRolls = maxRolls * 5;
  const statCap = maxRollsPerStat(rarity);

  // Per-slot tracking
  const slotTotalRolls: Record<Slot, number> = {
    flower: 0,
    plume: 0,
    sands: 0,
    goblet: 0,
    circlet: 0,
  };
  const chosenPerSlot: Record<Slot, Set<SubStat>> = {
    flower: new Set(),
    plume: new Set(),
    sands: new Set(),
    goblet: new Set(),
    circlet: new Set(),
  };

  const getSheet = () =>
    buildSheetFromMainAndSubs(mainStats, subRolls, rv, rarity);
  const getSheets = () => ({ ...currentSheets, [charId]: getSheet() });

  /** Can this slot accept one more roll of `stat`? */
  const canPlace = (slot: Slot, stat: SubStat): boolean => {
    if (stat === (mainStats[slot] as string)) return false;
    if (slotTotalRolls[slot] >= maxRolls) return false;
    if ((subRolls[slot][stat] ?? 0) >= statCap) return false;
    if (chosenPerSlot[slot].has(stat)) {
      // Reserve remaining rolls for unchosen substats (1 each)
      const unchosenNeeded = MAX_SUBSTATS_PER_SLOT - chosenPerSlot[slot].size;
      return maxRolls - slotTotalRolls[slot] > unchosenNeeded;
    }
    return chosenPerSlot[slot].size < MAX_SUBSTATS_PER_SLOT;
  };

  /** Find a slot to place `stat`, preferring slots with fewer total rolls. */
  const findSlot = (stat: SubStat): Slot | null => {
    let best: Slot | null = null;
    let bestRolls = Number.POSITIVE_INFINITY;
    for (const slot of allSlots) {
      if (canPlace(slot, stat) && slotTotalRolls[slot] < bestRolls) {
        best = slot;
        bestRolls = slotTotalRolls[slot];
      }
    }
    return best;
  };

  for (let roll = 0; roll < totalRolls; roll++) {
    const baseDmg = evalDamage(getSheets());

    // Evaluate marginal gain for every substat and rank them
    const gains: { stat: SubStat; gain: number }[] = [];
    for (const stat of allSubstats) {
      // Quick check: can any slot accept this stat?
      if (!allSlots.some((s) => canPlace(s, stat))) continue;

      // Temporarily add one roll to any slot (stat value is slot-independent)
      const testSlot = allSlots.find((s) => canPlace(s, stat))!;
      subRolls[testSlot][stat] = (subRolls[testSlot][stat] ?? 0) + 1;
      const newDmg = evalDamage(getSheets());
      subRolls[testSlot][stat]! -= 1;
      if (subRolls[testSlot][stat] === 0) delete subRolls[testSlot][stat];

      gains.push({ stat, gain: newDmg - baseDmg });
    }

    // Sort by gain descending
    gains.sort((a, b) => b.gain - a.gain);

    // Try to place the best stat; if no slot available, try next best
    let placed = false;
    for (const { stat } of gains) {
      const slot = findSlot(stat);
      if (slot) {
        subRolls[slot][stat] = (subRolls[slot][stat] ?? 0) + 1;
        slotTotalRolls[slot]++;
        chosenPerSlot[slot].add(stat);
        placed = true;
        break;
      }
    }

    if (!placed) break;
  }

  return subRolls;
}

// ─── Utility: flatten per-slot allocation to per-stat totals ───

/**
 * Flatten per-slot substat rolls into total rolls per stat.
 * Useful for scoring weight computation which doesn't need per-slot detail.
 */
export function flattenAllocation(
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>
): Record<SubStat, number> {
  const totals = {} as Record<SubStat, number>;
  for (const stat of allSubstats) {
    totals[stat] = 0;
  }
  for (const slot of allSlots) {
    for (const [stat, rolls] of Object.entries(subRolls[slot])) {
      if (rolls) {
        totals[stat as SubStat] = (totals[stat as SubStat] ?? 0) + rolls;
      }
    }
  }
  return totals;
}
