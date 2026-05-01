import { canonicalJson, encodePathSegment } from "@/cloud/payload";
import type { ArtifactData, WeaponData } from "@/data/types";

export type CloudItemIdentity = {
  fingerprint: string;
  occurrence: number;
  sourceInstanceId?: string;
};

export type IdentifiedItem<TItem> = {
  localId: string;
  cloudId: string;
  identity: CloudItemIdentity;
  item: TItem;
};

export function assignArtifactIdentities(
  artifacts: ArtifactData[]
): IdentifiedItem<ArtifactData>[] {
  return assignIdentities(artifacts, artifactFingerprint, "art");
}

export function assignWeaponIdentities(
  weapons: WeaponData[]
): IdentifiedItem<WeaponData>[] {
  return assignIdentities(weapons, weaponFingerprint, "wpn");
}

function assignIdentities<TItem extends { id: string }>(
  items: TItem[],
  getFingerprint: (item: TItem) => string,
  prefix: string
): IdentifiedItem<TItem>[] {
  const byFingerprint = new Map<string, TItem[]>();
  for (const item of items) {
    const fingerprint = getFingerprint(item);
    const group = byFingerprint.get(fingerprint);
    if (group) group.push(item);
    else byFingerprint.set(fingerprint, [item]);
  }

  const output = new Map<string, IdentifiedItem<TItem>>();
  for (const [fingerprint, group] of byFingerprint) {
    const sorted = [...group].sort((first, second) =>
      first.id.localeCompare(second.id)
    );
    sorted.forEach((item, occurrence) => {
      const identity = { fingerprint, occurrence };
      output.set(item.id, {
        localId: item.id,
        cloudId: `${prefix}_${shortHash(fingerprint)}_${occurrence}`,
        identity,
        item,
      });
    });
  }

  return items.map((item) => {
    const identified = output.get(item.id);
    if (!identified) {
      throw new Error(`Missing cloud identity for item ${item.id}`);
    }
    return identified;
  });
}

export function artifactFingerprint(artifact: ArtifactData): string {
  return canonicalJson({
    setKey: artifact.setKey,
    slotKey: artifact.slotKey,
    rarity: artifact.rarity,
    level: artifact.level,
    mainStatKey: artifact.mainStatKey,
    substats: artifact.substats,
    totalRolls: artifact.totalRolls,
    elixirCrafted: artifact.elixirCrafted,
    initialValues: artifact.initialValues,
    unactivatedSubstats: artifact.unactivatedSubstats,
  });
}

export function weaponFingerprint(weapon: WeaponData): string {
  return canonicalJson({
    key: weapon.key,
    level: weapon.level,
    refinement: weapon.refinement,
  });
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return encodePathSegment((hash >>> 0).toString(36));
}
