import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackupApiError } from "@/cloud/apiClient";
import type { CloudBackupMetadataSnapshot } from "@/cloud/backupMetadata";
import {
  CLOUD_METADATA_CACHE_MAX_AGE_MS,
  downloadManualBackupSelection,
  isCloudMetadataCacheStale,
  type PendingManualBackupAction,
  uploadManualBackupSelection,
} from "@/cloud/manualBackupController";
import type { ManualBackupActionPlan } from "@/cloud/manualBackupFlow";
import type { CloudRestoreApplyResult } from "@/cloud/storeAdapters";
import {
  applyCloudRestoreAndMarkSynced,
  type BackupApi,
  type BackupDownloadApi,
  type CloudDownloadedRestore,
  type CloudSyncRunResult,
  downloadCloudSyncRestorePlan,
  runCloudSyncOnce,
} from "@/cloud/syncClient";
import type { CloudSyncPlan } from "@/cloud/syncPlanner";

vi.mock("@/cloud/syncClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/cloud/syncClient")>();
  return {
    ...actual,
    applyCloudRestoreAndMarkSynced: vi.fn(),
    downloadCloudSyncRestorePlan: vi.fn(),
    runCloudSyncOnce: vi.fn(),
  };
});

describe("manual backup controller", () => {
  beforeEach(() => {
    vi.mocked(applyCloudRestoreAndMarkSynced).mockReset();
    vi.mocked(downloadCloudSyncRestorePlan).mockReset();
    vi.mocked(runCloudSyncOnce).mockReset();
  });

  it("translates selected upload choices into explicit sync scopes", async () => {
    const apiClient = {} as BackupApi;
    const syncResult = runResult();
    vi.mocked(runCloudSyncOnce).mockResolvedValue(syncResult);

    const result = await uploadManualBackupSelection(
      apiClient,
      pendingUploadAction(),
      ["builds/all", "teams/all", "tiers/all"]
    );

    expect(runCloudSyncOnce).toHaveBeenCalledWith({
      apiClient,
      explicitLocalOverwrite: { partitionIds: ["builds/all"] },
      explicitCloudDelete: { partitionIds: ["teams/all"] },
    });
    expect(result).toEqual({ status: "uploaded", result: syncResult });
  });

  it("skips upload when there are no automatic or selected upload actions", async () => {
    const result = await uploadManualBackupSelection(
      {} as BackupApi,
      {
        direction: "upload",
        syncResult: runResult(),
        plan: {
          direction: "upload",
          automaticPartitionIds: [],
          automaticItems: [],
          choices: [choice("tiers/all", "download-overwrite-local")],
        },
      },
      ["tiers/all"]
    );

    expect(runCloudSyncOnce).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "skipped" });
  });

  it("propagates monthly upload quota errors without marking upload success", async () => {
    const error = new BackupApiError(
      "commit backup objects failed with HTTP 429",
      429,
      {
        error: "monthly_upload_limit_exceeded",
        quota: backupQuota(10),
      }
    );
    vi.mocked(runCloudSyncOnce).mockRejectedValue(error);

    await expect(
      uploadManualBackupSelection({} as BackupApi, pendingUploadAction(), [
        "builds/all",
      ])
    ).rejects.toBe(error);
  });

  it("passes selected download partitions through restore and marks them synced", async () => {
    const apiClient = {} as BackupDownloadApi;
    const syncResult = runResult();
    const downloaded = {
      heads: [],
      partitions: [],
      restorePlan: {},
    } satisfies CloudDownloadedRestore;
    const applied = {
      appliedSections: ["characters"],
    } satisfies CloudRestoreApplyResult;
    vi.mocked(downloadCloudSyncRestorePlan).mockResolvedValue(downloaded);
    vi.mocked(applyCloudRestoreAndMarkSynced).mockReturnValue(applied);

    const result = await downloadManualBackupSelection(
      apiClient,
      syncResult,
      ["profile.game/600000001"],
      { appliedAt: 123 }
    );

    expect(downloadCloudSyncRestorePlan).toHaveBeenCalledWith({
      apiClient,
      syncResult,
      downloadScope: { partitionIds: ["profile.game/600000001"] },
    });
    expect(applyCloudRestoreAndMarkSynced).toHaveBeenCalledWith({
      appliedAt: 123,
      downloaded,
    });
    expect(result).toBe(applied);
  });

  it("treats cached metadata as stale after one week", () => {
    const checkedAt = 1000;
    const snapshot = {
      schemaVersion: 5,
      checkedAt,
      headSetRev: "hset-1",
      quota: backupQuota(),
      rows: [],
    } satisfies CloudBackupMetadataSnapshot;

    expect(
      isCloudMetadataCacheStale(
        snapshot,
        checkedAt + CLOUD_METADATA_CACHE_MAX_AGE_MS
      )
    ).toBe(false);
    expect(
      isCloudMetadataCacheStale(
        snapshot,
        checkedAt + CLOUD_METADATA_CACHE_MAX_AGE_MS + 1
      )
    ).toBe(true);
  });
});

function pendingUploadAction(): PendingManualBackupAction {
  return {
    direction: "upload",
    syncResult: runResult(),
    plan: {
      direction: "upload",
      automaticPartitionIds: ["profile.app/all"],
      automaticItems: [
        {
          id: "profile.app/all",
          namespace: "profile.app",
          partitionKey: "all",
          groupKey: "profile.app:all",
          reason: "local-only",
          kind: "upload-local",
          recordKinds: ["frozen", "settings"],
        },
      ],
      choices: [
        choice("builds/all", "upload-overwrite-cloud"),
        choice("teams/all", "upload-delete-cloud"),
        choice("tiers/all", "download-overwrite-local"),
      ],
    } satisfies ManualBackupActionPlan,
  };
}

function choice(
  id: "builds/all" | "teams/all" | "tiers/all",
  kind:
    | "upload-overwrite-cloud"
    | "upload-delete-cloud"
    | "download-overwrite-local"
) {
  const namespace = id.slice(0, id.indexOf("/")) as
    | "builds"
    | "teams"
    | "tiers";
  return {
    id,
    namespace,
    partitionKey: "all",
    groupKey: `${namespace}:all`,
    reason: "both-changed",
    kind,
    recordKinds: namespace === "teams" ? ["teams", "teamConfigs"] : [namespace],
  } satisfies ManualBackupActionPlan["choices"][number];
}

function runResult(): CloudSyncRunResult {
  return {
    status: "conflict",
    plan: emptyPlan(),
    remoteHeads: [],
    uploaded: [],
    headSetRev: "hset-1",
    quota: backupQuota(),
  };
}

function backupQuota(used = 0) {
  return {
    period: "2026-05",
    limit: 10,
    used,
    remaining: Math.max(0, 10 - used),
    resetsAt: Date.UTC(2026, 5, 1),
  };
}

function emptyPlan(): CloudSyncPlan {
  return {
    uploads: [],
    downloads: [],
    deletes: [],
    conflicts: [],
    noops: [],
    skipped: [],
    unsupported: [],
    decisions: [],
  };
}
