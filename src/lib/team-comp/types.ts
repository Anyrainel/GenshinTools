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
import type { SubstatBudgetPreset } from "./substatBudget";

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
  | "resReduction%"
  // Non-artifact element DMG bonus keys (used in formula DMG% alias expansion)
  | "pneuma%"
  | "lunar%";

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
    | "teamResonance"
    | "extra";
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
  /** Max activation count per rotation. Greedy allocation distributes stacks
   *  across formula parts to maximize total damage. */
  maxStacks?: number;
  /** Display-only element hint (e.g. for gleam resonance icon). */
  element?: Element;
};

/** buffKey → { partIndex → activatedHits } */
export type BuffActivationMap = Record<string, Record<number, number>>;

/** Canonical key for a BuffSource, used in BuffActivationMap and override store. */
export function buffSourceKey(source: BuffSource): string {
  return `${source.type}:${source.id}:${source.origin ?? ""}`;
}

/**
 * Lightweight buff identification for interval-based blending.
 * Contains only the buff's identity and per-part activation counts.
 * Stat variants (with/without the buff) are pre-built by the caller.
 */
export type PartialBuffInfo = {
  /** Canonical key identifying the buff (from buffSourceKey). */
  buffKey: string;
  /** Part index → activated hits. Missing = fully active (no blending). */
  partActivation: Record<number, number>;
};

/** Build a deterministic cache key from a set of excluded buff keys. */
export function exclusionKey(excludeKeys: Set<string>): string {
  return [...excludeKeys].sort().join("|");
}

export type BuffReceiverType =
  | "self"
  | "selfOnField"
  | "selfOffField"
  | "other"
  | "otherOnField"
  | "otherOffField"
  | "teamOnField"
  | "teamOffField"
  | "team";

// ─── Receiver classification helpers ────────────────────────────────────────

/** Receiver targets the provider's own stat sheet (vs. reaching other characters). */
export function isSelfReceiver(r: BuffReceiverType): boolean {
  return r === "self" || r === "selfOnField" || r === "selfOffField";
}

/** Receiver depends on field state (on-field / off-field) to resolve. */
export function isFieldDependentReceiver(r: BuffReceiverType): boolean {
  return r !== "self" && r !== "other" && r !== "team";
}

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
 * Receiver semantics — "on-field" means selfIsOnField=true for the character
 * whose stat sheet we build (derived from formula part field state):
 *
 * Field-independent (always resolved at construction):
 * - 'self':           Always applies to the provider's own stat sheet.
 * - 'other':          Applies to all party members except the provider.
 * - 'team':           Applies to all 4 party members.
 *
 * Field-dependent (deferred until field state is known):
 * - 'selfOnField':    Provider's sheet, only when provider is on-field.
 * - 'selfOffField':   Provider's sheet, only when provider is off-field.
 * - 'otherOnField':   Non-provider sheets, only when receiver is on-field.
 * - 'otherOffField':  Non-provider sheets, only when receiver is off-field.
 * - 'teamOnField':    Any sheet, only when receiver is on-field.
 * - 'teamOffField':   Any sheet, only when receiver is off-field.
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
  /** If set, buff only applies to the character with this ID. */
  charId?: string;
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
  offField?: boolean;
  tag?: DamageTag;
  /** All StatKeys this formula part reads from the StatSheet during evaluation. */
  readKeys?: ReadonlySet<StatKey>;
  /** Annotation when a buff is partially active on this part */
  partialBuffs?: {
    buffKey: string;
    activatedHits: number;
    totalHits: number;
  }[];
  /** Original part index (stable across reaction-split sub-parts) */
  sourcePartIndex?: number;
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
  /** Whether this buff contributed to the calc target's stat sheet (any part). */
  active: boolean;
  /**
   * Which DisplayPart indices this buff is active for.
   * Undefined means "all parts" (buff has no DamageTagFilter or is universally applicable).
   * Empty array means the buff is inactive for all parts (active will be false).
   */
  activePartIndices?: number[];
  /** Entries always present on this buff */
  staticEntries: StatEntry[];
  /** Entries evaluated at post-stats time, with per-entry caps. Empty for non-scaling buffs. */
  dynamicEntries: ResolvedStatEntry[];
  /** If this is a bespoke (per-formula-part) buff, the label of the formula it applies to. */
  bespokeLabel?: I18nLabel;
};

