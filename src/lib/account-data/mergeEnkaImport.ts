import type { AccountData, ArtifactData } from "@/data/types";

/**
 * Deterministic fingerprint for artifact identity (setKey, slot, level, mainStat, substats, etc.).
 * Used to dedupe identical artifacts when merging UID imports with existing inventory.
 */
export function artifactFingerprint(art: ArtifactData): string {
  const substatsStr = Object.keys(art.substats)
    .sort()
    .map((k) => `${k}:${(art.substats as Record<string, number>)[k]}`)
    .join(",");
  const unactivatedStr = art.unactivatedSubstats
    ? Object.keys(art.unactivatedSubstats)
        .sort()
        .map(
          (k) =>
            `u_${k}:${(art.unactivatedSubstats as Record<string, number>)[k]}`
        )
        .join(",")
    : "";
  const initialStr = art.initialValues
    ? Object.keys(art.initialValues)
        .sort()
        .map(
          (k) => `i_${k}:${(art.initialValues as Record<string, number>)[k]}`
        )
        .join(",")
    : "";
  return [
    art.setKey,
    art.slotKey,
    art.level,
    art.rarity,
    art.mainStatKey,
    substatsStr,
    art.totalRolls ?? "",
    art.astralMark ?? false,
    art.elixirCrafted ?? false,
    unactivatedStr,
    initialStr,
  ].join("|");
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
