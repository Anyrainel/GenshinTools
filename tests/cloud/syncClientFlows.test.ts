import { describe, expect, it, vi } from "vitest";
import type {
  BackupCommitRequest,
  BackupCommitResponse,
  BackupHead,
  BackupHeadResponse,
  BackupObjectDownloadResponse,
  BackupWriteMode,
} from "@/cloud/apiClient";
import { getContentHash } from "@/cloud/payload";
import {
  applyCloudRestoreAndMarkSynced,
  type BackupApi,
  downloadCloudSyncRestorePlan,
  runCloudSyncOnce,
} from "@/cloud/syncClient";
import type {
  CloudConflictPolicy,
  CloudExportPartition,
  CloudNamespace,
  CloudPartitionId,
  CloudPartitionKey,
} from "@/cloud/types";
import {
  type CloudSyncMetadataState,
  type CloudSyncPartitionMeta,
  getCloudSyncPartitionId,
} from "@/stores/useCloudSyncMetadataStore";

describe("cloud sync client multi-device flows", () => {
  it("lets another device observe a newer cloud head when its local copy is unchanged", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");
    const deviceB = createMemoryMetadataStore("device-b");
    const initial = buildsPartition({ builds: ["initial"] });

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [initial],
      createIdempotencyKey: () => "sync_device_a_initial",
    });
    const deviceBInitial = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [initial],
    });

    expect(deviceBInitial.status).toBe("synced");

    const changed = buildsPartition({ builds: ["device-a-edit"] });
    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [changed],
      createIdempotencyKey: () => "sync_device_a_edit",
    });
    const deviceBAfterAEdit = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [initial],
    });

    expect(deviceBAfterAEdit.status).toBe("needs-download");
    expect(deviceBAfterAEdit.plan.downloads[0]).toMatchObject({
      action: "download",
      reason: "remote-changed",
    });
    expect(remote.commit).toHaveBeenCalledTimes(2);

    const downloaded = await downloadCloudSyncRestorePlan({
      apiClient: remote,
      syncResult: deviceBAfterAEdit,
      buildRestorePlan: (partitions) => ({ builds: partitions[0]?.payload }),
    });
    expect(downloaded.partitions[0]).toMatchObject({
      namespace: "builds",
      partitionKey: "all",
      payload: { builds: ["device-a-edit"] },
    });

    const applyResult = applyCloudRestoreAndMarkSynced({
      metadataStore: deviceB.store,
      downloaded,
      appliedAt: 600,
      applyRestorePlan: (restorePlan) => {
        expect(restorePlan.builds).toEqual({ builds: ["device-a-edit"] });
        return { appliedSections: ["builds"] };
      },
    });
    expect(applyResult.appliedSections).toEqual(["builds"]);
    const deviceBAfterApply = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [changed],
    });

    expect(deviceBAfterApply.status).toBe("synced");
    expect(remote.commit).toHaveBeenCalledTimes(2);
  });

  it("keeps independent manual edits conflicted instead of overwriting either device", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");
    const deviceB = createMemoryMetadataStore("device-b");
    const initial = teamPartition({ teams: ["initial"] });

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [initial],
      createIdempotencyKey: () => "sync_team_initial",
    });
    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [initial],
    });
    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [teamPartition({ teams: ["device-a-edit"] })],
      createIdempotencyKey: () => "sync_team_device_a_edit",
    });

    const conflict = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [teamPartition({ teams: ["device-b-edit"] })],
      now: () => 500,
    });

    expect(conflict.status).toBe("conflict");
    expect(remote.commit).toHaveBeenCalledTimes(2);
    const id = getCloudSyncPartitionId("teams", "all");
    expect(deviceB.getState().conflictsById[id]).toMatchObject({
      id,
      groupKey: "teams:all",
      reason: "both-changed",
      detectedAt: 500,
    });
  });

  it("requires explicit local overwrite before a new profile import replaces different cloud data", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");
    const deviceB = createMemoryMetadataStore("device-b");
    const profileId = "600000001";
    const originalImport = profilePartitions(profileId, "original");
    const replacementImport = profilePartitions(profileId, "replacement");

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => originalImport,
      createIdempotencyKey: () => "sync_profile_original",
    });

    const passiveAttempt = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => replacementImport,
      now: () => 700,
    });

    expect(passiveAttempt.status).toBe("conflict");
    expect(remote.commit).toHaveBeenCalledTimes(1);
    expect(
      deviceB.getState().conflictsById[
        getCloudSyncPartitionId("profile.game", profileId)
      ]
    ).toMatchObject({
      groupKey: `profile:${profileId}`,
      reason: "first-sync-local-and-cloud",
      detectedAt: 700,
    });

    const overwrite = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => replacementImport,
      explicitLocalOverwrite: { groupKeys: [`profile:${profileId}`] },
      createIdempotencyKey: () => "sync_profile_replacement",
    });

    expect(overwrite.status).toBe("uploaded");
    expect(remote.commit).toHaveBeenCalledTimes(2);
    const overwriteRequest = remote.commit.mock.calls[1]?.[0];
    expect(overwriteRequest?.puts?.map((put) => put.writeMode)).toEqual([
      { kind: "overwrite" },
      { kind: "overwrite" },
    ]);
    expect(
      deviceB.getState().conflictsById[
        getCloudSyncPartitionId("profile.game", profileId)
      ]
    ).toBeUndefined();
    await expect(
      remote.contentHashFor("profile.game", profileId)
    ).resolves.toBe(await getContentHash(replacementImport[0].payload));
  });

  it("downloads all profile partitions when one profile partition changed remotely", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");
    const deviceB = createMemoryMetadataStore("device-b");
    const profileId = "600000001";
    const original = profilePartitions(profileId, "original");
    const changed = profilePartitions(profileId, "changed");

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => original,
      createIdempotencyKey: () => "sync_profile_group_original",
    });
    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => original,
    });
    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [changed[0], original[1]],
      createIdempotencyKey: () => "sync_profile_group_game_change",
    });

    const needsDownload = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => original,
    });
    expect(needsDownload.plan.downloads).toHaveLength(1);

    const downloaded = await downloadCloudSyncRestorePlan({
      apiClient: remote,
      syncResult: needsDownload,
    });

    expect(downloaded.heads.map((head) => head.partitionKey).sort()).toEqual([
      `profile.artifacts/${profileId}`,
      `profile.game/${profileId}`,
    ]);
    expect(downloaded.restorePlan.accounts).toBeDefined();
  });

  it("rejects downloaded objects whose compressed hash does not match the head", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");
    const deviceB = createMemoryMetadataStore("device-b");

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [buildsPartition({ builds: ["initial"] })],
      createIdempotencyKey: () => "sync_corrupt_initial",
    });
    const head = remote.heads.get(getCloudSyncPartitionId("builds", "all"));
    expect(head).toBeDefined();
    remote.objects.set(head?.objectId ?? "", new Blob(["corrupt"]));

    const needsDownload = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [],
    });

    await expect(
      downloadCloudSyncRestorePlan({
        apiClient: remote,
        syncResult: needsDownload,
      })
    ).rejects.toThrow("hash mismatch");
  });
});

