import type { StatSheet } from "@/domain/combat/damage/core/statSheet";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import type { Slot } from "@/domain/enums";
import type { AccountData, ArtifactData } from "@/domain/models";
import type { WeaponStatsMap } from "@/domain/reference/stats";
import type { TeamSetupConfig } from "./types";

export interface AccountEquipmentOptions {
  configs: TeamSlotConfig[];
  setupConfig: TeamSetupConfig;
  accountData: AccountData;
  weaponStats: WeaponStatsMap;
  combo: ComboFormula;
  calcContext: CalcContext;
  inventory: ArtifactData[];
  baseSheets: Record<string, StatSheet>;
  perCharExtraArtifacts: Record<string, ArtifactData[]>;
  forceReuseChars?: Record<string, Record<Slot, ArtifactData | null>>;
}
export interface AccountEquipmentResult {
  configs: TeamSlotConfig[];
  weaponCopyIds: string[];
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  damage: number;
  baselineDamage: number;
  evaluated: number;
  approximate: true;
}
export type AccountEquipmentYield =
  | { kind: "progress"; evaluated: number; phase: "screen" | "artifacts" }
  | { kind: "result"; result: AccountEquipmentResult | null };
