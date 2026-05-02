import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BackupCommitRequest,
  BackupCommitResponse,
  BackupHead,
  BackupHeadResponse,
} from "@/cloud/apiClient";
import { getContentHash } from "@/cloud/payload";
import {
  applyCloudRestoreAndMarkSynced,
  runCloudSyncOnce,
} from "@/cloud/syncClient";
import type { CloudExportPartition, CloudPartitionId } from "@/cloud/types";
import {
  type CloudSyncMetadataState,
  getCloudSyncPartitionId,
  useCloudSyncMetadataStore,
} from "@/stores/useCloudSyncMetadataStore";

const baseState: Pick<
  CloudSyncMetadataState,
  "deviceId" | "partitionsById" | "conflictsById"
> = {
  deviceId: "device-test",
  partitionsById: {},
  conflictsById: {},
};

beforeEach(() => {
  useCloudSyncMetadataStore.setState(baseState);
});

describe("cloud sync client", () => {
  it("uploads a local-only partition with ifAbsent and records the committed head", async () => {
    const partition = buildsPartition({ builds: ["local"] });
    const api = fakeApi({
      heads: [],
      commitResponse: (request) => commitFromRequest(request, 100),
    });

    const result = await runCloudSyncOnce({
      apiClient: api,
      buildPartitions: () => [partition],
      createIdempotencyKey: () => "sync_test_upload",
      now: () => 50,
    });

    expect(result.status).toBe("uploaded");
    expect(api.commit).toHaveBeenCalledTimes(1);
    const request = api.commit.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      idempotencyKey: "sync_test_upload",
      deviceId: "device-test",
    });
    expect(request?.puts?.[0]).toMatchObject({
      partitionKey: "builds/all",
      writeMode: { kind: "ifAbsent" },
    });

    const id = getCloudSyncPartitionId("builds", "all");
    expect(useCloudSyncMetadataStore.getState().partitionsById[id]).toEqual({
      id,
      namespace: "builds",
      partitionKey: "all",
      lastSeenRev: "rev-0",
      lastAppliedHash: request?.puts?.[0]?.contentHash,
      lastUploadedHash: request?.puts?.[0]?.contentHash,
      lastSyncedAt: 100,
      dirty: false,
      updatedAt: 100,
    });
  });

  it("marks matching local and remote content synced without committing", async () => {
    const partition = buildsPartition({ builds: ["same"] });
    const contentHash = await getContentHash(partition.payload);
    const api = fakeApi({
      heads: [remoteHead("builds/all", "rev-cloud", contentHash)],
    });

    const result = await runCloudSyncOnce({
      apiClient: api,
      buildPartitions: () => [partition],
      now: () => 200,
    });

    expect(result.status).toBe("synced");
    expect(api.commit).not.toHaveBeenCalled();

    const id = getCloudSyncPartitionId("builds", "all");
    expect(useCloudSyncMetadataStore.getState().partitionsById[id]).toEqual({
      id,
      namespace: "builds",
      partitionKey: "all",
      lastSeenRev: "rev-cloud",
      lastAppliedHash: contentHash,
      lastSyncedAt: 200,
      dirty: false,
      updatedAt: 200,
    });
  });

  it("uses ifMatch when local changed from the last seen cloud revision", async () => {
    const oldPayload = { builds: ["old"] };
    const oldHash = await getContentHash(oldPayload);
    useCloudSyncMetadataStore.getState().markPartitionSyncedFromUpload({
      namespace: "builds",
      partitionKey: "all",
      rev: "rev-old",
      contentHash: oldHash,
      syncedAt: 100,
    });
    const partition = buildsPartition({ builds: ["new"] });
    const api = fakeApi({
      heads: [remoteHead("builds/all", "rev-old", oldHash)],
      commitResponse: (request) => commitFromRequest(request, 300),
    });

    await runCloudSyncOnce({
      apiClient: api,
      buildPartitions: () => [partition],
      createIdempotencyKey: () => "sync_test_ifmatch",
    });

    expect(api.commit.mock.calls[0]?.[0].puts?.[0]?.writeMode).toEqual({
      kind: "ifMatch",
      expectedRev: "rev-old",
    });
  });

  it("records conflicts without uploading when local and cloud both changed", async () => {
    const oldPayload = { teams: ["old"] };
    const oldHash = await getContentHash(oldPayload);
    useCloudSyncMetadataStore.getState().markPartitionSyncedFromUpload({
      namespace: "teams",
      partitionKey: "all",
      rev: "rev-old",
      contentHash: oldHash,
      syncedAt: 100,
    });
    const partition = teamPartition({ teams: ["local"] });
    const remoteHash = await getContentHash({ teams: ["cloud"] });
    const api = fakeApi({
      heads: [remoteHead("teams/all", "rev-cloud", remoteHash)],
    });

    const result = await runCloudSyncOnce({
      apiClient: api,
      buildPartitions: () => [partition],
      now: () => 400,
    });

    expect(result.status).toBe("conflict");
    expect(api.commit).not.toHaveBeenCalled();

    const id = getCloudSyncPartitionId("teams", "all");
    expect(
      useCloudSyncMetadataStore.getState().conflictsById[id]
    ).toMatchObject({
      id,
      namespace: "teams",
      partitionKey: "all",
      groupKey: "teams:all",
      conflictPolicy: "explicit-choice",
      reason: "both-changed",
      remoteHash,
      remoteRev: "rev-cloud",
      detectedAt: 400,
    });
  });

  it("blocks newer cloud schemas before download or upload", async () => {
    const api = fakeApi({
      heads: [
        {
          ...remoteHead("builds/all", "rev-newer", await getContentHash({})),
          schemaVersion: 2,
        },
      ],
    });

    const result = await runCloudSyncOnce({
      apiClient: api,
      buildPartitions: () => [],
    });

    expect(result.status).toBe("unsupported");
    expect(result.plan.unsupported).toHaveLength(1);
    expect(api.commit).not.toHaveBeenCalled();
    expect(useCloudSyncMetadataStore.getState().partitionsById).toEqual({});
  });

  it("does not mark upload metadata when commit fails", async () => {
    const partition = buildsPartition({ builds: ["local"] });
    const api = fakeApi({
      heads: [],
      commitError: new Error("network failed"),
    });

    await expect(
      runCloudSyncOnce({
        apiClient: api,
        buildPartitions: () => [partition],
      })
    ).rejects.toThrow("network failed");

    expect(useCloudSyncMetadataStore.getState().partitionsById).toEqual({});
  });

  it("does not mark download metadata when restore apply fails", async () => {
    const head = remoteHead(
      "builds/all",
      "rev-cloud",
      await getContentHash({})
    );

    expect(() =>
      applyCloudRestoreAndMarkSynced({
        downloaded: {
          heads: [head],
          partitions: [],
          restorePlan: {},
        },
        applyRestorePlan: () => {
          throw new Error("apply failed");
        },
      })
    ).toThrow("apply failed");

    expect(useCloudSyncMetadataStore.getState().partitionsById).toEqual({});
  });
});