class StatefulBackupApi implements BackupApi {
  readonly heads = new Map<CloudPartitionId, BackupHead>();
  readonly objects = new Map<string, Blob>();
  private revIndex = 1;
  private headSetIndex = 1;

  readonly getHead = vi.fn(
    async (): Promise<BackupHeadResponse> => ({
      serverTime: this.revIndex,
      changed: true,
      headSetRev: `hset-${this.headSetIndex}`,
      capabilities: {
        apiVersion: 1,
        commitContentTypes: ["multipart/form-data"],
        maxObjectsPerCommit: 10,
        maxCompressedBytesPerCommit: 5_000_000,
        maxCompressedBytesPerObject: 2_000_000,
      },
      heads: [...this.heads.values()],
    })
  );

  readonly commit = vi.fn(
    async (request: BackupCommitRequest): Promise<BackupCommitResponse> => {
      const changed: BackupHead[] = [];
      for (const put of request.puts ?? []) {
        this.assertWriteAllowed(put.partitionKey, put.writeMode);
        const head: BackupHead = {
          partitionKey: put.partitionKey,
          objectId: `obj-${this.revIndex}`,
          rev: `rev-${this.revIndex}`,
          schemaVersion: put.schemaVersion,
          contentHash: put.contentHash,
          compressedHash: put.compressedHash,
          compressedBytes: put.compressedBytes ?? put.bytes.size,
          updatedAt: this.revIndex,
          sourceDeviceId: request.deviceId,
        };
        this.revIndex += 1;
        this.heads.set(put.partitionKey, head);
        this.objects.set(head.objectId, put.bytes);
        changed.push(head);
      }
      this.headSetIndex += 1;
      return {
        idempotencyKey: request.idempotencyKey,
        committedAt: this.revIndex,
        headSetRev: `hset-${this.headSetIndex}`,
        heads: changed,
      };
    }
  );

  readonly downloadObjects = vi.fn(
    async (objectIds: string[]): Promise<BackupObjectDownloadResponse> => {
      const heads = objectIds.map((objectId) => {
        const head = [...this.heads.values()].find(
          (entry) => entry.objectId === objectId
        );
        if (!head) throw new Error(`missing head ${objectId}`);
        return head;
      });
      return {
        manifest: { objects: heads },
        objects: new Map(
          objectIds.map((objectId) => {
            const object = this.objects.get(objectId);
            if (!object) throw new Error(`missing object ${objectId}`);
            return [objectId, object];
          })
        ),
      };
    }
  );

