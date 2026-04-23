import { statPools } from "@/data/constants";
import type { MainStat, Slot } from "@/data/enums";
import { artifactHalfSetsById } from "@/data/gameResources";
import type { Build } from "@/data/types";

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
