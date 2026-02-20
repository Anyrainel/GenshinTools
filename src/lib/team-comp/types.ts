import type { BaseStat, Element, MainStat, SubStat } from "@/data/types";

/**
 * All stat keys the engine tracks.
 *
 * Aggregation rules (handled internally by StatSheet):
 * - Scaled stats (ATK, HP, DEF): base × (1 + sum(%)) + sum(flat)
 * - Additive stats (everything else): sum(contributions)
 *
 * Universal keys are scoped by DamageTagFilter on the buff target.
 * See DmgDesign.md §1.1 for the stat key zone table.
 */
export type StatKey =
  | BaseStat
  | MainStat
  | SubStat
  // Damage modifiers — scoped by DamageTagFilter on BuffTarget
  | "dmg%" // generic + ability + element DMG bonus (§3 zone, replaces ${AbilityType}%)
  | "baseDmg" // flat base DMG add (replaces ${AbilityType}Base: Yun Jin, Zhongli A4, Shenhe)
  | "baseDmg%" // base DMG multiplier (§8.7, "deal X% original DMG", Nod-Krai passives)
  | "elevated%" // elevation multiplier §4 (replaces ${LunarReactionType}Elevated%)
  | "reactionDmg%" // reaction DMG bonus §8.4 (replaces ${ReactionType}%, separate zone from dmg%)
  | "reactionCr" // reaction CRIT rate §8.8 (replaces ${ReactionType}Cr, separate from cr)
  | "reactionCd" // reaction CRIT DMG §8.8 (replaces ${ReactionType}Cd, separate from cd)
  | "atkSpd%" // Attack Speed Bonus
  // Enemy debuff / modifier stats
  | "dmgTaken%" // enemy DMG Taken Increase — additive with DMG Bonus zone
  | "defReduction%"
  | "defIgnore%"
  | "resReduction%";

export type StatEntry = {
  key: StatKey;
  value: number;
};

// ─── Buff System ───

/** Display-only provenance. Does not affect calculation. */
export type BuffSource = {
  type:
    | "character"
    | "weapon"
    | "artifactSet"
    | "artifactHalfSet"
    | "teamResonance";
  /** Provider ID from resources.ts */
  id: string;
  /** Kit origin: C0–C6, A, E, Q, P1–P4, R1–R5 */
  origin?: string;
  /** Trigger conditions: ["low-hp"], ["bloom"], ["shielded"], etc. */
  triggers?: string[];
  /**
   * Dedup key for effects that state "buffs of the same type will not stack".
   * When multiple buffs share the same noStackId, only the highest value applies.
   * E.g. Millennial Movement weapons share `"millennial-movement-atk"` on their ATK% entries.
   */
  noStackId?: string;
};

export type BuffReceiverType =
  | "self"
  | "selfOnField"
  | "selfOffField"
  | "onField"
  | "team";

export type AbilityType =
  | "normal"
  | "charge"
  | "plunge"
  | "skill"
  | "burst"
  | "special";

// ─── Damage Tags ───

/** Full damage context — one value per dimension. Required on every DamageFormula. */
export type DamageTag = {
  element: Element | "Physical";
  ability: AbilityType;
  reaction: ReactionType;
};

/**
 * Scoping filter for buffs. Each dimension is optional:
 * - Omitted = universal (applies regardless of formula's tag).
 * - Specified = applies only when the formula's DamageTag matches at least one value.
 * Arrays must be sorted for deterministic serialization.
 */
export type DamageTagFilter = {
  elements?: (Element | "Physical")[];
  abilities?: AbilityType[];
  reactions?: ReactionType[];
};

export function filterMatchesTag(
  filter: DamageTagFilter,
  tag: DamageTag
): boolean {
  if (filter.elements && !filter.elements.includes(tag.element)) return false;
  if (filter.abilities && !filter.abilities.includes(tag.ability)) return false;
  if (filter.reactions && !filter.reactions.includes(tag.reaction))
    return false;
  return true;
}

