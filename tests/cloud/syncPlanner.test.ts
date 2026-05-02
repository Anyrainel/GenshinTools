import { describe, expect, it } from "vitest";
import { getCloudConflictGroupKey, planCloudSync } from "@/cloud/syncPlanner";
import type {
  CloudLocalPartitionState,
  CloudNamespace,
  CloudRemoteHead,
  LocalCloudPartitionMeta,
} from "@/cloud/types";

describe("cloud sync planner", () => {
  it("downloads a remote-only partition for a new or empty device", () => {
    const plan = planCloudSync({
      localPartitions: [],
      localMeta: [],
      remoteHeads: [remote("builds", "all", "rev-1", "hash-cloud")],
    });

    expect(plan.downloads).toHaveLength(1);
    expect(plan.downloads[0]).toMatchObject({
      action: "download",
      reason: "remote-only",
      remoteRev: "rev-1",
    });
  });

  it("uploads a local-only partition as a first cloud write", () => {
    const plan = planCloudSync({
      localPartitions: [local("builds", "all", "hash-local")],
      localMeta: [],
      remoteHeads: [],
    });

    expect(plan.uploads).toHaveLength(1);
    expect(plan.uploads[0]).toMatchObject({
      action: "upload",
      reason: "local-only",
    });
    expect(plan.uploads[0]).not.toHaveProperty("baseRev");
  });

  it("marks matching local and remote content as synced", () => {
    const plan = planCloudSync({
      localPartitions: [local("builds", "all", "hash-same")],
      localMeta: [meta("builds", "all", "rev-0", "hash-same")],
      remoteHeads: [remote("builds", "all", "rev-1", "hash-same")],
    });

    expect(plan.noops).toHaveLength(1);
    expect(plan.noops[0]).toMatchObject({
      action: "noop",
      reason: "same-content",
      remoteRev: "rev-1",
    });
  });

  it("downloads when local is unchanged and cloud moved ahead", () => {
    const plan = planCloudSync({
      localPartitions: [local("builds", "all", "hash-old")],
      localMeta: [meta("builds", "all", "rev-1", "hash-old")],
      remoteHeads: [remote("builds", "all", "rev-2", "hash-cloud")],
    });

    expect(plan.downloads).toHaveLength(1);
    expect(plan.downloads[0]).toMatchObject({
      action: "download",
      reason: "remote-changed",
      remoteRev: "rev-2",
    });
  });

  it("uploads when local changed and cloud is still at the last seen revision", () => {
    const plan = planCloudSync({
      localPartitions: [local("builds", "all", "hash-local")],
      localMeta: [meta("builds", "all", "rev-1", "hash-old")],
      remoteHeads: [remote("builds", "all", "rev-1", "hash-old")],
    });

    expect(plan.uploads).toHaveLength(1);
    expect(plan.uploads[0]).toMatchObject({
      action: "upload",
      reason: "local-changed",
      baseRev: "rev-1",
    });
  });

  it("requires user choice when a first sync sees different local and cloud data", () => {
    const plan = planCloudSync({
      localPartitions: [local("builds", "all", "hash-local")],
      localMeta: [],
      remoteHeads: [remote("builds", "all", "rev-1", "hash-cloud")],
    });

    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      action: "conflict",
      reason: "first-sync-local-and-cloud",
    });
  });

  it("downloads cloud data on first sync when the local partition is only default app state", () => {
    const plan = planCloudSync({
      localPartitions: [local("builds", "all", "hash-default", 1, 1, true)],
      localMeta: [],
      remoteHeads: [remote("builds", "all", "rev-1", "hash-cloud")],
    });

    expect(plan.downloads).toHaveLength(1);
    expect(plan.downloads[0]).toMatchObject({
      action: "download",
      reason: "remote-only",
      remoteRev: "rev-1",
    });
  });

  it("requires user choice when explicit-choice data changed on both sides", () => {
    const plan = planCloudSync({
      localPartitions: [local("teams", "all", "hash-local")],
      localMeta: [meta("teams", "all", "rev-1", "hash-old")],
      remoteHeads: [remote("teams", "all", "rev-2", "hash-cloud")],
    });

    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      action: "conflict",
      reason: "both-changed",
      groupKey: "teams:all",
    });
  });

  it("blocks restore when the remote schema is newer than this app supports", () => {
    const plan = planCloudSync({
      localPartitions: [],
      localMeta: [],
      remoteHeads: [remote("builds", "all", "rev-1", "hash-cloud", 1, 2)],
    });

    expect(plan.unsupported).toHaveLength(1);
    expect(plan.unsupported[0]).toMatchObject({
      action: "unsupported",
      reason: "newer-cloud-schema",
      remoteSchemaVersion: 2,
      supportedSchemaVersion: 1,
    });
  });

  it("skips partitions marked excluded by the local planning input", () => {
    const plan = planCloudSync({
      localPartitions: [
        {
          ...local("builds", "all", "hash-local"),
          conflictPolicy: "excluded",
        },
      ],
      localMeta: [],
      remoteHeads: [],
    });

    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]).toMatchObject({
      action: "skip",
      reason: "excluded",
    });
  });

  it("groups profile partitions by profile id", () => {
    expect(getCloudConflictGroupKey("profile.app", "600000001")).toBe(
      "profile:600000001"
    );
    expect(getCloudConflictGroupKey("profile.game", "600000001")).toBe(
      "profile:600000001"
    );
    expect(
      getCloudConflictGroupKey("profile.artifacts", "600000001:gladiators")
    ).toBe("profile:600000001");
    expect(getCloudConflictGroupKey("profile.artifacts", "600000001")).toBe(
      "profile:600000001"
    );
  });
});

function local(
  namespace: CloudNamespace,
  partitionKey: string,
  contentHash: string,
  updatedAt = 1,
  schemaVersion = 1,
  isEmpty = false
): CloudLocalPartitionState {
  return {
    namespace,
    partitionKey,
    schemaVersion,
    contentHash,
    ...(isEmpty ? { isEmpty } : {}),
    updatedAt,
  };
}

function remote(
  namespace: CloudNamespace,
  partitionKey: string,
  rev: string,
  contentHash: string,
  updatedAt = 2,
  schemaVersion = 1
): CloudRemoteHead {
  return {
    namespace,
    partitionKey,
    rev,
    schemaVersion,
    contentHash,
    updatedAt,
  };
}

function meta(
  namespace: CloudNamespace,
  partitionKey: string,
  lastSeenRev: string,
  lastAppliedHash: string,
  updatedAt = 1
): LocalCloudPartitionMeta {
  return {
    namespace,
    partitionKey,
    lastSeenRev,
    lastAppliedHash,
    updatedAt,
  };
}
