import type { SubStat } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { solveArtifact } from "./solver";

/**
 * Deterministic physical-artifact fingerprint. It ignores mutable local
 * metadata such as id, lock, and marks, and normalizes solver-rounded substats
 * so imports agree on duplicate artifact identity.
 *
 * Substat order is intentionally part of exact identity. The app preserves
 * import order and displays artifacts in that order, so reordered substats are
 * only diagnostic-equivalent rather than the same stored artifact.
 */
export function artifactFingerprint(art: ArtifactData): string {
  return buildArtifactFingerprint(art, "ordered");
}

/**
 * Order-insensitive artifact stat fingerprint for diagnostics. This can flag
 * suspicious duplicates with the same physical stats in different substat
 * order, but it must not be used to shrink optimizer or recommendation pools.
 */
export function artifactStatFingerprint(art: ArtifactData): string {
  return buildArtifactFingerprint(art, "sorted");
}

export interface ArtifactEquivalenceGroup {
  fingerprint: string;
  artifacts: ArtifactData[];
}

export function findEquivalentArtifactGroups(
  artifacts: ArtifactData[]
): ArtifactEquivalenceGroup[] {
  const groups = new Map<string, ArtifactData[]>();
  for (const artifact of artifacts) {
    const fingerprint = artifactStatFingerprint(artifact);
    const group = groups.get(fingerprint);
    if (group) {
      group.push(artifact);
    } else {
      groups.set(fingerprint, [artifact]);
    }
  }

  return Array.from(groups.entries())
    .filter(([, groupedArtifacts]) => groupedArtifacts.length > 1)
    .map(([fingerprint, groupedArtifacts]) => ({
      fingerprint,
      artifacts: groupedArtifacts,
    }));
}

function buildArtifactFingerprint(
  art: ArtifactData,
  substatOrder: "ordered" | "sorted"
): string {
  const normalized = normalizeArtifactIdentity(art);
  const substatKeys = Object.keys(normalized.substats) as SubStat[];
  if (substatOrder === "sorted") {
    substatKeys.sort();
  }
  const substatsStr = substatKeys
    .map((k) => `${k}:${normalized.substats[k]}`)
    .join(",");
  return [
    normalized.setKey,
    normalized.slotKey,
    normalized.level,
    normalized.rarity,
    normalized.mainStatKey,
    substatsStr,
    normalized.totalRolls ?? "",
    normalized.elixirCrafted ? "1" : "0",
  ].join("|");
}

function normalizeArtifactIdentity(art: ArtifactData): {
  setKey: string;
  slotKey: ArtifactData["slotKey"];
  level: number;
  rarity: number;
  mainStatKey: ArtifactData["mainStatKey"];
  substats: Partial<Record<SubStat, number>>;
  totalRolls?: number;
  elixirCrafted: boolean;
} {
  const rarity = art.rarity;
  const solved =
    rarity === 4 || rarity === 5
      ? solveArtifact({
          rarity,
          level: art.level,
          substats: art.substats,
          totalRolls: art.totalRolls,
        })
      : null;

  return {
    setKey: art.setKey,
    slotKey: art.slotKey,
    level: art.level,
    rarity: art.rarity,
    mainStatKey: art.mainStatKey,
    substats: normalizeSubstatsPreservingOrder(art.substats, solved),
    totalRolls: art.totalRolls,
    elixirCrafted: art.elixirCrafted ?? false,
  };
}

function normalizeSubstatsPreservingOrder(
  substats: Partial<Record<SubStat, number>>,
  solved: Partial<Record<SubStat, number>> | null
): Partial<Record<SubStat, number>> {
  if (!solved) {
    return substats;
  }

  const normalized: Partial<Record<SubStat, number>> = {};
  for (const key of Object.keys(substats) as SubStat[]) {
    const solvedValue = solved[key];
    normalized[key] = solvedValue ?? substats[key];
  }

  for (const key of Object.keys(solved) as SubStat[]) {
    if (!(key in normalized)) {
      normalized[key] = solved[key];
    }
  }

  return normalized;
}
