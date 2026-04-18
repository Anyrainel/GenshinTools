import { charInfo } from "@/data/charInfo";
import {
  getTalentParam,
  resolveCharacterStats,
  resolveWeaponStats,
} from "@/lib/gameStatsLoader";
import { ELEMENT_ELIGIBLE_REACTIONS } from "../constants";
import type { FormulaEntry } from "../types";
import type {
  BuffSource,
  CalcContext,
  ComboTemplate,
  ComboTemplateEntry,
  DamageResult,
  I18nLabel,
  OptionMap,
  PartialBuffInfo,
  ReactionOverride,
  ReactionType,
  StatEntry,
  TalentLevels,
} from "../types";
import { resolveComboDescriptor } from "./combo";
import { resolvePartReaction } from "./combo";
import type { DamageFormula } from "./damageFormula";
import { createReactionVariant } from "./damageFormula";
import { isPartOffField } from "./fieldState";
import { blendSubPart } from "./stackAllocation";
import type { StatBuff } from "./statBuff";
import {
  type StatSheet,
  bespokeMaxStacks,
  buildBespokeOverlay,
} from "./statSheet";
import type { TeamMeta } from "./teamMeta";

/** Any entity that contributes stats and buffs to a build */
export abstract class IStatProvider {
  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];
}

/** An entity that owns damage formulas and exposes them for calc/display/compiler paths */
abstract class IFormulaProvider {
  /** Public label map — derived from the internal formulaMap */
  abstract get formulaIds(): Record<string, I18nLabel>;
  /** Look up a formula entry by ID (used by all three damage paths) */
  abstract getFormulaEntry(formulaId: string): FormulaEntry | undefined;
}

/**
 * Base class for character extensions.
 * Stats are auto-resolved from character_stats.json including baselines.
 */
export abstract class CharacterBase implements IStatProvider, IFormulaProvider {
  /** Auto-resolved: base stats + baselines (5% CR, 50% CD, 100% ER) */
  readonly stats: StatEntry[];

  /** Raw option string from OptionMap. Subclasses narrow via resolveOption(). */
  protected readonly option: string;

  /** Effective talent levels after C3/C5 bonuses. */
  private readonly _effectiveLevels: { A: number; E: number; Q: number };

  constructor(
    readonly charId: string,
    readonly charLevel: number,
    readonly constellation: number,
    readonly teamMeta: TeamMeta,
    combatOpts: OptionMap = {},
    talentLevels?: TalentLevels
  ) {
    this.stats = resolveCharacterStats(charId, charLevel);
    this.option = combatOpts[charId] ?? "";

    const base = talentLevels ?? { auto: 10, skill: 10, burst: 10 };
    const info = charInfo[charId];
    const c3Bonus = this.constellation >= 3 && info ? 3 : 0;
    const c5Bonus = this.constellation >= 5 && info ? 3 : 0;
    const passive = teamMeta.talentPassiveBonuses(charId);
    this._effectiveLevels = {
      A:
        base.auto +
        (info?.c3Talent === "A" ? c3Bonus : 0) +
        (info?.c5Talent === "A" ? c5Bonus : 0) +
        passive.A,
      E:
        base.skill +
        (info?.c3Talent === "E" ? c3Bonus : 0) +
        (info?.c5Talent === "E" ? c5Bonus : 0) +
        passive.E,
      Q:
        base.burst +
        (info?.c3Talent === "Q" ? c3Bonus : 0) +
        (info?.c5Talent === "Q" ? c5Bonus : 0) +
        passive.Q,
    };
  }

  /** Get talent param at the character's effective talent level. 1-based paramIndex. */
  protected param(skill: "A" | "E" | "Q", paramIndex: number): number {
    const level = this._effectiveLevels[skill];
    return getTalentParam(this.charId, skill, level - 1, paramIndex - 1);
  }

  /** Get the effective talent level for an ability (after C3/C5 bonuses). */
  protected talentLevel(ability: "auto" | "skill" | "burst"): number {
    const map = { auto: "A", skill: "E", burst: "Q" } as const;
    return this._effectiveLevels[map[ability]];
  }

  abstract readonly buffs: StatBuff[];

