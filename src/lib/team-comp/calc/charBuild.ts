import type { Faction, Region } from "@/data/types";
import { ELEMENT_ELIGIBLE_REACTIONS } from "../constants";
import type {
  CalcContext,
  DamageResult,
  DisplayPart,
  I18nLabel,
  OptionMap,
  ProvidedStaticBuff,
  ReactionOverride,
  StatEntry,
  TeamSlotConfig,
} from "../types";
import { resolvePartReaction } from "./combo";
import type { EvaluatedDynamicBuff } from "./damageCalc";
import type { DamageFormula } from "./damageFormula";
import { createReactionVariant } from "./damageFormula";
import { isFieldDependentReceiver } from "./fieldState";
import { isPartOffField } from "./fieldState";
import type {
  ArtifactHalfSetBase,
  ArtifactSetBase,
  CharacterBase,
  WeaponBase,
} from "./implModel";
import {
  createArtifactHalfSet,
  createArtifactSet,
  createCharacter,
  createWeapon,
} from "./registry";
import { blendSubPart } from "./stackAllocation";
import type { PartialBuffInfo } from "./stackAllocation";
import {
  StatBuff,
  deduplicateBuffs,
  getBuffInstanceKey,
  isBuffApplicable,
} from "./statBuff";
import { bespokeMaxStacks, buildBespokeOverlay } from "./statSheet";
import { StatSheet } from "./statSheet";
import type { TeamMeta } from "./teamMeta";
import { buildGleamResonanceBuffs } from "./teamResonance";

/**
 * Composes a single character's build:
 * character + weapon + artifact sets → stats + buffs + formulas.
 *
 * Owns the stat resolution pipeline:
 * Phase 1: Base stats (character + weapon) → baseStatSheet
 * Phase 2: + target-independent static buffs → innerStatSheet  (construction)
 * Phase 3: + target-dependent buffs + artifact stats → preStats (getTeamStats)
 * Phase 4: + dynamic buffs → postStats                         (getTeamStats)
 */
export class CharBuild {
  readonly charBase: CharacterBase;
  readonly weaponBase: WeaponBase;
  readonly artifactSetBase: ArtifactSetBase | null;
  readonly artifactHalfSetBases: ArtifactHalfSetBase[];
  private readonly resonanceBuffs: StatBuff[] = [];
  /** Phase 1 baseline: character + weapon + artifact set bonuses, BEFORE static buffs. */
  private readonly baseStatSheet: StatSheet;
  private innerStatSheet: StatSheet;

  constructor(
    config: TeamSlotConfig,
    teamMeta: TeamMeta,
    combatOpts: OptionMap = {}
  ) {
    this.charBase = createCharacter(
      config.charId,
      config.charLevel,
      config.constellation,
      teamMeta,
      combatOpts,
      config.talentLevels
    );
    this.weaponBase = createWeapon(
      config.weaponId,
      config.refinement,
      config.charId,
      teamMeta,
      combatOpts
    );
    this.artifactSetBase = config.artifactSetId
      ? createArtifactSet(
          config.artifactSetId,
          config.charId,
          teamMeta,
          combatOpts
        )
      : null;

    // Auto-include the 2pc half-set when using a 4pc set (if the set declares one)
    const auto2pcId = this.artifactSetBase?.halfSetId ?? null;
    const auto2pc = auto2pcId
      ? createArtifactHalfSet(auto2pcId, config.charId, teamMeta)
      : null;

    this.artifactHalfSetBases = [
      ...(auto2pc ? [auto2pc] : []),
      ...config.artifactHalfSetIds.map((id) =>
        createArtifactHalfSet(id, config.charId, teamMeta)
      ),
    ];

    this.resonanceBuffs.push(
      ...buildGleamResonanceBuffs(config.charId, teamMeta)
    );

    // Phase 1: Assemble base stats from character + weapon + artifact set 2pc bonuses
    const baseEntries: StatEntry[] = [
      ...this.charBase.stats,
      ...this.weaponBase.stats,
      ...(this.artifactSetBase?.stats ?? []),
      ...this.artifactHalfSetBases.flatMap((h) => h.stats),
    ];
    this.innerStatSheet = new StatSheet(baseEntries);
    this.baseStatSheet = this.innerStatSheet;
  }

  /** Reset innerStatSheet to the pre-applyStaticBuffs baseline.
   *  Used by the analyzer to efficiently reuse CharBuild instances across
   *  team combinations without re-constructing CharacterBase/WeaponBase. */
  resetStatSheet(): void {
    this.innerStatSheet = this.baseStatSheet;
  }

