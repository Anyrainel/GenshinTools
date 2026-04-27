import type { TriageSettings } from "./types";

export const DEFAULT_TRIAGE_SETTINGS: TriageSettings = {
  triageMode: "loose",
  mainStatThreshold: 80,
  optionalSubThreshold: 50,
  fillerKeep: 3,
  qualityMargin: 7,
  alwaysLockSolidArtifacts: false,
  setSlotKeep: 3,
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
