import type { AccountData, ArtifactData, SubStat } from "@/data/types";
import { solveArtifact } from "./artifactSolver";

/**
 * Deterministic fingerprint for artifact identity (setKey, slot, level, mainStat, substats, etc.).
 * Used to dedupe identical artifacts when merging UID imports with existing inventory.
 */
export function artifactFingerprint(art: ArtifactData): string {
  const normalized = normalizeArtifactIdentity(art);
  const substatsStr = Object.keys(normalized.substats)
    .sort()
    .map((k) => `${k}:${normalized.substats[k as SubStat]}`)
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
    substats: solved ?? art.substats,
    totalRolls: art.totalRolls,
    elixirCrafted: art.elixirCrafted ?? false,
  };
}

/**
 * Collect all artifacts from an account (equipped on characters + extraArtifacts).
 */
function collectArtifacts(data: AccountData): ArtifactData[] {
  const out: ArtifactData[] = [...data.extraArtifacts];
  for (const char of data.characters) {
    for (const art of Object.values(char.artifacts)) {
      if (art) out.push(art);
    }
  }
  return out;
}

/**
 * Merge inventory for a UID (Enka) import with existing account data.
 * Returns merged extraArtifacts: existing inventory plus any "seen-before" artifacts
 * (previously equipped or in inventory) that are not in the new import's equipped set,
 * without duplicating identical artifacts (by fingerprint).
 * Caller is responsible for merging characters and reassigning ids.
 */
export function mergeEnkaImportWithInventory(
  previous: AccountData,
  newData: AccountData
): ArtifactData[] {
  const equippedFingerprints = new Set<string>();
  for (const art of collectArtifacts(newData)) {
    equippedFingerprints.add(artifactFingerprint(art));
  }

  const seenBefore = collectArtifacts(previous);
  const inventoryFingerprints = new Set(
    previous.extraArtifacts.map(artifactFingerprint)
  );
  const toAdd: ArtifactData[] = [];

  for (const art of seenBefore) {
    const fp = artifactFingerprint(art);
    if (equippedFingerprints.has(fp)) continue;
    if (inventoryFingerprints.has(fp)) continue;
    inventoryFingerprints.add(fp);
    toAdd.push(art);
  }

  return [...previous.extraArtifacts, ...toAdd];
}
