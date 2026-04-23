/**
 * Formula evaluation entry points and blending helpers.
 *
 * These functions evaluate a formula's parts against resolved stats,
 * handling partial buff activation (interval-based blending), bespoke
 * overlays, reaction overrides, and off-field routing.
 *
 * Consumers: TeamBuild (getDamageResult, getDisplayResult, getComboDisplayResult).
 */

import { ELEMENT_ELIGIBLE_REACTIONS } from "../constants";
import type {
  BuffActivationMap,
  CalcContext,
  DamageResult,
  DisplayPart,
  FormulaEntry,
  FormulaPart,
  ReactionOverride,
} from "../types";
import { resolvePartReaction } from "./combo";
import { createReactionVariant, type DamageFormula } from "./damageFormula";
import { isPartOffField } from "./fieldState";
import {
  bespokeMaxStacks,
  buildBespokeOverlay,
  getBuffInstanceKey,
  type StatBuff,
} from "./statBuff";
import type { StatSheet } from "./statSheet";
import type { TeamStatSheet } from "./teamStatSheet";

/** Build a deterministic cache key from a set of excluded buff keys. */
export function exclusionKey(excludeKeys: Set<string>): string {
  return [...excludeKeys].sort().join("|");
}

/**
 * Core interval-blending for a single sub-part (possibly a reaction split).
 *
 * Computes the weighted damage sum across intervals defined by partial buff
 * activation cutpoints and bespoke overlay cutoff. Returns the raw weighted
 * sum (NOT divided by hits — caller decides averaging).
 *
 * Used by both computeBlendedDamage and calcPartBlended to avoid
 * duplicating the interval math.
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
  charId: string,
  teamStats: TeamStatSheet,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  forceOnField?: boolean
): { totalDamage: number; partDamages: { damage: number; hits: number }[] } {
  const postStats = teamStats.getPostStats(charId, charId);
  const charLevel = teamStats.getCharLevel(charId);

  const defaultOnFieldCharId = teamStats.getDefaultOnFieldCharId(charId);
  const hasOffFieldParts = parts.some((p) => isPartOffField(p, forceOnField));
  const offFieldPostStats =
    hasOffFieldParts && defaultOnFieldCharId !== charId
      ? teamStats.getPostStats(charId, defaultOnFieldCharId)
      : undefined;

  const statsVariants = buildStatVariants(activation, parts, (excl) =>
    teamStats.getPostStats(charId, charId, excl)
  );
  const offFieldVariants = offFieldPostStats
    ? buildStatVariants(activation, parts, (excl) =>
        teamStats.getPostStats(charId, defaultOnFieldCharId, excl)
      )
    : undefined;

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
  charId: string,
  teamStats: TeamStatSheet,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  activation?: BuffActivationMap,
  forceOnField?: boolean
): DamageResult {
  const selfPostStats = teamStats.getPostStats(charId, charId);
  const charLevel = teamStats.getCharLevel(charId);
  const teamPostStatsArr = Object.values(teamStats.getAllPostStats(charId));

  const defaultOnFieldCharId = teamStats.getDefaultOnFieldCharId(charId);
  const hasOffFieldParts = entry.parts.some((p) =>
    isPartOffField(p, forceOnField)
  );
  const offFieldSelfPostStats =
    hasOffFieldParts && defaultOnFieldCharId !== charId
      ? teamStats.getPostStats(charId, defaultOnFieldCharId)
      : undefined;

  const statsVariants =
    activation && Object.keys(activation).length > 0
      ? buildStatVariants(activation, entry.parts, (excl) =>
          teamStats.getPostStats(charId, charId, excl)
        )
      : undefined;
  const offFieldVariants =
    activation && Object.keys(activation).length > 0 && offFieldSelfPostStats
      ? buildStatVariants(activation, entry.parts, (excl) =>
          teamStats.getPostStats(charId, defaultOnFieldCharId, excl)
        )
      : undefined;

  const parts: DamageResult["parts"] = [];
  for (let idx = 0; idx < entry.parts.length; idx++) {
    const part = entry.parts[idx];
    const { formula, hits: totalHits, bespokeBuffs } = part;
    const h = totalHits ?? 1;
    const bespokeMax = bespokeMaxStacks(bespokeBuffs);
    const effectiveOffField = isPartOffField(part, forceOnField);

    const perPartRouting = part.statsCharId
      ? teamStats.getPostStats(part.statsCharId, charId)
      : undefined;
    const partStats = perPartRouting ?? selfPostStats;
    const partCharLevel = part.statsCharId
      ? teamStats.getCharLevel(part.statsCharId)
      : charLevel;

    const baseSelfStats =
      effectiveOffField && offFieldSelfPostStats && !perPartRouting
        ? offFieldSelfPostStats
        : partStats;

    let bespokeOverlay: StatSheet | undefined;
    if (bespokeBuffs?.length) {
      bespokeOverlay = buildBespokeOverlay(
        bespokeBuffs,
        baseSelfStats,
        teamPostStatsArr
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
        partCharLevel,
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
          partCharLevel,
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
        partCharLevel,
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
          partCharLevel,
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
        partCharLevel,
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
          partCharLevel,
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
  charId: string,
  teamStats: TeamStatSheet,
  ctx: CalcContext,
  reactionOverride?: ReactionOverride,
  forceOnField?: boolean
): { parts: DisplayPart[]; totalDamage: number } {
  const selfPostStats = teamStats.getPostStats(charId, charId);
  const charLevel = teamStats.getCharLevel(charId);

  const hasAnyOffField = entry.parts.some((p) =>
    isPartOffField(p, forceOnField)
  );
  const defaultOnFieldCharId = hasAnyOffField
    ? teamStats.getDefaultOnFieldCharId(charId)
    : charId;
  const offFieldSelfPostStats =
    hasAnyOffField && defaultOnFieldCharId !== charId
      ? teamStats.getPostStats(charId, defaultOnFieldCharId)
      : undefined;

  const displayParts: DisplayPart[] = [];
  let totalDamage = 0;
  for (let i = 0; i < entry.parts.length; i++) {
    const part = entry.parts[i];
    const { formula, hits: totalHits, bespokeBuffs } = part;
    const h = totalHits ?? 1;
    const effectiveOffField = isPartOffField(part, forceOnField);

    const perPartRouting = part.statsCharId
      ? teamStats.getPostStats(part.statsCharId, charId)
      : undefined;
    const partBaseStats = perPartRouting ?? selfPostStats;
    const partCharLevel = part.statsCharId
      ? teamStats.getCharLevel(part.statsCharId)
      : charLevel;

    const baseSelfStats =
      effectiveOffField && offFieldSelfPostStats && !perPartRouting
        ? offFieldSelfPostStats
        : partBaseStats;

    const stats = bespokeBuffs?.length
      ? baseSelfStats.merge(
          buildBespokeOverlay(bespokeBuffs, baseSelfStats, [])
        )
      : baseSelfStats;

    const hasReaction =
      reactionOverride?.reaction && reactionOverride.reaction !== "none";

    const bespokeMax = bespokeMaxStacks(bespokeBuffs);

    const addContributorInfo = (dp: DisplayPart) => {
      if (entry.isMultiContributor && part.statsCharId) {
        dp.contributorCharId = part.statsCharId;
      }
    };

    if (!hasReaction || formula.tag.reaction !== "none") {
      if (bespokeMax != null && bespokeMax < h) {
        const dpBuffed = formula.displayFull(stats, partCharLevel, ctx);
        dpBuffed.hits = bespokeMax;
        dpBuffed.sourcePartIndex = i;
        if (effectiveOffField) dpBuffed.offField = true;
        addContributorInfo(dpBuffed);
        totalDamage += dpBuffed.damage * bespokeMax;
        displayParts.push(dpBuffed);
        const dpUnbuffed = formula.displayFull(
          baseSelfStats,
          partCharLevel,
          ctx
        );
        dpUnbuffed.hits = h - bespokeMax;
        dpUnbuffed.sourcePartIndex = i;
        if (effectiveOffField) dpUnbuffed.offField = true;
        addContributorInfo(dpUnbuffed);
        totalDamage += dpUnbuffed.damage * (h - bespokeMax);
        displayParts.push(dpUnbuffed);
      } else {
        const dp = formula.displayFull(stats, partCharLevel, ctx);
        dp.hits = h;
        dp.sourcePartIndex = i;
        if (effectiveOffField) dp.offField = true;
        addContributorInfo(dp);
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
          const dpB = effectiveFormula.displayFull(stats, partCharLevel, ctx);
          dpB.hits = buffedRx;
          dpB.sourcePartIndex = i;
          if (effectiveOffField) dpB.offField = true;
          addContributorInfo(dpB);
          totalDamage += dpB.damage * buffedRx;
          displayParts.push(dpB);
        }
        if (unbuffedRx > 0) {
          const dpU = effectiveFormula.displayFull(
            baseSelfStats,
            partCharLevel,
            ctx
          );
          dpU.hits = unbuffedRx;
          dpU.sourcePartIndex = i;
          if (effectiveOffField) dpU.offField = true;
          addContributorInfo(dpU);
          totalDamage += dpU.damage * unbuffedRx;
          displayParts.push(dpU);
        }
      } else {
        const dp = effectiveFormula.displayFull(stats, partCharLevel, ctx);
        dp.hits = reactingHits;
        dp.sourcePartIndex = i;
        if (effectiveOffField) dp.offField = true;
        addContributorInfo(dp);
        totalDamage += dp.damage * reactingHits;
        displayParts.push(dp);
      }
    }
    if (nonReactingHits > 0) {
      if (bespokeRemaining != null) {
        const buffedNr = Math.min(bespokeRemaining, nonReactingHits);
        const unbuffedNr = nonReactingHits - buffedNr;
        if (buffedNr > 0) {
          const dpB = formula.displayFull(stats, partCharLevel, ctx);
          dpB.hits = buffedNr;
          dpB.sourcePartIndex = i;
          if (effectiveOffField) dpB.offField = true;
          addContributorInfo(dpB);
          totalDamage += dpB.damage * buffedNr;
          displayParts.push(dpB);
        }
        if (unbuffedNr > 0) {
          const dpU = formula.displayFull(baseSelfStats, partCharLevel, ctx);
          dpU.hits = unbuffedNr;
          dpU.sourcePartIndex = i;
          if (effectiveOffField) dpU.offField = true;
          addContributorInfo(dpU);
          totalDamage += dpU.damage * unbuffedNr;
          displayParts.push(dpU);
        }
      } else {
        const dp = formula.displayFull(stats, partCharLevel, ctx);
        dp.hits = nonReactingHits;
        dp.sourcePartIndex = i;
        if (effectiveOffField) dp.offField = true;
        addContributorInfo(dp);
        totalDamage += dp.damage * nonReactingHits;
        displayParts.push(dp);
      }
    }
  }
  return { parts: displayParts, totalDamage };
}
