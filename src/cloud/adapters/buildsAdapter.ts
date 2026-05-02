import type { CloudExportPartition } from "@/cloud/types";
import type { ComputeOptions } from "@/data/types";
import type { BuildDelta } from "@/lib/artifact-builds/buildDeltas";
import { DEFAULT_COMPUTE_OPTIONS } from "@/lib/artifact-builds/computeFilters";
import { DEFAULT_GLOBAL_STAT_WEIGHTS } from "@/stores/schemas";

export type ArtifactScoreCloudConfig = Record<string, unknown> & {
  global: Record<string, number>;
};

export type BuildsCloudSnapshot = {
  activePresetId: string | null;
  deltas: BuildDelta[];
  hiddenCharacters: Record<string, boolean>;
  characterWeapons: Record<string, string[]>;
  computeOptions: ComputeOptions;
  artifactScore: ArtifactScoreCloudConfig;
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
  artifactScore?: ArtifactScoreCloudConfig;
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
      partitionKey: "all",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      isEmpty: isEmptyBuildsSnapshot(snapshot),
      payload: {
        activePresetId: snapshot.activePresetId,
        deltas: snapshot.deltas,
        ...(Object.keys(characterMetadata).length ? { characterMetadata } : {}),
        computeOptions: snapshot.computeOptions,
        artifactScore: snapshot.artifactScore,
        author: snapshot.author,
        description: snapshot.description,
      },
    },
  ];
}

function isEmptyBuildsSnapshot(snapshot: BuildsCloudSnapshot) {
  return (
    snapshot.activePresetId === null &&
    snapshot.deltas.length === 0 &&
    Object.keys(snapshot.hiddenCharacters).length === 0 &&
    Object.keys(snapshot.characterWeapons).length === 0 &&
    snapshot.author === "" &&
    snapshot.description === "" &&
    isSameJson(snapshot.computeOptions, DEFAULT_COMPUTE_OPTIONS) &&
    isSameJson(snapshot.artifactScore, { global: DEFAULT_GLOBAL_STAT_WEIGHTS })
  );
}

function isSameJson(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second);
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
    artifactScore: payload?.artifactScore ?? { global: {} },
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
