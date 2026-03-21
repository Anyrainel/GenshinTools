/**
 * Greedy stack allocation for buffs with maxStacks.
 *
 * Distributes a buff's limited activation count across formula parts
 * to maximize total damage. Each stack-limited buff is allocated independently.
 *
 * The resulting BuffActivationMap is the *default* — users can override any
 * value via the UI (sliders/toggles), even exceeding maxStacks.
 */

import type { StatBuff } from "./damageBuffs";
import type { FormulaPart } from "./damageModels";
import { StatSheet } from "./damageModels";
import type {
  BuffActivationMap,
  BuffSource,
  CalcContext,
  PartialBuffSpec,
  ReactionOverride,
  StatEntry,
} from "./types";
import { buffSourceKey } from "./types";

export type { PartialBuffSpec } from "./types";

export type StackLimitedBuffInfo = {
  source: BuffSource;
  maxStacks: number;
  /** Combined static + dynamic entries for this buff (already evaluated). */
  entries: StatEntry[];
  /** The buff's target filter (for scoping the stat contribution). */
  filter?: import("./types").DamageTagFilter;
};

/**
 * Compute default BuffActivationMap for all stack-limited buffs on a formula.
 *
 * Algorithm per buff (independent allocation):
 * 1. For each part, compute marginal damage gain per hit from this buff
 * 2. Sort parts by marginal gain descending
 * 3. Greedily assign stacks to highest-gain parts until budget exhausted
 */
export function computeDefaultActivation(
  parts: FormulaPart[],
  stackLimitedBuffs: StackLimitedBuffInfo[],
  postStats: StatSheet,
  charLevel: number,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  offFieldPostStats?: StatSheet
): BuffActivationMap {
  if (stackLimitedBuffs.length === 0) return {};

  const activation: BuffActivationMap = {};

  for (const buffInfo of stackLimitedBuffs) {
    const bKey = buffSourceKey(buffInfo.source);
    const partAlloc: Record<number, number> = {};

    // Build the "sans-buff" stat sheet by negating this buff's entries
    const negatedEntries: StatEntry[] = buffInfo.entries.map((e) => ({
      key: e.key,
      value: -e.value,
    }));
    const sansBuff = postStats.merge(
      StatSheet.fromEntries(negatedEntries, buffInfo.filter)
    );

    // For off-field parts, also build sans-buff variant
    let sansBuffOffField: StatSheet | undefined;
    if (offFieldPostStats) {
      sansBuffOffField = offFieldPostStats.merge(
        StatSheet.fromEntries(negatedEntries, buffInfo.filter)
      );
    }

    // Compute marginal gain per hit for each part
    type PartGain = {
      partIndex: number;
      marginalPerHit: number;
      availableHits: number;
    };
    const gains: PartGain[] = [];

    for (let idx = 0; idx < parts.length; idx++) {
      const { formula, hits: totalHits, offField } = parts[idx];
      const h = totalHits ?? 1;

      const statsWithBuff =
        offField && offFieldPostStats ? offFieldPostStats : postStats;
      const statsWithout =
        offField && sansBuffOffField ? sansBuffOffField : sansBuff;

      const dmgWith = formula.calc(statsWithBuff, charLevel, ctx);
      const dmgWithout = formula.calc(statsWithout, charLevel, ctx);
      const marginalPerHit = dmgWith - dmgWithout;

      if (marginalPerHit > 0) {
        gains.push({ partIndex: idx, marginalPerHit, availableHits: h });
      }
    }

    // Sort by marginal gain descending
    gains.sort((a, b) => b.marginalPerHit - a.marginalPerHit);

    // Greedy allocation
    let remaining = buffInfo.maxStacks;
    for (const { partIndex, availableHits } of gains) {
      if (remaining <= 0) break;
      const assign = Math.min(remaining, availableHits);
      partAlloc[partIndex] = assign;
      remaining -= assign;
    }

    // Parts not in partAlloc get 0 (no stacks)
    // Only add to activation if this buff doesn't cover all hits on all parts
    const totalHits = parts.reduce((s, p) => s + (p.hits ?? 1), 0);
    if (buffInfo.maxStacks < totalHits) {
      activation[bKey] = partAlloc;
    }
  }

  return activation;
}

/**
 * Compute blended total damage for a formula with partial buff activation.
 *
 * Uses interval-based blending: for each part, sort buff cutoff points to
 * create intervals where different combinations of buffs are active.
 *
 * Example with buff1 (3/5 hits) and buff2 (2/5 hits) on a 5-hit part:
 *   Hits 1-2: both active   → 2 × Dmg(b1, b2)
 *   Hit  3:   b1 only       → 1 × Dmg(b1)
 *   Hits 4-5: none active   → 2 × Dmg()
 *
 * Each buff's "first K hits" semantics means it's active in interval (start, end]
 * iff activatedHits >= end.
 */