function fakeApi(options: {
  heads: BackupHead[];
  commitResponse?: (request: BackupCommitRequest) => BackupCommitResponse;
  commitError?: Error;
}) {
  return {
    getHead: vi.fn(
      async (): Promise<BackupHeadResponse> => ({
        serverTime: 1,
        changed: true,
        headSetRev: "hset-test",
        capabilities: {
          apiVersion: 1,
          commitContentTypes: ["multipart/form-data"],
          maxObjectsPerCommit: 10,
          maxCompressedBytesPerCommit: 5_000_000,
          maxCompressedBytesPerObject: 2_000_000,
        },
        heads: options.heads,
      })
    ),
    commit: vi.fn(async (request: BackupCommitRequest) => {
      if (options.commitError) throw options.commitError;
      return options.commitResponse?.(request) ?? commitFromRequest(request, 1);
    }),
  };
}

function commitFromRequest(
  request: BackupCommitRequest,
  committedAt: number
): BackupCommitResponse {
  return {
    idempotencyKey: request.idempotencyKey,
    committedAt,
    headSetRev: "hset-committed",
    heads:
      request.puts?.map((put, index) => ({
        partitionKey: put.partitionKey,
        objectId: `obj-${index}`,
        rev: `rev-${index}`,
        schemaVersion: put.schemaVersion,
        contentHash: put.contentHash,
        compressedHash: put.compressedHash,
        compressedBytes: put.compressedBytes ?? put.bytes.size,
        updatedAt: committedAt,
      })) ?? [],
  };
}

function buildsPartition(payload: unknown): CloudExportPartition {
  return {
    namespace: "builds",
    partitionKey: "all",
    schemaVersion: 1,
    conflictPolicy: "explicit-choice",
    payload,
  };
}

function teamPartition(payload: unknown): CloudExportPartition {
  return {
    namespace: "teams",
    partitionKey: "all",
    schemaVersion: 1,
    conflictPolicy: "explicit-choice",
    payload,
  };
}

function remoteHead(
  partitionKey: CloudPartitionId,
  rev: string,
  contentHash: string
): BackupHead {
  return {
    partitionKey,
    objectId: "obj-cloud",
    rev,
    schemaVersion: 1,
    contentHash,
    compressedHash: "sha256:compressed",
    compressedBytes: 10,
    updatedAt: 2,
  };
}
