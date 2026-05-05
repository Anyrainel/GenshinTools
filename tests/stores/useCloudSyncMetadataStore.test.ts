import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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

describe("useCloudSyncMetadataStore", () => {
  it("tracks dirty and synced partition metadata by namespace and partition", () => {
    act(() => {
      useCloudSyncMetadataStore.getState().markPartitionDirty({
        namespace: "builds",
        partitionKey: "all",
        updatedAt: 100,
      });
    });

    const id = getCloudSyncPartitionId("builds", "all");
    expect(useCloudSyncMetadataStore.getState().partitionsById[id]).toEqual({
      id,
      namespace: "builds",
      partitionKey: "all",
      dirty: true,
      updatedAt: 100,
    });

    act(() => {
      useCloudSyncMetadataStore.getState().markPartitionSyncedFromUpload({
        namespace: "builds",
        partitionKey: "all",
        rev: "rev-1",
        contentHash: "sha256:local",
        syncedAt: 200,
        updatedAt: 150,
      });
    });

    expect(useCloudSyncMetadataStore.getState().partitionsById[id]).toEqual({
      id,
      namespace: "builds",
      partitionKey: "all",
      lastSeenRev: "rev-1",
      lastAppliedHash: "sha256:local",
      lastUploadedHash: "sha256:local",
      lastSyncedAt: 200,
      dirty: false,
      updatedAt: 150,
    });
  });

  it("preserves upload hash when a later download becomes the applied head", () => {
    act(() => {
      useCloudSyncMetadataStore.getState().markPartitionSyncedFromUpload({
        namespace: "teams",
        partitionKey: "all",
        rev: "rev-1",
        contentHash: "sha256:local",
        syncedAt: 100,
      });
      useCloudSyncMetadataStore.getState().markPartitionSyncedFromDownload({
        namespace: "teams",
        partitionKey: "all",
        rev: "rev-2",
        contentHash: "sha256:cloud",
        syncedAt: 200,
      });
    });

    const id = getCloudSyncPartitionId("teams", "all");
    expect(
      useCloudSyncMetadataStore.getState().partitionsById[id]
    ).toMatchObject({
      lastSeenRev: "rev-2",
      lastAppliedHash: "sha256:cloud",
      lastUploadedHash: "sha256:local",
      dirty: false,
    });
  });

  it("records and clears conflicts separately from partition metadata", () => {
    const id = getCloudSyncPartitionId("profile.artifacts", "0:gladiators");

    act(() => {
      useCloudSyncMetadataStore.getState().markConflict({
        id,
        namespace: "profile.artifacts",
        partitionKey: "0:gladiators",
        groupKey: "profile:0",
        conflictPolicy: "explicit-choice",
        reason: "both-changed",
        detectedAt: 300,
        localHash: "sha256:local",
        remoteHash: "sha256:cloud",
        remoteRev: "rev-2",
      });
    });

    expect(
      useCloudSyncMetadataStore.getState().conflictsById[id]
    ).toMatchObject({
      groupKey: "profile:0",
      reason: "both-changed",
      remoteRev: "rev-2",
    });

    act(() => {
      useCloudSyncMetadataStore
        .getState()
        .clearConflict("profile.artifacts", "0:gladiators");
    });

    expect(
      useCloudSyncMetadataStore.getState().conflictsById[id]
    ).toBeUndefined();
  });

  it("clears local sync state without changing device identity", () => {
    act(() => {
      useCloudSyncMetadataStore.getState().markPartitionDirty({
        namespace: "builds",
        partitionKey: "all",
      });
      useCloudSyncMetadataStore.getState().clearSyncMetadata();
    });

    expect(useCloudSyncMetadataStore.getState()).toMatchObject({
      deviceId: "device-test",
      partitionsById: {},
      conflictsById: {},
    });
  });
});
