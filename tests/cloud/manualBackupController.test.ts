import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadManualBackupSelection,
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
