import { allSlots } from "@/data/enums";
import type { ArtifactData, Build } from "@/data/types";
import type {
  DemandSource,
  QualityTier,
  TriageDecision,
  TriageDemandGroup,
  TriageKeepReason,
  TriageSetStatistics,
  TriageStatistics,
  TriageSupplyEntry,
} from "./types";

function emptySupply(): Record<QualityTier, number> {
  return { prime: 0, solid: 0, filler: 0, fodder: 0 };
}

/** Primary keep reasons are exclusive; a matching flex tag alone is not a flex keep. */
export function countKeepReasons(
  decisions: TriageDecision[]
): Record<TriageKeepReason, number> {
  const counts = { prime: 0, solid: 0, filler: 0, flex: 0, other: 0 };
  const counted = new Set<string>();
  for (const decision of decisions) {
    if (counted.has(decision.artifact.id)) continue;
    const protectedArtifact =
      decision.specialRules.includes("levelProtected") ||
      decision.specialRules.includes("equippedProtected");
    if (decision.label !== "lock" && !protectedArtifact) continue;
    counted.add(decision.artifact.id);
    const rule =
      decision.label === "lock" ? decision.decidingResult?.ruleId : null;
    if (rule === "primeTierKeep") counts.prime++;
    else if (rule === "solidTierKeep") counts.solid++;
    else if (rule === "fillerShortfallKeep") counts.filler++;
    else if (rule === "offPiecePattern") counts.flex++;
    else counts.other++;
  }
  return counts;
}

export function buildTriageStatistics({
  activeGroups,
  buildGroups,
  demandGroups,
  artifacts,
  supply,
  decisions,
}: {
  activeGroups: { characterId: string; builds: Build[] }[];
  buildGroups: { characterId: string; builds: Build[] }[];
  demandGroups: Map<string, TriageDemandGroup>;
  artifacts: ArtifactData[];
  supply: TriageSupplyEntry[];
  decisions: TriageDecision[];
}): TriageStatistics {
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
        gap: 0,
        supplyByTier: emptySupply(),
        slots: Object.fromEntries(
          allSlots.map((slot) => [
            slot,
            { demand: 0, gap: 0, supplyByTier: emptySupply() },
          ])
        ) as TriageSetStatistics["slots"],
      };
      sets.set(key, row);
    }
    return row;
  }
  const supplyByGroup = new Map<string, Record<QualityTier, number>>();
  const assigned = new Set<string>();
  for (const entry of supply) {
    if (assigned.has(entry.artifact.id))
      throw new Error("Triage supply assigned twice");
    if (!demandGroups.has(entry.embryoKey))
      throw new Error("Triage supply has no demand group");
    assigned.add(entry.artifact.id);
    if (!supplyByGroup.has(entry.embryoKey))
      supplyByGroup.set(entry.embryoKey, emptySupply());
    supplyByGroup.get(entry.embryoKey)![entry.tier]++;
  }
  for (const [key, group] of demandGroups) {
    const row = getSet(group.source);
    const tiers = supplyByGroup.get(key) ?? emptySupply();
    // Surplus in another main-stat, substat, or slot group cannot cover this gap.
    const gap = Math.max(0, group.demand - tiers.prime - tiers.solid);
    row.demand += group.demand;
    row.gap += gap;
    const slot = row.slots[group.slot];
    slot.demand += group.demand;
    slot.gap += gap;
    for (const tier of ["prime", "solid", "filler", "fodder"] as const) {
      row.supplyByTier[tier] += tiers[tier];
      slot.supplyByTier[tier] += tiers[tier];
    }
  }
  const uniqueArtifacts = new Map(
    artifacts.filter((a) => a.rarity === 5).map((a) => [a.id, a])
  );
  for (const artifact of uniqueArtifacts.values()) {
    if (assigned.has(artifact.id)) continue;
    // No matching build: fodder in its actual set, even when a special rule
    // or protection keeps it. These keeps do not fill build demand.
    const row = getSet({ type: "4pc", setKey: artifact.setKey });
    row.supplyByTier.fodder++;
    row.slots[artifact.slotKey].supplyByTier.fodder++;
  }
  const activeCounts = new Map(
    activeGroups.map((group) => [group.characterId, group.builds.length])
  );
  const characters = buildGroups
    .filter((group) => group.builds.length > 0)
    .map((group) => ({
      characterId: group.characterId,
      totalBuildCount: group.builds.length,
      activeBuildCount: activeCounts.get(group.characterId) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.activeBuildCount - a.activeBuildCount ||
        b.totalBuildCount - a.totalBuildCount ||
        a.characterId.localeCompare(b.characterId)
    );
  const rows = [...sets.values()].sort(
    (a, b) => b.gap - a.gap || b.demand - a.demand || a.key.localeCompare(b.key)
  );
  return {
    sets: rows,
    characters,
    totalDemand: rows.reduce((sum, row) => sum + row.demand, 0),
    totalGap: rows.reduce((sum, row) => sum + row.gap, 0),
    totalSupply: uniqueArtifacts.size,
    totalBuilds: characters.reduce((sum, row) => sum + row.totalBuildCount, 0),
    totalActiveBuilds: characters.reduce(
      (sum, row) => sum + row.activeBuildCount,
      0
    ),
    keepReasons: countKeepReasons(decisions),
  };
}
