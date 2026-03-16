export { DEFAULT_TRIAGE_SETTINGS } from "./defaults";
export {
  getAcceptedMainStats,
  getEligibleSetsForHalfSet,
} from "./demandExtractor";
export { buildFlexPatterns } from "./flexRegistry";
export { extractRules } from "./ruleBuilder";
export { runTriage } from "./triageEngine";
export type {
  DemandProfile,
  EmbryoMatch,
  EmbryoResult,
  FlexPattern,
  QualityTier,
  SubstatGrade,
  TriageDecision,
  TriageLabel,
  TriageRule,
  TriageSettings,
} from "./types";