/**
 * Full display payload returned by TeamBuild.getDisplayResult().
 * Single entry point for all UI display needs — formulas, buffs, stats.
 */
export type DisplayResult = {
  // ── Formula ──
  /** Per-formula display parts, keyed by "charId.formulaId". */
  partsByFormula: Record<string, DisplayPart[]>;
  totalDamage: number;
  /** Per-line damage breakdown (same order as active combo lines).
   *  Only present for combo display results, not single-formula display. */
  lineDamages?: { perHit: number; total: number }[];

  // ── Buffs ──
  buffs: ResolvedBuff[];
  /** Default buff activation from greedy stack allocation. */
  buffActivation?: BuffActivationMap;

  // ── Stats (all keyed by charId, full team) ──

  /** Raw StatSheets for both on/off field contexts per character. */
  statSheets: Record<string, { onField: StatSheet; offField: StatSheet }>;

  /** All unique formula tags per character (across all formulas, not just selected). */
  charFormulaTags: Record<string, DamageTag[]>;

  /** Relative damage gain (fractional, e.g. 0.023 = 2.3%) for +1 avg 5★ substat roll.
   *  Calc target: filtered by stat keys used in formula parts.
   *  Teammates: filtered by inputKeys of their scaling buffs that affect calc target. */
  marginalGains: Record<string, Partial<Record<StatKey, number>>>;

  /** Relative damage gain from leveling to the next tier(s).
   *  Only populated for characters below max level. Keyed by charId.
   *  Array may contain multiple entries (e.g. 90→95 and 90→100). */
  levelUpGains: Record<string, { gain: number; from: number; to: number }[]>;

  /** Idle stat records per character, on-field and off-field (character-panel view, per-element dmg% keys). */
  idleStatRecords: Record<
    string,
    {
      onField: Partial<Record<StatKey, number>>;
      offField: Partial<Record<StatKey, number>>;
    }
  >;

  /** Characters whose substats produce zero marginal gains even with no artifact stats.
   *  These are "intrinsically saturated" — their buffs scale on base stats only (e.g. Bennett). */
  intrinsicSaturatedCharIds: string[];
};

// ─── Team ───

// ─── Calc Context ───

/**
 * Scenario-level parameters for damage calculation.
 * Constant for the entire team — individual character implementations
 * never need to know or set these values.
 *
 * Per-character `charLevel` lives on TeamSlotConfig and is threaded
 * separately through the formula pipeline.
 */
/** How the crit multiplier is displayed (display-only, not used in optimizer). */
export type CritMode = "expected" | "crit" | "noCrit";

export type CalcContext = {
  enemyLevel: number;
  enemyRes: number;
  critRateTarget?: number; // 0–100 integer; undefined = disabled
  rollMultiplier?: number; // generator only; 0.7–1.0, default 0.85
  /** Generator only; per-slot substat roll totals; default 8_6 */
  substatBudget?: SubstatBudgetPreset;
};

// ─── Reaction Override (Formula v2) ───

/** Which reactions a formula part can participate in. */
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

/** Wrap a single formula into a 1-line ComboFormula. */
export function singleFormulaCombo(
  charId: string,
  formulaId: string,
  reaction?: ReactionOverride
): ComboFormula {
  return {
    id: "__single__",
    label: { zh: "", en: "" },
    lines: [{ charId, formulaId, count: 1, reaction }],
  };
}

export type ComboResult = {
  lineDamages: { perHit: number; total: number }[];
  totalDamage: number;
};

/**
 * Bundled formula context: combo definition + per-formula overrides.
 * Always travels as a unit across optimizer, generator, analyzer, and display.
 */
