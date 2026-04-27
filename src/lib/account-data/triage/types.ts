import type { MainStat, Slot, SubStat } from "@/data/enums";
import type { ArtifactData } from "@/data/types";

// Core labels & tiers

export type TriageLabel = "lock" | "unlock";

export const QUALITY_TIERS = ["prime", "solid", "filler", "fodder"] as const;

export type QualityTier = (typeof QUALITY_TIERS)[number];

export const QUALITY_TIER_RANK: Record<QualityTier, number> = {
  prime: 0,
  solid: 1,
  filler: 2,
  fodder: 3,
};

// Demand & Embryo

export type DemandSource =
  | { type: "4pc"; setKey: string }
  | { type: "2pc"; halfSetId: string }
  | { type: "flex" };

export type DemandProfile = {
  buildId: string;
  characterId: string;
  demandSource: DemandSource;
  slot: Slot;
  acceptedMainStats: MainStat[];
  coreStats: SubStat[];
  valuableStats: SubStat[];
};

export type SubstatGrade = {
  coreCount: number;
  valuableCount: number;
  minorCount: number;
  unwantedCount: number;
  totalCount: number;
  initial4Line: boolean;
};

export type EmbryoMatch = {
  demand: DemandProfile;
  grade: SubstatGrade;
  embryoKey: string;
};

// Decision output

export type TriageRuleId =
  | "primeTierKeep"
  | "solidTierKeep"
  | "solidOversupplyUnlock"
  | "fillerShortfallKeep"
  | "fillerDefaultUnlock"
  | "fodderSubstatMismatch"
  | "fodderTier"
  | "noDemand"
  | "setSlotFloorKeep"
  | "supportSetErHoard"
  | "allSetErHoard"
  | "doubleCrit"
  | "offPiecePattern"
  | "concentrationValue";

export type TriageSpecialRule =
  | "supportSetErHoard"
  | "allSetErHoard"
  | "levelProtected"
  | "equippedProtected"
  | "doubleCrit"
  | "setSlotFloor"
  | "offPiecePattern"
  | `concentrationValue:${string}`;

export type EmbryoResult = {
  embryo: EmbryoMatch;
  label: TriageLabel;
  ruleId: TriageRuleId;
  reason: string;
  /** Numeric args for i18n reason templates ({0}, {1}, ...) */
  reasonArgs: (string | number)[];
  /** Quality tier (prime/solid/filler/fodder) */
  tier?: QualityTier;
};

export type SupplyDemandInfo = {
  demand: number;
  supplyByTier: Record<QualityTier, number>;
  rankInTier: number; // 1-based
  tierTotal: number;
};

export type TriageDecision = {
  artifact: ArtifactData;
  label: TriageLabel;
  /** The embryo result that determined the final label */
  decidingResult: EmbryoResult | null;
  /** All embryo evaluations (for detail view) */
  allResults: EmbryoResult[];
  /** Special rules that fired, such as ER hoarding or protection rules. */
  specialRules: TriageSpecialRule[];
  /** Supply/demand context for the deciding embryoKey */
  supplyDemand: SupplyDemandInfo | null;
};

// Settings

export type TriageMode = "strict" | "loose";

export type TriageSettings = {
  /** Triage strictness mode. Loose mode uses looser per-tier probability thresholds. */
  triageMode: TriageMode;
  mainStatThreshold: number;
  optionalSubThreshold: number;
  fillerKeep: number;
  qualityMargin: number;
  setSlotKeep: number; // min artifacts to keep per set+slot
  ownedOnly: boolean; // only consider owned characters' builds
  erHoardingEnabled: boolean;
  erHoardingAllEnabled: boolean; // all sets, not just support
  doubleCritLockEnabled: boolean;
  levelProtection: number; // artifacts >= this level are protected
  /**
   * When true, high-level artifacts (≥ levelProtection) are auto-protected
   * When false, they flow through normal triage and, if rejected, are
   * re-evaluated by the concentration-value pass.
   * Default true.
   */
  highLevelProtection: boolean;
  equippedProtection: boolean; // default true
  disabledFlexPatterns: string[];
  enabledFlexPatterns: string[];
  customFlexInputs: CustomFlexInput[];
};

// Tier system types

export type TierCondition = {
  requiredDesiredHits: number;
  requiresCritPair: boolean;
  requiresFourInitialSubstats: boolean;
  requiresFillerHit: boolean;
  tier: Exclude<QualityTier, "fodder">;
  /**
   * End-to-end probability that a random artifact (same set/slot/main-stat
   * scenario) would satisfy this condition. Lower = rarer = better. Used as
   * the primary ranking signal within a tier.
   */
  rarity: number;
};

export type DemandTierEntry = {
  desiredSubstatCount: number;
  hasCritPair: boolean;
  hasFillers: boolean;
  conditions: TierCondition[]; // sorted best-first (prime → solid → filler)
};

export type TriageRule = {
  characterId: string;
  buildId: string;
  demandSource: DemandSource;
  slot: Slot;
  mainStat: MainStat;
  desired: SubStat[];
  optional: SubStat[]; // for ranking only
  fillers: SubStat[];
  tierEntry: DemandTierEntry;
};

export type FlexPattern = {
  key: string;
  slot: Slot;
  mainStat: MainStat;
  requiredSubs: SubStat[];
  /** E2E rarity probability */
  rarity: number;
  /** If true, this pattern is off by default and must be explicitly enabled */
  defaultOff?: boolean;
  /** If true, this is a user-created custom pattern */
  custom?: boolean;
};

export type CustomFlexInput = {
  slot: Slot;
  mainStat: MainStat;
  requiredSubs: SubStat[];
};
