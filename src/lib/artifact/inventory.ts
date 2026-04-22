import { artifactHalfSetsById } from "@/data/constants";
import {
  type AccountData,
  type ArtifactData,
  type SubStat,
  allSlots,
} from "@/data/types";
import { getSubstatAvgRoll } from "./scoring/utils";

/**
 * Compute the set of artifact set IDs that match the team roster's
 * configured sets for a given character index.
 */
export function getMatchingSetIds(
  team: {
    artifacts: (
      | {
          type: string;
          setId?: string;
          id1?: string | number;
          id2?: string | number;
        }
      | undefined
    )[];
  },
  charIndex: number
): Set<string> {
  const ids = new Set<string>();
  const artConfig = team.artifacts[charIndex];
  if (!artConfig) return ids;

  if (artConfig.type === "4pc" && artConfig.setId) {
    ids.add(artConfig.setId);
  } else if (artConfig.type === "2pc+2pc") {
    for (const hsId of [String(artConfig.id1), String(artConfig.id2)]) {
      const hs = artifactHalfSetsById[hsId];
      if (hs) {
        for (const setId of hs.setIds) ids.add(setId);
      }
    }
  }
  return ids;
}

/** Collect every artifact from account data (equipped + inventory). */
export function getAllArtifacts(accountData: AccountData): ArtifactData[] {
  const artifacts: ArtifactData[] = [];
  for (const char of accountData.characters) {
    for (const slot of allSlots) {
      const art = char.artifacts[slot];
      if (art) artifacts.push(art);
    }
  }
  for (const art of accountData.extraArtifacts) {
    artifacts.push(art);
  }
  return artifacts;
}

/**
 * Get the value of a stat on an artifact (checks main stat then substats).
 * Returns 0 if the artifact doesn't have that stat.
 */
export function getStatValue(art: ArtifactData, stat: string): number {
  if (art.mainStatKey === stat) {
    // Main stat value isn't stored numerically in ArtifactData,
    // but we can use level as a proxy (higher level = higher main stat).
    // For sorting purposes, having the stat at all is the key signal,
    // so we return a large number to ensure main-stat matches rank high.
    return 10000 + art.level;
  }
  return (art.substats as Record<string, number | undefined>)?.[stat] ?? 0;
}

/**
 * Sort artifacts mimicking in-game sorting:
 * 1. Number of selected stats matched (more matches first)
 * 2. First stat's value (descending)
 * 3. Second stat's value as tiebreaker (descending)
 * 4. Third, fourth stat values (descending)
 */
export function sortByStats(
  items: ArtifactData[],
  sortStats: (string | null)[]
): ArtifactData[] {
  const activeStats = sortStats.filter((s): s is string => s != null);
  if (activeStats.length === 0) return items;

  return [...items].sort((a, b) => {
    // Count how many of the selected stats each artifact has
    const countA = activeStats.filter((s) => getStatValue(a, s) > 0).length;
    const countB = activeStats.filter((s) => getStatValue(b, s) > 0).length;
    if (countB !== countA) return countB - countA;

    // Tiebreak by stat values in priority order
    for (const stat of activeStats) {
      const valA = getStatValue(a, stat);
      const valB = getStatValue(b, stat);
      if (valB !== valA) return valB - valA;
    }
    return 0;
  });
}
export type ArtifactStatus =
  | { type: "same" }
  | { type: "fromChar"; charId: string }
  | { type: "inventory" };

export function buildArtifactOwnerMap(
  accountData: AccountData | null
): Map<string, string> {
  const map = new Map<string, string>();
  if (!accountData) return map;
  for (const char of accountData.characters) {
    for (const art of Object.values(char.artifacts)) {
      if (art) map.set(art.id, char.key);
    }
  }
  return map;
}

export function getArtifactStatus(
  optimizedArt: ArtifactData | undefined,
  equippedArt: ArtifactData | undefined,
  charId: string,
  ownerMap: Map<string, string>
): ArtifactStatus {
  if (!optimizedArt) return { type: "same" };
  if (equippedArt && equippedArt.id === optimizedArt.id) {
    return { type: "same" };
  }
  const currentOwner = ownerMap.get(optimizedArt.id);
  if (currentOwner && currentOwner !== charId) {
    return { type: "fromChar", charId: currentOwner };
  }
  return { type: "inventory" };
}
export function getRollCount(
  statKey: SubStat,
  value: number,
  rarity: number
): number {
  const r = rarity === 4 || rarity === 5 ? rarity : 5;
  const avgRollValue = getSubstatAvgRoll(statKey, r as 4 | 5);
  if (!avgRollValue) return 0;
  return value / avgRollValue;
} /** A single artifact conflict: this char wants an artifact that's frozen on another char. */
export type ArtifactConflict = {
  /** Character trying to freeze */
  charId: string;
  /** The conflicting artifact */
  artifact: ArtifactData;
  /** Character that currently has it frozen */
  frozenCharId: string;
};
/**
 * Find artifacts in `artsByChar` that are already frozen in other teams.
 * Returns the list of conflicts with details about who owns each artifact.
 */
export function detectFrozenArtifactConflicts(
  artsByChar: Record<string, Record<string, ArtifactData | null>>,
  frozenArtifactIds: Set<string>,
  frozenTeams: Record<
    string,
    {
      frozenCharIds: string[];
      artifactsByChar: Record<string, Record<string, ArtifactData | null>>;
    }
  >,
  currentTeamId: string
): ArtifactConflict[] {
  if (frozenArtifactIds.size === 0) return [];
  // Build reverse map: artifact ID → frozen char ID (from other teams)
  const artIdToFrozenChar = new Map<string, string>();
  for (const [tid, entry] of Object.entries(frozenTeams)) {
    if (tid === currentTeamId || !entry?.artifactsByChar) continue;
    for (const cid of entry.frozenCharIds ?? []) {
      const arts = entry.artifactsByChar[cid];
      if (!arts) continue;
      for (const art of Object.values(arts)) {
        if (art) artIdToFrozenChar.set(art.id, cid);
      }
    }
  }
  const conflicts: ArtifactConflict[] = [];
  for (const [charId, arts] of Object.entries(artsByChar)) {
    for (const art of Object.values(arts)) {
      if (!art) continue;
      const frozenCharId = artIdToFrozenChar.get(art.id);
      if (frozenCharId) {
        conflicts.push({ charId, artifact: art, frozenCharId });
      }
    }
  }
  return conflicts;
}
