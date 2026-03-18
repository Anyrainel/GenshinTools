/**
 * Optimizer V2 module: Branch-and-Bound per-character + Team Allocation.
 *
 * Re-exports all public types and functions from submodules.
 */

export * from "./types";
export { TopKCollector } from "./topKCollector";
export {
  computeWeightScore,
  computeMarginalScore,
  prepareSlotData,
  withResortedSlotData,
  getArtifactEr,
  getArtifactCr,
  getArtifactStats,
  buildSuperArtifact,
} from "./artifactScoring";
export { computeMarginalWeights } from "./marginalWeights";
export { evaluateBuild, evaluateUpperBound } from "./evaluation";
export { runCharacterBnB } from "./characterBnB";
export { runTeamOptimization, evaluateBuildDirect } from "./teamOptimization";
