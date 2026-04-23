/**
 * Constrained Greedy Substat Allocation
 *
 * Shared greedy hill-climbing algorithm that respects real artifact constraints:
 * - Each artifact has at most 4 distinct substats
 * - Substats cannot match the slot's main stat
 * - Per-stat roll cap per artifact (defaults: 5★: 6, 4★: 4)
 * - Per-artifact total roll cap (defaults: 5★: 9, 4★: 7)
 *
 * Used by both generator (full artifact generation) and
 * autoTune (scoring weight generation).
 */

import { statPools } from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/enums";
import { allSlots } from "@/data/enums";
import {
  buildSheetFromMainAndSubs,
  type FlexSlotConfig,
} from "@/lib/artifact/scoring/sheetBuilder";
import { emptySubRolls } from "@/lib/artifact/scoring/utils";
import type { StatSheet } from "../../dmgcalc/core/statSheet";

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
  /** Pre-allocated substat rolls (e.g. to meet ER/CR constraints before greedy). */
  preFill?: Record<Slot, Partial<Record<SubStat, number>>>;
  /** Override per-slot max substat rolls (default: 9 for 5★, 7 for 4★). */
  maxRollsPerSlot?: number;
  /** Override max rolls on one substat line (default: 6 for 5★, 4 for 4★). */
  maxRollsPerStat?: number;
  /** Optional flex slot config for 5★ off-set slot in a 4★ set. */
  flex?: FlexSlotConfig;
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
  const { charId, mainStats, currentSheets, evalDamage, rv, preFill, flex } =
    opts;
  const rarity = opts.rarity ?? 5;

  const subRolls = emptySubRolls();
  const baseMaxRolls = opts.maxRollsPerSlot ?? rollsPerArtifact(rarity);
  const baseStatCap = opts.maxRollsPerStat ?? maxRollsPerStat(rarity);
  const slotMax = (s: Slot) =>
    flex?.slot === s ? flex.maxRolls : baseMaxRolls;
  const slotCap = (s: Slot) => (flex?.slot === s ? flex.statCap : baseStatCap);
  let totalRolls = allSlots.reduce((sum, s) => sum + slotMax(s), 0);

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

  // Apply pre-fill (e.g. ER/CR constraint rolls)
  if (preFill) {
    for (const slot of allSlots) {
      for (const [stat, rolls] of Object.entries(preFill[slot])) {
        if (!rolls) continue;
        subRolls[slot][stat as SubStat] = rolls;
        slotTotalRolls[slot] += rolls;
        chosenPerSlot[slot].add(stat as SubStat);
        totalRolls -= rolls;
      }
    }
  }

  const getSheet = () =>
    buildSheetFromMainAndSubs(mainStats, subRolls, rv, rarity, flex);
  const getSheets = () => ({ ...currentSheets, [charId]: getSheet() });

  /** Can this slot accept one more roll of `stat`? */
  const canPlace = (slot: Slot, stat: SubStat): boolean => {
    if (stat === (mainStats[slot] as string)) return false;
    const mx = slotMax(slot);
    if (slotTotalRolls[slot] >= mx) return false;
    if ((subRolls[slot][stat] ?? 0) >= slotCap(slot)) return false;
    if (chosenPerSlot[slot].has(stat)) {
      // Reserve remaining rolls for unchosen substats (1 each)
      const unchosenNeeded = MAX_SUBSTATS_PER_SLOT - chosenPerSlot[slot].size;
      return mx - slotTotalRolls[slot] > unchosenNeeded;
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
