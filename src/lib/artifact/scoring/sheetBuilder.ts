import {
  allSlots,
  type MainStat,
  type Slot,
  type StatKey,
  type SubStat,
} from "@/data/enums";
import { getMainStatValue } from "@/data/utils";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { rollToInternal, toInternal } from "./utils";

/**
 * When a character uses a 4-star 4pc set, only 4 pieces need to match.
 * The 5th slot (sands/goblet/circlet) can be a 5-star off-set artifact
 * with higher main stat values and more substat rolls.
 */
export interface FlexSlotConfig {
  /** Which slot is promoted to 5★ */
  slot: Slot;
  /** 5★ roll values for substats in this slot */
  rv: Record<SubStat, number>;
  /** 5★ per-slot roll budget (e.g. 8 for preset "8_6") */
  maxRolls: number;
  /** 5★ per-stat cap (maxRolls - 3) */
  statCap: number;
}

/**
 * Build a StatSheet from main stats and substat rolls.
 * Main stat values come from getMainStatValue (display form),
 * converted to internal representation via toInternal.
 */
export function buildSheetFromMainAndSubs(
  mainStats: Record<Slot, MainStat>,
  subRolls: Record<Slot, Partial<Record<SubStat, number>>>,
  rv: Record<SubStat, number>,
  rarity: 4 | 5 = 5,
  flex?: FlexSlotConfig
): StatSheet {
  const combined: Partial<Record<StatKey, number>> = {};

  for (const slot of allSlots) {
    const isFlexed = flex?.slot === slot;
    const slotR: 4 | 5 = isFlexed ? 5 : rarity;
    const slotRv = isFlexed ? flex.rv : rv;

    // Main stat
    const ms = mainStats[slot];
    const rawVal = getMainStatValue(ms, slotR);
    if (rawVal) {
      combined[ms as StatKey] =
        (combined[ms as StatKey] ?? 0) + toInternal(ms, rawVal);
    }

    // Substats
    const slotSubs = subRolls[slot];
    for (const [stat, rolls] of Object.entries(slotSubs)) {
      if (!rolls) continue;
      const val = rollToInternal(stat as SubStat, rolls, slotRv);
      combined[stat as StatKey] = (combined[stat as StatKey] ?? 0) + val;
    }
  }

  return StatSheet.fromRaw(combined);
}
