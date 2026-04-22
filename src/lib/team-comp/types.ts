import type {
  ArtifactData,
  Element,
  Faction,
  GlobalStatWeights,
  ReactionType,
  Region,
  Slot,
  StatEntry,
  StatKey,
} from "@/data/types";
import type { BuildMatchResult } from "@/lib/artifact/scoring/artifactScore";
import type { DamageFormula } from "./calc/damageFormula";
import type { StatBuff } from "./calc/statBuff";
import type { StatSheet } from "./calc/statSheet";
import type { TeamBuild } from "./calc/teamBuild";
import type { TeamMeta } from "./calc/teamMeta";
import type { SubstatBudgetPreset } from "./generator/substatBudget";

export type { StatEntry, StatKey };

/**
 * Stats that flow into the damage formula but never feed back into sheet stats.
 * ScalingBuffs that output to these keys can safely read from post-sheet-dynamic
 * stats (two-pass evaluation) without creating cycles.
 */
export const FINAL_STAT_KEYS: ReadonlySet<StatKey> = new Set([
  "baseDmg",
  "baseDmg%",
  "dmg%",
  "reactionDmg%",
  "reactionBaseDmg%",
  "elevated%",
  "reactionCr",
  "reactionCd",
  "atkSpd%",
  "defReduction%",
  "defIgnore%",
  "resReduction%",
  "pneuma%",
  "lunar%",
]);

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
  /**
   * Optional explicit discriminator for cases where one source emits multiple
   * structurally similar buffs that still need distinct internal identity.
   * Does not affect display naming.
   */
  internalKey?: string;
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

/** Character field state — "on" = on-field, "off" = off-field. */
export type FieldState = "on" | "off";

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

// Combat Options (Schema-Driven)
/** A single selectable value in an OptionDef. */

export type OptionEntry = {
  value: string;
  label: I18nLabel;
  /** If provided, this choice is disabled when the predicate returns false. */
  when?: (teamMeta: TeamMeta) => boolean;
};
/**
 * Declarative option schema for a provider (character, weapon, or artifact set).
 * Defines a single select control with labeled choices.
 * UI renders as a toggle (2 choices) or dropdown (3+).
 */

export type OptionDef = {
  label: I18nLabel;
  choices: readonly OptionEntry[];
};
/**
 * Infer the typed option value union from an `as const` OptionDef.
 * Usage: `type DurinOption = InferOption<typeof durinOption>; // "dps" | "support"`
 */

export type InferOption<D extends OptionDef> = D["choices"][number]["value"];
/**
 * User-selected combat options, keyed by provider ID (charId or weaponId).
 * Each value is the selected option string for that provider.
 * Providers with no entry get `""` → falls back to first enabled choice via `resolveOption()`.
 */

export type OptionMap = Record<string, string>;

/** A single formula with an optional hit count (defaults to 1). */
export type FormulaPart = {
  formula: DamageFormula;
  hits?: number;
  /** Per-part buffs applied only when computing this part (selfOnField scope).
   *  Accepts any StatBuff subclass (StatBuff, ScalingBuff, CrossScalingBuff). */
  bespokeBuffs?: StatBuff[];
  /** If true, damage is dealt while the character is off-field.
   *  On-field buffs (onField, selfOnField) will NOT apply. */
  offField?: boolean;
  /** Override: use this character's stats (from team stats map) instead of the formula-level default. */
  statsCharId?: string;
};
/** Declarative entry in a character's formulaMap. */
export type FormulaEntry = {
  label: I18nLabel;
  parts: FormulaPart[];
  /** Owner of this formula: a charId, or "team" for reaction formulas.
   *  Populated by the engine during formulaIndex construction.
   *  Undefined until the entry is registered in a formulaIndex. */
  owner?: string;
  /** When true, each part represents a different character's contribution.
   *  Evaluation resolves per-part stats via part.statsCharId. */
  isMultiContributor?: boolean;
  /** Minimum constellation required (0-6). Omit or 0 = always available. */
  minC?: number;
  /** Additional availability condition (evaluated at construction time).
   *  `false` = formula is disabled (shown in UI but greyed out, excluded from combo).
   *  Omit or `true` = available (subject to minC check).
   *  The full condition is: `constellation >= (minC ?? 0) && when !== false`. */
  when?: boolean;
};