  /**
   * Collect all buffs from this build's providers, filtering out no-ops.
   *
   * WARNING: Returns a fresh array with fresh object references on each call.
   * Some providers use `get buffs()` getters that create new StatBuff
   * instances per invocation. Do NOT compare objects from separate calls
   * via Set.has() or ===. For stable references, use TeamBuild.allStaticBuffs
   * which is populated once at construction time.
   */
  getAllBuffs(): StatBuff[] {
    return [
      ...this.resonanceBuffs,
      ...this.charBase.buffs,
      ...this.weaponBase.buffs,
      ...(this.artifactSetBase?.buffs ?? []),
      ...this.artifactHalfSetBases.flatMap((h) => h.buffs),
    ].filter((b) => !b.isNoOp);
  }

  /**
   * Apply field-independent static buffs (self, other, team).
   * Called once during TeamBuild construction.
   * Field-dependent buffs (*OnField, *OffField) are deferred to getTeamStats.
   */
  applyStaticBuffs(
    teamStaticBuffs: ProvidedStaticBuff[],
    selfCharId: string,
    selfRegion?: Region,
    selfFaction?: Faction
  ): void {
    let applicable = teamStaticBuffs
      .filter(
        (b) =>
          !isFieldDependentReceiver(b.buff.target.receiver) &&
          isBuffApplicable(
            b.buff,
            b.providerCharId,
            selfCharId,
            false,
            selfRegion,
            selfFaction
          )
      )
      .map((b) => b.buff);
    applicable = deduplicateBuffs(applicable, (b) => b.staticBuffs);
    this.innerStatSheet = this.innerStatSheet.apply(applicable);
  }

  /**
   * Merge with artifact stats + apply target-dependent static buffs.
   * Returns "pre-stats": after base + all static buffs + artifacts, before dynamic.
   */
  getPreStats(
    artifactStats: StatSheet,
    targetDependentBuffs: ProvidedStaticBuff[]
  ): StatSheet {
    const merged = this.innerStatSheet.merge(artifactStats);
    if (targetDependentBuffs.length === 0) return merged;
    const applicable = deduplicateBuffs(
      targetDependentBuffs.map((b) => b.buff),
      (b) => b.staticBuffs
    );
    return merged.apply(applicable);
  }

  /**
   * Rebuild pre-stats from Phase 1 baseline, excluding buffs with matching keys.
   * Used by the exclusion-based blending system to produce stat variants.
   */
  getPreStatsExcluding(
    artifactStats: StatSheet,
    targetDependentBuffs: ProvidedStaticBuff[],
    allStaticBuffs: ProvidedStaticBuff[],
    excludeKeys: Set<string>,
    selfCharId: string,
    selfRegion?: Region,
    selfFaction?: Faction
  ): StatSheet {
    let sheet = this.rebuildBaseExcluding(
      artifactStats,
      allStaticBuffs,
      excludeKeys,
      selfCharId,
      selfRegion,
      selfFaction
    );

    if (targetDependentBuffs.length > 0) {
      const filteredTD = targetDependentBuffs.filter(
        (b) => !excludeKeys.has(getBuffInstanceKey(b.buff, b.providerCharId))
      );
      if (filteredTD.length > 0) {
        const deduped = deduplicateBuffs(
          filteredTD.map((b) => b.buff),
          (b) => b.staticBuffs
        );
        sheet = sheet.apply(deduped);
      }
    }

    return sheet;
  }

  /**
   * Shared base rebuild: re-apply target-independent static buffs (excluding
   * specified keys) from Phase 1 baseline, then merge artifact stats.
   */
  private rebuildBaseExcluding(
    artifactStats: StatSheet,
    allStaticBuffs: ProvidedStaticBuff[],
    excludeKeys: Set<string>,
    selfCharId: string,
    selfRegion?: Region,
    selfFaction?: Faction
  ): StatSheet {
    let applicable = allStaticBuffs
      .filter((b) => {
        if (excludeKeys.has(getBuffInstanceKey(b.buff, b.providerCharId)))
          return false;
        if (isFieldDependentReceiver(b.buff.target.receiver)) return false;
        return isBuffApplicable(
          b.buff,
          b.providerCharId,
          selfCharId,
          false,
          selfRegion,
          selfFaction
        );
      })
      .map((b) => b.buff);
    applicable = deduplicateBuffs(applicable, (b) => b.staticBuffs);
    return this.baseStatSheet.apply(applicable).merge(artifactStats);
  }

