import {
  type BackupMetadataRow,
  buildLocalBackupMetadataRows,
  type CloudBackupMetadataSnapshot,
  fetchCloudBackupMetadata,
  mergeBackupMetadataRows,
} from "@/cloud/backupMetadata";
import {
  type ManualBackupActionPlan,
  type ManualBackupDirection,
  planManualBackupAction,
} from "@/cloud/manualBackupFlow";
import { buildLocalBackupPartitions } from "@/cloud/storeAdapters";
import {
  applyCloudRestoreAndMarkSynced,
  type BackupApi,
  type BackupDownloadApi,
  type CloudRestoreApplyOptions,
  type CloudSyncRunResult,
  downloadCloudSyncRestorePlan,
  previewCloudSync,
  runCloudSyncOnce,
} from "@/cloud/syncClient";
import type { CloudExportPartition, CloudPartitionId } from "@/cloud/types";
import type { CloudSyncPartitionMeta } from "@/stores/useCloudSyncMetadataStore";

export type PendingManualBackupAction = {
  direction: ManualBackupDirection;
  syncResult: CloudSyncRunResult;
  plan: ManualBackupActionPlan;
};

export type ManualBackupUploadSelectionResult =
  | { status: "skipped" }
  | { status: "uploaded"; result: CloudSyncRunResult };

const CLOUD_METADATA_CACHE_PREFIX = "cloud_backup_metadata:";
const CLOUD_METADATA_CACHE_SCHEMA_VERSION = 4;

export function buildManualBackupMetadataRows(
  localMeta: CloudSyncPartitionMeta[],
  cloudMetadata: CloudBackupMetadataSnapshot | null,
  buildPartitions: () => CloudExportPartition[] = buildLocalBackupPartitions
): BackupMetadataRow[] {
  return mergeBackupMetadataRows(
    buildLocalBackupMetadataRows(buildPartitions(), localMeta),
    cloudMetadata?.rows ?? []
  );
}

export async function refreshManualBackupMetadata(
  apiClient: BackupApi,
  userId: string
): Promise<CloudBackupMetadataSnapshot> {
  const snapshot = await fetchCloudBackupMetadata(apiClient);
  writeCloudMetadataCache(userId, snapshot);
  return snapshot;
}

export async function previewManualBackupAction(
  direction: ManualBackupDirection,
  apiClient: BackupApi
): Promise<PendingManualBackupAction> {
  const syncResult = await previewCloudSync({ apiClient });
  return {
    direction,
    syncResult,
    plan: planManualBackupAction(syncResult.plan, direction),
  };
}

export async function uploadManualBackupSelection(
  apiClient: BackupApi,
  pending: PendingManualBackupAction,
  selectedIds: CloudPartitionId[]
): Promise<ManualBackupUploadSelectionResult> {
  const selected = new Set(selectedIds);
  const selectedConflicts = pending.plan.choices
    .filter(
      (choice) =>
        selected.has(choice.id) && choice.kind === "upload-overwrite-cloud"
    )
    .map((choice) => choice.id);
  const selectedDeletes = pending.plan.choices
    .filter(
      (choice) =>
        selected.has(choice.id) && choice.kind === "upload-delete-cloud"
    )
    .map((choice) => choice.id);
  if (
    pending.plan.automaticPartitionIds.length === 0 &&
    selectedConflicts.length === 0 &&
    selectedDeletes.length === 0
  ) {
    return { status: "skipped" };
  }
  const result = await runCloudSyncOnce({
    apiClient,
    explicitLocalOverwrite: { partitionIds: selectedConflicts },
    explicitCloudDelete: { partitionIds: selectedDeletes },
  });
  return { status: "uploaded", result };
}

export async function downloadManualBackupSelection(
  apiClient: BackupDownloadApi,
  syncResult: CloudSyncRunResult,
  partitionIds: CloudPartitionId[],
  options: Omit<CloudRestoreApplyOptions, "downloaded"> = {}
) {
  const downloaded = await downloadCloudSyncRestorePlan({
    apiClient,
    syncResult,
    downloadScope: { partitionIds },
  });
  return applyCloudRestoreAndMarkSynced({ ...options, downloaded });
}

export function readCloudMetadataCache(
  userId: string
): CloudBackupMetadataSnapshot | null {
  try {
    const raw = sessionStorage.getItem(metadataCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CloudBackupMetadataSnapshot;
    if (
      !parsed ||
      parsed.schemaVersion !== CLOUD_METADATA_CACHE_SCHEMA_VERSION ||
      !Array.isArray(parsed.rows) ||
      !parsed.rows.every(isCachedMetadataRow)
    ) {
      sessionStorage.removeItem(metadataCacheKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCloudMetadataCache(
  userId: string,
  snapshot: CloudBackupMetadataSnapshot
): void {
  try {
    sessionStorage.setItem(metadataCacheKey(userId), JSON.stringify(snapshot));
  } catch {
    // Cache failure should not block backup workflows.
  }
}

function metadataCacheKey(userId: string) {
  return `${CLOUD_METADATA_CACHE_PREFIX}${userId}`;
}

function isCachedMetadataRow(row: BackupMetadataRow): boolean {
  return (
    typeof row?.id === "string" &&
    typeof row.kind === "string" &&
    isCachedMetadataSide(row.local) &&
    isCachedMetadataSide(row.cloud)
  );
}

function isCachedMetadataSide(side: BackupMetadataRow["local"]): boolean {
  return (
    typeof side?.hasRecord === "boolean" &&
    typeof side.count === "number" &&
    typeof side.partitionCount === "number"
  );
}
