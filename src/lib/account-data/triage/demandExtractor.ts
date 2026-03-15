import {
  artifactHalfSetsById,
  statPoolWithWeights,
  statPools,
} from "@/data/constants";
import type { Build, MainStat, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import type { DemandProfile, TriageSettings } from "./types";

/**
 * Classify a build's substats into core/valuable tiers based on threshold settings.
 */
function classifyStats(
  build: Build,
  settings: TriageSettings
): { coreStats: SubStat[]; valuableStats: SubStat[] } {
  const core: SubStat[] = [];
  const valuable: SubStat[] = [];
  for (const { stat, weight } of build.substats) {
    if (weight >= settings.coreThreshold) core.push(stat);
    else if (weight >= settings.valuableThreshold) valuable.push(stat);
  }
  return { coreStats: core, valuableStats: valuable };
}

/**
 * Get accepted main stats for a slot from a build's main stat weights.
 * Only includes stats with weight > 0.
 */
function getAcceptedMainStats(build: Build, slot: Slot): MainStat[] {
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
  return weights.filter((w) => w.weight > 0).map((w) => w.stat);
}

/**
 * Extract all demand profiles from a list of resolved builds.
 * Each build generates demands based on its composition (4pc or 2pc+2pc).
 */
export function extractDemands(
  builds: { characterId: string; builds: Build[] }[],
  settings: TriageSettings
): DemandProfile[] {
  const demands: DemandProfile[] = [];

  for (const { characterId, builds: charBuilds } of builds) {
    for (const build of charBuilds) {
      if (!build.visible) continue;

      const { coreStats, valuableStats } = classifyStats(build, settings);

      if (build.composition === "4pc" && build.artifactSet) {
        // 4pc: one demand per slot for the set
        for (const slot of allSlots) {
          demands.push({
            buildId: build.id,
            characterId,
            demandSource: { type: "4pc", setKey: build.artifactSet },
            slot,
            acceptedMainStats: getAcceptedMainStats(build, slot),
            coreStats,
            valuableStats,
          });
        }
      } else if (build.composition === "2pc+2pc") {
        const hs1 = build.halfSet1 != null ? String(build.halfSet1) : null;
        const hs2 = build.halfSet2 != null ? String(build.halfSet2) : null;

        // 2pc demands: every slot can serve either half-set
        for (const slot of allSlots) {
          const accepted = getAcceptedMainStats(build, slot);
          if (hs1) {
            demands.push({
              buildId: build.id,
              characterId,
              demandSource: { type: "2pc", halfSetId: hs1 },
              slot,
              acceptedMainStats: accepted,
              coreStats,
              valuableStats,
            });
          }
          if (hs2 && hs2 !== hs1) {
            demands.push({
              buildId: build.id,
              characterId,
              demandSource: { type: "2pc", halfSetId: hs2 },
              slot,
              acceptedMainStats: accepted,
              coreStats,
              valuableStats,
            });
          }
        }
      }
    }
  }

  return demands;
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
