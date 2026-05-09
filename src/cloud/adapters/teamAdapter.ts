import type { CloudExportPartition } from "@/cloud/types";
import {
  compactTeamSetupConfigs,
  type TeamCompDelta,
} from "@/lib/team-comp/teamDeltas";
import type { TeamSetupConfig } from "@/lib/team-comp/types";

export type TeamCloudSnapshot = {
  activePresetId: string | null;
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamSetupConfig>;
  author: string;
  description: string;
  updatedAt: number;
};

export type TeamCloudPayload = {
  activePresetId: string | null;
  presetRevision?: string;
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamSetupConfig>;
  author?: string;
  description?: string;
  updatedAt?: number;
};

export type TeamRestorePatch = TeamCloudSnapshot;

export function teamToCloud(
  snapshot: TeamCloudSnapshot
): CloudExportPartition<TeamCloudPayload>[] {
  const configsByTeamId = compactTeamSetupConfigs(snapshot.configsByTeamId);
  return [
    {
      namespace: "teams",
      partitionKey: "all",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      isDefaultState: isDefaultTeamSnapshot(snapshot, configsByTeamId),
      payload: {
        activePresetId: snapshot.activePresetId,
        compDeltas: snapshot.compDeltas,
        configsByTeamId,
        author: snapshot.author,
        description: snapshot.description,
        updatedAt: snapshot.updatedAt,
      } satisfies TeamCloudPayload,
    },
  ];
}

export function teamFromCloud(
  partitions: CloudExportPartition[]
): TeamRestorePatch {
  const partition = partitions.find(
    (partition) => partition.namespace === "teams"
  );
  const current = partition?.payload as TeamCloudPayload | undefined;
  return {
    activePresetId: current?.activePresetId ?? null,
    compDeltas: current?.compDeltas ?? [],
    configsByTeamId: current?.configsByTeamId ?? {},
    author: current?.author ?? "",
    description: current?.description ?? "",
    updatedAt:
      getMetadataUpdatedAt(partition) ?? current?.updatedAt ?? Date.now(),
  };
}

function getMetadataUpdatedAt(
  partition: CloudExportPartition | undefined
): number | undefined {
  const values = (partition?.metadata?.records ?? [])
    .filter(
      (record) => record.kind === "teams" || record.kind === "teamConfigs"
    )
    .flatMap((record) =>
      typeof record.updatedAt === "number" ? [record.updatedAt] : []
    );
  return values.length ? Math.max(...values) : undefined;
}

function isDefaultTeamSnapshot(
  snapshot: TeamCloudSnapshot,
  configsByTeamId: Record<string, TeamSetupConfig>
) {
  if (snapshot.compDeltas.length > 0) return false;
  if (Object.keys(configsByTeamId).length > 0) return false;
  if (snapshot.activePresetId != null) return true;
  return snapshot.author === "" && snapshot.description === "";
}
