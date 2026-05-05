import type { CloudExportPartition } from "@/cloud/types";
import type { ComputeOptions } from "@/data/types";
import {
  type BuildDelta,
  disableBuildsForCharacters,
} from "@/lib/artifact-builds/buildDeltas";
import { getDefaultBuildPresetId } from "@/lib/artifact-builds/buildPresetRegistry";
import { DEFAULT_COMPUTE_OPTIONS } from "@/lib/artifact-builds/computeFilters";
import { DEFAULT_GLOBAL_STAT_WEIGHTS } from "@/stores/schemas";

export type ArtifactScoreCloudConfig = Record<string, unknown> & {
  global: Record<string, number>;
};

export type BuildsCloudSnapshot = {
  activePresetId: string | null;
  deltas: BuildDelta[];
  characterWeapons: Record<string, string[]>;
  computeOptions: ComputeOptions;
  artifactScore: ArtifactScoreCloudConfig;
  author: string;
  description: string;
  updatedAt: number;
};

export type BuildsCloudPayload = {
  activePresetId?: string | null;
  activePresetRevision?: string;
  deltas: BuildDelta[];
  characterMetadata?: Record<
    string,
    {
      hidden?: boolean;
      weaponIds?: string[];
    }
  >;
  characterWeapons?: Record<string, string[]>;
  computeOptions?: ComputeOptions;
  artifactScore?: ArtifactScoreCloudConfig;
  author?: string;
  description?: string;
  updatedAt?: number;
};

export type BuildsRestorePatch = BuildsCloudSnapshot;

export function buildsToCloud(
  snapshot: BuildsCloudSnapshot
): CloudExportPartition<BuildsCloudPayload>[] {
  const activePresetId = getCloudBuildPresetSelection(snapshot.activePresetId);
  return [
    {
      namespace: "builds",
      partitionKey: "all",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      isEmpty: isEmptyBuildsSnapshot(snapshot),
      payload: {
        ...(activePresetId !== undefined ? { activePresetId } : {}),
        deltas: snapshot.deltas,
        ...(Object.keys(snapshot.characterWeapons).length
          ? { characterWeapons: snapshot.characterWeapons }
          : {}),
        computeOptions: snapshot.computeOptions,
        artifactScore: snapshot.artifactScore,
        author: snapshot.author,
        description: snapshot.description,
        updatedAt: snapshot.updatedAt,
      },
    },
  ];
}

function isEmptyBuildsSnapshot(snapshot: BuildsCloudSnapshot) {
  return (
    isImplicitDefaultPreset(snapshot.activePresetId) &&
    snapshot.deltas.length === 0 &&
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
  const partition = partitions.find(
    (partition) => partition.namespace === "builds"
  );
  const payload = partition?.payload as BuildsCloudPayload | undefined;
  const hiddenCharacterIds = Object.entries(
    payload?.characterMetadata ?? {}
  ).flatMap(([characterId, metadata]) =>
    metadata.hidden ? [characterId] : []
  );
  return {
    activePresetId: getRestoredBuildPresetSelection(payload),
    deltas: disableBuildsForCharacters(
      payload?.deltas ?? [],
      hiddenCharacterIds,
      null
    ),
    characterWeapons: getRestoredCharacterWeapons(payload),
    computeOptions: payload?.computeOptions ?? {},
    artifactScore: payload?.artifactScore ?? { global: {} },
    author: payload?.author ?? "",
    description: payload?.description ?? "",
    updatedAt:
      getMetadataUpdatedAt(partition, "builds") ??
      payload?.updatedAt ??
      Date.now(),
  };
}

function getMetadataUpdatedAt(
  partition: CloudExportPartition | undefined,
  kind: "builds"
): number | undefined {
  return partition?.metadata?.records.find((record) => record.kind === kind)
    ?.updatedAt;
}

function getCloudBuildPresetSelection(
  activePresetId: string | null
): string | null | undefined {
  return isImplicitDefaultPreset(activePresetId) ? undefined : activePresetId;
}

function getRestoredBuildPresetSelection(
  payload: BuildsCloudPayload | undefined
): string | null {
  if (!payload) return null;
  if ("activePresetId" in payload) return payload.activePresetId ?? null;
  return getDefaultBuildPresetId();
}

function isImplicitDefaultPreset(activePresetId: string | null): boolean {
  return activePresetId === getDefaultBuildPresetId();
}

function getRestoredCharacterWeapons(
  payload: BuildsCloudPayload | undefined
): Record<string, string[]> {
  return {
    ...Object.fromEntries(
      Object.entries(payload?.characterMetadata ?? {}).flatMap(
        ([characterId, metadata]) =>
          metadata.weaponIds?.length ? [[characterId, metadata.weaponIds]] : []
      )
    ),
    ...(payload?.characterWeapons ?? {}),
  };
}