  /** Subclasses declare all formulas here — labels + formula instances in one place. */
  protected abstract readonly formulaMap: Record<string, FormulaEntry>;

  /** Declarative rotation descriptor — ordered array of ComboEntry.
   *  Subclasses override this instead of defaultCombo.
   *  Default: empty (no combo defined). */
  protected get comboDescriptor(): ComboTemplate {
    return [];
  }

  /** Public read-only access to the raw combo descriptor.
   *  Used by the analyzer combo tab to compute defaults per constellation. */
  get rawComboDescriptor(): ComboTemplate {
    return this.comboDescriptor;
  }

  /** Resolved combo counts — delegates to comboDescriptor.
   *  Subclasses should NOT override this; override comboDescriptor instead. */
  protected get defaultCombo(): Record<string, number> {
    return resolveComboDescriptor(this.comboDescriptor, this.constellation);
  }

  /** Check if a formula entry is enabled (minC + when satisfied). */
  private isFormulaEnabled(entry: FormulaEntry): boolean {
    return (entry.minC ?? 0) <= this.constellation && entry.when !== false;
  }

  /** Public accessor — filters defaultCombo to only enabled formulas. */
  get combo(): Record<string, number> {
    const raw = this.defaultCombo;
    const map = this.formulaMap;
    const result: Record<string, number> = {};
    for (const [id, count] of Object.entries(raw)) {
      const entry = map[id];
      if (entry && this.isFormulaEnabled(entry)) result[id] = count;
    }
    return result;
  }

  /** Structured combo info — descriptor entries filtered to enabled formulas. */
  get comboInfo(): ComboTemplateEntry[] {
    const map = this.formulaMap;
    return this.comboDescriptor.filter(
      (e) => map[e.id] && this.isFormulaEnabled(map[e.id])
    );
  }

  /** Derived from formulaMap — exposes enabled formula IDs and labels for combo evaluation. */
  get formulaIds(): Record<string, I18nLabel> {
    const result: Record<string, I18nLabel> = {};
    for (const [id, entry] of Object.entries(this.formulaMap)) {
      if (!this.isFormulaEnabled(entry)) continue;
      result[id] = entry.label;
    }
    return result;
  }

  /** All formula IDs with minC and enabled info, regardless of constellation.
   *  Used by UI to render locked/unavailable formulas. */
  get allFormulaIds(): Record<
    string,
    { label: I18nLabel; minC: number; enabled: boolean }
  > {
    const result: Record<
      string,
      { label: I18nLabel; minC: number; enabled: boolean }
    > = {};
    for (const [id, entry] of Object.entries(this.formulaMap)) {
      result[id] = {
        label: entry.label,
        minC: entry.minC ?? 0,
        enabled: this.isFormulaEnabled(entry),
      };
    }
    return result;
  }

  /** Public accessor for a single formula entry (used by display path).
   *  Lazily enriches the entry with `owner = this.charId` on first access. */
  getFormulaEntry(formulaId: string): FormulaEntry | undefined {
    const entry = this.formulaMap[formulaId];
    if (entry && !entry.owner) {
      (entry as FormulaEntry).owner = this.charId;
    }
    return entry;
  }

  /** All formula entries in this character's formulaMap (for formulaIndex construction). */
  get allFormulaEntries(): Record<string, FormulaEntry> {
    return this.formulaMap;
  }

  /** Check if any formula in this character's formulaMap produces the given reaction. */
  hasReactionFormula(reaction: ReactionType): boolean {
    for (const entry of Object.values(this.formulaMap)) {
      if (entry.parts.some((p) => p.formula.tag.reaction === reaction)) {
        return true;
      }
    }
    return false;
  }

  /** Returns all bespoke buffs across all formula parts, for display in BuffLedger. */
  getBespokeBuffs(): {
    formulaId: string;
    label: I18nLabel;
    buff: StatBuff;
  }[] {
    const result: { formulaId: string; label: I18nLabel; buff: StatBuff }[] =
      [];
    for (const [id, entry] of Object.entries(this.formulaMap)) {
      for (const part of entry.parts) {
        if (part.bespokeBuffs) {
          for (const buff of part.bespokeBuffs) {
            result.push({
              formulaId: id,
              label: entry.label,
              buff,
            });
          }
        }
      }
    }
    return result;
  }

