import type { TriageSettings } from "./types";

export const DEFAULT_TRIAGE_SETTINGS: TriageSettings = {
  triageMode: "loose",
  mainStatThreshold: 90,
  optionalSubThreshold: 50,
  fillerKeep: 5,
  qualityMargin: 5,
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
