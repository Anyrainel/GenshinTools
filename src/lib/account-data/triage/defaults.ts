import type { TriageSettings } from "./types";

export const DEFAULT_TRIAGE_SETTINGS: TriageSettings = {
  mainStatThreshold: 90,
  optionalSubThreshold: 50,
  neutralKeep: 2,
  qualityMargin: 2,
  setSlotKeep: 2,
  ownedOnly: true,
  erHoardingEnabled: true,
  doubleCritLockEnabled: true,
  levelProtection: 12,
  equippedProtection: true,
  disabledFlexPatterns: [],
};
