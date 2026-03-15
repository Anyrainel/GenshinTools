import type { TriageSettings } from "./types";

export const DEFAULT_TRIAGE_SETTINGS: TriageSettings = {
  coreThreshold: 85,
  valuableThreshold: 50,
  surplusBuffer: 1,
  minimumKeep: 1,
  erHoardingEnabled: true,
  doubleCritLockEnabled: true,
  rareEmbryoEnabled: true,
  maxLevelProtection: true,
  equippedProtection: true,
};
