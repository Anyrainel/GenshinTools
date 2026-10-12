import type {
  QualityTier,
  TriageBackupAmountMode,
  TriageSettings,
} from "./types";

export const TRIAGE_BACKUP_AMOUNT_PRESETS = {
  normal: {
    qualityMargin: 5,
    fillerKeep: 3,
    setSlotKeep: 3,
  },
  extra: {
    qualityMargin: 10,
    fillerKeep: 5,
    setSlotKeep: 3,
  },
} as const satisfies Record<
  Exclude<TriageBackupAmountMode, "custom">,
  Pick<TriageSettings, "qualityMargin" | "fillerKeep" | "setSlotKeep">
>;

export const DEFAULT_TRIAGE_SETTINGS: TriageSettings = {
  triageMode: "loose",
  mainStatThreshold: 80,
  optionalSubThreshold: 50,
  fillerKeep: TRIAGE_BACKUP_AMOUNT_PRESETS.normal.fillerKeep,
  qualityMargin: TRIAGE_BACKUP_AMOUNT_PRESETS.normal.qualityMargin,
  backupAmountMode: "normal",
  alwaysLockSolidArtifacts: false,
  setSlotKeep: TRIAGE_BACKUP_AMOUNT_PRESETS.normal.setSlotKeep,
  ownedOnly: true,
  erHoardingEnabled: true,
  erHoardingAllEnabled: false,
  doubleCritLockEnabled: true,
  levelProtection: 12,
  highLevelProtection: true,
  equippedProtection: true,
  disabledFlexPatterns: [],
  enabledFlexPatterns: [],
  customFlexInputs: [],
};

export const QUALITY_TIERS = [
  "prime",
  "solid",
  "filler",
  "fodder",
] as const satisfies readonly QualityTier[];

export const QUALITY_TIER_RANK: Record<QualityTier, number> = {
  prime: 0,
  solid: 1,
  filler: 2,
  fodder: 3,
};
