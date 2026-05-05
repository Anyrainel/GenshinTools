import { describe, expect, it } from "vitest";
import { planManualBackupAction } from "@/cloud/manualBackupFlow";
import { planCloudSync } from "@/cloud/syncPlanner";
import type {
  CloudLocalPartitionState,
  CloudNamespace,
  CloudRemoteHead,
  LocalCloudPartitionMeta,
} from "@/cloud/types";

describe("manual backup flow planning", () => {
  it("keeps upload directional: safe uploads are automatic and conflicts require upload choice", () => {
    const plan = planCloudSync({
      localPartitions: [
        local("builds", "all", "hash-local"),
        local("teams", "all", "hash-local-team"),
      ],
      localMeta: [meta("teams", "all", "rev-old", "hash-old-team")],
      remoteHeads: [remote("teams", "all", "rev-new", "hash-cloud-team")],
    });

    const manual = planManualBackupAction(plan, "upload");

    expect(manual.automaticPartitionIds).toEqual(["builds/all"]);
    expect(manual.automaticItems).toEqual([
      expect.objectContaining({
        id: "builds/all",
        kind: "upload-local",
        recordKinds: ["builds"],
      }),
    ]);
    expect(manual.choices).toEqual([
      expect.objectContaining({
        id: "teams/all",
        kind: "upload-overwrite-cloud",
        recordKinds: ["teams", "teamConfigs"],
      }),
    ]);
  });

  it("requires explicit upload choice before deleting cloud shards missing locally", () => {
    const plan = planCloudSync({
      localPartitions: [],
      localMeta: [meta("builds", "all", "rev-old", "hash-old")],
      remoteHeads: [remote("builds", "all", "rev-old", "hash-old")],
    });

    const manual = planManualBackupAction(plan, "upload");

    expect(manual.automaticPartitionIds).toEqual([]);
    expect(manual.automaticItems).toEqual([]);
    expect(manual.choices).toEqual([
      expect.objectContaining({
        id: "builds/all",
        kind: "upload-delete-cloud",
        recordKinds: ["builds"],
      }),
    ]);
  });

  it("keeps download directional: safe downloads are automatic and conflicts require download choice", () => {
    const plan = planCloudSync({
      localPartitions: [
        local("profile.game", "600000001", "hash-old"),
        local("teams", "all", "hash-local-team"),
      ],
      localMeta: [
        meta("profile.game", "600000001", "rev-old", "hash-old"),
        meta("teams", "all", "rev-old", "hash-old-team"),
      ],
      remoteHeads: [
        remote("profile.game", "600000001", "rev-new", "hash-cloud"),
        remote("teams", "all", "rev-new", "hash-cloud-team"),
      ],
    });

    const manual = planManualBackupAction(plan, "download");

    expect(manual.automaticPartitionIds).toEqual(["profile.game/600000001"]);
    expect(manual.automaticItems).toEqual([
      expect.objectContaining({
        id: "profile.game/600000001",
        kind: "download-cloud",
        recordKinds: ["characters", "weapons"],
      }),
    ]);
    expect(manual.choices).toEqual([
      expect.objectContaining({
        id: "teams/all",
        kind: "download-overwrite-local",
        recordKinds: ["teams", "teamConfigs"],
      }),
    ]);
  });
});

function local(
  namespace: CloudNamespace,
  partitionKey: string,
  contentHash: string
): CloudLocalPartitionState {
  return {
    namespace,
    partitionKey,
    schemaVersion: 1,
    contentHash,
    updatedAt: 1,
  };
}

function remote(
  namespace: CloudNamespace,
  partitionKey: string,
  rev: string,
  contentHash: string
): CloudRemoteHead {
  return {
    namespace,
    partitionKey,
    rev,
    schemaVersion: 1,
    contentHash,
    updatedAt: 2,
  };
}

function meta(
  namespace: CloudNamespace,
  partitionKey: string,
  lastSeenRev: string,
  lastAppliedHash: string
): LocalCloudPartitionMeta {
  return {
    namespace,
    partitionKey,
    lastSeenRev,
    lastAppliedHash,
    updatedAt: 1,
  };
}
