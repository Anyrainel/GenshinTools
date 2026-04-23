/**
 * Types for the V2 Optimizer (Branch-and-Bound per character + Team Allocation).
 */

import type { StatKey } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import type { DamageResult } from "@/lib/dmgcalc/types";

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