  /**
   * Apply dynamic buffs to pre-stats → post-stats.
   * Evaluates all applicable dynamic buffs.
   */
  getPostStats(
    selfPreStats: StatSheet,
    teamDynamicBuffs: EvaluatedDynamicBuff[],
    selfCharId: string,
    selfIsOnField: boolean,
    selfRegion?: Region,
    selfFaction?: Faction
  ): StatSheet {
    let applicable = teamDynamicBuffs.filter((b) =>
      isBuffApplicable(
        b.buff,
        b.providerCharId,
        selfCharId,
        selfIsOnField,
        selfRegion,
        selfFaction
      )
    );
    applicable = deduplicateBuffs(applicable, (b) => b.entries);

    const mappedToStatic = applicable.map(
      (b) => new StatBuff(b.buff.source, b.buff.target, b.entries)
    );
    return selfPreStats.apply(mappedToStatic);
  }

  /**
   * Compute idle pre-stats: baseStatSheet + artifacts + idle-eligible static buffs.
   * Bypasses innerStatSheet so only explicitly passed buffs are included.
   */
  getIdlePreStats(artifactStats: StatSheet, idleBuffs: StatBuff[]): StatSheet {
    const sheet = this.baseStatSheet.merge(artifactStats);
    if (idleBuffs.length === 0) return sheet;
    const deduped = deduplicateBuffs(idleBuffs, (b) => b.staticBuffs);
    return sheet.apply(deduped);
  }

  getFormulaIds(): Record<string, I18nLabel> {
    return this.charBase.formulaIds;
  }

  /** All formula IDs including constellation-locked ones, with minC/enabled info. */
  getAllFormulaIds(): Record<
    string,
    { label: I18nLabel; minC: number; enabled: boolean }
  > {
    return this.charBase.allFormulaIds;
  }

  /** Iterates the formula entry's parts, calls .calc() on each, and aggregates. */
  getDamageResult(
    formulaId: string,
    selfPostStats: StatSheet,
    teamPostStats: StatSheet[],
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldSelfPostStats?: StatSheet,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    offFieldVariants?: Map<string, StatSheet>,
    charLevelOverride?: number,
    forceOnField?: boolean
  ): DamageResult {
    const entry = this.charBase.getFormulaEntry(formulaId);
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);
    const effectiveLevel = charLevelOverride ?? this.charBase.charLevel;
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
        effectiveOffField && offFieldVariants
          ? offFieldVariants
          : statsVariants;

      const hasReaction =
        reactionOverride?.reaction && reactionOverride.reaction !== "none";

