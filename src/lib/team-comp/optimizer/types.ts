/**
 * Types for the V2 Optimizer (Branch-and-Bound per character + Team Allocation).
 */

import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import type { OptimizerContext, TeamBuild } from "../damageCalc";
import type { StatSheet } from "../damageModels";
import type { ArtifactVarLookup, CompiledTeamDamage } from "../formulaCompiler";
import type {
  CalcContext,
  CharOptConfig,
  DamageResult,
  OptFailReason,
  ReactionOverride,
  StatKey,
} from "../types";
import type { ConstraintChecker } from "./constraintChecker";

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
  constraints: ConstraintChecker;
  reactionOverride?: ReactionOverride;
  scoreFn?: (sheets: Record<string, StatSheet>, calcTargetId: string) => number;
  collector: TopKCollectorLike;
  evaluations: number;
  sinceLastYield: number;
  optCtx?: OptimizerContext;
  compiled?: CompiledTeamDamage;
  compiledVars?: Float64Array;
  compiledCharIdx?: number;
  compiledLookup?: ArtifactVarLookup;
  deadline?: number;
  aborted?: boolean;
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

export interface CharacterBnBResult {
  collector: TopKCollectorLike;
  evaluations: number;
  failReason?: OptFailReason;
  marginalWeights?: MarginalWeights | null;
}
