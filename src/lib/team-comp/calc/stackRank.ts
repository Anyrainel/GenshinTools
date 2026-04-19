/**
 * Greedy stack allocation for buffs with maxStacks.
 *
 * Distributes a buff's limited activation count across formula parts
 * to maximize total damage. Each stack-limited buff is allocated independently.
 *
 * The resulting BuffActivationMap is the *default* — users can override any
 * value via the UI (sliders/toggles), even exceeding maxStacks.
 */

import type { BuffActivationMap, BuffSource, CalcContext } from "../types";
import type { DamageFormula } from "./damageFormula";
import { type StatBuff, getBuffInstanceKey } from "./statBuff";
import type { StatSheet } from "./statSheet";
import { LUNAR_RANK_WEIGHTS } from "./teamReaction";

/**
 * Everything needed for one formula.calc() call — the resolved evaluation primitive.
 * Stats are fully resolved for the correct onFieldCharId by the caller.
 */
export type FormulaPartEval = {
  formula: DamageFormula;
  stats: StatSheet;
  charLevel: number;
  hits: number;
};

export type StackLimitedBuffInfo = {
  source: BuffSource;
  buffKey: string;
  maxStacks: number;
};

/** A single candidate for greedy stack allocation. */
type GainEntry = {
  idx: number;
  marginalPerHit: number;
  availableHits: number;
};

/**
 * Core greedy allocation: sort by marginal gain descending, then assign stacks
 * to the highest-gain entries until the budget is exhausted.
 * Returns a map from entry index → assigned stacks.
 */
function greedyAllocate(
  gains: GainEntry[],
  maxStacks: number
): Map<number, number> {
  gains.sort((a, b) => b.marginalPerHit - a.marginalPerHit);
  const alloc = new Map<number, number>();
  let remaining = maxStacks;
  for (const { idx, availableHits } of gains) {
    if (remaining <= 0) break;
    const assign = Math.min(remaining, availableHits);
    alloc.set(idx, assign);
    remaining -= assign;
  }
  return alloc;
}

/**
 * Compute default BuffActivationMap for all stack-limited buffs on a formula.
 *
 * Ranks parts by baseDmg multiplier — since all stack-limited buffs are
 * baseDmg buffs, the marginal gain per hit is proportional to this multiplier.
 * Greedily assigns stacks to the highest-multiplier parts until the budget
 * is exhausted.
 */
export function computeDefaultActivation(
  partEvals: FormulaPartEval[],
  stackLimitedBuffs: StackLimitedBuffInfo[],
  ctx: CalcContext
): BuffActivationMap {
  if (stackLimitedBuffs.length === 0 || partEvals.length === 0) return {};

  // Rank parts by baseDmg multiplier — since all stack-limited buffs are
  // baseDmg buffs, the marginal gain per hit is proportional to this multiplier.
  const mults = partEvals.map(({ formula, stats, charLevel }) =>
    formula.calcBaseDmgMult(stats, charLevel, ctx)
  );

  const activation: BuffActivationMap = {};

  for (const buffInfo of stackLimitedBuffs) {
    const bKey = buffInfo.buffKey;

    const gains: GainEntry[] = [];
    for (let idx = 0; idx < partEvals.length; idx++) {
      if (mults[idx] > 0) {
        gains.push({
          idx,
          marginalPerHit: mults[idx],
          availableHits: partEvals[idx].hits,
        });
      }
    }

    const alloc = greedyAllocate(gains, buffInfo.maxStacks);
    const partAlloc: Record<number, number> = {};
    for (const [idx, assign] of alloc) {
      partAlloc[idx] = assign;
    }

    // Fill 0 for unallocated parts so downstream consumers
    // (e.g. PartBuffDialog) don't default to "fully active"
    for (let idx = 0; idx < partEvals.length; idx++) {
      if (!(idx in partAlloc)) {
        partAlloc[idx] = 0;
      }
    }

    // Only add to activation if this buff doesn't cover all hits on all parts
    const totalHits = partEvals.reduce((s, e) => s + e.hits, 0);
    if (buffInfo.maxStacks < totalHits) {
      activation[bKey] = partAlloc;
    }
  }

  return activation;
}

/**
 * Collect stack-limited buff info from a team's allStaticBuffs.
 * Evaluates dynamic entries only to check if the buff is non-empty.
 */
export function collectStackLimitedBuffs(
  allStaticBuffs: { buff: StatBuff; providerCharId: string }[],
  preStats: Record<string, StatSheet>,
  teamPreStatsArr: StatSheet[]
): StackLimitedBuffInfo[] {
  const result: StackLimitedBuffInfo[] = [];

  for (const { buff, providerCharId } of allStaticBuffs) {
    if (providerCharId === "resonance" || providerCharId === "extra") continue;
    if (buff.source.maxStacks == null) continue;

    const ownerStats = preStats[providerCharId];
    if (!ownerStats) continue;

    const dynamicEntries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
    const hasEntries = buff.staticBuffs.length > 0 || dynamicEntries.length > 0;

    if (!hasEntries) continue;

    result.push({
      source: buff.source,
      buffKey: getBuffInstanceKey(buff, providerCharId),
      maxStacks: buff.source.maxStacks,
    });
  }

  return result;
}

