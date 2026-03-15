import { statPoolWithWeights, statPools } from "@/data/constants";
import type { MainStat, Slot, SubStat } from "@/data/types";
import { mainStatSlots } from "@/data/types";
import type { DemandProfile, RareEmbryoEntry } from "./types";

/** Internal threshold: combinedRarity below this percentage is considered rare. */
const RARE_THRESHOLD = 10;

/**
 * Probability of seeing all required substats in 3-4 random draws from the substat pool,
 * excluding the main stat. This is a simplified estimate.
 */
function substatHitProbability(
  mainStat: MainStat,
  requiredSubstats: SubStat[]
): number {
  // Substat pool excludes the main stat (if it's a substat type)
  const pool = statPools.substat.filter((s) => s !== mainStat);
  const poolSize = pool.length;

  if (requiredSubstats.length === 1) {
    // P(at least 1 hit in 3 draws) = 1 - P(miss all 3)
    // P(miss one) = (poolSize - 1) / poolSize
    const pMissOne = (poolSize - 1) / poolSize;
    return (1 - pMissOne ** 3) * 100;
  }
  if (requiredSubstats.length === 2) {
    // P(both present in 4 draws without replacement, using hypergeometric)
    // Simplified: P = C(2,2)*C(n-2,2) / C(n,4) * some arrangement factor
    // More practical: P(A in 4) * P(B in remaining 3 given A hit)
    const n = poolSize;
    const pFirstIn4 =
      1 -
      ((n - 1) * (n - 2) * (n - 3) * (n - 4)) /
        (n * (n - 1) * (n - 2) * (n - 3));
    // Given first hit, P(second in remaining 3 from pool of n-1)
    const pSecondIn3 =
      1 - ((n - 2) * (n - 3) * (n - 4)) / ((n - 1) * (n - 2) * (n - 3));
    return pFirstIn4 * pSecondIn3 * 100;
  }
  return 100; // No requirements = always matches
}

/**
 * Auto-discover rare embryo entries from demand profiles.
 * A rare embryo = (slot, mainStat, requiredSubstats) where:
 * 1. At least one build needs this slot + mainStat
 * 2. The build has CR and/or CD as core stats
 * 3. Combined rarity (main stat drop rate × substat hit rate) is below threshold
 */
export function buildRareEmbryoRegistry(
  demands: DemandProfile[]
): RareEmbryoEntry[] {
  // Group demands by (slot, mainStat) → unique characters + core stats
  const groups = new Map<
    string,
    {
      slot: Slot;
      mainStat: MainStat;
      characters: Set<string>;
      coreStats: Set<SubStat>;
    }
  >();

  for (const d of demands) {
    if (!mainStatSlots.includes(d.slot as "sands" | "goblet" | "circlet"))
      continue;

    for (const ms of d.acceptedMainStats) {
      const key = `${d.slot}:${ms}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          slot: d.slot,
          mainStat: ms,
          characters: new Set(),
          coreStats: new Set(),
        };
        groups.set(key, group);
      }
      group.characters.add(d.characterId);
      for (const s of d.coreStats) group.coreStats.add(s);
    }
  }

  const entries: RareEmbryoEntry[] = [];

  for (const { slot, mainStat, characters, coreStats } of groups.values()) {
    // Only create entries for crit-related requirements
    const hasCR = coreStats.has("cr");
    const hasCD = coreStats.has("cd");
    if (!hasCR && !hasCD) continue;

    const requiredSubstats: SubStat[] = [];
    if (hasCR) requiredSubstats.push("cr");
    if (hasCD) requiredSubstats.push("cd");

    const mainStatDrop = getMainStatDropRate(slot, mainStat);
    const substatProb = substatHitProbability(mainStat, requiredSubstats);
    const combinedRarity = (mainStatDrop * substatProb) / 100;

    if (combinedRarity <= RARE_THRESHOLD) {
      entries.push({
        slot,
        mainStat,
        requiredSubstats,
        demandCharacters: Array.from(characters),
        combinedRarity: Math.round(combinedRarity * 100) / 100,
      });
    }
  }

  return entries.sort((a, b) => a.combinedRarity - b.combinedRarity);
}

function getMainStatDropRate(slot: Slot, mainStat: MainStat): number {
  const weights = statPoolWithWeights[slot as keyof typeof statPoolWithWeights];
  if (!weights) return 100;
  return (weights as Record<string, number>)[mainStat] ?? 0;
}
