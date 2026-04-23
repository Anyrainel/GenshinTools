import { statPools } from "@/data/constants";
import type { MainStat, Slot } from "@/data/enums";
import type { WeaponStatsMap } from "@/data/gameStatsLoader";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the full URL for an asset path
 * Prepends the Vite base URL for proper asset loading
 */
export function getAssetUrl(path: string): string {
  const BASE_URL = import.meta.env.BASE_URL || "/";

  // If path already starts with BASE_URL, return as-is
  if (path.startsWith(BASE_URL)) {
    return path;
  }

  // If path starts with /, prepend BASE_URL (removing trailing slash if needed)
  if (path.startsWith("/")) {
    const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
    return base + path;
  }

  // Otherwise, just prepend BASE_URL
  return BASE_URL + path;
}

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
