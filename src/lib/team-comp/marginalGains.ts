/**
 * Shared marginal-gain computation.
 *
 * Evaluates the damage delta from +1 avg substat roll for each rollable stat
 * key, for each specified character.  The caller provides an eval function
 * that maps stat sheets → total damage; this lets the same loop power both
 * the display tab (cold-path evaluateCombo / getDamageResult) and the
 * optimizer/generator (compiled AST DamageEvalFn).
 *
 * Returns absolute damage deltas.  Callers convert to relative gains
 * (display: delta / baseDamage) or normalized weights (optimizer: 0-100).
 */

import { AVG_SUBSTAT_ROLL } from "@/lib/account-data/scoring/utils";
import { StatSheet } from "./damageModels";
import type { StatKey } from "./types";

/** All rollable substat keys — tested exhaustively for every character. */
const ROLLABLE_KEYS = Object.keys(AVG_SUBSTAT_ROLL) as StatKey[];

/**
 * Compute absolute damage deltas from +1 avg substat roll per character.
 *
 * @param evalFn  Maps team stat sheets → total damage number.
 *                Cold path: wraps evaluateCombo / getDamageResult.
 *                Hot path:  wraps compiled DamageEvalFn.
 * @param baseSheets  Current artifact stat sheets per character.
 * @param baseDamage  Damage evaluated at baseSheets (caller pre-computes
 *                    to avoid a redundant evalFn call).
 * @param charIds     Characters to evaluate (carry + supports).
 * @returns Per-character per-stat absolute damage deltas (zero entries omitted).
 */
export function computeSubstatMarginals(
  evalFn: (sheets: Record<string, StatSheet>) => number,
  baseSheets: Record<string, StatSheet>,
  baseDamage: number,
  charIds: string[]
): Record<string, Partial<Record<StatKey, number>>> {
  const result: Record<string, Partial<Record<StatKey, number>>> = {};
  for (const charId of charIds) {
    const charDeltas: Partial<Record<StatKey, number>> = {};
    for (const key of ROLLABLE_KEYS) {
      const delta = (AVG_SUBSTAT_ROLL as Record<string, number>)[key];
      if (!delta) continue;
      const tweaked = { ...baseSheets };
      tweaked[charId] = (baseSheets[charId] ?? new StatSheet([])).withDelta(
        key,
        delta
      );
      const newDamage = evalFn(tweaked);
      const gain = newDamage - baseDamage;
      if (gain !== 0) charDeltas[key] = gain;
    }
    if (Object.keys(charDeltas).length > 0) result[charId] = charDeltas;
  }
  return result;
}
