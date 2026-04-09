/**
 * Greedy stack allocation for buffs with maxStacks.
 *
 * Distributes a buff's limited activation count across formula parts
 * to maximize total damage. Each stack-limited buff is allocated independently.
 *
 * The resulting BuffActivationMap is the *default* — users can override any
 * value via the UI (sliders/toggles), even exceeding maxStacks.
 */

import { ELEMENT_ELIGIBLE_REACTIONS } from "./constants";
import { type StatBuff, getBuffInstanceKey } from "./damageBuffs";
import { createReactionVariant } from "./damageFormulas";
import type { DamageFormula, FormulaPart } from "./damageModels";
import { StatSheet } from "./damageModels";
import type {
  BuffActivationMap,
  BuffSource,
  CalcContext,
  PartialBuffInfo,
  ReactionOverride,
} from "./types";
import { exclusionKey, resolvePartReaction } from "./types";

export type { PartialBuffInfo } from "./types";

export type StackLimitedBuffInfo = {
  source: BuffSource;
  buffKey: string;
  maxStacks: number;
};

/**
 * Compute default BuffActivationMap for all stack-limited buffs on a formula.
 *
 * Algorithm per buff (independent allocation):
 * 1. For each part, compute marginal damage gain per hit from this buff
 * 2. Sort parts by marginal gain descending
 * 3. Greedily assign stacks to highest-gain parts until budget exhausted
 *
 * @param sansBuffStats  Pre-built stats with each buff excluded (buffKey → StatSheet).
 *   Built by the caller via getTeamStatsExcluding.
 * @param offFieldSansBuffStats  Same for off-field context.
 */