export type FormulaContext = {
  combo: ComboFormula;
  reactionOverrides?: Record<string, ReactionOverride>;
  buffOverrides?: Record<number, PartialBuffInfo[]>;
};

// ─── Char Build Config ───

export type TalentLevels = { auto: number; skill: number; burst: number };

export type TeamSlotConfig = {
  charId: string;
  charLevel: number;
  constellation: number;
  weaponId: string;
  refinement: number;
  artifactSetId: string | null; // null if 2+2
  artifactHalfSetIds: string[]; // 1 (for 4pc) or 2 (for 2+2)
  talentLevels?: TalentLevels;
};

// ─── Combat Options (Schema-Driven) ───
// OptionEntry, OptionDef, InferOption, OptionMap live in damageModels.ts
// (co-located with TeamMeta and resolveOption that consume them).

// ─── Optimizer Types (shared across V1, V2, Mona, benchmark) ───

import type { ArtifactData, GlobalStatWeights, Slot } from "@/data/types";
import type { BuildMatchResult } from "@/lib/account-data/artifactScore";
import type { TeamBuild } from "./damageCalc";

export type OptFailReason =
  | { kind: "empty-pool"; emptySlots: Slot[] }
  | { kind: "no-seeds"; setId?: string | null; halfSetIds?: string[] }
  | { kind: "er-unmet"; minEr: number; bestEr: number }
  | { kind: "cr-unmet"; minCr: number; bestCr: number }
  | {
      kind: "set-impossible";
      setId?: string | null;
      halfSetIds?: string[];
      slotCounts: Record<string, number>;
    }
  | { kind: "all-filtered"; combinationsTotal: number }
  | { kind: "timeout" }
  | { kind: "worker-error"; message: string };

export type TeamOptPassId = "carry-1" | "support" | "carry-2";

export interface TeamOptPassResult {
  passId: TeamOptPassId;
  charId: string;
  bestDamage: number;
  bestArtifacts: Record<Slot, ArtifactData | null>;
  failReason?: OptFailReason;
  /** Per-substat weights used for artifact ranking (debug display). */
  substatWeights?: Record<string, number>;
}

export type OptPhase = "init" | "phase1" | "phase2" | "phase3";

export interface TeamOptimizationProgress {
  currentPass: TeamOptPassId;
  currentPassCharId: string;
  passIndex: number;
  totalPasses: number;
  passPhase: "pruning" | "evaluating";
  passProgress: number;
  overallProgress: number;
  /** Current optimizer phase for display. */
  phase: OptPhase;
  passResults: TeamOptPassResult[];
  /** Live per-character best damage from in-progress Phase 1 workers. */
  workerBestDamage?: Record<string, number>;
  done: false;
}

interface TeamOptResultBase {
  bestDamage: number;
  bestArtifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  passResults: TeamOptPassResult[];
  failReasons: Record<string, OptFailReason>;
  teamBuild?: TeamBuild;
  done: true;
}

export type TeamOptimizationResult = TeamOptResultBase;

export type TeamOptYield = TeamOptimizationProgress | TeamOptimizationResult;

export interface CharOptConfig {
  minEr: number;
  minCr: number;
  buildMatch?: BuildMatchResult | null;
  artifactSetId?: string | null;
  artifactHalfSetIds?: string[];
}

export interface TeamOptimizerOptions {
  teamBuild: TeamBuild;
  carryCharId: string;
  formula: FormulaContext;
  inventory: ArtifactData[];
  calcContext: CalcContext;
  globalConfig: GlobalStatWeights;
  baseSheets: Record<string, StatSheet>;
  perChar: Record<string, CharOptConfig>;
  ignoreArtifactSets?: Record<string, boolean>;
  perCharDeadlineMs?: number;
  teamDeadlineMs?: number;
  maxArtsPerSlot?: number;
  /** Extra artifacts available only to specific characters (e.g. same-char frozen reuse) */
  perCharExtraArtifacts?: Record<string, ArtifactData[]>;
}
