import { describe, expect, it, vi } from "vitest";
import { tiersFromCloud, tiersToCloud } from "@/cloud/adapters/tierAdapter";
import type { BackupHead } from "@/cloud/apiClient";
import {
  buildBackupHeadMetadataByPartition,
  buildLocalBackupMetadataRows,
  type CloudBackupMetadataSnapshot,
  fetchCloudBackupMetadata,
} from "@/cloud/backupMetadata";
import type { CloudExportPartition } from "@/cloud/types";
import {
  formatBackupCount,
  formatOptionalBackupDate,
} from "@/components/account/cloudBackupLabels";

describe("backup metadata", () => {
  it("summarizes local backup contents into head metadata records", () => {
    const partitions = createPartitions();
    const metadataByPartition = buildBackupHeadMetadataByPartition(partitions);

    expect(metadataByPartition.get("profile.game/100")?.records).toEqual([
      { kind: "characters", count: 2, profileId: "100", updatedAt: 1234 },
      { kind: "weapons", count: 1, profileId: "100", updatedAt: 1234 },
    ]);
    expect(metadataByPartition.get("teams/all")?.records).toEqual([
      { kind: "teams", count: 1, updatedAt: 4321 },
      { kind: "teamConfigs", count: 2, updatedAt: 4321 },
    ]);

    const rows = buildLocalBackupMetadataRows(partitions, []);
    expect(rows.find((row) => row.id === "characters/100")).toMatchObject({
      kind: "characters",
      profileId: "100",
      local: {
        hasRecord: true,
        count: 2,
        updatedAt: 1234,
        partitionCount: 1,
      },
    });
    expect(rows.find((row) => row.id === "weapons/100")).toMatchObject({
      kind: "weapons",
      profileId: "100",
      local: {
        hasRecord: true,
        count: 1,
        updatedAt: 1234,
        partitionCount: 1,
      },
    });
    expect(rows.find((row) => row.id === "teamConfigs")?.local.count).toBe(2);
    expect(rows.find((row) => row.id === "builds")?.local).toEqual({
      hasRecord: false,
      count: 0,
      partitionCount: 0,
    });
  });

  it("keeps profile metadata rows separate by profile id", () => {
    const rows = buildLocalBackupMetadataRows(
      [
        ...createPartitions(),
        {
          namespace: "profile.game",
          partitionKey: "200",
          schemaVersion: 1,
          conflictPolicy: "profile-import-wins",
          payload: {
            accountProfileId: 200,
            characters: [{ key: "c" }],
            weapons: [],
          },
        },
      ],
      []
    );

    expect(rows.find((row) => row.id === "characters/100")?.local).toEqual({
      hasRecord: true,
      count: 2,
      updatedAt: 1234,
      partitionCount: 1,
    });
    expect(rows.find((row) => row.id === "characters/200")?.local).toEqual({
      hasRecord: true,
      count: 1,
      partitionCount: 1,
    });
    expect(rows.find((row) => row.id === "weapons/200")?.local).toEqual({
      hasRecord: true,
      count: 0,
      partitionCount: 1,
    });
  });

  it("counts explicit build order overrides as build changes", () => {
    const rows = buildLocalBackupMetadataRows(
      [
        {
          namespace: "builds",
          partitionKey: "all",
          schemaVersion: 1,
          conflictPolicy: "explicit-choice",
          payload: {
            updatedAt: 2468,
            deltas: [
              { kind: "preset", id: "preset-a", displayIndex: 0 },
              { kind: "preset", id: "preset-b", displayIndex: 1 },
              { kind: "preset", id: "preset-c", deleted: true },
              {
                kind: "custom",
                id: "custom-a",
                value: { id: "custom-a", characterId: "char-a" },
              },
            ],
          },
        },
      ],
      []
    );

    expect(rows.find((row) => row.id === "builds")?.local).toEqual({
      hasRecord: true,
      count: 4,
      updatedAt: 2468,
      partitionCount: 1,
    });
  });

  it("does not count untouched default tier-list instances", () => {
    const rows = buildLocalBackupMetadataRows(
      [
        {
          namespace: "tiers",
          partitionKey: "all",
          schemaVersion: 1,
          conflictPolicy: "explicit-choice",
          payload: {
            character: {
              activeTierListId: 1,
              nextId: 2,
              lists: [
                {
                  id: "list-1",
                  linkedAccountProfileId: null,
                  title: "",
                  author: "",
                  description: "",
                  tierAssignments: {},
                  tierCustomization: {},
                },
              ],
            },
            weapon: {
              activeTierListId: 1,
              nextId: 2,
              lists: [
                {
                  id: "list-1",
                  title: "",
                  author: "",
                  description: "",
                  tierAssignments: {},
                  tierCustomization: {},
                },
              ],
            },
            artifact: {
              activeTierListId: 1,
              nextId: 2,
              lists: [
                {
                  id: "list-1",
                  title: "Artifact notes",
                  author: "",
                  description: "",
                  tierAssignments: {},
                  tierCustomization: {},
                },
              ],
            },
          },
        },
      ],
      []
    );

    expect(rows.find((row) => row.id === "tiers")?.local).toEqual({
      hasRecord: true,
      count: 1,
      partitionCount: 1,
    });
  });

  it("keeps tier metadata count stable after cloud restore round-trip", () => {
    const [cloudPartition] = tiersToCloud({
      character: {
        activeTierListId: 1,
        nextId: 3,
        updatedAt: 5000,
        tierLists: {
          1: {
            id: 1,
            linkedAccountId: 0,
            customTitle: "",
            author: "",
            description: "",
            tierAssignments: {},
            tierCustomization: {},
          },
          2: {
            id: 2,
            linkedAccountId: null,
            customTitle: "Characters",
            author: "",
            description: "",
            tierAssignments: {},
            tierCustomization: {},
          },
        },
      },
      weapon: {
        activeTierListId: 1,
        nextId: 2,
        updatedAt: 5100,
        tierLists: {
          1: {
            id: 1,
            customTitle: "",
            author: "weapon author",
            description: "",
            tierAssignments: {},
            tierCustomization: {},
          },
        },
      },
      artifact: {
        activeTierListId: 1,
        nextId: 2,
        updatedAt: 5200,
        tierLists: {
          1: {
            id: 1,
            customTitle: "",
            author: "",
            description: "",
            tierAssignments: { gladiators_finale: { tier: "A", position: 0 } },
            tierCustomization: {},
          },
        },
      },
    });
    const restored = tiersFromCloud([cloudPartition]);
    const [localPartition] = tiersToCloud(restored);

    const cloudMetadata = buildBackupHeadMetadataByPartition([
      cloudPartition,
    ]).get("tiers/all");
    const localMetadata = buildBackupHeadMetadataByPartition([
      localPartition,
    ]).get("tiers/all");
    const rows = buildLocalBackupMetadataRows([localPartition], []);

    expect(cloudMetadata).toEqual(localMetadata);
    expect(rows.find((row) => row.id === "tiers")?.local.count).toBe(4);
  });

  it("reads cloud metadata from backup heads without downloading objects", async () => {
    const head: BackupHead = {
      partitionKey: "builds/all",
      objectId: "obj_1",
      rev: "rev_1",
      schemaVersion: 1,
      contentHash: "sha256:a",
      compressedHash: "sha256:b",
      compressedBytes: 10,
      updatedAt: 3000,
      metadata: {
        schemaVersion: 1,
        records: [{ kind: "builds", count: 4, updatedAt: 2500 }],
      },
    };
    const snapshot = await fetchCloudBackupMetadata({
      getHead: async () => ({
        serverTime: 3100,
        changed: true,
        headSetRev: "hset_1",
        capabilities: {
          apiVersion: 1,
          commitContentTypes: ["multipart/form-data"],
          maxObjectsPerCommit: 10,
          maxCompressedBytesPerCommit: 10,
          maxCompressedBytesPerObject: 10,
        },
        quota: backupQuota(),
        heads: [head],
      }),
    });

    expect(snapshot.quota).toEqual(backupQuota());
    expect(snapshot.rows.find((row) => row.id === "builds")?.cloud).toEqual({
      hasRecord: true,
      count: 4,
      updatedAt: 2500,
      partitionCount: 1,
    });
  });

  it("reuses cached metadata rows when the cloud head revision is unchanged", async () => {
    const quota = backupQuota();
    const updatedQuota = { ...quota, used: 4, remaining: 6 };
    const previous = {
      schemaVersion: 5,
      checkedAt: 1000,
      headSetRev: "hset_1",
      quota,
      rows: [
        {
          id: "builds",
          kind: "builds",
          local: { hasRecord: false, count: 0, partitionCount: 0 },
          cloud: {
            hasRecord: true,
            count: 4,
            updatedAt: 2500,
            partitionCount: 1,
          },
        },
      ],
    } satisfies CloudBackupMetadataSnapshot;
    const getHead = vi.fn(async () => ({
      serverTime: 3100,
      changed: false,
      headSetRev: "hset_1",
      capabilities: {
        apiVersion: 1 as const,
        commitContentTypes: ["multipart/form-data"] as ["multipart/form-data"],
        maxObjectsPerCommit: 10,
        maxCompressedBytesPerCommit: 10,
        maxCompressedBytesPerObject: 10,
      },
      quota: updatedQuota,
      heads: [],
    }));

    const snapshot = await fetchCloudBackupMetadata({ getHead }, previous);

    expect(getHead).toHaveBeenCalledWith({ headSetRev: "hset_1" });
    expect(snapshot.rows).toEqual(previous.rows);
    expect(snapshot.quota).toEqual(updatedQuota);
    expect(snapshot.checkedAt).toBeGreaterThanOrEqual(previous.checkedAt);
  });

  it("formats present empty cloud heads separately from absent heads", async () => {
    const snapshot = await fetchCloudBackupMetadata({
      getHead: async () => ({
        serverTime: 3100,
        changed: true,
        headSetRev: "hset_1",
        capabilities: {
          apiVersion: 1,
          commitContentTypes: ["multipart/form-data"],
          maxObjectsPerCommit: 10,
          maxCompressedBytesPerCommit: 10,
          maxCompressedBytesPerObject: 10,
        },
        quota: backupQuota(),
        heads: [
          {
            partitionKey: "tiers/all",
            objectId: "obj_1",
            rev: "rev_1",
            schemaVersion: 1,
            contentHash: "sha256:a",
            compressedHash: "sha256:b",
            compressedBytes: 10,
            updatedAt: 3000,
            metadata: {
              schemaVersion: 1,
              records: [{ kind: "tiers", count: 0 }],
            },
          },
        ],
      }),
    });
    const t = {
      ui: (key: string) => {
        if (key === "accountSystem.noRecord") return "No record";
        if (key === "accountSystem.missingUpdateTime") return "No update time";
        return key;
      },
    } as Parameters<typeof formatOptionalBackupDate>[1];

    const tierCloud = snapshot.rows.find((row) => row.id === "tiers")?.cloud;
    const buildsCloud = snapshot.rows.find((row) => row.id === "builds")?.cloud;
    expect(tierCloud).toEqual({
      hasRecord: true,
      count: 0,
      partitionCount: 1,
    });
    expect(formatBackupCount(tierCloud!)).toBe("0");
    expect(formatOptionalBackupDate(tierCloud!, t)).toBe("No update time");
    expect(buildsCloud).toEqual({
      hasRecord: false,
      count: 0,
      partitionCount: 0,
    });
    expect(formatBackupCount(buildsCloud!)).toBe("-");
    expect(formatOptionalBackupDate(buildsCloud!, t)).toBe("No record");
  });

  it("does not display backup upload time as data update time", async () => {
    const snapshot = await fetchCloudBackupMetadata({
      getHead: async () => ({
        serverTime: 3100,
        changed: true,
        headSetRev: "hset_1",
        capabilities: {
          apiVersion: 1,
          commitContentTypes: ["multipart/form-data"],
          maxObjectsPerCommit: 10,
          maxCompressedBytesPerCommit: 10,
          maxCompressedBytesPerObject: 10,
        },
        quota: backupQuota(),
        heads: [
          {
            partitionKey: "teams/all",
            objectId: "obj_1",
            rev: "rev_1",
            schemaVersion: 1,
            contentHash: "sha256:a",
            compressedHash: "sha256:b",
            compressedBytes: 10,
            updatedAt: 3000,
            metadata: {
              schemaVersion: 1,
              records: [{ kind: "teams", count: 1 }],
            },
          },
        ],
      }),
    });

    expect(snapshot.rows.find((row) => row.id === "teams")?.cloud).toEqual({
      hasRecord: true,
      count: 1,
      partitionCount: 1,
    });
  });
});

