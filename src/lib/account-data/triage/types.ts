import type { ArtifactData, MainStat, Slot, SubStat } from "@/data/types";

// ---------------------------------------------------------------------------
// Core labels & tiers
// ---------------------------------------------------------------------------

export type TriageLabel = "lock" | "unlock";

export type QualityTier = "P" | "Q" | "N" | "T";

// ---------------------------------------------------------------------------
// Demand & Embryo
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Decision output
// ---------------------------------------------------------------------------

export type TriageRuleId = string;

export type EmbryoResult = {
  embryo: EmbryoMatch;
  label: TriageLabel;
  ruleId: TriageRuleId;
  reason: string;
  /** Numeric args for i18n reason templates ({0}, {1}, ...) */
  reasonArgs: (string | number)[];
  /** Quality tier (P/Q/N/T) */
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
  /** Special rules that fired (SP1, SP5, etc.) */
  specialRules: string[];
  /** Supply/demand context for the deciding embryoKey */
  supplyDemand: SupplyDemandInfo | null;
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type TriageSettings = {
  mainStatThreshold: number; // default 90 (weight 0-100 scale)
  optionalSubThreshold: number; // default 50 (weight 0-100 scale)
  neutralKeep: number; // default 2
  qualityMargin: number; // default 2
  setSlotKeep: number; // default 2 (min artifacts to keep per set+slot)
  ownedOnly: boolean; // default true (only consider owned characters' builds)
  erHoardingEnabled: boolean; // default true
  doubleCritLockEnabled: boolean; // default true
  levelProtection: number; // default 12 (artifacts >= this level are protected)
  equippedProtection: boolean; // default true
  disabledFlexPatterns: string[];
  enabledFlexPatterns: string[];
};

// ---------------------------------------------------------------------------
// Tier system types
// ---------------------------------------------------------------------------

export type TierCondition = {
  k: number; // hit ≥ k desired substats
  crcd: boolean; // require both CR and CD present
  is4L: boolean; // require initial 4-line
  fill: boolean; // require ≥1 filler hit (only when k == subN)
  tier: Exclude<QualityTier, "T">;
};

export type DemandTierEntry = {
  subN: number;
  hasCrCd: boolean;
  hasFillers: boolean;
  conditions: TierCondition[]; // sorted best-first (P → Q → N)
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
};