export function computeBlendedDamage(
  parts: FormulaPart[],
  partialBuffs: PartialBuffSpec[],
  postStats: StatSheet,
  charLevel: number,
  ctx: CalcContext,
  offFieldPostStats?: StatSheet
): { totalDamage: number; partDamages: { damage: number; hits: number }[] } {
  const partDamages: { damage: number; hits: number }[] = [];
  let totalDamage = 0;

  for (let idx = 0; idx < parts.length; idx++) {
    const { formula, hits: totalHits, offField } = parts[idx];
    const h = totalHits ?? 1;

    const baseStats =
      offField && offFieldPostStats ? offFieldPostStats : postStats;

    // Collect partial buffs affecting this part
    const affecting = partialBuffs.filter((pb) => {
      const activated = pb.partActivation[idx] ?? h;
      return activated < h;
    });

    if (affecting.length === 0) {
      // Fully buffed on all hits
      const dmg = formula.calc(baseStats, charLevel, ctx);
      partDamages.push({ damage: dmg, hits: h });
      totalDamage += dmg * h;
      continue;
    }

    // Build interval cutpoints from activation counts
    const cutpointSet = new Set<number>([0, h]);
    for (const pb of affecting) {
      const activated = pb.partActivation[idx] ?? h;
      if (activated > 0 && activated < h) cutpointSet.add(activated);
    }
    const cutpoints = [...cutpointSet].sort((a, b) => a - b);

    // Sum damage across intervals
    let partTotal = 0;
    for (let i = 0; i < cutpoints.length - 1; i++) {
      const start = cutpoints[i];
      const end = cutpoints[i + 1];
      const width = end - start;
      if (width <= 0) continue;

      // Build stat sheet: negate buffs that are inactive in interval (start, end]
      // A buff is active iff activatedHits >= end
      let intervalStats = baseStats;
      for (const pb of affecting) {
        const activated = pb.partActivation[idx] ?? h;
        if (activated < end) {
          // Buff has fallen off — negate its entries
          intervalStats = intervalStats.merge(
            StatSheet.fromEntries(pb.negatedEntries, pb.filter)
          );
        }
      }

      const dmg = formula.calc(intervalStats, charLevel, ctx);
      partTotal += width * dmg;
    }

    partDamages.push({ damage: partTotal / h, hits: h });
    totalDamage += partTotal;
  }

  return { totalDamage, partDamages };
}

/**
 * Build PartialBuffSpec[] from a BuffActivationMap and StackLimitedBuffInfo[].
 * Only includes buffs that have at least one partially-active part.
 */
export function buildPartialBuffSpecs(
  activation: BuffActivationMap,
  stackLimitedBuffs: StackLimitedBuffInfo[],
  parts: FormulaPart[]
): PartialBuffSpec[] {
  const result: PartialBuffSpec[] = [];

  for (const buffInfo of stackLimitedBuffs) {
    const bKey = buffSourceKey(buffInfo.source);
    const partMap = activation[bKey];
    if (!partMap) continue;

    // For stack-limited buffs, missing part = 0 stacks (greedy didn't allocate).
    // Normalize to explicit values so downstream consumers don't need to know.
    const fullPartActivation: Record<number, number> = {};
    let hasPartial = false;
    for (let idx = 0; idx < parts.length; idx++) {
      const h = parts[idx].hits ?? 1;
      const activated = partMap[idx] ?? 0; // missing = 0 stacks from greedy
      fullPartActivation[idx] = activated;
      if (activated < h) hasPartial = true;
    }
    if (!hasPartial) continue;

    result.push({
      negatedEntries: buffInfo.entries.map((e) => ({
        key: e.key,
        value: -e.value,
      })),
      filter: buffInfo.filter,
      partActivation: fullPartActivation,
    });
  }

  return result;
}

/**
 * Build PartialBuffSpec[] from user overrides for non-stack-limited buffs.
 * Resolves buff entries from allStaticBuffs.
 */
export function buildUserOverrideSpecs(
  userOverrides: BuffActivationMap,
  allStaticBuffs: { buff: StatBuff; providerCharId: string }[],
  preStats: Record<string, StatSheet>,
  teamPreStatsArr: StatSheet[],
  parts: FormulaPart[]
): PartialBuffSpec[] {
  const result: PartialBuffSpec[] = [];

  for (const [bKey, partMap] of Object.entries(userOverrides)) {
    // Check if any part is partially active
    const hasPartial = parts.some((p, idx) => {
      const h = p.hits ?? 1;
      const activated = partMap[idx];
      return activated !== undefined && activated < h;
    });
    if (!hasPartial) continue;

    // Find the matching buff in allStaticBuffs
    const match = allStaticBuffs.find((b) => {
      if (b.providerCharId === "resonance") return false;
      return buffSourceKey(b.buff.source) === bKey;
    });
    if (!match) continue;

    // Skip stack-limited buffs (already handled by buildPartialBuffSpecs)
    if (match.buff.source.maxStacks != null) continue;

    const ownerStats = preStats[match.providerCharId];
    if (!ownerStats) continue;

    const dynamicEntries = match.buff.dynamicBuffs(ownerStats, teamPreStatsArr);
    const entries = [...match.buff.staticBuffs, ...dynamicEntries];
    if (entries.length === 0) continue;

    result.push({
      negatedEntries: entries.map((e) => ({ key: e.key, value: -e.value })),
      filter: match.buff.target.filter,
      partActivation: partMap,
    });
  }

  return result;
}

/**
 * Collect stack-limited buff info from a team's allStaticBuffs.
 * Evaluates dynamic entries at the given preStats.
 */
export function collectStackLimitedBuffs(
  allStaticBuffs: { buff: StatBuff; providerCharId: string }[],
  preStats: Record<string, StatSheet>,
  teamPreStatsArr: StatSheet[]
): StackLimitedBuffInfo[] {
  const result: StackLimitedBuffInfo[] = [];

  for (const { buff, providerCharId } of allStaticBuffs) {
    if (providerCharId === "resonance") continue;
    if (buff.source.maxStacks == null) continue;

    const ownerStats = preStats[providerCharId];
    if (!ownerStats) continue;

    const dynamicEntries = buff.dynamicBuffs(ownerStats, teamPreStatsArr);
    const entries = [...buff.staticBuffs, ...dynamicEntries];

    if (entries.length === 0) continue;

    result.push({
      source: buff.source,
      maxStacks: buff.source.maxStacks,
      entries,
      filter: buff.target.filter,
    });
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
