import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import type { Slot } from "@/domain/enums";
import type { AccountData, ArtifactData } from "@/domain/models";
import type {
  ArtifactInventoryReuseMode,
  ReservedArtifactTeam,
} from "./artifactInventory";
import type { TeamComp, TeamSetupConfig } from "./types";

export type CharacterCandidatePool = "owned-owned" | "owned-any" | "all-any";
export type CharacterArtifactBasis = "account" | "generated";
export interface CharacterReplacementSettings {
  replaceSlots: number[];
  pool: CharacterCandidatePool;
  artifactBasis: CharacterArtifactBasis;
  constellation4: number;
  constellation5: number;
  refinement34: number;
  refinement5: number;
}
export interface CharacterReplacementRequest {
  task?: "independent" | "joint";
  teamComp: TeamComp;
  setupConfig: TeamSetupConfig;
  accountData: AccountData | null;
  objective: ComboFormula;
  calcContext: CalcContext;
  settings: CharacterReplacementSettings;
  excludedArtifactIds: string[];
  ignoredCharIds?: string[];
  inventoryReservations?: {
    teams: Record<string, ReservedArtifactTeam>;
    reuseMode: ArtifactInventoryReuseMode;
    standaloneIds: string[];
  };
}
export interface CharacterReplacementResult {
  replacementSlots?: number[];
  configs: TeamSlotConfig[];
  slotIndexes: number[];
  weaponInstanceIds: (string | null)[];
  combo: ComboFormula;
  damage: number;
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  artifactBasis: CharacterArtifactBasis;
  ignoredCharIds: string[];
}
export type CharacterReplacementFailure =
  | "invalid-slots"
  | "no-objective"
  | "single-source"
  | "no-account"
  | "fixed-copy-shortage"
  | "not-enough-characters"
  | "no-results"
  | "calculator-error";
export type CharacterReplacementMessage =
  | {
      type: "progress";
      phase: "screen" | "refine";
      evaluated: number;
      step: number;
      total: number;
    }
  | {
      type: "result";
      results: CharacterReplacementResult[];
      baselineDamage: number | null;
      evaluated: number;
      skipped: number;
      partial: boolean;
    }
  | { type: "error"; reason: CharacterReplacementFailure; details?: string };

export type CharacterSlotReplacementOutcome = Extract<
  CharacterReplacementMessage,
  { type: "result" | "error" }
>;
export interface CharacterSlotReplacementRanking {
  slotIndex: number;
  outcome: CharacterSlotReplacementOutcome;
}
export type CharacterReplacementWorkerMessage =
  | CharacterReplacementMessage
  | { type: "slot-result"; ranking: CharacterSlotReplacementRanking }
  | { type: "independent-result"; rankings: CharacterSlotReplacementRanking[] };
