/**
 * Greedy stack allocation for buffs with maxStacks.
 *
 * Distributes a buff's limited activation count across formula parts
 * to maximize total damage. Each stack-limited buff is allocated independently.
 *
 * The resulting BuffActivationMap is the *default* — users can override any
 * value via the UI (sliders/toggles), even exceeding maxStacks.
 */

import { ELEMENT_ELIGIBLE_REACTIONS } from "../constants";
import type {
  DamageResult,
  DisplayPart,
  FormulaEntry,
  FormulaPart,
} from "../types";
import type {
  BuffActivationMap,
  BuffSource,
  CalcContext,
  ReactionOverride,
} from "../types";
import { resolvePartReaction } from "./combo";
import { type DamageFormula, createReactionVariant } from "./damageFormula";
import { isPartOffField } from "./fieldState";
import { type StatBuff, getBuffInstanceKey } from "./statBuff";
import { bespokeMaxStacks, buildBespokeOverlay } from "./statSheet";
import type { StatSheet } from "./statSheet";

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

/** Build a deterministic cache key from a set of excluded buff keys. */
export function exclusionKey(excludeKeys: Set<string>): string {
  return [...excludeKeys].sort().join("|");
}

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
 * Core interval-blending for a single sub-part (possibly a reaction split).
 *
 * Computes the weighted damage sum across intervals defined by partial buff
 * activation cutpoints and bespoke overlay cutoff. Returns the raw weighted
 * sum (NOT divided by hits — caller decides averaging).
 *
 * Used by both computeBlendedDamage (stackAllocation) and _calcPartBlended
 * (implModel) to avoid duplicating the interval math.
 *
 * @param subBespokeCutoff  Bespoke cutoff already in sub-part coordinates
 *   (i.e., number of hits in this sub-part that get the bespoke overlay).
 *   Set equal to `hits` when bespoke doesn't split this sub-part.
 * @param hits         Number of hits for this sub-part (may be < originalPartHits for reaction splits)
 * @param partIdx      Index into partialBuffs[].partActivation
 * @param originalPartHits  The part's full hit count (before reaction split)
 * @param partialBuffs Buffs with partial activation on this part
 * @param statsVariants Pre-built stat sheets for each exclusion combination
 */
