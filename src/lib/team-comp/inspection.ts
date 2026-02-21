import type { SubStat } from "@/data/types";

import type { ResolvedBuff, StatKey } from "./types";

// ─── Average 5★ Substat Roll Values ──────────────────────────────
// Mean of all possible roll tiers for 5★ artifacts.
// Used by marginal-gain analysis (one roll ≈ this delta).

export const AVG_SUBSTAT_ROLL: Partial<Record<StatKey, number>> = {
  hp: 253.9,
  atk: 16.5,
  def: 19.7,
  "hp%": 0.0496,
  "atk%": 0.0496,
  "def%": 0.062,
  em: 19.8,
  er: 0.055,
  cr: 0.0331,
  cd: 0.0662,
} satisfies Record<SubStat, number>;

// ─── Stat Inspection Utilities ───────────────────────────────────

/**
 * For each stat, how many average substat rolls the current value represents.
 * Useful for gauging how invested a stat sheet is per stat.
 */
export function computeRollEquivalents(
  stats: Partial<Record<StatKey, number>>
): Partial<Record<StatKey, number>> {
  const result: Partial<Record<StatKey, number>> = {};
  for (const [key, value] of Object.entries(stats)) {
    const avg = AVG_SUBSTAT_ROLL[key as StatKey];
    if (avg && value) {
      result[key as StatKey] = value / avg;
    }
  }
  return result;
}

// ─── Buff Inspection Utilities ───────────────────────────────────

/**
 * Filter out buffs that don't meaningfully contribute.
 * A buff is trivial if all its entries (static + dynamic) have values < threshold.
 */
export function isTrivialBuff(buff: ResolvedBuff, threshold = 0.001): boolean {
  for (const e of buff.staticEntries) {
    if (Math.abs(e.value) >= threshold) return false;
  }
  for (const e of buff.dynamicEntries) {
    if (Math.abs(e.value) >= threshold) return false;
  }
  return true;
}
