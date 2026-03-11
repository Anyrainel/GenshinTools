/**
 * Artifact Score V2: Normalized Scoring with Main Stat Integration
 *
 * Public API for the V2 scoring system.
 * Uses real TeamBuild damage calculations for auto-tuned weights.
 */

// Core types
export type {
  BuildV2Weights,
  MainStatWeight,
  TeamContext,
  AutoTuneResult,
} from "./types";

export {
  SUBSTAT_COEFFICIENTS,
  MAX_ROLLS_5STAR,
  AVG_ROLL_VALUES,
  AVG_ROLL_CD_EQUIV,
  MAIN_STAT_CD_EQUIV_5STAR,
  MAIN_STAT_CD_EQUIV_4STAR,
  SUBSTAT_BUDGET_ROLLS,
  IDEAL_ROLL_DISTRIBUTION,
} from "./types";

// Auto-tuning (uses real TeamBuild damage calculator)
export {
  autoTuneWeights,
  computeIdealScore,
  averageWeights,
} from "./autoTune";

// Team database (derived from curated presets)
export {
  CHARACTER_BUILD_PROFILES,
  CHARACTER_PROFILES_BY_ID,
  getProfiledCharacterIds,
} from "./teamDatabase";
export type { CharacterBuildProfile } from "./teamDatabase";

// Pipeline
export {
  runPipeline,
  generateBuildWeights,
  v2WeightsToLegacyBuild,
  formatBuildWeights,
} from "./pipeline";
export type { PipelineResult } from "./pipeline";

// Scorer
export { scoreV2, getScoreTier } from "./scorer";
export type { V2ScoreResult, V2SlotScore } from "./scorer";
