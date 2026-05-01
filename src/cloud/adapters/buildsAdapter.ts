import type { CloudExportPartition } from "@/cloud/types";
import type { ComputeOptions } from "@/data/types";
import type { BuildDelta } from "@/lib/artifact-builds/buildDeltas";

export type BuildsCloudSnapshot = {
  activePresetId: string | null;
  deltas: BuildDelta[];
  hiddenCharacters: Record<string, boolean>;
  characterWeapons: Record<string, string[]>;
  computeOptions: ComputeOptions;
  author: string;
  description: string;
};

export type CharacterBuildMetadata = {
  hidden?: boolean;
  weaponIds?: string[];
};

export type BuildsCloudPayload = {
  activePresetId: string | null;
  activePresetRevision?: string;
  deltas: BuildDelta[];
  characterMetadata?: Record<string, CharacterBuildMetadata>;
  computeOptions?: ComputeOptions;
  author?: string;
  description?: string;
};

export type BuildsRestorePatch = BuildsCloudSnapshot;

export function buildsToCloud(
  snapshot: BuildsCloudSnapshot
): CloudExportPartition<BuildsCloudPayload>[] {
  const characterMetadata = buildCharacterMetadata(snapshot);
  return [
    {
      namespace: "builds",
      partitionKey: "default",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      payload: {
        activePresetId: snapshot.activePresetId,
        deltas: snapshot.deltas,
        ...(Object.keys(characterMetadata).length ? { characterMetadata } : {}),
        computeOptions: snapshot.computeOptions,
        author: snapshot.author,
        description: snapshot.description,
      },
    },
  ];
}

export function buildsFromCloud(
  partitions: CloudExportPartition[]
): BuildsRestorePatch {
  const payload = partitions.find(
    (partition) => partition.namespace === "builds"
  )?.payload as BuildsCloudPayload | undefined;
  const characterMetadata = payload?.characterMetadata ?? {};
  return {
    activePresetId: payload?.activePresetId ?? null,
    deltas: payload?.deltas ?? [],
    hiddenCharacters: Object.fromEntries(
      Object.entries(characterMetadata).flatMap(([charId, metadata]) =>
        metadata.hidden ? [[charId, true]] : []
      )
    ),
    characterWeapons: Object.fromEntries(
      Object.entries(characterMetadata).flatMap(([charId, metadata]) =>
        metadata.weaponIds?.length ? [[charId, metadata.weaponIds]] : []
      )
    ),
    computeOptions: payload?.computeOptions ?? {},
    author: payload?.author ?? "",
    description: payload?.description ?? "",
  };
}

function buildCharacterMetadata(snapshot: BuildsCloudSnapshot) {
  const characterIds = new Set([
    ...Object.keys(snapshot.hiddenCharacters),
    ...Object.keys(snapshot.characterWeapons),
  ]);
  const metadata: Record<string, CharacterBuildMetadata> = {};
  for (const characterId of characterIds) {
    const entry: CharacterBuildMetadata = {};
    if (snapshot.hiddenCharacters[characterId]) entry.hidden = true;
    const weaponIds = snapshot.characterWeapons[characterId];
    if (weaponIds?.length) entry.weaponIds = weaponIds;
    if (Object.keys(entry).length) metadata[characterId] = entry;
  }
  return metadata;
}
