import { allSlots } from "@/data/enums";
import type { ArtifactData, Build } from "@/data/types";
import { getEligibleSetsForHalfSet } from "./demandExtractor";
import type {
  DemandSource,
  TriageDemandGroup,
  TriageSetStatistics,
  TriageStatistics,
} from "./types";

export function buildTriageStatistics(
  activeGroups: { characterId: string; builds: Build[] }[],
  demandGroups: Map<string, TriageDemandGroup>,
  artifacts: ArtifactData[]
): TriageStatistics {
  const sets = new Map<string, TriageSetStatistics>();
  function getSet(source: DemandSource): TriageSetStatistics {
    const key =
      source.type === "4pc"
        ? `4pc:${source.setKey}`
        : source.type === "2pc"
          ? `2pc:${source.halfSetId}`
          : "flex";
    let row = sets.get(key);
    if (!row) {
      row = {
        key,
        source,
        demand: 0,
        supply: 0,
        slots: Object.fromEntries(
          allSlots.map((slot) => [slot, { demand: 0, supply: 0 }])
        ) as TriageSetStatistics["slots"],
      };
      sets.set(key, row);
    }
    return row;
  }
  for (const group of demandGroups.values()) {
    const row = getSet(group.source);
    row.demand += group.demand;
    row.slots[group.slot].demand += group.demand;
  }
  const inventory = new Map<string, ArtifactData[]>();
  const uniqueArtifacts = new Map(
    artifacts.filter((a) => a.rarity === 5).map((a) => [a.id, a])
  );
  for (const artifact of uniqueArtifacts.values()) {
    if (!inventory.has(artifact.setKey)) inventory.set(artifact.setKey, []);
    inventory.get(artifact.setKey)!.push(artifact);
    getSet({ type: "4pc", setKey: artifact.setKey });
  }
  for (const row of sets.values()) {
    const eligibleSets =
      row.source.type === "4pc"
        ? [row.source.setKey]
        : row.source.type === "2pc"
          ? getEligibleSetsForHalfSet(row.source.halfSetId)
          : [];
    for (const setKey of new Set(eligibleSets)) {
      for (const artifact of inventory.get(setKey) ?? []) {
        row.supply++;
        row.slots[artifact.slotKey].supply++;
      }
    }
  }
  const characters = activeGroups
    .map((group) => ({
      characterId: group.characterId,
      buildCount: group.builds.length,
    }))
    .sort(
      (a, b) =>
        b.buildCount - a.buildCount ||
        a.characterId.localeCompare(b.characterId)
    );
  return {
    sets: [...sets.values()].sort(
      (a, b) => b.demand - a.demand || a.key.localeCompare(b.key)
    ),
    characters,
    totalDemand: [...sets.values()].reduce((sum, row) => sum + row.demand, 0),
    // Inventory overlaps between 4pc sets and shared 2pc pools; count it once here.
    totalSupply: uniqueArtifacts.size,
    totalBuilds: characters.reduce((sum, row) => sum + row.buildCount, 0),
  };
}
