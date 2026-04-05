/**
 * Lagrangian Relaxation for Shared-Artifact Allocation (Phase 2.5)
 *
 * When multiple characters want the same artifacts, Phase 2's DFS can't
 * explore deep enough. This module:
 * 1. Identifies contested artifacts (appear in top-K of 2+ characters)
 * 2. Assigns Lagrangian "prices" to contested artifacts
 * 3. Re-ranks existing top-K entries with price-adjusted scoring
 * 4. Iterates via subgradient method until conflicts resolve
 *
 * The Lagrangian bound provides a certificate: if the gap between the
 * bound and best feasible solution is <1%, we know we're near-optimal.
 */

import type { ArtifactData, Slot } from "@/data/types";
import type { ArtifactTuple, TopKEntry } from "./types";

// ─── Types ───

export interface LagrangianConfig {
  /** Max iterations of subgradient descent. Default: 12. */
  maxIterations: number;
  /** Initial step size for subgradient updates. Default: 0.05 (5% of best damage). */
  initialStepFraction: number;
  /** Step size decay per iteration (multiplied each round). Default: 0.85. */
  stepDecay: number;
  /** Stop if no improvement for this many consecutive iterations. Default: 3. */
  plateauLimit: number;
}

export const DEFAULT_LAGRANGIAN_CONFIG: LagrangianConfig = {
  maxIterations: 12,
  initialStepFraction: 0.05,
  stepDecay: 0.85,
  plateauLimit: 3,
};

export interface LagrangianResult {
  /** Best feasible (conflict-free) artifact assignment found. */
  bestArtifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  /** Damage of the best feasible assignment. */
  bestFeasibleDamage: number;
  /** Lagrangian upper bound (always >= true optimal). */
  upperBound: number;
  /** Optimality gap: (upperBound - bestFeasible) / bestFeasible. */
  gap: number;
  /** Number of iterations run. */
  iterations: number;
  /** Whether this improved over the input allocation. */
  improved: boolean;
}

// ─── Helpers ───

function artsTupleToRecord(
  tuple: ArtifactTuple
): Record<Slot, ArtifactData | null> {
  return {
    flower: tuple[0],
    plume: tuple[1],
    sands: tuple[2],
    goblet: tuple[3],
    circlet: tuple[4],
  };
}

/**
 * Identify artifacts that appear in the top-K of 2+ characters.
 * Returns a map: artifactId -> set of characterIds that want it.
 */
export function findContestedArtifacts(
  charIds: string[],
  topKByChar: Record<string, TopKEntry[]>,
  minUsageFraction = 0.1
): Map<string, Set<string>> {
  const artToChars = new Map<string, Set<string>>();

  for (const charId of charIds) {
    const entries = topKByChar[charId] ?? [];
    if (entries.length === 0) continue;

    const artCounts = new Map<string, number>();
    for (const entry of entries) {
      for (const artId of entry.artifactIds) {
        artCounts.set(artId, (artCounts.get(artId) ?? 0) + 1);
      }
    }

    for (const [artId, count] of artCounts) {
      if (count / entries.length >= minUsageFraction) {
        if (!artToChars.has(artId)) artToChars.set(artId, new Set());
        artToChars.get(artId)!.add(charId);
      }
    }
  }

  for (const [artId, chars] of artToChars) {
    if (chars.size < 2) artToChars.delete(artId);
  }

  return artToChars;
}

// ─── Core Algorithm ───

function buildFeasibleAssignment(
  charOrder: string[],
  topKByChar: Record<string, TopKEntry[]>
): Record<string, TopKEntry | null> {
  const usedArtifacts = new Set<string>();
  const assignment: Record<string, TopKEntry | null> = {};

  for (const charId of charOrder) {
    const entries = topKByChar[charId] ?? [];
    let found = false;
    for (const entry of entries) {
      let conflict = false;
      for (const artId of entry.artifactIds) {
        if (usedArtifacts.has(artId)) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        assignment[charId] = entry;
        for (const artId of entry.artifactIds) usedArtifacts.add(artId);
        found = true;
        break;
      }
    }
    if (!found) assignment[charId] = null;
  }

  return assignment;
}

