import type { ArtifactData, MainStat, Slot, SubStat } from "@/data/types";

// ---------------------------------------------------------------------------
// Core labels & tiers
// ---------------------------------------------------------------------------

export type TriageLabel = "LOCK" | "BORDERLINE" | "FODDER";

export type StatTier = "core" | "valuable" | "minor" | "unwanted";

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
  isRareEmbryo: boolean;
};

// ---------------------------------------------------------------------------
// Decision output
// ---------------------------------------------------------------------------

export type TriageRuleId = string; // e.g. "L4-1", "F2-2", "S1", "SP1"

export type EmbryoResult = {
  embryo: EmbryoMatch;
  label: TriageLabel;
  ruleId: TriageRuleId;
  reason: string;
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
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type TriageSettings = {
  coreThreshold: number; // default 85
  valuableThreshold: number; // default 50
  surplusBuffer: number; // default 1
  minimumKeep: number; // default 1, range 0-3
  erHoardingEnabled: boolean; // default true
  doubleCritLockEnabled: boolean; // default true
  rareEmbryoEnabled: boolean; // default true
  maxLevelProtection: boolean; // default true
  equippedProtection: boolean; // default true
};

// ---------------------------------------------------------------------------
// Rare Embryo
// ---------------------------------------------------------------------------

export type RareEmbryoEntry = {
  slot: Slot;
  mainStat: MainStat;
  requiredSubstats: SubStat[];
  demandCharacters: string[];
  combinedRarity: number; // lower = rarer
};
