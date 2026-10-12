import { statPools } from "@/config/gameConstants";
import type { Slot } from "@/domain/enums";

/**
 * Stats that can appear on a given slot (substats first in substat order,
 * then main-stat-only stats appended). Use for sort selectors scoped to a slot.
 */
export function getSortableStatsForSlot(slot: Slot): string[] {
  const mainStats = new Set<string>(statPools[slot] as readonly string[]);
  const subs = statPools.substat as readonly string[];
  // Start with substats (in substat order), which are the most useful to sort by
  const result: string[] = [...subs];
  // Append main-stat-only stats (e.g. elemental%, heal%) that aren't already in substats
  for (const ms of mainStats) {
    if (!result.includes(ms)) result.push(ms);
  }
  return result;
}