export type ProvidedStaticBuff = {
  buff: StatBuff;
  providerCharId: string;
};

/**
 * An extra buff applied by the user (food, environment, status, or custom).
 * Stored on Team.extraBuffs, consumed by TeamBuild when constructing stat sheets.
 */

export type ExtraBuff = {
  /** Unique instance ID for removal. */
  id: string;
  /** Links to an EnvBuff id for display; undefined for custom buffs. */
  presetId?: string;
  /** 'team' from team-wide, or a charId for per-character. */
  target: "team" | string;
  /** Stat contributions. Uses engine format: flat for hp/atk/def/em, fractional for %. */
  stats: { key: StatKey; value: number }[];
  /** Optional max stacks (for engine integration). */
  maxStacks?: number;
};

// ─── Reaction Combo Descriptor ───
/** Constellation-gated additive delta for a reaction combo entry,
 *  tagged with the character whose constellation gates it. */

export type ReactionComboDelta = {
  charId: string;
  minC: number;
  delta: number;
};
/** One reaction formula's combo descriptor.
 *  `total` is the base trigger count (with Columbina ×4/3 baked in).
 *  `eligible` lists participating charIds in team-slot order.
 *  `onFieldCharId` receives the remainder after giving 1 to each other eligible.
 *  `bonus` lists constellation-gated additive deltas to the total. */

export type ReactionComboEntry = {
  id: string;
  total: number;
  eligible: string[];
  onFieldCharId: string;
  bonus: ReactionComboDelta[];
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
  parts: {
    damage: number;
    hits: number;
    /** Present when this part has a bespokeBuff with maxStacks. */
    bespokeInfo?: {
      /** Per-hit damage WITHOUT the bespokeBuff applied. */
      unbuffedDamage: number;
      /** The maxStacks value from bespokeBuff.source. */
      maxStacks: number;
    };
  }[];
  /** Σ(damage × hits) — per-invocation total (all hits assume buffed when bespokeBuff present). */
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
  /** Per-hit damage with all buffs at full activation (no blending).
   *  Present only when blending reduces damage below the max. */
  maxDamage?: number;
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
  /** For multi-contributor lunar reactions: which character contributes this part */
  contributorCharId?: string;
};

/** StatEntry augmented with an optional cap for scaling buff display. */
export type ResolvedStatEntry = StatEntry & {
  cap?: number;
  inputKey?: StatKey;
  /** When present, value varies across on-field contexts. Shows range in UI. */
  minValue?: number;
  maxValue?: number;
};

/** A single buff, pre-resolved for display. */
export type ResolvedBuff = {
  /** Canonical buff-instance key used by overrides, blending, and BuffLedger UI. */
  buffKey: string;
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
  perCharCrTarget?: Record<string, number>; // charId → 0-100 integer; per-char CR targets
  rollMultiplier: number; // 0.7–1.0
  substatBudget: SubstatBudgetPreset;
};

/** Resolve a Partial<CalcContext> (from the store) into a full CalcContext with defaults. */
export function resolveCalcContext(ctx?: Partial<CalcContext>): CalcContext {
  return { ...DEFAULT_CALC_CONTEXT, ...ctx };
}

export const DEFAULT_CALC_CONTEXT: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

// ─── Reaction Override (Formula v2) ───

/** Which reactions a formula part can participate in. */
/** Per-formula reaction override (gate + per-part).
 *  Default: all parts inherit the gate reaction.
 *  partReactions stores explicit overrides (typically "none" to disable a part).
 *  partHits stores how many hits of a multi-hit part should react (rest use "none").
 */