export function runLagrangianAllocation(opts: {
  charIds: string[];
  topKByChar: Record<string, TopKEntry[]>;
  currentBestDamage: number;
  currentBestArtifacts: Record<string, Record<Slot, ArtifactData | null>>;
  evalTeamDamage: (
    artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>
  ) => number;
  deadline?: number;
  config?: Partial<LagrangianConfig>;
  charPriorityOrder: string[];
}): LagrangianResult {
  const config = { ...DEFAULT_LAGRANGIAN_CONFIG, ...opts.config };
  const { charIds, topKByChar, evalTeamDamage, deadline, charPriorityOrder } =
    opts;

  const contested = findContestedArtifacts(charIds, topKByChar);
  if (contested.size === 0) {
    return {
      bestArtifactsByChar: opts.currentBestArtifacts,
      bestFeasibleDamage: opts.currentBestDamage,
      upperBound: opts.currentBestDamage,
      gap: 0,
      iterations: 0,
      improved: false,
    };
  }

  const prices = new Map<string, number>();
  for (const artId of contested.keys()) {
    prices.set(artId, 0);
  }

  let stepSize =
    config.initialStepFraction * Math.max(opts.currentBestDamage, 1);

  let bestFeasibleDamage = opts.currentBestDamage;
  let bestFeasibleArts = opts.currentBestArtifacts;
  let bestUpperBound = Number.POSITIVE_INFINITY;
  let plateauCount = 0;
  let iteration = 0;

  for (; iteration < config.maxIterations; iteration++) {
    if (deadline && performance.now() > deadline) break;

    // Step A: Re-rank top-K entries with prices
    const pricedTopK: Record<
      string,
      { entry: TopKEntry; pricedDamage: number }[]
    > = {};
    let relaxedSum = 0;

    for (const charId of charIds) {
      const entries = topKByChar[charId] ?? [];
      const ranked = entries.map((entry) => {
        let pricePenalty = 0;
        for (const artId of entry.artifactIds) {
          const p = prices.get(artId);
          if (p !== undefined) pricePenalty += p;
        }
        return { entry, pricedDamage: entry.damage - pricePenalty };
      });
      ranked.sort((a, b) => b.pricedDamage - a.pricedDamage);
      pricedTopK[charId] = ranked;

      if (ranked.length > 0) {
        relaxedSum += ranked[0].pricedDamage;
      }
    }

    // Step B: Compute Lagrangian upper bound
    let totalPrices = 0;
    for (const p of prices.values()) totalPrices += p;
    const upperBound = relaxedSum + totalPrices;
    if (upperBound < bestUpperBound) bestUpperBound = upperBound;

    // Step C: Build feasible (conflict-free) assignment
    const pricedEntryByChar: Record<string, TopKEntry[]> = {};
    for (const charId of charIds) {
      pricedEntryByChar[charId] = (pricedTopK[charId] ?? []).map(
        (r) => r.entry
      );
    }
    const feasible = buildFeasibleAssignment(
      charPriorityOrder,
      pricedEntryByChar
    );

    const emptyArts: Record<Slot, ArtifactData | null> = {
      flower: null,
      plume: null,
      sands: null,
      goblet: null,
      circlet: null,
    };
    const feasibleArts: Record<string, Record<Slot, ArtifactData | null>> = {};
    for (const charId of charIds) {
      const entry = feasible[charId];
      feasibleArts[charId] = entry
        ? artsTupleToRecord(entry.artifacts)
        : { ...emptyArts };
    }

    const feasibleDamage = evalTeamDamage(feasibleArts);

    if (
      Number.isFinite(feasibleDamage) &&
      feasibleDamage > bestFeasibleDamage
    ) {
      bestFeasibleDamage = feasibleDamage;
      bestFeasibleArts = feasibleArts;
      plateauCount = 0;
    } else {
      plateauCount++;
      if (plateauCount >= config.plateauLimit) break;
    }

    // Step D: Update prices via subgradient
    const relaxedUsage = new Map<string, number>();
    for (const artId of contested.keys()) {
      relaxedUsage.set(artId, 0);
    }
    for (const charId of charIds) {
      const best = pricedTopK[charId]?.[0];
      if (!best) continue;
      for (const artId of best.entry.artifactIds) {
        if (relaxedUsage.has(artId)) {
          relaxedUsage.set(artId, relaxedUsage.get(artId)! + 1);
        }
      }
    }

    let hasViolation = false;
    for (const [artId, usage] of relaxedUsage) {
      const gradient = usage - 1;
      if (gradient > 0) hasViolation = true;
      const newPrice = Math.max(
        0,
        (prices.get(artId) ?? 0) + stepSize * gradient
      );
      prices.set(artId, newPrice);
    }

    if (!hasViolation) break;

    stepSize *= config.stepDecay;
  }

  const gap =
    bestFeasibleDamage > 0
      ? (bestUpperBound - bestFeasibleDamage) / bestFeasibleDamage
      : Number.POSITIVE_INFINITY;

  return {
    bestArtifactsByChar: bestFeasibleArts,
    bestFeasibleDamage,
    upperBound: bestUpperBound,
    gap,
    iterations: iteration,
    improved: bestFeasibleDamage > opts.currentBestDamage,
  };
}
