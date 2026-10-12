import type { CloudExportPartition } from "@/domain/backup/types";
import {
  compactTeamSetupConfigs,
  type TeamCompDelta,
} from "@/domain/team/teamDeltas";
import type { TeamSetupConfig } from "@/domain/team/types";
import { migrateReleasedTeamWeapons } from "@/stores/migration/releasedWeaponIds";
import { migrateTeamAnalysisConfigs } from "@/stores/migration/teamAnalysis";
import {
  migrateLegacyFormulaUnitConfigs,
  migrateLegacySkirkFormulaUnitConfigs,
} from "@/stores/migration/teamFormulaUnits";
import { PersistedTeamStoreSchema } from "@/stores/schemas";

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
      schemaVersion: 6,
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
  let configsByTeamId = current?.configsByTeamId ?? {};
  if (partition && partition.schemaVersion < 2) {
    configsByTeamId = migrateLegacyFormulaUnitConfigs(configsByTeamId);
  }
  if (partition && partition.schemaVersion < 3) {
    configsByTeamId = migrateLegacySkirkFormulaUnitConfigs(configsByTeamId);
  }
  if (partition && partition.schemaVersion < 5) {
    configsByTeamId = migrateTeamAnalysisConfigs(configsByTeamId);
  }
  const restored = {
    activePresetId: current?.activePresetId ?? null,
    compDeltas: current?.compDeltas ?? [],
    configsByTeamId,
    author: current?.author ?? "",
    description: current?.description ?? "",
    updatedAt:
      getMetadataUpdatedAt(partition) ?? current?.updatedAt ?? Date.now(),
  };
  const migrated =
    partition && partition.schemaVersion < 4
      ? migrateReleasedTeamWeapons(restored)
      : restored;
  const parsed = PersistedTeamStoreSchema.parse(migrated);
  // Cloud v6 adds optional absolute count targets. Prior v5 delta/exact maps
  // keep their meaning and no target is synthesized during restore.
  return {
    ...migrated,
    activePresetId: parsed.activePresetId,
    compDeltas: parsed.compDeltas as TeamCompDelta[],
    configsByTeamId: parsed.configsByTeamId as Record<string, TeamSetupConfig>,
    author: parsed.author,
    description: parsed.description,
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
