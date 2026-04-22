/**
 * Compiled evaluation functions for the B&B optimizer.
 *
 * - evaluateUpperBoundCompiled: compute an optimistic upper bound using compiled expression
 */

import type { ArtifactData, MainStat } from "@/data/types";
import { getMainStatValueAtLevel } from "@/lib/artifact/scoring/utils";
import type {
  ArtifactVarLookup,
  CompiledTeamDamage,
} from "../calc/formulaCompiler";
import { fillVarsFromRawStats } from "../calc/formulaCompiler";
import type { StatKey } from "../types";

// ─── Compiled Evaluation ───

/**
 * Evaluate upper bound using the compiled damage expression.
 * Fills vars from real pieces + super-artifact raw stats.
 */
export function evaluateUpperBoundCompiled(
  /** Full 5-element pieces array; only elements [0..piecesCount) are used. */
  pieces: (ArtifactData | null)[],
  /** Number of real pieces to read from the start of pieces array. */
  piecesCount: number,
  superStatsRemaining: Partial<Record<StatKey, number>>[],
  /** Number of entries to read from superStatsRemaining (avoids .slice() allocation). */
  remainingCount: number,
  compiled: CompiledTeamDamage,
  lookup: ArtifactVarLookup,
  charIdx: number,
  reusableVars: Float64Array
): number {
  reusableVars.fill(0);
  // Fill vars from first piecesCount real pieces (avoids pieces.slice() allocation)
  for (let i = 0; i < piecesCount; i++) {
    const art = pieces[i];
    if (!art) continue;
    const mainKey = art.mainStatKey;
    if (mainKey) {
      const idx = lookup.keyToIdx.get(mainKey);
      if (idx !== undefined) {
        const displayVal = getMainStatValueAtLevel(
          mainKey as MainStat,
          art.rarity,
          art.level
        );
        reusableVars[idx] += lookup.keyIsPct.get(mainKey)
          ? displayVal / 100
          : displayVal;
      }
    }
    if (art.substats) {
      for (const subKey of Object.keys(art.substats)) {
        const subVal = art.substats[subKey as keyof typeof art.substats];
        if (!subVal) continue;
        const idx = lookup.keyToIdx.get(subKey);
        if (idx !== undefined) {
          reusableVars[idx] += lookup.keyIsPct.get(subKey)
            ? subVal / 100
            : subVal;
        }
      }
    }
  }
  fillVarsFromRawStats(
    superStatsRemaining,
    remainingCount,
    compiled.varMapping,
    charIdx,
    reusableVars
  );
  // Skip ER/CR constraint checks for upper bound (optimistic)
  return compiled.evaluate(reusableVars);
}
