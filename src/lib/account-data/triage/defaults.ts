import type { TriageSettings } from "./types";

export const DEFAULT_TRIAGE_SETTINGS: TriageSettings = {
  triageMode: "strict",
  mainStatThreshold: 90,
  optionalSubThreshold: 50,
  neutralKeep: 3,
  qualityMargin: 3,
  setSlotKeep: 3,
  ownedOnly: true,
  erHoardingEnabled: true,
  erHoardingAllEnabled: false,
  doubleCritLockEnabled: true,
  levelProtection: 12,
  strategicHighLevelEvaluation: false,
  equippedProtection: true,
  disabledFlexPatterns: [],
  enabledFlexPatterns: [],
  customFlexInputs: [],
};
