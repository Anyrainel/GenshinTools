import type { Slot } from "@/data/enums";
import type { AccountData, ArtifactData } from "@/data/types";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";

export interface TeammateSearchSettings {
  constellation4: number | null;
  constellation5: number | null;
  refinement34: number | null;
  refinement5: number | null;
}

export interface TeammateSearchRequest {
  fixedIds: string[];
  account: AccountData;
  settings: TeammateSearchSettings;
  excludedArtifactIds?: string[];
}

export interface TeammateSearchResult {
  configs: TeamSlotConfig[];
  weaponInstanceIds: string[];
  damage: number;
  combo: ComboFormula;
  calcContext: CalcContext;
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
}

export type TeammateSearchMessage =
  | {
      type: "progress";
      phase: "screen" | "artifacts";
      evaluated: number;
      step: number;
      total: number;
    }
  | {
      type: "result";
      results: TeammateSearchResult[];
      evaluated: number;
      skipped: number;
      truncated: boolean;
    }
  | { type: "error"; message: string };
