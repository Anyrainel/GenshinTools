import { describe, expect, it, vi } from "vitest";
import { teamToCloud } from "@/cloud/adapters/teamAdapter";
import type {
  BackupCommitRequest,
  BackupCommitResponse,
  BackupHead,
  BackupHeadResponse,
  BackupObjectDownloadResponse,
  BackupWriteMode,
} from "@/cloud/apiClient";
import { createEnvelope, getContentHash, gzipJson } from "@/cloud/payload";
import {
  applyCloudRestoreAndMarkSynced,
  type BackupApi,
  downloadCloudSyncRestorePlan,
  previewCloudSync,
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
  it("previews cloud restore for a fresh device without uploading local defaults", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");
    const deviceB = createMemoryMetadataStore("device-b");

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [buildsPartition({ builds: ["from-cloud"] })],
      createIdempotencyKey: () => "sync_restore_source",
    });

    const preview = await previewCloudSync({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [
        buildsPartition({ builds: [] }, { isDefaultState: true }),
      ],
    });

    expect(preview.status).toBe("needs-download");
    expect(preview.plan.downloads).toHaveLength(1);
    expect(remote.commit).toHaveBeenCalledTimes(1);

    const downloaded = await downloadCloudSyncRestorePlan({
      apiClient: remote,
      syncResult: preview,
      buildRestorePlan: (partitions) => ({ builds: partitions[0]?.payload }),
    });

    expect(downloaded.restorePlan.builds).toEqual({
      builds: ["from-cloud"],
    });
    expect(remote.commit).toHaveBeenCalledTimes(1);
  });

  it("downloads cloud teams after local custom teams are cleared to default state", async () => {
    const remote = new StatefulBackupApi();
    const sourceDevice = createMemoryMetadataStore("source-device");
    const freshDevice = createMemoryMetadataStore("fresh-device");

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: sourceDevice.store,
      buildPartitions: () => [
        ...teamToCloud({
          activePresetId: null,
          compDeltas: [
            {
              kind: "custom",
              id: "custom-team",
              value: {
                id: "custom-team",
                name: "Cloud Team",
                slots: [{ charId: "amber", weaponId: null, artifactSet: null }],
                reactions: [],
              },
            },
          ],
          configsByTeamId: {},
          author: "",
          description: "",
          updatedAt: 100,
        }),
      ],
      createIdempotencyKey: () => "sync_cloud_team_source",
    });

    const preview = await previewCloudSync({
      apiClient: remote,
      metadataStore: freshDevice.store,
      buildPartitions: () => [
        ...teamToCloud({
          activePresetId: null,
          compDeltas: [],
          configsByTeamId: {},
          author: "",
          description: "",
          updatedAt: 200,
        }),
      ],
    });

    expect(preview.status).toBe("needs-download");
    expect(preview.plan.conflicts).toEqual([]);
    expect(preview.plan.downloads.map((download) => download.id)).toEqual([
      "teams/all",
    ]);
  });

  it("downloads cloud teams when a fresh device only has preset teams", async () => {
    const remote = new StatefulBackupApi();
    const sourceDevice = createMemoryMetadataStore("source-device");
    const freshDevice = createMemoryMetadataStore("fresh-device");

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: sourceDevice.store,
      buildPartitions: () => [
        ...teamToCloud({
          activePresetId: null,
          compDeltas: [
            {
              kind: "custom",
              id: "cloud-team",
              value: {
                id: "cloud-team",
                name: "Cloud Team",
                slots: [{ charId: "amber", weaponId: null, artifactSet: null }],
                reactions: [],
              },
            },
          ],
          configsByTeamId: {},
          author: "",
          description: "",
          updatedAt: 100,
        }),
      ],
      createIdempotencyKey: () => "sync_cloud_team_source",
    });

    const preview = await previewCloudSync({
      apiClient: remote,
      metadataStore: freshDevice.store,
      buildPartitions: () => [
        ...teamToCloud({
          activePresetId: "preset-teams",
          compDeltas: [],
          configsByTeamId: { "preset-team": { combatOptions: {} } },
          author: "preset author",
          description: "preset description",
          updatedAt: 200,
        }),
      ],
    });

    expect(preview.status).toBe("needs-download");
    expect(preview.plan.conflicts).toEqual([]);
    expect(preview.plan.downloads.map((download) => download.id)).toEqual([
      "teams/all",
    ]);
  });

  it("uploads default-state partitions on a brand-new backup", async () => {
    const remote = new StatefulBackupApi();
    const device = createMemoryMetadataStore("device-empty");

    const result = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: device.store,
      buildPartitions: () => [
        buildsPartition(
          { activePresetId: null, deltas: [] },
          { isDefaultState: true }
        ),
        teamPartition(
          { activePresetId: null, compDeltas: [], configsByTeamId: {} },
          { isDefaultState: true }
        ),
        tiersPartition(emptyTiersPayload(), { isDefaultState: true }),
      ],
      createIdempotencyKey: () => "sync_empty_backup",
    });

    expect(result.status).toBe("uploaded");
    expect(result.plan.uploads.map((upload) => upload.id).sort()).toEqual([
      "builds/all",
      "teams/all",
      "tiers/all",
    ]);
    expect([...remote.heads.keys()].sort()).toEqual([
      "builds/all",
      "teams/all",
      "tiers/all",
    ]);
    expect(remote.heads.get("builds/all")?.metadata.records).toEqual([
      { kind: "builds", count: 0 },
    ]);
    expect(remote.heads.get("teams/all")?.metadata.records).toEqual([
      { kind: "teams", count: 0 },
      { kind: "teamConfigs", count: 0 },
    ]);
    expect(remote.heads.get("tiers/all")?.metadata.records).toEqual([
      { kind: "tiers", count: 0 },
    ]);
  });

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

  it("publishes deletes instead of restoring a previously synced missing partition", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [buildsPartition({ builds: ["local"] })],
      createIdempotencyKey: () => "sync_delete_initial",
    });

    const deleted = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [],
      createIdempotencyKey: () => "sync_delete_missing_local",
    });

    expect(deleted.status).toBe("uploaded");
    expect(deleted.plan.downloads).toEqual([]);
    expect(remote.commit).toHaveBeenCalledTimes(2);
    const deleteRequest = remote.commit.mock.calls[1]?.[0];
    expect(deleteRequest).toMatchObject({
      idempotencyKey: "sync_delete_missing_local",
    });
    expect(deleteRequest?.puts ?? []).toEqual([]);
    expect(deleteRequest?.deletes).toEqual([
      {
        partitionKey: "builds/all",
        writeMode: { kind: "ifMatch", expectedRev: "rev-1" },
      },
    ]);
    expect(remote.heads.has("builds/all")).toBe(false);
  });

  it("skips cloud deletes when upload choices omit missing local shards", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [buildsPartition({ builds: ["local"] })],
      createIdempotencyKey: () => "sync_skip_delete_initial",
    });

    const skipped = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [],
      explicitCloudDelete: { partitionIds: [] },
      createIdempotencyKey: () => "sync_skip_delete_missing_local",
    });

    expect(skipped.plan.deletes).toHaveLength(1);
    expect(skipped.status).toBe("synced");
    expect(remote.commit).toHaveBeenCalledTimes(1);
    expect(remote.heads.has("builds/all")).toBe(true);
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

  it("downloads an explicitly selected conflict shard without requiring a mixed sync", async () => {
    const remote = new StatefulBackupApi();
    const deviceA = createMemoryMetadataStore("device-a");
    const deviceB = createMemoryMetadataStore("device-b");
    const initial = teamPartition({ teams: ["initial"] });

    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [initial],
      createIdempotencyKey: () => "sync_selected_download_initial",
    });
    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [initial],
    });
    await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceA.store,
      buildPartitions: () => [teamPartition({ teams: ["cloud-edit"] })],
      createIdempotencyKey: () => "sync_selected_download_cloud_edit",
    });

    const conflict = await runCloudSyncOnce({
      apiClient: remote,
      metadataStore: deviceB.store,
      buildPartitions: () => [teamPartition({ teams: ["local-edit"] })],
    });

    expect(conflict.status).toBe("conflict");
    const downloaded = await downloadCloudSyncRestorePlan({
      apiClient: remote,
      syncResult: conflict,
      downloadScope: { partitionIds: ["teams/all"] },
      buildRestorePlan: (partitions) => ({
        teams: partitions.map((partition) => partition.payload),
      }),
    });

    expect(downloaded.heads.map((head) => head.partitionKey)).toEqual([
      "teams/all",
    ]);
    expect(downloaded.restorePlan.teams).toEqual([{ teams: ["cloud-edit"] }]);
    expect(remote.commit).toHaveBeenCalledTimes(2);
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

  it("rejects hash-valid downloaded objects with invalid payload shape", async () => {
    const invalidPartition = buildsPartition({
      activePresetId: null,
      deltas: "not-an-array",
    });
    const envelope = await createEnvelope(invalidPartition, {
      rev: "rev-invalid",
      createdAt: 1,
    });
    const compressedBytes = await gzipJson(envelope);
    const blob = new Blob([compressedBytes], { type: "application/gzip" });
    const head: BackupHead = {
      partitionKey: "builds/all",
      objectId: "obj-invalid",
      rev: "rev-invalid",
      schemaVersion: 1,
      contentHash: envelope.contentHash,
      compressedHash: await sha256Bytes(compressedBytes),
      compressedBytes: compressedBytes.byteLength,
      updatedAt: 1,
      metadata: { schemaVersion: 1, records: [] },
    };

    await expect(
      downloadCloudSyncRestorePlan({
        apiClient: {
          downloadObjects: async () => ({
            manifest: { objects: [head] },
            objects: new Map([[head.objectId, blob]]),
          }),
        },
        syncResult: {
          status: "needs-download",
          plan: {
            uploads: [],
            downloads: [
              {
                action: "download",
                id: "builds/all",
                namespace: "builds",
                partitionKey: "all",
                groupKey: "builds:all",
                conflictPolicy: "explicit-choice",
                reason: "remote-only",
                remoteRev: head.rev,
                contentHash: head.contentHash,
                schemaVersion: head.schemaVersion,
              },
            ],
            deletes: [],
            conflicts: [],
            noops: [],
            skipped: [],
            unsupported: [],
            decisions: [],
          },
          remoteHeads: [head],
          uploaded: [],
          headSetRev: "hset-invalid",
        },
      })
    ).rejects.toThrow(/invalid.*payload|payload.*invalid/i);
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
      quota: backupQuota(),
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
          metadata: put.metadata,
          sourceDeviceId: request.deviceId,
        };
        this.revIndex += 1;
        this.heads.set(put.partitionKey, head);
        this.objects.set(head.objectId, put.bytes);
        changed.push(head);
      }
      for (const del of request.deletes ?? []) {
        this.assertWriteAllowed(del.partitionKey, del.writeMode);
        const current = this.heads.get(del.partitionKey);
        if (!current) continue;
        const deletedAt = this.revIndex;
        this.revIndex += 1;
        this.heads.delete(del.partitionKey);
        changed.push({ ...current, deletedAt });
      }
      this.headSetIndex += 1;
      return {
        idempotencyKey: request.idempotencyKey,
        committedAt: this.revIndex,
        headSetRev: `hset-${this.headSetIndex}`,
        quota: backupQuota(this.headSetIndex - 1),
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

function backupQuota(used = 0) {
  return {
    period: "2026-05",
    limit: 10,
    used,
    remaining: Math.max(0, 10 - used),
    resetsAt: Date.UTC(2026, 5, 1),
  };
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
      removePartitionMeta: (namespace, partitionKey) => {
        const id = getCloudSyncPartitionId(namespace, partitionKey);
        const partitionsById = { ...state.partitionsById };
        const conflictsById = { ...state.conflictsById };
        delete partitionsById[id];
        delete conflictsById[id];
        state = { ...state, partitionsById, conflictsById };
      },
    } satisfies Pick<
      CloudSyncMetadataState,
      | "ensureDeviceId"
      | "getAllPartitionMeta"
      | "markPartitionSyncedFromUpload"
      | "markPartitionSyncedFromDownload"
      | "markPartitionSyncedWithoutTransfer"
      | "markConflict"
      | "removePartitionMeta"
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
      updatedAt?: number;
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
          updatedAt: input.updatedAt ?? syncedAt,
        } satisfies CloudSyncPartitionMeta,
      },
      conflictsById,
    };
  }
}