export type ReactionOverride = {
  reaction?: ReactionType; // which reaction to override to
  rxnParts?: Record<number, ReactionType>; // which parts get new reaction
  rxnPartHits?: Record<number, number>; // which hits in said part get new reaction
};

// ─── Combo Descriptor ───

/** A single entry in a ComboDescriptor — one formula's hit count in a rotation. */
export type ComboTemplateEntry = {
  id: string;
  count: number;
  /** Constellation-dependent count adjustments, applied additively when met. */
  bonus?: ConstellationDelta[];
};

/** Constellation-gated additive delta for a ComboEntry count. */
export type ConstellationDelta = {
  /** Minimum constellation level required (1–6). */
  minC: number;
  /** Additive change to count when constellation ≥ minC. */
  delta: number;
  /** Whose constellation gates this delta. If omitted, uses the owning character. */
  charId?: string;
};

/**
 * Declarative rotation descriptor — an ordered array of ComboEntry.
 * Resolved into a flat Record<string, number> by resolveComboDescriptor().
 */
export type ComboTemplate = ComboTemplateEntry[];

// ─── Combo Formulas (Rotation Modeling) ───

export type ComboLine = {
  charId: string; // whose formula (on-field for on-field parts only)
  formulaId: string; // which formula from that character
  count: number; // repetitions (e.g., 9)
  reaction?: ReactionOverride; // per-line reaction override
  forceOnField?: boolean; // force all off-field parts to be on-field (intentional playstyle change)
};

export type ComboFormula = {
  id: string; // unique ID
  label: I18nLabel; // user-given name
  lines: ComboLine[];
  buffOverrides?: Record<number, BuffActivationMap>;
};

export type ComboResult = {
  lineDamages: { perHit: number; total: number }[];
  totalDamage: number;
};

// ─── Artifact Set Config ───

export type ArtifactSetConfig =
  | { type: "4pc"; setId: string }
  | { type: "2pc+2pc"; halfSetIds: [string, string] };

/** Extract the 4pc set ID, or null if not a 4pc config. */
export function getSetId(
  cfg: ArtifactSetConfig | null | undefined
): string | null {
  return cfg?.type === "4pc" ? cfg.setId : null;
}

/** Extract half-set IDs, or empty array if not a 2pc+2pc config. */
export function getHalfSetIds(
  cfg: ArtifactSetConfig | null | undefined
): string[] {
  return cfg?.type === "2pc+2pc" ? cfg.halfSetIds : [];
}

// ─── Char Build Config ───

export type TalentLevels = { auto: number; skill: number; burst: number };

export type TeamSlotConfig = {
  charId: string;
  charLevel: number;
  constellation: number;
  weaponId: string;
  refinement: number;
  artifactSet: ArtifactSetConfig | null;
  talentLevels?: TalentLevels;
};

// ─── Combat Options (Schema-Driven) ───
// OptionEntry, OptionDef, InferOption, OptionMap live in damageModels.ts
// (co-located with TeamMeta and resolveOption that consume them).

// ─── Optimizer Types (shared across V1, V2, Mona, benchmark) ───

export type OptFailReason =
  | { kind: "empty-pool"; emptySlots: Slot[] }
  | { kind: "no-seeds"; artifactSet?: ArtifactSetConfig | null }
  | { kind: "er-unmet"; minEr: number; bestEr: number }
  | { kind: "cr-unmet"; minCr: number; bestCr: number }
  | {
      kind: "set-impossible";
      artifactSet?: ArtifactSetConfig | null;
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
  artifactSet?: ArtifactSetConfig | null;
}

export interface TeamOptimizerOptions {
  teamBuild: TeamBuild;
  carryCharId: string;
  combo: ComboFormula;
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
  /** Artifact IDs to exclude from the pool per character (e.g. tier-aware exclusion) */
  perCharExcludedArtifactIds?: Record<string, string[]>;
  /** Enable Lagrangian relaxation for shared-set artifact allocation (Phase 2.5). */
  useLagrangianAlloc?: boolean;
}
