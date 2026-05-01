import { encodePathSegment } from "@/cloud/payload";
import type { CloudExportPartition } from "@/cloud/types";
import type { Slot } from "@/data/enums";
import type { AccountProfileId } from "@/lib/account-data/types";

export type ArtifactReuseMode = "none" | "sameChar" | "forceReuse";

export type FrozenArtifactIdsByChar = Record<
  string,
  Partial<Record<Slot, string>>
>;

export type FrozenTeamLoadout = {
  frozenCharIds: string[];
  artifactIdsByChar: FrozenArtifactIdsByChar;
};

export type FrozenProfileStateSnapshot = {
  frozenTeamLoadouts: Record<string, FrozenTeamLoadout>;
  reuseMode: ArtifactReuseMode;
  frozenArtifactIds: string[];
};

export type FreezeCloudSnapshot = {
  freezesByProfileId: Record<AccountProfileId, FrozenProfileStateSnapshot>;
};

export type FrozenLoadoutCloudEntry = {
  teamId?: string;
  charId: string;
  artifactIds: Partial<Record<Slot, string>>;
  updatedAt?: number;
};

export type FreezeCloudPayload = {
  accountProfileId: AccountProfileId;
  reuseMode: ArtifactReuseMode;
  standaloneArtifactIds: string[];
  loadouts: FrozenLoadoutCloudEntry[];
};

export type FreezeRestorePatch = FreezeCloudSnapshot;

export function freezeToCloud(
  snapshot: FreezeCloudSnapshot
): CloudExportPartition<FreezeCloudPayload>[] {
  return Object.entries(snapshot.freezesByProfileId).map(
    ([profileId, profile]) => ({
      namespace: "account.freeze",
      partitionKey: encodePathSegment(profileId),
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      payload: {
        accountProfileId: Number(profileId),
        reuseMode: profile.reuseMode,
        standaloneArtifactIds: profile.frozenArtifactIds,
        loadouts: flattenLoadouts(profile.frozenTeamLoadouts),
      },
    })
  );
}

export function freezeFromCloud(
  partitions: CloudExportPartition[]
): FreezeRestorePatch {
  const freezesByProfileId: Record<
    AccountProfileId,
    FrozenProfileStateSnapshot
  > = {};
  for (const partition of partitions) {
    if (partition.namespace !== "account.freeze") continue;
    const payload = partition.payload as FreezeCloudPayload;
    freezesByProfileId[payload.accountProfileId] = {
      reuseMode: payload.reuseMode,
      frozenArtifactIds: payload.standaloneArtifactIds,
      frozenTeamLoadouts: unflattenLoadouts(payload.loadouts),
    };
  }
  return { freezesByProfileId };
}

function flattenLoadouts(
  frozenTeamLoadouts: Record<string, FrozenTeamLoadout>
): FrozenLoadoutCloudEntry[] {
  return Object.entries(frozenTeamLoadouts).flatMap(([teamId, loadout]) =>
    loadout.frozenCharIds.map((charId) => ({
      teamId,
      charId,
      artifactIds: loadout.artifactIdsByChar[charId] ?? {},
    }))
  );
}

function unflattenLoadouts(
  loadouts: FrozenLoadoutCloudEntry[]
): Record<string, FrozenTeamLoadout> {
  const byTeamId: Record<string, FrozenTeamLoadout> = {};
  for (const entry of loadouts) {
    if (!entry.teamId) continue;
    const loadout = byTeamId[entry.teamId] ?? {
      frozenCharIds: [],
      artifactIdsByChar: {},
    };
    if (!loadout.frozenCharIds.includes(entry.charId)) {
      loadout.frozenCharIds.push(entry.charId);
    }
    loadout.artifactIdsByChar[entry.charId] = entry.artifactIds;
    byTeamId[entry.teamId] = loadout;
  }
  return byTeamId;
}