export function computeDefaultActivation(
  parts: FormulaPart[],
  stackLimitedBuffs: StackLimitedBuffInfo[],
  postStats: StatSheet,
  charLevel: number,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  offFieldPostStats?: StatSheet,
  sansBuffStats?: Map<string, StatSheet>,
  offFieldSansBuffStats?: Map<string, StatSheet>
): BuffActivationMap {
  if (stackLimitedBuffs.length === 0) return {};

  const activation: BuffActivationMap = {};

  for (const buffInfo of stackLimitedBuffs) {
    const bKey = buffInfo.buffKey;
    const partAlloc: Record<number, number> = {};

    const sansBuff = sansBuffStats?.get(bKey);
    const sansBuffOffField = offFieldSansBuffStats?.get(bKey);

    // If no sans-buff stats provided, skip this buff (caller must provide them)
    if (!sansBuff) continue;

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

    // Explicitly fill 0 for unallocated parts so downstream consumers
    // (e.g. PartBuffDialog) don't default to "fully active"
    for (let idx = 0; idx < parts.length; idx++) {
      if (!(idx in partAlloc)) {
        partAlloc[idx] = 0;
      }
    }

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
 * Each interval looks up a pre-built stat variant from statsVariants.
 *
 * Example with buff1 (3/5 hits) and buff2 (2/5 hits) on a 5-hit part:
 *   Hits 1-2: both active   → 2 × Dmg(default stats)
 *   Hit  3:   b1 only       → 1 × Dmg(variant excluding b2)
 *   Hits 4-5: none active   → 2 × Dmg(variant excluding b1+b2)
 */
export function computeBlendedDamage(
  parts: FormulaPart[],
  partialBuffs: PartialBuffInfo[],
  postStats: StatSheet,
  statsVariants: Map<string, StatSheet>,
  charLevel: number,
  ctx: CalcContext,
  offFieldPostStats?: StatSheet,
  offFieldVariants?: Map<string, StatSheet>,
  reactionOverride?: ReactionOverride
): { totalDamage: number; partDamages: { damage: number; hits: number }[] } {
  const partDamages: { damage: number; hits: number }[] = [];
  let totalDamage = 0;

  for (let idx = 0; idx < parts.length; idx++) {
    const { formula, hits: totalHits, offField, bespokeBuff } = parts[idx];
    const h = totalHits ?? 1;

    const effectiveOffField = offField && !reactionOverride?.forceOnField;
    const baseStats =
      effectiveOffField && offFieldPostStats ? offFieldPostStats : postStats;
    const variants =
      effectiveOffField && offFieldVariants ? offFieldVariants : statsVariants;

    // Bespoke overlay + hit-count cutoff. Bespoke applies to hits
    // [0, bespokeCutoff); remaining hits use baseStats. Mirrors
    // getDisplayParts' split so all 3 paths agree.
    const bespokeOverlay = bespokeBuff
      ? StatSheet.fromEntries(
          [
            ...bespokeBuff.staticBuffs,
            ...bespokeBuff.dynamicBuffs(baseStats, []),
          ],
          bespokeBuff.target.filter
        )
      : undefined;
    const bespokeMax = bespokeBuff?.source.maxStacks;
    const bespokeCutoff =
      bespokeOverlay && bespokeMax != null && bespokeMax < h ? bespokeMax : h;
    const withBespoke = bespokeOverlay
      ? baseStats.merge(bespokeOverlay)
      : baseStats;

    // Inner helper: blend `subHits` of `subFormula` with scaled activations.
    // Used once for non-reacting and once (with reaction variant) for reacting
    // sub-parts so reaction overrides mirror getDamageResult/compile exactly.
    const blendSub = (subFormula: DamageFormula, subHits: number): number => {
      if (subHits <= 0) return 0;
      const scale = subHits / h;
      const subBespokeCutoff =
        bespokeOverlay && bespokeMax != null && bespokeMax * scale < subHits
          ? bespokeMax * scale
          : subHits;

      // Partials affecting this sub-part (activation scaled)
      const affecting = partialBuffs.filter((pb) => {
        const activated = (pb.partActivation[idx] ?? h) * scale;
        return activated < subHits;
      });

      if (affecting.length === 0 && subBespokeCutoff === subHits) {
        return subFormula.calc(withBespoke, charLevel, ctx) * subHits;
      }

      const cutpointSet = new Set<number>([0, subHits]);
      if (subBespokeCutoff < subHits) cutpointSet.add(subBespokeCutoff);
      for (const pb of affecting) {
        const activated = (pb.partActivation[idx] ?? h) * scale;
        if (activated > 0 && activated < subHits) cutpointSet.add(activated);
      }
      const cutpoints = [...cutpointSet].sort((a, b) => a - b);

      let sum = 0;
      for (let i = 0; i < cutpoints.length - 1; i++) {
        const start = cutpoints[i];
        const end = cutpoints[i + 1];
        const width = end - start;
        if (width <= 0) continue;

        const excludeSet = new Set<string>();
        for (const pb of affecting) {
          const activated = (pb.partActivation[idx] ?? h) * scale;
          if (activated < end) excludeSet.add(pb.buffKey);
        }

        const bespokeActive = end <= subBespokeCutoff;

        let intervalStats: StatSheet;
        if (excludeSet.size === 0) {
          intervalStats = bespokeActive ? withBespoke : baseStats;
        } else {
          const variant = variants.get(exclusionKey(excludeSet)) ?? baseStats;
          intervalStats =
            bespokeActive && bespokeOverlay
              ? variant.merge(bespokeOverlay)
              : variant;
        }

        sum += width * subFormula.calc(intervalStats, charLevel, ctx);
      }
      return sum;
    };

    // Apply reaction override: split into reacting/non-reacting hits.
    const hasReaction =
      reactionOverride?.reaction && reactionOverride.reaction !== "none";
    let partTotal = 0;
    if (!hasReaction || formula.tag.reaction !== "none") {
      partTotal = blendSub(formula, h);
    } else {
      const partEligible =
        ELEMENT_ELIGIBLE_REACTIONS[
          formula.tag.element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
        ];
      const targetReaction = resolvePartReaction(
        reactionOverride,
        idx,
        partEligible
      );
      const reactingHits =
        targetReaction !== "none"
          ? Math.min(reactionOverride.partHits?.[idx] ?? h, h)
          : 0;
      const nonReactingHits = h - reactingHits;
      if (reactingHits > 0) {
        const effectiveFormula =
          targetReaction !== formula.tag.reaction
            ? createReactionVariant(formula, targetReaction)
            : formula;
        partTotal += blendSub(effectiveFormula, reactingHits);
      }
      if (nonReactingHits > 0) {
        partTotal += blendSub(formula, nonReactingHits);
      }
    }

    partDamages.push({ damage: partTotal / h, hits: h });
    totalDamage += partTotal;
  }

  return { totalDamage, partDamages };
}

/**
 * Build PartialBuffInfo[] from a BuffActivationMap and StackLimitedBuffInfo[].
 * Only includes buffs that have at least one partially-active part.
 */
export function buildPartialBuffInfos(
  activation: BuffActivationMap,
  stackLimitedBuffs: StackLimitedBuffInfo[],
  parts: FormulaPart[]
): PartialBuffInfo[] {
  const result: PartialBuffInfo[] = [];

  for (const buffInfo of stackLimitedBuffs) {
    const bKey = buffInfo.buffKey;
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
      buffKey: bKey,
      partActivation: fullPartActivation,
    });
  }

  return result;
}