/**
 * Buff receiver scope + dimensional scoping (via DamageTagFilter).
 *
 * Receiver semantics (where calcTarget = the character whose damage we optimize):
 * - 'self':         Always applies to the provider's own stat sheet.
 * - 'selfOnField':  Applies to the provider ONLY when provider IS the calcTarget.
 * - 'selfOffField': Applies to the provider ONLY when provider is NOT the calcTarget.
 *                   In single-target optimization, equivalent to 'self' (easy to achieve off-field).
 * - 'onField':      Applies to the calcTarget's stat sheet (transfers from support to DPS).
 * - 'team':         Applies to all 4 party members.
 *
 * Filter dimensions scope which damage formulas see this buff's stat entries.
 * See DmgDesign.md §1.2–1.4.
 */
export type BuffTarget = {
  receiver: BuffReceiverType;
  /** If set, buff stat entries are only visible to formulas whose DamageTag matches this filter. */
  filter?: DamageTagFilter;
};

// ─── Reactions ───

/**
 * Reaction type identifiers for multiplier lookup.
 * AmplifyByX indicates which element triggers the reaction (determines 1.5x vs 2.0x).
 */
export type LunarReactionType =
  | "lunarCharged" // 月感电
  | "lunarBloom" // 月绽放
  | "lunarCrystallize"; // 月结晶

export type ReactionType =
  | "none"
  // Amplifying (coefficient derived from damage element)
  | "melt" // 融化
  | "vaporize" // 蒸发
  // Additive (Catalyze)
  | "quicken" // 原激化 (no damage)
  | "spread" // 蔓激化
  | "aggravate" // 超激化
  // Transformative
  | "overloaded" // 超载
  | "electroCharged" // 感电
  | "superconduct" // 超导
  | "swirl" // 扩散
  | "frozen" // 冻结
  | "shatter" // 碎冰
  | "bloom" // 绽放
  | "hyperbloom" // 超绽放
  | "burgeon" // 烈绽放
  | "burning" // 燃烧
  // Crystallize
  | "crystallize" // 结晶
  // Lunar
  | LunarReactionType;

// ─── Damage Results ───

/** Bilingual label used for formula entries, option controls, etc. */
export type I18nLabel = { zh: string; en: string };

/** Output of a single DamageFormula.calc() invocation. */
export type DamagePart = {
  /** Named components for UI display (e.g., { baseDmg: 8678, dmgBonusMult: 2.68, ... }) */
  components: Record<string, number>;
  /** The computed damage for this single formula */
  damage: number;
};

/** Aggregated result for a formulaId — may combine multiple formulas with hit counts. */
export type DamageResult = {
  parts: { part: DamagePart; hits: number }[];
  /** Σ(part.damage × hits) */
  totalDamage: number;
};

// ─── Team ───

// ─── Calc Context ───

/**
 * Scenario-level parameters for damage calculation.
 * Constant for the entire team — individual character implementations
 * never need to know or set these values.
 *
 * Per-character `charLevel` lives on CharCompConfig and is threaded
 * separately through the formula pipeline.
 */
export type CalcContext = {
  enemyLevel: number;
  enemyRes: number;
  assumeCrit: boolean;
};

// ─── Char Build Config ───

export type CharCompConfig = {
  charId: string;
  charLevel: number;
  constellation: number;
  weaponId: string;
  refinement: number;
  artifactSetId: string | null; // null if 2+2
  artifactHalfSetIds: string[]; // 1 (for 4pc) or 2 (for 2+2)
};

// ─── Combat Options (Schema-Driven) ───

/** A single selectable value in an OptionDef. */
export type OptionChoice = {
  value: string;
  label: I18nLabel;
};

/**
 * Declarative option schema for a provider (character or weapon).
 * Defines a single select control with labeled choices.
 * UI renders as a toggle (2 choices) or dropdown (3+).
 */
export type OptionDef = {
  label: I18nLabel;
  choices: readonly OptionChoice[];
  default: string;
};

/**
 * Infer the typed option value union from an `as const` OptionDef.
 * Usage: `type DurinOption = InferOption<typeof durinOption>; // "dps" | "support"`
 */
export type InferOption<D extends OptionDef> = D["choices"][number]["value"];

/**
 * User-selected combat options, keyed by provider ID (charId or weaponId).
 * Each value is the selected option string for that provider.
 * Providers with no entry get `""` → falls back to schema default via `resolveOption()`.
 *
 * Changing one entity's option only requires reconstructing that entity's CharBuild.
 *
 * Example:
 * ```
 * const opts: CombatOpts = {
 *   durin: "support",
 *   the_widsith: "em",
 * };
 * ```
 */
export type CombatOpts = Record<string, string>;
