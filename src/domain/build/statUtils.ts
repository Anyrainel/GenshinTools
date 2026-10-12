import {
  FLAT_STATS,
  MAIN_STAT_VALUES_4STAR,
  MAIN_STAT_VALUES_5STAR,
} from "../../config/gameConstants";
import type { MainStat } from "../enums";

export function isFlatStat(stat: string): boolean {
  return FLAT_STATS.has(stat);
}
/** Whether a stat key represents a percentage value (needs ÷100 for internal format). */

export function isPctStat(key: string): boolean {
  return (
    key.endsWith("%") ||
    key === "cr" ||
    key === "cd" ||
    key === "er" ||
    key === "reactionCr" ||
    key === "reactionCd"
  );
} /** Get the max-level main stat value in display format (46.6 for ATK%, 311 for flat ATK) */

export function getMainStatValue(stat: MainStat, rarity: number): number {
  const table = rarity === 4 ? MAIN_STAT_VALUES_4STAR : MAIN_STAT_VALUES_5STAR;
  return table[stat] ?? 0;
}