/**
 * Build PartialBuffInfo[] from user overrides for non-stack-limited buffs.
 *
 * @param isApplicable Optional predicate to check whether a buff actually
 *   applies to the formula character. When provided, buffs that fail the
 *   check are silently skipped — their toggles should have no effect on a
 *   character they don't target (e.g. a self-buff from character A should
 *   not affect character B's formula).
 */
export function buildUserOverrideInfos(
  userOverrides: BuffActivationMap,
  allStaticBuffs: { buff: StatBuff; providerCharId: string }[],
  parts: FormulaPart[],
  isApplicable?: (buff: StatBuff, providerCharId: string) => boolean
): PartialBuffInfo[] {
  const result: PartialBuffInfo[] = [];

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
      if (b.providerCharId === "resonance" || b.providerCharId === "extra")
        return false;
      return getBuffInstanceKey(b.buff, b.providerCharId) === bKey;
    });
    if (!match) continue;

    // Skip stack-limited buffs (already handled by buildPartialBuffInfos)
    if (match.buff.source.maxStacks != null) continue;

    // Skip buffs that don't apply to the formula character
    if (isApplicable && !isApplicable(match.buff, match.providerCharId))
      continue;

    result.push({
      buffKey: bKey,
      partActivation: partMap,
    });
  }

  return result;
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
 * Context for one combo line, used by combo-wide default activation.
 */