export function blendSubPart(
  formula: DamageFormula,
  baseStats: StatSheet,
  withBespoke: StatSheet,
  bespokeOverlay: StatSheet | undefined,
  subBespokeCutoff: number,
  charLevel: number,
  ctx: CalcContext,
  hits: number,
  partIdx: number,
  originalPartHits: number,
  activation: BuffActivationMap,
  statsVariants: Map<string, StatSheet> | undefined
): number {
  if (hits <= 0) return 0;
  const scale = hits / originalPartHits;

  const affecting: { buffKey: string; activatedScaled: number }[] = [];
  for (const [buffKey, partMap] of Object.entries(activation)) {
    const activatedScaled = (partMap[partIdx] ?? originalPartHits) * scale;
    if (activatedScaled < hits) {
      affecting.push({ buffKey, activatedScaled });
    }
  }

  // Fast path: uniform damage across all hits
  if (affecting.length === 0 && subBespokeCutoff === hits) {
    return formula.calc(withBespoke, charLevel, ctx) * hits;
  }

  // Build interval cutpoints
  const cutpointSet = new Set<number>([0, hits]);
  if (subBespokeCutoff < hits) cutpointSet.add(subBespokeCutoff);
  for (const { activatedScaled } of affecting) {
    if (activatedScaled > 0 && activatedScaled < hits)
      cutpointSet.add(activatedScaled);
  }
  const cutpoints = [...cutpointSet].sort((a, b) => a - b);

  let sum = 0;
  for (let i = 0; i < cutpoints.length - 1; i++) {
    const end = cutpoints[i + 1];
    const width = end - cutpoints[i];
    if (width <= 0) continue;

    const excludeSet = new Set<string>();
    for (const { buffKey, activatedScaled } of affecting) {
      if (activatedScaled < end) excludeSet.add(buffKey);
    }

    const bespokeActive = end <= subBespokeCutoff;

    let intervalStats: StatSheet;
    if (excludeSet.size === 0) {
      intervalStats = bespokeActive ? withBespoke : baseStats;
    } else {
      const eKey = exclusionKey(excludeSet);
      const variant = statsVariants?.get(eKey) ?? baseStats;
      intervalStats =
        bespokeActive && bespokeOverlay
          ? variant.merge(bespokeOverlay)
          : variant;
    }

    sum += width * formula.calc(intervalStats, charLevel, ctx);
  }
  return sum;
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
  activation: BuffActivationMap,
  postStats: StatSheet,
  statsVariants: Map<string, StatSheet>,
  charLevel: number,
  ctx: CalcContext,
  offFieldPostStats?: StatSheet,
  offFieldVariants?: Map<string, StatSheet>,
  reactionOverride?: ReactionOverride,
  forceOnField?: boolean
): { totalDamage: number; partDamages: { damage: number; hits: number }[] } {
  const partDamages: { damage: number; hits: number }[] = [];
  let totalDamage = 0;

  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    const { formula, hits: totalHits, bespokeBuffs } = part;
    const h = totalHits ?? 1;

    const effectiveOffField = isPartOffField(part, forceOnField);
    const baseStats =
      effectiveOffField && offFieldPostStats ? offFieldPostStats : postStats;
    const variants =
      effectiveOffField && offFieldVariants ? offFieldVariants : statsVariants;

    // Bespoke overlay + hit-count cutoff. Bespoke applies to hits
    // [0, bespokeCutoff); remaining hits use baseStats. Mirrors
    // getDisplayParts' split so all 3 paths agree.
    const bespokeOverlay = bespokeBuffs?.length
      ? buildBespokeOverlay(bespokeBuffs, baseStats, [])
      : undefined;
    const bespokeMax = bespokeMaxStacks(bespokeBuffs);
    const bespokeCutoff =
      bespokeOverlay && bespokeMax != null && bespokeMax < h ? bespokeMax : h;
    const withBespoke = bespokeOverlay
      ? baseStats.merge(bespokeOverlay)
      : baseStats;

    const blendSub = (subFormula: DamageFormula, subHits: number): number => {
      const subScale = subHits / h;
      const subBespoke =
        bespokeOverlay && bespokeCutoff < h
          ? bespokeCutoff * subScale
          : subHits;
      return blendSubPart(
        subFormula,
        baseStats,
        withBespoke,
        bespokeOverlay,
        subBespoke,
        charLevel,
        ctx,
        subHits,
        idx,
        h,
        activation,
        variants
      );
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
          ? Math.min(reactionOverride.rxnPartHits?.[idx] ?? h, h)
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
 * Build BuffActivationMap from user overrides for non-stack-limited buffs.
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
): BuffActivationMap {
  const result: BuffActivationMap = {};

  for (const [bKey, partMap] of Object.entries(userOverrides)) {
    const hasPartial = parts.some((p, idx) => {
      const h = p.hits ?? 1;
      const activated = partMap[idx];
      return activated !== undefined && activated < h;
    });
    if (!hasPartial) continue;

    const match = allStaticBuffs.find((b) => {
      if (b.providerCharId === "resonance" || b.providerCharId === "extra")
        return false;
      return getBuffInstanceKey(b.buff, b.providerCharId) === bKey;
    });
    if (!match) continue;

    if (match.buff.source.maxStacks != null) continue;

    if (isApplicable && !isApplicable(match.buff, match.providerCharId))
      continue;

    result[bKey] = partMap;
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
 * Build pre-computed stat variants for all exclusion combinations needed
 * by a BuffActivationMap across a formula's parts.
 *
 * Returns a Map from exclusionKey → StatSheet. The caller should provide
 * a function that builds stats for a given exclusion set.
 */
export function buildStatVariants(
  activation: BuffActivationMap,
  parts: FormulaPart[],
  buildExcluded: (excludeKeys: Set<string>) => StatSheet
): Map<string, StatSheet> {
  const variants = new Map<string, StatSheet>();
  const seen = new Set<string>();

  for (let idx = 0; idx < parts.length; idx++) {
    const h = parts[idx].hits ?? 1;
    const affecting: { buffKey: string; activated: number }[] = [];
    for (const [buffKey, partMap] of Object.entries(activation)) {
      const activated = partMap[idx] ?? h;
      if (activated < h) affecting.push({ buffKey, activated });
    }
    if (affecting.length === 0) continue;

    const cutpointSet = new Set<number>([0, h]);
    for (const { activated } of affecting) {
      if (activated > 0 && activated < h) cutpointSet.add(activated);
    }
    const cutpoints = [...cutpointSet].sort((a, b) => a - b);

    for (let i = 0; i < cutpoints.length - 1; i++) {
      const end = cutpoints[i + 1];
      const excludeSet = new Set<string>();
      for (const { buffKey, activated } of affecting) {
        if (activated < end) excludeSet.add(buffKey);
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

/**
 * Compute blended damage for a sub-part (possibly a reaction split).
 * If activation affects this part, uses interval-based blending.
 * Inlined from CharBuild._calcPartBlended.
 */
function calcPartBlended(
  formula: DamageFormula,
  baseStats: StatSheet,
  ctx: CalcContext,
  hits: number,
  partIdx: number,
  originalPartHits: number,
  charLevel: number,
  activation?: BuffActivationMap,
  statsVariants?: Map<string, StatSheet>,
  bespokeOverlay?: StatSheet,
  bespokeMax?: number
): { damage: number; hits: number } {
  const bespokeCutoff =
    bespokeOverlay && bespokeMax != null && bespokeMax < hits
      ? bespokeMax
      : hits;
  const withBespoke = bespokeOverlay
    ? baseStats.merge(bespokeOverlay)
    : baseStats;

  const total = blendSubPart(
    formula,
    baseStats,
    withBespoke,
    bespokeOverlay,
    bespokeCutoff,
    charLevel,
    ctx,
    hits,
    partIdx,
    originalPartHits,
    activation ?? {},
    statsVariants
  );
  return { damage: total / hits, hits };
}

/** Evaluate a formula entry's parts, calling .calc() on each, and aggregate into a DamageResult. */
export function evaluateFormulaDamage(
  entry: FormulaEntry,
  charLevel: number,
  selfPostStats: StatSheet,
  teamPostStats: StatSheet[],
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  offFieldSelfPostStats?: StatSheet,
  activation?: BuffActivationMap,
  statsVariants?: Map<string, StatSheet>,
  offFieldVariants?: Map<string, StatSheet>,
  forceOnField?: boolean
): DamageResult {
  const parts: DamageResult["parts"] = [];
  for (let idx = 0; idx < entry.parts.length; idx++) {
    const part = entry.parts[idx];
    const { formula, hits: totalHits, bespokeBuffs } = part;
    const h = totalHits ?? 1;
    const bespokeMax = bespokeMaxStacks(bespokeBuffs);
    const effectiveOffField = isPartOffField(part, forceOnField);

    const baseSelfStats =
      effectiveOffField && offFieldSelfPostStats
        ? offFieldSelfPostStats
        : selfPostStats;

    let bespokeOverlay: StatSheet | undefined;
    if (bespokeBuffs?.length) {
      bespokeOverlay = buildBespokeOverlay(
        bespokeBuffs,
        baseSelfStats,
        teamPostStats
      );
    }

    const partVariants =
      effectiveOffField && offFieldVariants ? offFieldVariants : statsVariants;

    const hasReaction =
      reactionOverride?.reaction && reactionOverride.reaction !== "none";

    if (!hasReaction || formula.tag.reaction !== "none") {
      const buffedResult = calcPartBlended(
        formula,
        baseSelfStats,
        ctx,
        h,
        idx,
        h,
        charLevel,
        activation,
        partVariants,
        bespokeOverlay,
        bespokeMax
      );
      if (bespokeMax != null) {
        const unbuffedResult = calcPartBlended(
          formula,
          baseSelfStats,
          ctx,
          h,
          idx,
          h,
          charLevel,
          activation,
          partVariants,
          undefined,
          undefined
        );
        parts.push({
          ...buffedResult,
          bespokeInfo: {
            unbuffedDamage: unbuffedResult.damage,
            maxStacks: bespokeMax,
          },
        });
      } else {
        parts.push(buffedResult);
      }
      continue;
    }

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
        ? Math.min(reactionOverride.rxnPartHits?.[idx] ?? h, h)
        : 0;
    const nonReactingHits = h - reactingHits;

    if (reactingHits > 0) {
      const effectiveFormula =
        targetReaction !== formula.tag.reaction
          ? createReactionVariant(formula, targetReaction)
          : formula;
      const buffedResult = calcPartBlended(
        effectiveFormula,
        baseSelfStats,
        ctx,
        reactingHits,
        idx,
        h,
        charLevel,
        activation,
        partVariants,
        bespokeOverlay,
        bespokeMax
      );
      if (bespokeMax != null) {
        const unbuffedResult = calcPartBlended(
          effectiveFormula,
          baseSelfStats,
          ctx,
          reactingHits,
          idx,
          h,
          charLevel,
          activation,
          partVariants,
          undefined,
          undefined
        );
        parts.push({
          ...buffedResult,
          bespokeInfo: {
            unbuffedDamage: unbuffedResult.damage,
            maxStacks: bespokeMax,
          },
        });
      } else {
        parts.push(buffedResult);
      }
    }
    if (nonReactingHits > 0) {
      const buffedResult = calcPartBlended(
        formula,
        baseSelfStats,
        ctx,
        nonReactingHits,
        idx,
        h,
        charLevel,
        activation,
        partVariants,
        bespokeOverlay,
        bespokeMax
      );
      if (bespokeMax != null) {
        const unbuffedResult = calcPartBlended(
          formula,
          baseSelfStats,
          ctx,
          nonReactingHits,
          idx,
          h,
          charLevel,
          activation,
          partVariants,
          undefined,
          undefined
        );
        parts.push({
          ...buffedResult,
          bespokeInfo: {
            unbuffedDamage: unbuffedResult.damage,
            maxStacks: bespokeMax,
          },
        });
      } else {
        parts.push(buffedResult);
      }
    }
  }
  const totalDamage = parts.reduce(
    (sum, { damage, hits }) => sum + damage * hits,
    0
  );
  return { parts, totalDamage };
}

/** Produce structured display data for a formula (cold path). */
export function evaluateFormulaDisplay(
  entry: FormulaEntry,
  charLevel: number,
  selfPostStats: StatSheet,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  offFieldSelfPostStats?: StatSheet,
  forceOnField?: boolean
): { parts: DisplayPart[]; totalDamage: number } {
  const displayParts: DisplayPart[] = [];
  let totalDamage = 0;
  for (let i = 0; i < entry.parts.length; i++) {
    const part = entry.parts[i];
    const { formula, hits: totalHits, bespokeBuffs } = part;
    const h = totalHits ?? 1;
    const effectiveOffField = isPartOffField(part, forceOnField);

    const baseSelfStats =
      effectiveOffField && offFieldSelfPostStats
        ? offFieldSelfPostStats
        : selfPostStats;

    const stats = bespokeBuffs?.length
      ? baseSelfStats.merge(
          buildBespokeOverlay(bespokeBuffs, baseSelfStats, [])
        )
      : baseSelfStats;

    const hasReaction =
      reactionOverride?.reaction && reactionOverride.reaction !== "none";

    const bespokeMax = bespokeMaxStacks(bespokeBuffs);

    if (!hasReaction || formula.tag.reaction !== "none") {
      if (bespokeMax != null && bespokeMax < h) {
        const dpBuffed = formula.displayFull(stats, charLevel, ctx);
        dpBuffed.hits = bespokeMax;
        dpBuffed.sourcePartIndex = i;
        if (effectiveOffField) dpBuffed.offField = true;
        totalDamage += dpBuffed.damage * bespokeMax;
        displayParts.push(dpBuffed);
        const dpUnbuffed = formula.displayFull(baseSelfStats, charLevel, ctx);
        dpUnbuffed.hits = h - bespokeMax;
        dpUnbuffed.sourcePartIndex = i;
        if (effectiveOffField) dpUnbuffed.offField = true;
        totalDamage += dpUnbuffed.damage * (h - bespokeMax);
        displayParts.push(dpUnbuffed);
      } else {
        const dp = formula.displayFull(stats, charLevel, ctx);
        dp.hits = h;
        dp.sourcePartIndex = i;
        if (effectiveOffField) dp.offField = true;
        totalDamage += dp.damage * h;
        displayParts.push(dp);
      }
      continue;
    }

    const partEligible =
      ELEMENT_ELIGIBLE_REACTIONS[
        formula.tag.element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
      ];
    const targetReaction = resolvePartReaction(
      reactionOverride,
      i,
      partEligible
    );

    const reactingHits =
      targetReaction !== "none"
        ? Math.min(reactionOverride.rxnPartHits?.[i] ?? h, h)
        : 0;
    const nonReactingHits = h - reactingHits;

    let bespokeRemaining =
      bespokeMax != null && bespokeMax < h ? bespokeMax : undefined;

    if (reactingHits > 0) {
      const effectiveFormula =
        targetReaction !== formula.tag.reaction
          ? createReactionVariant(formula, targetReaction)
          : formula;
      if (bespokeRemaining != null) {
        const buffedRx = Math.min(bespokeRemaining, reactingHits);
        const unbuffedRx = reactingHits - buffedRx;
        bespokeRemaining -= buffedRx;
        if (buffedRx > 0) {
          const dpB = effectiveFormula.displayFull(stats, charLevel, ctx);
          dpB.hits = buffedRx;
          dpB.sourcePartIndex = i;
          if (effectiveOffField) dpB.offField = true;
          totalDamage += dpB.damage * buffedRx;
          displayParts.push(dpB);
        }
        if (unbuffedRx > 0) {
          const dpU = effectiveFormula.displayFull(
            baseSelfStats,
            charLevel,
            ctx
          );
          dpU.hits = unbuffedRx;
          dpU.sourcePartIndex = i;
          if (effectiveOffField) dpU.offField = true;
          totalDamage += dpU.damage * unbuffedRx;
          displayParts.push(dpU);
        }
      } else {
        const dp = effectiveFormula.displayFull(stats, charLevel, ctx);
        dp.hits = reactingHits;
        dp.sourcePartIndex = i;
        if (effectiveOffField) dp.offField = true;
        totalDamage += dp.damage * reactingHits;
        displayParts.push(dp);
      }
    }
    if (nonReactingHits > 0) {
      if (bespokeRemaining != null) {
        const buffedNr = Math.min(bespokeRemaining, nonReactingHits);
        const unbuffedNr = nonReactingHits - buffedNr;
        if (buffedNr > 0) {
          const dpB = formula.displayFull(stats, charLevel, ctx);
          dpB.hits = buffedNr;
          dpB.sourcePartIndex = i;
          if (effectiveOffField) dpB.offField = true;
          totalDamage += dpB.damage * buffedNr;
          displayParts.push(dpB);
        }
        if (unbuffedNr > 0) {
          const dpU = formula.displayFull(baseSelfStats, charLevel, ctx);
          dpU.hits = unbuffedNr;
          dpU.sourcePartIndex = i;
          if (effectiveOffField) dpU.offField = true;
          totalDamage += dpU.damage * unbuffedNr;
          displayParts.push(dpU);
        }
      } else {
        const dp = formula.displayFull(stats, charLevel, ctx);
        dp.hits = nonReactingHits;
        dp.sourcePartIndex = i;
        if (effectiveOffField) dp.offField = true;
        totalDamage += dp.damage * nonReactingHits;
        displayParts.push(dp);
      }
    }
  }
  return { parts: displayParts, totalDamage };
}