/**
 * Pre-resolved evaluation data for one combo line, used by combo-wide allocation.
 */
export type ComboLineEval = {
  partEvals: FormulaPartEval[];
  lineCount: number;
};

/**
 * Compute default BuffActivationMap for all stack-limited buffs across an
 * entire combo rotation.
 *
 * Unlike `computeDefaultActivation` (which allocates per-formula), this
 * function shares the maxStack budget across ALL combo lines. For example,
 * if a buff has maxStacks=5 and the combo has formulaA (10 hits × 2 reps)
 * and formulaB (5 hits × 1 rep), the 5 stacks are distributed across all
 * 25 total hits to maximize total damage.
 *
 * Returns one BuffActivationMap per line (per-cast activation values).
 */
export function computeComboDefaultActivation(
  lines: ComboLineEval[],
  stackLimitedBuffs: StackLimitedBuffInfo[],
  ctx: CalcContext
): BuffActivationMap[] {
  if (stackLimitedBuffs.length === 0) return lines.map(() => ({}));

  const result: BuffActivationMap[] = lines.map(() => ({}));

  // Pre-compute multipliers for all parts across all lines
  const lineMults = lines.map(({ partEvals }) =>
    partEvals.map(({ formula, stats, charLevel }) =>
      formula.calcBaseDmgMult(stats, charLevel, ctx)
    )
  );

  for (const buffInfo of stackLimitedBuffs) {
    const bKey = buffInfo.buffKey;

    const maxParts = Math.max(...lines.map((l) => l.partEvals.length), 1);
    const gains: GainEntry[] = [];
    let totalHitsAllLines = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const { partEvals, lineCount } = lines[lineIdx];
      const mults = lineMults[lineIdx];

      for (let partIdx = 0; partIdx < partEvals.length; partIdx++) {
        const h = partEvals[partIdx].hits;
        const totalAvailable = h * lineCount;
        totalHitsAllLines += totalAvailable;

        if (mults[partIdx] > 0) {
          gains.push({
            idx: lineIdx * maxParts + partIdx,
            marginalPerHit: mults[partIdx],
            availableHits: totalAvailable,
          });
        }
      }
    }

    const alloc = greedyAllocate(gains, buffInfo.maxStacks);
    const linePartAlloc: Record<number, number>[] = lines.map(() => ({}));

    for (const [flatIdx, assign] of alloc) {
      const lineIdx = Math.floor(flatIdx / maxParts);
      const partIdx = flatIdx % maxParts;
      linePartAlloc[lineIdx][partIdx] = assign / lines[lineIdx].lineCount;
    }

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      for (
        let partIdx = 0;
        partIdx < lines[lineIdx].partEvals.length;
        partIdx++
      ) {
        if (!(partIdx in linePartAlloc[lineIdx])) {
          linePartAlloc[lineIdx][partIdx] = 0;
        }
      }
    }

    if (buffInfo.maxStacks < totalHitsAllLines) {
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        result[lineIdx][bKey] = linePartAlloc[lineIdx];
      }
    }
  }

  return result;
}

/**
 * Distribute combo-level activated hits across lines using greedy fill.
 *
 * Given a total activation count (from the combo slider) and the sequence
 * of combo lines that use this formula, fill casts greedily: first line's
 * casts fill up, then next line, etc.
 *
 * Returns per-line total activated hits.
 *
 * TODO: Revisit once we know how to better model per-line distribution.
 * Currently fills sequentially. A smarter approach would prioritize lines
 * with higher marginal value (e.g., vaporize lines over non-reaction lines).
 */
export function distributeComboHits(
  totalActivated: number,
  hitsPerCast: number,
  lineCounts: number[]
): number[] {
  const result: number[] = [];
  let remaining = totalActivated;
  for (const count of lineCounts) {
    const lineMax = hitsPerCast * count;
    const lineAlloc = Math.min(remaining, lineMax);
    result.push(lineAlloc);
    remaining -= lineAlloc;
  }
  return result;
}

/**
 * Compute per-character rank weights for a multi-contributor lunar formula.
 * Evaluates the formula with each eligible character's stats, sorts by damage
 * descending, and assigns LUNAR_RANK_WEIGHTS positionally.
 */
export function computeLunarRankWeights(
  formula: DamageFormula,
  eligible: string[],
  teamStats: Record<string, StatSheet>,
  charLevels: Record<string, number>,
  ctx: CalcContext
): Map<string, number> {
  const contributions: { charId: string; damage: number }[] = [];
  for (const charId of eligible) {
    const stats = teamStats[charId];
    if (!stats) continue;
    const damage = formula.calc(stats, charLevels[charId] ?? 90, ctx);
    contributions.push({ charId, damage });
  }
  contributions.sort((a, b) => b.damage - a.damage);
  const weights = new Map<string, number>();
  for (let i = 0; i < contributions.length; i++) {
    weights.set(contributions[i].charId, LUNAR_RANK_WEIGHTS[i] ?? 0);
  }
  return weights;
}
