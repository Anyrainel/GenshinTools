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

export type TeamCloudPayload = {
  activePresetId: string | null;
  presetRevision?: string;
  compDeltas: TeamCompDelta[];
  configsByTeamId: Record<string, TeamSetupConfig>;
  author?: string;
  description?: string;
};

export type TeamRestorePatch = TeamCloudSnapshot;

export function teamToCloud(
  snapshot: TeamCloudSnapshot
): CloudExportPartition<TeamCloudPayload>[] {
  return [
    {
      namespace: "teams",
      partitionKey: "all",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      payload: {
        activePresetId: snapshot.activePresetId,
        compDeltas: snapshot.compDeltas,
        configsByTeamId: snapshot.configsByTeamId,
        author: snapshot.author,
        description: snapshot.description,
      } satisfies TeamCloudPayload,
    },
  ];
}

export function teamFromCloud(
  partitions: CloudExportPartition[]
): TeamRestorePatch {
  const current = partitions.find(
    (partition) => partition.namespace === "teams"
  )?.payload as TeamCloudPayload | undefined;
  return {
    activePresetId: current?.activePresetId ?? null,
    compDeltas: current?.compDeltas ?? [],
    configsByTeamId: current?.configsByTeamId ?? {},
    author: current?.author ?? "",
    description: current?.description ?? "",
  };
}
