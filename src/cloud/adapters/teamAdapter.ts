import type { CloudExportPartition } from "@/cloud/types";
import type { TeamCompDelta } from "@/lib/team-comp/teamDeltas";
import type { TeamSetupConfig } from "@/lib/team-comp/types";

export type TeamCloudSnapshot = {
  activePresetId: string | null;
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamSetupConfig>;
  author: string;
  description: string;
};

export type TeamCompCloudPayload = {
  activePresetId: string | null;
  presetRevision?: string;
  compDeltas: TeamCompDelta[];
  author?: string;
  description?: string;
};

export type TeamConfigCloudPayload = {
  configsByTeamId: Record<string, TeamSetupConfig>;
};

export type TeamRestorePatch = TeamCloudSnapshot;

export function teamToCloud(
  snapshot: TeamCloudSnapshot
): CloudExportPartition[] {
  return [
    {
      namespace: "team.comp",
      partitionKey: "default",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      payload: {
        activePresetId: snapshot.activePresetId,
        compDeltas: snapshot.compDeltas,
        author: snapshot.author,
        description: snapshot.description,
      } satisfies TeamCompCloudPayload,
    },
    {
      namespace: "team.config",
      partitionKey: "default",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      payload: {
        configsByTeamId: snapshot.configsByTeamId,
      } satisfies TeamConfigCloudPayload,
    },
  ];
}

export function teamFromCloud(
  partitions: CloudExportPartition[]
): TeamRestorePatch {
  const comp = partitions.find(
    (partition) => partition.namespace === "team.comp"
  )?.payload as TeamCompCloudPayload | undefined;
  const config = partitions.find(
    (partition) => partition.namespace === "team.config"
  )?.payload as TeamConfigCloudPayload | undefined;
  return {
    activePresetId: comp?.activePresetId ?? null,
    compDeltas: comp?.compDeltas ?? [],
    configsByTeamId: config?.configsByTeamId ?? {},
    author: comp?.author ?? "",
    description: comp?.description ?? "",
  };
}
