/**
 * Types for the V2 Optimizer (Branch-and-Bound per character + Team Allocation).
 */

import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import type { TeamBuild } from "../damageCalc";
import type { StatSheet } from "../damageModels";
import type { ArtifactVarLookup, CompiledTeamDamage } from "../formulaCompiler";
import type {
  CalcContext,
  CharOptConfig,
  DamageResult,
  OptFailReason,
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

// ─── Compiled Evaluation Context ───

/** Pre-compiled damage expression for fast DFS evaluation. */
export interface CompiledContext {
  compiled: CompiledTeamDamage;
  vars: Float64Array;
  charIdx: number;
  lookup: ArtifactVarLookup;
}

// ─── B&B Context ───

/** Mutable state shared across the DFS and hill-climbing within a single character B&B run. */
export interface BnBContext {
  teamBuild: TeamBuild;
  swapCharId: string;
  baseSheets: Record<string, StatSheet>;
  calcContext: CalcContext;
  constraints: ConstraintChecker;
  collector: TopKCollectorLike;
  evaluations: number;
  sinceLastYield: number;
  compiledCtx: CompiledContext;
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
  marginalWeights?: MarginalWeights;
  /** True when all marginal + buildMatch weights were zero and fallback weights were injected. */
  usedFallbackWeights?: boolean;
}
