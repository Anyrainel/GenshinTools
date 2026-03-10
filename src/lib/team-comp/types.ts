import type {
  BaseStat,
  Element,
  Faction,
  LunarReactionType,
  MainStat,
  ReactionType,
  Region,
  SubStat,
} from "@/data/types";

import type { StatSheet } from "./damageModels";

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
  | "baseDmg%" // 倍率乘区: "deal X% original DMG" multiplier (Yoimiya E, Neuvillette A1, Veil of Falsehood, etc.)
  | "reactionBaseDmg%" // 反应基础提升: lunar reaction base DMG bonus (Nod-Krai P3 passives)
  | "elevated%" // elevation multiplier §4 (replaces ${LunarReactionType}Elevated%)
  | "reactionDmg%" // reaction DMG bonus §8.4 (replaces ${ReactionType}%, separate zone from dmg%)
  | "reactionCr" // reaction CRIT rate §8.8 (replaces ${ReactionType}Cr, separate from cr)
  | "reactionCd" // reaction CRIT DMG §8.8 (replaces ${ReactionType}Cd, separate from cd)
  | "atkSpd%" // Attack Speed Bonus
  // Enemy debuff / modifier stats
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
  | "otherOnField"
  | "onField"
  | "team";

export type AbilityType =
  | "normal"
  | "charge"
  | "plunge"
  | "skill"
  | "burst"
  | "sprint"
  | "special";

// ─── Damage Tags ───

export type ElementalOrPhysical = Element | "Physical";

/** Full damage context — one value per dimension. Required on every DamageFormula. */
export type DamageTag = {
  element: ElementalOrPhysical;
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
  elements?: ElementalOrPhysical[];
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
  /** If set, buff only applies to characters from these regions. */
  regions?: Region[];
  /** If set, buff only applies to characters from these factions. */
  factions?: Faction[];
};

// ─── Reactions (re-exported from @/data/types — canonical definitions live there) ───

export type {
  LunarReactionType,
  ReactionType,
} from "@/data/types";

// ─── Damage Results ───

/** Bilingual label used for formula entries, option controls, etc. */
export type I18nLabel = { zh: string; en: string };

/** Aggregated result for a formulaId — may combine multiple formulas with hit counts. */
export type DamageResult = {
  parts: { damage: number; hits: number }[];
  /** Σ(damage × hits) */
  totalDamage: number;
};

// ─── Display Types (cold path — not used by optimizer) ───

/**
 * Formula template identifier. Each value maps 1:1 to a UI renderer
 * component that knows the equation structure for that formula type.
 */
export type FormulaTemplate =
  | "direct"
  | "amplify"
  | "catalyze"
  | "transform"
  | "lunar"
  | "lunarDirect";

/**
 * One formula part's structured display data.
 * Produced by DamageFormula.display(), consumed by UI template renderers.
 */
export type DisplayPart = {
  template: FormulaTemplate;
  /** Stat values read from the StatSheet — keys serve as cross-highlight targets */
  statValues: Partial<Record<StatKey, number>>;
  /** Formula-specific numeric coefficients for the template renderer
   *  (e.g. reactionCoeff, emCoeff, defCoeff). Keys are well-known per template. */
  params: Record<string, number>;
  /** Which StatKeys the formula scales off of (primary + optional extra) */
  scalingKeys: StatKey[];
  /** Talent/scaling multipliers, 1:1 with scalingKeys */
  scalingMulti: number[];
  damage: number;
  hits?: number;
  tag?: DamageTag;
};

/** StatEntry augmented with an optional cap for scaling buff display. */
export type ResolvedStatEntry = StatEntry & {
  cap?: number;
  inputKey?: StatKey;
};

/** A single buff, pre-resolved for display. */
export type ResolvedBuff = {
  source: BuffSource;
  /**
   * The ID of the character who provided this buff.
   * Undefined for team resonance buffs.
   */
  providerCharId?: string;
  target: BuffTarget;
  /** Whether this buff contributed to the calc target's stat sheet */
  active: boolean;
  /** Entries always present on this buff */
  staticEntries: StatEntry[];
  /** Entries evaluated at post-stats time, with per-entry caps. Empty for non-scaling buffs. */
  dynamicEntries: ResolvedStatEntry[];
};

/**
 * Full display payload returned by TeamBuild.getDisplayResult().
 * Single entry point for all UI display needs — formulas, buffs, stats.
 */
