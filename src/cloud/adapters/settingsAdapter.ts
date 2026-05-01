import { encodePathSegment } from "@/cloud/payload";
import type { CloudExportPartition } from "@/cloud/types";
import type { AccountProfileId } from "@/lib/account-data/types";

export type ArtifactScoreCloudConfig = Record<string, unknown> & {
  global: Record<string, number>;
};

export type SettingsCloudSnapshot = {
  artifactScore: ArtifactScoreCloudConfig;
  triageByProfileId: Record<AccountProfileId, unknown>;
  resourcesByProfileId: Record<AccountProfileId, unknown>;
};

export type ArtifactScoreSettingsPayload = {
  config: ArtifactScoreCloudConfig;
};

export type AccountTriagePayload = {
  accountProfileId: AccountProfileId;
  settings: unknown;
};

export type AccountResourcesPayload = {
  accountProfileId: AccountProfileId;
  settings: unknown;
};

export type SettingsRestorePatch = SettingsCloudSnapshot;

export function settingsToCloud(
  snapshot: SettingsCloudSnapshot
): CloudExportPartition[] {
  return [
    {
      namespace: "settings.artifactScore",
      partitionKey: "default",
      schemaVersion: 1,
      conflictPolicy: "latest-writer-wins",
      payload: {
        config: snapshot.artifactScore,
      } satisfies ArtifactScoreSettingsPayload,
    },
    ...Object.entries(snapshot.triageByProfileId).map(
      ([profileId, settings]) =>
        ({
          namespace: "account.triage",
          partitionKey: encodePathSegment(profileId),
          schemaVersion: 1,
          conflictPolicy: "explicit-choice",
          payload: {
            accountProfileId: Number(profileId),
            settings,
          } satisfies AccountTriagePayload,
        }) satisfies CloudExportPartition
    ),
    ...Object.entries(snapshot.resourcesByProfileId).map(
      ([profileId, settings]) =>
        ({
          namespace: "account.resources",
          partitionKey: encodePathSegment(profileId),
          schemaVersion: 1,
          conflictPolicy: "explicit-choice",
          payload: {
            accountProfileId: Number(profileId),
            settings,
          } satisfies AccountResourcesPayload,
        }) satisfies CloudExportPartition
    ),
  ];
}

export function settingsFromCloud(
  partitions: CloudExportPartition[]
): SettingsRestorePatch {
  const artifactScore = partitions.find(
    (partition) => partition.namespace === "settings.artifactScore"
  )?.payload as ArtifactScoreSettingsPayload | undefined;
  const triageByProfileId: Record<AccountProfileId, unknown> = {};
  const resourcesByProfileId: Record<AccountProfileId, unknown> = {};
  for (const partition of partitions) {
    if (partition.namespace === "account.triage") {
      const payload = partition.payload as AccountTriagePayload;
      triageByProfileId[payload.accountProfileId] = payload.settings;
    }
    if (partition.namespace === "account.resources") {
      const payload = partition.payload as AccountResourcesPayload;
      resourcesByProfileId[payload.accountProfileId] = payload.settings;
    }
  }
  return {
    artifactScore: artifactScore?.config ?? { global: {} },
    triageByProfileId,
    resourcesByProfileId,
  };
}
