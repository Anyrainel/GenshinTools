/**
 * Artifact Scoring: Normalized Scoring with Main Stat Integration
 *
 * Public API for the scoring system.
 * Uses real TeamBuild damage calculations for auto-tuned weights.
 */

// Core types
export type {
  TeamContext,
  AutoTuneResult,
} from "./utils";

export {
  SUBSTAT_COEFFICIENTS,
  MAX_ROLLS_5STAR,
  AVG_ROLL_VALUES,
  AVG_ROLL_CD_EQUIV,
  MAIN_STAT_CD_EQUIV_5STAR,
  MAIN_STAT_CD_EQUIV_4STAR,
  MAIN_STAT_VALUES_5STAR,
  MAIN_STAT_VALUES_4STAR,
  SUBSTAT_BUDGET_ROLLS,
  IDEAL_ROLL_DISTRIBUTION,
  computeIdealScore,
  computeCrDeduction,
  getMainStatValue,
} from "./utils";

// Auto-tuning (uses real TeamBuild damage calculator)
export {
  autoTuneWeights,
  averageWeights,
  toWeightedFormulas,
} from "./autoTune";
export type { WeightedFormula } from "./autoTune";

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
  autoTuneBuild,
  formatPipelineBuild,
} from "./pipeline";
export type {
  PipelineResult,
  PipelineBuildMeta,
  AutoTuneInput,
  AutoTuneOutput,
  TeamBreakdown,
  ComboBreakdown,
} from "./pipeline";

// Scorer
export { scoreNormalized } from "./scorer";
export type { ScoreResult, SlotScore } from "./scorer";