export type DisplayResult = {
  // ── Formula ──
  parts: DisplayPart[];
  totalDamage: number;

  // ── Buffs ──
  buffs: ResolvedBuff[];

  // ── Stats (all keyed by charId, full team) ──

  /** Raw StatSheets for both on/off field contexts per character. */
  statSheets: Record<string, { onField: StatSheet; offField: StatSheet }>;

  /** All unique formula tags per character (across all formulas, not just selected). */
  charFormulaTags: Record<string, DamageTag[]>;

  /** Relative damage gain (fractional, e.g. 0.023 = 2.3%) for +1 avg 5★ substat roll.
   *  Calc target: filtered by stat keys used in formula parts.
   *  Teammates: filtered by inputKeys of their scaling buffs that affect calc target. */
  marginalGains: Record<string, Partial<Record<StatKey, number>>>;

  /** Relative damage gain from leveling to the next tier.
   *  Only populated for characters below max level. Keyed by charId. */
  levelUpGains: Record<string, { gain: number; from: number; to: number }>;

  // DEPRECATED — kept during migration, remove after UI rewrite verified
  idleStats: Record<string, Partial<Record<StatKey, number>>>;
  combatStats: Record<string, Partial<Record<StatKey, number>>>;
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
  critRateTarget?: number; // 0–100 integer; undefined = disabled
  rollMultiplier?: number; // ideal-gen only; 0.7–1.0, default 0.85
};

// ─── Reaction Override (Formula v2) ───

/** Which reactions a formula part can participate in. */
export type AmplifyReaction = "vaporize" | "melt";
export type CatalyzeReaction = "spread" | "aggravate";

/** Per-formula reaction override (gate + per-part).
 *  Default: all parts inherit the gate reaction.
 *  partReactions stores explicit overrides (typically "none" to disable a part).
 *  partHits stores how many hits of a multi-hit part should react (rest use "none").
 */
export type ReactionOverride = {
  reaction?: ReactionType; // gate reaction
  partReactions?: Record<number, ReactionType>; // per-part overrides (sparse: only non-default)
  partHits?: Record<number, number>; // per-part reacting hit count (for multi-hit parts)
};

export function isAmplifying(r: ReactionType): r is AmplifyReaction {
  return r === "vaporize" || r === "melt";
}

export function isCatalyze(r: ReactionType): r is CatalyzeReaction {
  return r === "spread" || r === "aggravate";
}

/** Resolve the effective reaction for a formula part given overrides.
 *  Default behavior: ALL parts inherit the gate reaction (if element-eligible).
 *  Parts can be explicitly turned off via partReactions[idx] = "none".
 */
export function resolvePartReaction(
  override: ReactionOverride | undefined,
  partIndex: number,
  eligibleReactions: ReactionType[] | undefined
): ReactionType {
  // No override → no reaction
  if (!override?.reaction || override.reaction === "none") return "none";

  // Per-part override takes priority (used to disable specific parts)
  if (override.partReactions?.[partIndex] != null)
    return override.partReactions[partIndex];

  // Default: all parts inherit the gate if element-eligible
  if (eligibleReactions?.includes(override.reaction)) return override.reaction;

  // Element can't use this reaction at all
  return "none";
}

// ─── Combo Formulas (Rotation Modeling) ───

export type ComboLine = {
  charId: string; // whose formula (also the on-field character)
  formulaId: string; // which formula from that character
  count: number; // repetitions (e.g., 9)
  reaction?: ReactionOverride; // per-line reaction override
};

export type ComboFormula = {
  id: string; // unique ID
  label: I18nLabel; // user-given name
  lines: ComboLine[];
};

export type ComboResult = {
  lineDamages: { perHit: number; total: number }[];
  totalDamage: number;
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

/**
 * Structural interface for TeamMeta, used by option predicates.
 * Avoids circular imports between types.ts and damageModels.ts.
 */
export interface ITeamMeta {
  characters: string[];
  constellations: Record<string, number>;
  elements: Record<string, Element | undefined>;
  enemyElementAura?: Element;
  hasReaction(reaction: ReactionType, charId?: string): boolean;
  countByElement(element: Element): number;
}

/** A single selectable value in an OptionDef. */
export type OptionChoice = {
  value: string;
  label: I18nLabel;
  /** If provided, this choice is disabled when the predicate returns false. */
  when?: (teamMeta: ITeamMeta) => boolean;
};

/**
 * Declarative option schema for a provider (character, weapon, or artifact set).
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