function buildsPartition(
  payload: unknown,
  options: { isDefaultState?: boolean } = {}
): CloudExportPartition {
  return partition("builds", "all", "explicit-choice", payload, options);
}

function teamPartition(
  payload: unknown,
  options: { isDefaultState?: boolean } = {}
): CloudExportPartition {
  return partition("teams", "all", "explicit-choice", payload, options);
}

function tiersPartition(
  payload: unknown,
  options: { isDefaultState?: boolean } = {}
): CloudExportPartition {
  return partition("tiers", "all", "explicit-choice", payload, options);
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
  payload: unknown,
  options: { isDefaultState?: boolean } = {}
): CloudExportPartition {
  return {
    namespace,
    partitionKey,
    schemaVersion: 1,
    conflictPolicy,
    payload,
    ...(options.isDefaultState ? { isDefaultState: true } : {}),
  };
}

function emptyTiersPayload() {
  const emptyGenericList = {
    id: "list-1",
    title: "",
    author: "",
    description: "",
    tierAssignments: {},
    tierCustomization: {},
  };
  return {
    character: {
      activeTierListId: 1,
      nextId: 2,
      lists: [{ ...emptyGenericList, linkedAccountProfileId: null }],
    },
    weapon: {
      activeTierListId: 1,
      nextId: 2,
      lists: [emptyGenericList],
    },
    artifact: {
      activeTierListId: 1,
      nextId: 2,
      lists: [emptyGenericList],
    },
  };
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
