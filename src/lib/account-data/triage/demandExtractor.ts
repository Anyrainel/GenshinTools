import {
  artifactHalfSetsById,
  statPoolWithWeights,
  statPools,
} from "@/data/constants";
import type { Build, MainStat, Slot } from "@/data/types";

/**
 * Get accepted main stats for a slot from a build's main stat weights.
 * Only includes stats with weight >= threshold.
 */
export function getAcceptedMainStats(
  build: Build,
  slot: Slot,
  threshold = 0
): MainStat[] {
  if (slot === "flower") return ["hp"];
  if (slot === "plume") return ["atk"];

  const weightsKey = `${slot}Weights` as
    | "sandsWeights"
    | "gobletWeights"
    | "circletWeights";
  const weights = build[weightsKey];
  if (!weights || weights.length === 0) {
    // Fallback: accept all possible main stats for this slot
    return [...statPools[slot]] as MainStat[];
  }
  return weights.filter((w) => w.weight >= threshold).map((w) => w.stat);
}

/**
 * Get the eligible set IDs for a 2pc half-set demand.
 */
export function getEligibleSetsForHalfSet(halfSetId: string): string[] {
  return artifactHalfSetsById[halfSetId]?.setIds ?? [];
}

/**
 * Get the main stat drop rate for a given slot + mainStat combination.
 * Returns a percentage (e.g., 26.66 for ATK% sands).
 */
export function getMainStatDropRate(slot: Slot, mainStat: MainStat): number {
  const weights = statPoolWithWeights[slot as keyof typeof statPoolWithWeights];
  if (!weights) return 100; // flower/plume have fixed main stats
  return (weights as Record<string, number>)[mainStat] ?? 0;
}