export type ComboLineContext = {
  parts: FormulaPart[];
  lineCount: number;
  postStats: StatSheet;
  charLevel: number;
  offFieldPostStats?: StatSheet;
  /** Pre-built sans-buff stats per buffKey (on-field). */
  sansBuffStats?: Map<string, StatSheet>;
  /** Pre-built sans-buff stats per buffKey (off-field). */
  offFieldSansBuffStats?: Map<string, StatSheet>;
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
  lines: ComboLineContext[],
  stackLimitedBuffs: StackLimitedBuffInfo[],
  ctx: CalcContext
): BuffActivationMap[] {
  if (stackLimitedBuffs.length === 0) return lines.map(() => ({}));

  const result: BuffActivationMap[] = lines.map(() => ({}));

  for (const buffInfo of stackLimitedBuffs) {
    const bKey = buffInfo.buffKey;

    // Compute marginal gain per hit for each (line, part) across the combo
    type VirtualPart = {
      lineIdx: number;
      partIdx: number;
      marginalPerHit: number;
      availableHits: number; // part.hits × lineCount
    };
    const gains: VirtualPart[] = [];
    let totalHitsAllLines = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const {
        parts,
        lineCount,
        postStats,
        charLevel,
        offFieldPostStats,
        sansBuffStats,
        offFieldSansBuffStats,
      } = lines[lineIdx];

      const sansBuff = sansBuffStats?.get(bKey);
      const sansBuffOffField = offFieldSansBuffStats?.get(bKey);

      if (!sansBuff) continue;

      for (let partIdx = 0; partIdx < parts.length; partIdx++) {
        const { formula, hits: totalHits, offField } = parts[partIdx];
        const h = totalHits ?? 1;
        const totalAvailable = h * lineCount;
        totalHitsAllLines += totalAvailable;

        const statsWithBuff =
          offField && offFieldPostStats ? offFieldPostStats : postStats;
        const statsWithout =
          offField && sansBuffOffField ? sansBuffOffField : sansBuff;

        const dmgWith = formula.calc(statsWithBuff, charLevel, ctx);
        const dmgWithout = formula.calc(statsWithout, charLevel, ctx);
        const marginalPerHit = dmgWith - dmgWithout;

        if (marginalPerHit > 0) {
          gains.push({
            lineIdx,
            partIdx,
            marginalPerHit,
            availableHits: totalAvailable,
          });
        }
      }
    }

    // Sort by marginal gain descending
    gains.sort((a, b) => b.marginalPerHit - a.marginalPerHit);

    // Greedy allocation across all combo lines
    let remaining = buffInfo.maxStacks;
    const linePartAlloc: Record<number, number>[] = lines.map(() => ({}));

    for (const { lineIdx, partIdx, availableHits } of gains) {
      if (remaining <= 0) break;
      const assign = Math.min(remaining, availableHits);
      // Convert to per-cast activation (divide by lineCount)
      linePartAlloc[lineIdx][partIdx] = assign / lines[lineIdx].lineCount;
      remaining -= assign;
    }

    // Fill 0 for unallocated parts
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      for (let partIdx = 0; partIdx < lines[lineIdx].parts.length; partIdx++) {
        if (!(partIdx in linePartAlloc[lineIdx])) {
          linePartAlloc[lineIdx][partIdx] = 0;
        }
      }
    }

    // Only add if budget doesn't cover all hits
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
 * Build pre-computed stat variants for all exclusion combinations needed
 * by a set of PartialBuffInfos across a formula's parts.
 *
 * Returns a Map from exclusionKey → StatSheet. The caller should provide
 * a function that builds stats for a given exclusion set.
 */
export function buildStatVariants(
  partialBuffs: PartialBuffInfo[],
  parts: FormulaPart[],
  buildExcluded: (excludeKeys: Set<string>) => StatSheet
): Map<string, StatSheet> {
  const variants = new Map<string, StatSheet>();
  const seen = new Set<string>();

  for (let idx = 0; idx < parts.length; idx++) {
    const h = parts[idx].hits ?? 1;
    const affecting = partialBuffs.filter((pb) => {
      const activated = pb.partActivation[idx] ?? h;
      return activated < h;
    });
    if (affecting.length === 0) continue;

    // Build cutpoints for this part
    const cutpointSet = new Set<number>([0, h]);
    for (const pb of affecting) {
      const activated = pb.partActivation[idx] ?? h;
      if (activated > 0 && activated < h) cutpointSet.add(activated);
    }
    const cutpoints = [...cutpointSet].sort((a, b) => a - b);

    // Collect all exclusion sets for this part's intervals
    for (let i = 0; i < cutpoints.length - 1; i++) {
      const end = cutpoints[i + 1];
      const excludeSet = new Set<string>();
      for (const pb of affecting) {
        const activated = pb.partActivation[idx] ?? h;
        if (activated < end) excludeSet.add(pb.buffKey);
      }
      if (excludeSet.size === 0) continue;
      const eKey = exclusionKey(excludeSet);
      if (seen.has(eKey)) continue;
      seen.add(eKey);
      variants.set(eKey, buildExcluded(excludeSet));
    }
  }

  return variants;
}