      if (!hasReaction || formula.tag.reaction !== "none") {
        const buffedResult = this._calcPartBlended(
          formula,
          baseSelfStats,
          ctx,
          h,
          idx,
          h,
          partialBuffs,
          partVariants,
          bespokeOverlay,
          bespokeMax,
          effectiveLevel
        );
        if (bespokeMax != null) {
          const unbuffedResult = this._calcPartBlended(
            formula,
            baseSelfStats,
            ctx,
            h,
            idx,
            h,
            partialBuffs,
            partVariants,
            undefined,
            undefined,
            effectiveLevel
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
        const buffedResult = this._calcPartBlended(
          effectiveFormula,
          baseSelfStats,
          ctx,
          reactingHits,
          idx,
          h,
          partialBuffs,
          partVariants,
          bespokeOverlay,
          bespokeMax,
          effectiveLevel
        );
        if (bespokeMax != null) {
          const unbuffedResult = this._calcPartBlended(
            effectiveFormula,
            baseSelfStats,
            ctx,
            reactingHits,
            idx,
            h,
            partialBuffs,
            partVariants,
            undefined,
            undefined,
            effectiveLevel
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
        const buffedResult = this._calcPartBlended(
          formula,
          baseSelfStats,
          ctx,
          nonReactingHits,
          idx,
          h,
          partialBuffs,
          partVariants,
          bespokeOverlay,
          bespokeMax,
          effectiveLevel
        );
        if (bespokeMax != null) {
          const unbuffedResult = this._calcPartBlended(
            formula,
            baseSelfStats,
            ctx,
            nonReactingHits,
            idx,
            h,
            partialBuffs,
            partVariants,
            undefined,
            undefined,
            effectiveLevel
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

  /**
   * Compute blended damage for a sub-part (possibly a reaction split).
   * If partialBuffs affect this part, uses interval-based blending.
   */
  private _calcPartBlended(
    formula: DamageFormula,
    baseStats: StatSheet,
    ctx: CalcContext,
    hits: number,
    partIdx: number,
    originalPartHits: number,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    bespokeOverlay?: StatSheet,
    bespokeMax?: number,
    charLevel?: number
  ): { damage: number; hits: number } {
    const effectiveLevel = charLevel ?? this.charBase.charLevel;
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
      effectiveLevel,
      ctx,
      hits,
      partIdx,
      originalPartHits,
      partialBuffs ?? [],
      statsVariants
    );
    return { damage: total / hits, hits };
  }

  /** Cold path: produce structured display data for a formula. */
  getDisplayParts(
    formulaId: string,
    selfPostStats: StatSheet,
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldSelfPostStats?: StatSheet,
    forceOnField?: boolean
  ): { parts: DisplayPart[]; totalDamage: number } {
    const entry = this.charBase.getFormulaEntry(formulaId);
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);
    const displayParts: DisplayPart[] = [];
    let totalDamage = 0;
    for (let i = 0; i < entry.parts.length; i++) {
      const part = entry.parts[i];
      const { formula, hits: totalHits, bespokeBuffs } = part;
      const h = totalHits ?? 1;
      const effectiveOffField = isPartOffField(part, forceOnField);

      // Use off-field stats when the part deals damage while the character is off-field
      const baseSelfStats =
        effectiveOffField && offFieldSelfPostStats
          ? offFieldSelfPostStats
          : selfPostStats;

      // Apply per-part stat overlay if present
      const stats = bespokeBuffs?.length
        ? baseSelfStats.merge(
            buildBespokeOverlay(bespokeBuffs, baseSelfStats, [])
          )
        : baseSelfStats;

      const hasReaction =
        reactionOverride?.reaction && reactionOverride.reaction !== "none";

      const bespokeMax = bespokeMaxStacks(bespokeBuffs);

      // Skip reaction override if the formula already has a built-in reaction
      // (e.g., LunarDirectFormula with lunarBloom should not be converted to CatalyzeFormula)
      if (!hasReaction || formula.tag.reaction !== "none") {
        if (bespokeMax != null && bespokeMax < h) {
          // Buffed hits
          const dpBuffed = formula.displayFull(
            stats,
            this.charBase.charLevel,
            ctx
          );
          dpBuffed.hits = bespokeMax;
          dpBuffed.sourcePartIndex = i;
          if (effectiveOffField) dpBuffed.offField = true;
          totalDamage += dpBuffed.damage * bespokeMax;
          displayParts.push(dpBuffed);
          // Unbuffed hits
          const dpUnbuffed = formula.displayFull(
            baseSelfStats,
            this.charBase.charLevel,
            ctx
          );
          dpUnbuffed.hits = h - bespokeMax;
          dpUnbuffed.sourcePartIndex = i;
          if (effectiveOffField) dpUnbuffed.offField = true;
          totalDamage += dpUnbuffed.damage * (h - bespokeMax);
          displayParts.push(dpUnbuffed);
        } else {
          const dp = formula.displayFull(stats, this.charBase.charLevel, ctx);
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

      // Distribute bespoke maxStacks across reacting then non-reacting hits
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
            const dpB = effectiveFormula.displayFull(
              stats,
              this.charBase.charLevel,
              ctx
            );
            dpB.hits = buffedRx;
            dpB.sourcePartIndex = i;
            if (effectiveOffField) dpB.offField = true;
            totalDamage += dpB.damage * buffedRx;
            displayParts.push(dpB);
          }
          if (unbuffedRx > 0) {
            const dpU = effectiveFormula.displayFull(
              baseSelfStats,
              this.charBase.charLevel,
              ctx
            );
            dpU.hits = unbuffedRx;
            dpU.sourcePartIndex = i;
            if (effectiveOffField) dpU.offField = true;
            totalDamage += dpU.damage * unbuffedRx;
            displayParts.push(dpU);
          }
        } else {
          const dp = effectiveFormula.displayFull(
            stats,
            this.charBase.charLevel,
            ctx
          );
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
            const dpB = formula.displayFull(
              stats,
              this.charBase.charLevel,
              ctx
            );
            dpB.hits = buffedNr;
            dpB.sourcePartIndex = i;
            if (effectiveOffField) dpB.offField = true;
            totalDamage += dpB.damage * buffedNr;
            displayParts.push(dpB);
          }
          if (unbuffedNr > 0) {
            const dpU = formula.displayFull(
              baseSelfStats,
              this.charBase.charLevel,
              ctx
            );
            dpU.hits = unbuffedNr;
            dpU.sourcePartIndex = i;
            if (effectiveOffField) dpU.offField = true;
            totalDamage += dpU.damage * unbuffedNr;
            displayParts.push(dpU);
          }
        } else {
          const dp = formula.displayFull(stats, this.charBase.charLevel, ctx);
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
}
