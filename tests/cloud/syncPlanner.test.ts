import { describe, expect, it } from "vitest";
import {
  getCloudConflictGroupKey,
  planCloudSync,
  planPartitionSync,
} from "@/cloud/syncPlanner";
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
      remoteHeads: [remote("builds", "default", "rev-1", "hash-cloud")],
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
      localPartitions: [local("builds", "default", "hash-local")],
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
      localPartitions: [local("builds", "default", "hash-same")],
      localMeta: [meta("builds", "default", "rev-0", "hash-same")],
      remoteHeads: [remote("builds", "default", "rev-1", "hash-same")],
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
      localPartitions: [local("builds", "default", "hash-old")],
      localMeta: [meta("builds", "default", "rev-1", "hash-old")],
      remoteHeads: [remote("builds", "default", "rev-2", "hash-cloud")],
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
      localPartitions: [local("builds", "default", "hash-local")],
      localMeta: [meta("builds", "default", "rev-1", "hash-old")],
      remoteHeads: [remote("builds", "default", "rev-1", "hash-old")],
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
      localPartitions: [local("builds", "default", "hash-local")],
      localMeta: [],
      remoteHeads: [remote("builds", "default", "rev-1", "hash-cloud")],
    });

    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      action: "conflict",
      reason: "first-sync-local-and-cloud",
    });
  });

  it("requires user choice when explicit-choice data changed on both sides", () => {
    const plan = planCloudSync({
      localPartitions: [local("team.comp", "default", "hash-local")],
      localMeta: [meta("team.comp", "default", "rev-1", "hash-old")],
      remoteHeads: [remote("team.comp", "default", "rev-2", "hash-cloud")],
    });

    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toMatchObject({
      action: "conflict",
      reason: "both-changed",
      groupKey: "team:default",
    });
  });

  it("resolves latest-writer-wins settings by timestamp", () => {
    const newerLocal = planPartitionSync({
      id: "settings.artifactScore/default",
      namespace: "settings.artifactScore",
      partitionKey: "default",
      local: local("settings.artifactScore", "default", "hash-local", 20),
      meta: meta("settings.artifactScore", "default", "rev-1", "hash-old", 10),
      remote: remote(
        "settings.artifactScore",
        "default",
        "rev-2",
        "hash-cloud",
        15
      ),
    });
    const newerRemote = planPartitionSync({
      id: "settings.artifactScore/default",
      namespace: "settings.artifactScore",
      partitionKey: "default",
      local: local("settings.artifactScore", "default", "hash-local", 20),
      meta: meta("settings.artifactScore", "default", "rev-1", "hash-old", 10),
      remote: remote(
        "settings.artifactScore",
        "default",
        "rev-2",
        "hash-cloud",
        25
      ),
    });

    expect(newerLocal).toMatchObject({
      action: "upload",
      reason: "both-changed",
    });
    expect(newerRemote).toMatchObject({
      action: "download",
      reason: "both-changed",
    });
  });

  it("blocks restore when the remote schema is newer than this app supports", () => {
    const plan = planCloudSync({
      localPartitions: [],
      localMeta: [],
      remoteHeads: [remote("builds", "default", "rev-1", "hash-cloud", 1, 2)],
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
          ...local("builds", "default", "hash-local"),
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

  it("groups sharded account partitions by profile id", () => {
    expect(
      getCloudConflictGroupKey("account.artifacts", "600000001:gladiators")
    ).toBe("account:600000001");
    expect(getCloudConflictGroupKey("account.weapons", "600000001")).toBe(
      "account:600000001"
    );
  });
});

function local(
  namespace: CloudNamespace,
  partitionKey: string,
  contentHash: string,
  updatedAt = 1,
  schemaVersion = 1
): CloudLocalPartitionState {
  return {
    namespace,
    partitionKey,
    schemaVersion,
    contentHash,
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