  async contentHashFor(
    namespace: CloudNamespace,
    partitionKey: CloudPartitionKey
  ): Promise<string | undefined> {
    return this.heads.get(getCloudSyncPartitionId(namespace, partitionKey))
      ?.contentHash;
  }

  private assertWriteAllowed(
    partitionKey: CloudPartitionId,
    writeMode: BackupWriteMode
  ): void {
    const current = this.heads.get(partitionKey);
    if (writeMode.kind === "overwrite") return;
    if (writeMode.kind === "ifAbsent" && current) {
      throw new Error(`unexpected ifAbsent overwrite for ${partitionKey}`);
    }
    if (
      writeMode.kind === "ifMatch" &&
      (!current || current.rev !== writeMode.expectedRev)
    ) {
      throw new Error(`unexpected ifMatch mismatch for ${partitionKey}`);
    }
  }
}

function createMemoryMetadataStore(deviceId: string) {
  let state: Pick<
    CloudSyncMetadataState,
    "deviceId" | "partitionsById" | "conflictsById"
  > = {
    deviceId,
    partitionsById: {},
    conflictsById: {},
  };

  return {
    getState: () => state,
    store: {
      ensureDeviceId: () => state.deviceId,
      getAllPartitionMeta: () => Object.values(state.partitionsById),
      markPartitionSyncedFromUpload: (input) =>
        markSynced(state, input, "upload"),
      markPartitionSyncedFromDownload: (input) =>
        markSynced(state, input, "download"),
      markPartitionSyncedWithoutTransfer: (input) =>
        markSynced(state, input, "none"),
      markConflict: (conflict) => {
        state = {
          ...state,
          conflictsById: {
            ...state.conflictsById,
            [conflict.id]: conflict,
          },
        };
      },
    } satisfies Pick<
      CloudSyncMetadataState,
      | "ensureDeviceId"
      | "getAllPartitionMeta"
      | "markPartitionSyncedFromUpload"
      | "markPartitionSyncedFromDownload"
      | "markPartitionSyncedWithoutTransfer"
      | "markConflict"
    >,
  };

  function markSynced(
    current: typeof state,
    input: {
      namespace: CloudNamespace;
      partitionKey: CloudPartitionKey;
      rev: string;
      contentHash: string;
      syncedAt?: number;
    },
    source: "upload" | "download" | "none"
  ) {
    const id = getCloudSyncPartitionId(input.namespace, input.partitionKey);
    const previous = current.partitionsById[id];
    const syncedAt = input.syncedAt ?? 1;
    const conflictsById = { ...current.conflictsById };
    delete conflictsById[id];
    state = {
      ...current,
      partitionsById: {
        ...current.partitionsById,
        [id]: {
          id,
          namespace: input.namespace,
          partitionKey: input.partitionKey,
          lastSeenRev: input.rev,
          lastAppliedHash: input.contentHash,
          ...(source === "upload"
            ? { lastUploadedHash: input.contentHash }
            : previous?.lastUploadedHash
              ? { lastUploadedHash: previous.lastUploadedHash }
              : {}),
          lastSyncedAt: syncedAt,
          dirty: false,
          updatedAt: syncedAt,
        } satisfies CloudSyncPartitionMeta,
      },
      conflictsById,
    };
  }
}

function buildsPartition(payload: unknown): CloudExportPartition {
  return partition("builds", "all", "explicit-choice", payload);
}

function teamPartition(payload: unknown): CloudExportPartition {
  return partition("teams", "all", "explicit-choice", payload);
}

function profilePartitions(
  profileId: CloudPartitionKey,
  marker: string
): CloudExportPartition[] {
  return [
    partition("profile.game", profileId, "profile-import-wins", {
      marker,
      accountProfileId: Number(profileId),
      characters: [
        {
          key: "amber",
          level: marker === "changed" ? 81 : 80,
          constellation: 0,
          talent: [1, 1, 1],
        },
      ],
      weapons: [],
    }),
    partition("profile.artifacts", profileId, "profile-import-wins", {
      marker,
      accountProfileId: Number(profileId),
      artifacts: [],
    }),
  ];
}

function partition(
  namespace: CloudNamespace,
  partitionKey: CloudPartitionKey,
  conflictPolicy: CloudConflictPolicy,
  payload: unknown
): CloudExportPartition {
  return {
    namespace,
    partitionKey,
    schemaVersion: 1,
    conflictPolicy,
    payload,
  };
}
