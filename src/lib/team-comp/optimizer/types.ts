/**
 * Types for the V2 Optimizer (Branch-and-Bound per character + Team Allocation).
 */

import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import type { BuildMatchResult } from "../../account-data/artifactScore";
import type { OptimizerContext, TeamBuild } from "../damageCalc";
import type { StatSheet } from "../damageModels";
import type { CompiledTeamDamage } from "../formulaCompiler";
import type {
  CalcContext,
  CharOptConfig,
  DamageResult,
  OptFailReason,
  ReactionOverride,
  StatKey,
} from "../types";

// ─── Artifact Types ───

export type ArtifactTuple = [
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
  ArtifactData | null,
];

export interface SuperArtifact {
  maxEr: number;
  maxCr: number;
  stats: Partial<Record<StatKey, number>>;
}

// ─── Top-K Entry ───

export interface TopKEntry {
  damage: number;
  result: DamageResult | null;
  artifacts: ArtifactTuple;
  artifactIds: Set<string>;
}

// ─── Marginal Weights ───

export interface MarginalWeights {
  substatWeights: Record<string, number>;
  mainStatMarginals: Record<string, Record<string, number>>;
  hasMainStatDisagreement: boolean;
}

// ─── Slot Data ───

export interface PreparedSlotData {
  allArtifacts: ArtifactData[];
  bySet: Map<string, ArtifactData[]>;
  slotSuperArtifact: SuperArtifact;
  setSuperArtifacts: Map<string, SuperArtifact>;
}

// ─── Pattern Task ───

export interface PatternTask {
  groups: ArtifactData[][];
  supers: SuperArtifact[];
  upperBound: number;
}

// ─── B&B Context ───

/** Mutable state shared across the DFS and hill-climbing within a single character B&B run. */
export interface BnBContext {
  teamBuild: TeamBuild;
  swapCharId: string;
  formulaCharId: string;
  formulaId: string;
  baseSheets: Record<string, StatSheet>;
  calcTargetId: string;
  calcContext: CalcContext;
  erCheckCharId: string;
  minEr: number;
  minCr: number;
  erFloor: number;
  crFloor: number;
  reactionOverride?: ReactionOverride;
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number;
  collector: TopKCollectorLike;
  evaluations: number;
  sinceLastYield: number;
  optCtx?: OptimizerContext;
  compiled?: CompiledTeamDamage;
  compiledVars?: Float64Array;
  compiledCharIdx?: number;
  compiledLookup?: import("../formulaCompiler").ArtifactVarLookup;
  deadline?: number;
  aborted?: boolean;
  /** Called periodically from DFS/HC with current best damage and evaluation count. */
  onProgress?: (bestDamage: number, evaluations: number) => void;
}

/** Minimal interface for the top-K collector, enabling alternate implementations. */
export interface TopKCollectorLike {
  readonly threshold: number;
  readonly best: TopKEntry | undefined;
  readonly size: number;
  readonly results: TopKEntry[];
  add(
    damage: number,
    result: DamageResult | null,
    artifacts: ArtifactTuple
  ): boolean;
}

// ─── Character B&B Parameters ───

export interface CharacterBnBParams {
  charId: string;
  charConfig: CharOptConfig;
  teamBuild: TeamBuild;
  carryCharId: string;
  formulaId: string;
  inventory: ArtifactData[];
  globalConfig: GlobalStatWeights;
  baseSheets: Record<string, StatSheet>;
  calcContext: CalcContext;
  excludedIds: Set<string> | undefined;
  reactionOverride: ReactionOverride | undefined;
  scoreFn:
    | ((sheets: Record<string, StatSheet>, calcTargetId: string) => number)
    | undefined;
  topK: number;
  deadline?: number;
  warmStartThreshold?: number;
  maxArtsPerSlot?: number;
}

export interface CharacterBnBResult {
  collector: TopKCollectorLike;
  evaluations: number;
  failReason?: OptFailReason;
  marginalWeights?: MarginalWeights | null;
}

// ─── Scoring Strategy ───

/** Strategy for scoring/ranking artifacts within a slot. */
export interface ArtifactScoringStrategy {
  score(art: ArtifactData): number;
}

/** Config needed to create scoring strategies. */
export interface ScoringConfig {
  buildMatch: BuildMatchResult | null | undefined;
  globalConfig: GlobalStatWeights;
  crDiscount: number;
}
