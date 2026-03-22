/**
 * Branch-and-Bound Team Optimizer
 *
 * This file is a thin re-export layer. All implementation lives in
 * the `./optimizer/` submodules.
 */

// Re-export optimizer types so consumers can import from this module
export type {
  TeamOptPassResult,
  TeamOptimizationProgress,
  TeamOptimizationResult,
  TeamOptSingleResult,
  TeamOptComboResult,
  TeamOptYield,
  TeamOptimizerOptions,
  CharOptConfig,
  TeamOptPassId,
} from "./types";

export type { TopKEntry } from "./optimizer/types";

export { runCharacterBnB } from "./optimizer/characterBnB";
export { runTeamOptimization } from "./optimizer/teamOptimization";