function createPartitions(): CloudExportPartition[] {
  return [
    {
      namespace: "profile.app",
      partitionKey: "100",
      schemaVersion: 1,
      conflictPolicy: "profile-import-wins",
      payload: {
        accountProfileId: 100,
        name: "Main",
        lastImportedAt: 1234,
        freeze: {
          frozenTeamLoadouts: { teamA: {} },
          reuseMode: "none",
          frozenArtifactIds: [],
        },
        triageSettings: {},
        resourceSettings: {},
      },
    },
    {
      namespace: "profile.game",
      partitionKey: "100",
      schemaVersion: 1,
      conflictPolicy: "profile-import-wins",
      payload: {
        accountProfileId: 100,
        characters: [{ key: "a" }, { key: "b" }],
        weapons: [{ key: "weapon" }],
      },
    },
    {
      namespace: "profile.artifacts",
      partitionKey: "100",
      schemaVersion: 1,
      conflictPolicy: "profile-import-wins",
      payload: {
        accountProfileId: 100,
        artifacts: [{ id: "artifact" }],
      },
    },
    {
      namespace: "teams",
      partitionKey: "all",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
      payload: {
        updatedAt: 4321,
        compDeltas: [
          {
            kind: "custom",
            id: "delta",
            value: { id: "delta", name: "Team", slots: [], reactions: [] },
          },
        ],
        configsByTeamId: { first: {}, second: {} },
      },
    },
  ];
}

function backupQuota() {
  return {
    period: "2026-05",
    limit: 10,
    used: 3,
    remaining: 7,
    resetsAt: Date.UTC(2026, 5, 1),
  };
}