  /** Iterates the formulaMap entry's parts, calls .calc() on each, and aggregates. */
  getDamageResult(
    formulaId: string,
    selfStats: StatSheet,
    teamStats: StatSheet[],
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldSelfStats?: StatSheet,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    offFieldVariants?: Map<string, StatSheet>,
    /** Override the character level used for DEF calculations (cross-scaled formulas). */
    charLevelOverride?: number,
    forceOnField?: boolean
  ): DamageResult {
    const entry = this.formulaMap[formulaId];
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);
    const effectiveLevel = charLevelOverride ?? this.charLevel;
    const parts: DamageResult["parts"] = [];
    for (let idx = 0; idx < entry.parts.length; idx++) {
      const part = entry.parts[idx];
      const { formula, hits: totalHits, bespokeBuffs } = part;
      const h = totalHits ?? 1;
      const bespokeMax = bespokeMaxStacks(bespokeBuffs);
      const effectiveOffField = isPartOffField(part, forceOnField);

      // Use off-field stats when the part deals damage while the character is off-field
      const baseSelfStats =
        effectiveOffField && offFieldSelfStats ? offFieldSelfStats : selfStats;

      // Apply per-part stat overlay if present
      let bespokeOverlay: StatSheet | undefined;
      if (bespokeBuffs?.length) {
        bespokeOverlay = buildBespokeOverlay(
          bespokeBuffs,
          baseSelfStats,
          teamStats
        );
      }

      // Pick the correct variants map for on/off-field
      const partVariants =
        effectiveOffField && offFieldVariants
          ? offFieldVariants
          : statsVariants;

      const hasReaction =
        reactionOverride?.reaction && reactionOverride.reaction !== "none";

      // Skip reaction override if the formula already has a built-in reaction
      // (e.g., LunarDirectFormula with lunarBloom should not be converted to CatalyzeFormula)
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

      // Determine how many hits react (partHits override, default = all)
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
   * The activation is scaled proportionally when hits < originalPartHits
   * (i.e., this is a reacting/non-reacting sub-part).
   *
   * @param statsVariants Pre-built stat sheets for each exclusion combination
   *   (without bespoke buffs). When a variant is used, bespokeOverlay is
   *   merged on top to restore bespoke buff contributions.
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
    const effectiveLevel = charLevel ?? this.charLevel;
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
}

/**
 * Base class for weapon extensions.
 * Stats are auto-resolved from resources.ts (baseAtk + secondary stat).
 */
export abstract class WeaponBase implements IStatProvider {
  /** Auto-resolved: baseAtk + secondary stat from resources.ts */
  readonly stats: StatEntry[];

  /** Raw option string from OptionMap. Subclasses narrow via resolveOption(). */
  protected readonly option: string;

  constructor(
    readonly weaponId: string,
    readonly refinement: number,
    readonly charId: string,
    readonly teamMeta: TeamMeta,
    combatOpts: OptionMap = {}
  ) {
    this.stats = resolveWeaponStats(weaponId);
    this.option = combatOpts[weaponId] ?? "";
  }

  abstract readonly buffs: StatBuff[];
}

/** Base class for 4-piece artifact set extensions (4pc bonus only) */
export abstract class ArtifactSetBase implements IStatProvider {
  /** Raw option string from OptionMap. Subclasses narrow via resolveOption(). */
  protected readonly option: string;

  constructor(
    readonly artifactSetId: string,
    readonly charId: string,
    readonly teamMeta: TeamMeta,
    combatOpts: OptionMap = {}
  ) {
    this.option = combatOpts[artifactSetId] ?? "";
  }

  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];

  /**
   * The ArtifactHalfSet ID that provides this set's 2pc bonus, or null if none.
   * When non-null, CharBuild will automatically include the matching half-set.
   */
  readonly halfSetId: string | null = null;
}

/** Base class for 2-piece artifact set extensions */
export abstract class ArtifactHalfSetBase implements IStatProvider {
  constructor(
    readonly artifactHalfSetId: string,
    readonly charId: string,
    readonly teamMeta: TeamMeta
  ) {}

  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];
}
