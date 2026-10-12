import type { MainStat } from "@/domain/enums";
import type { WeaponStatsMap } from "@/domain/reference/stats";

export function getSortedWeaponSecondaryStats(
  weaponStats: WeaponStatsMap | null
): MainStat[] {
  if (!weaponStats) return [];
  const set = new Set<MainStat>();
  for (const entry of Object.values(weaponStats)) {
    if (entry.secondaryStat) set.add(entry.secondaryStat);
  }
  return Array.from(set).sort();
}
