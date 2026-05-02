import { describe, expect, it } from "vitest";
import {
  type AccountCloudSnapshot,
  accountFromCloud,
  accountToCloud,
} from "@/cloud/adapters/accountAdapter";
import {
  type BuildsCloudSnapshot,
  buildsFromCloud,
  buildsToCloud,
} from "@/cloud/adapters/buildsAdapter";
import {
  type TeamCloudSnapshot,
  teamFromCloud,
  teamToCloud,
} from "@/cloud/adapters/teamAdapter";
import {
  type CharacterTierListSnapshot,
  type GenericTierListSnapshot,
  tiersFromCloud,
  tiersToCloud,
} from "@/cloud/adapters/tierAdapter";
import { createEnvelope, verifyEnvelopePayload } from "@/cloud/payload";
import type { ArtifactData, Build, WeaponData } from "@/data/types";

describe("account cloud adapter", () => {
  it("partitions profiles, game data, artifacts, and disposable weapons", () => {
    const equippedWeapon: WeaponData = {
      id: "weapon-1",
      key: "black_tassel",
      level: 1,
      refinement: 1,
      lock: false,
    };
    const disposableWeapon: WeaponData = {
      id: "weapon-2",
      key: "black_tassel",
      level: 1,
      refinement: 1,
      lock: false,
    };
    const firstArtifact = artifact("artifact-1");
    const duplicateArtifact = artifact("artifact-2");
    const snapshot: AccountCloudSnapshot = {
      activeAccountId: 0,
      freezesByProfileId: {
        0: {
          reuseMode: "forceReuse",
          frozenArtifactIds: ["artifact-1"],
          frozenTeamLoadouts: {},
        },
      },
      triageByProfileId: { 0: { triageMode: "strict" } },
      resourcesByProfileId: { 0: { panelOpen: true } },
      recommendationsByProfileId: { 0: { allowPoolArtifactSteals: false } },
      accounts: {
        0: {
          id: 0,
          name: "Default",
          lastUpdate: 100,
          data: {
            characters: [
              {
                key: "amber",
                level: 80,
                constellation: 2,
                talent: { auto: 6, skill: 7, burst: 8 },
                weapon: equippedWeapon,
                artifacts: { flower: firstArtifact },
              },
            ],
            extraWeapons: [disposableWeapon],
            extraArtifacts: [duplicateArtifact],
          },
        },
        600000001: {
          id: 600000001,
          name: "UID",
          lastUpdate: 200,
          data: { characters: [], extraWeapons: [], extraArtifacts: [] },
        },
      },
    };

    const partitions = accountToCloud(snapshot);

    expect(
      partitions.map((partition) => [
        partition.namespace,
        partition.partitionKey,
      ])
    ).toEqual([
      ["profile.app", "0"],
      ["profile.game", "0"],
      ["profile.artifacts", "0"],
      ["profile.app", "600000001"],
      ["profile.game", "600000001"],
      ["profile.artifacts", "600000001"],
    ]);
    expect(
      partitions.filter((partition) => partition.namespace === "profile.app")
    ).toHaveLength(2);
    const weaponPayload = partitions.find(
      (partition) =>
        partition.namespace === "profile.game" && partition.partitionKey === "0"
    )?.payload as { weapons: { key: string }[] };
    expect(weaponPayload.weapons).toEqual([
      {
        id: expect.any(String),
        identity: expect.any(Object),
        key: "black_tassel",
        level: 1,
        refinement: 1,
        lock: false,
        equippedCharacterId: "amber",
      },
    ]);

    const artifactPayload = partitions.find(
      (partition) =>
        partition.namespace === "profile.artifacts" &&
        partition.partitionKey === "0"
    )?.payload as {
      artifacts: {
        id: string;
        identity: { occurrence: number };
        equippedCharacterId?: string;
      }[];
    };
    expect(artifactPayload.artifacts).toHaveLength(2);
    expect(artifactPayload.artifacts[0].equippedCharacterId).toBe("amber");
    expect(new Set(artifactPayload.artifacts.map((item) => item.id)).size).toBe(
      2
    );
    expect(
      artifactPayload.artifacts.map((item) => item.identity.occurrence)
    ).toEqual([0, 1]);

    const restored = accountFromCloud(partitions);
    expect(restored.accounts[0].name).toBe("Default");
    expect(restored.accounts[0].data.characters[0].weapon?.key).toBe(
      "black_tassel"
    );
    expect(restored.accounts[0].data.extraWeapons).toEqual([]);
    expect(restored.accounts[0].data.extraArtifacts).toHaveLength(1);
    expect(restored.accounts[600000001].name).toBe("UID");
    expect(restored.freezesByProfileId[0].frozenArtifactIds).toEqual([
      artifactPayload.artifacts[0].id,
    ]);
    expect(restored.triageByProfileId[0]).toEqual({ triageMode: "strict" });
    expect(restored.resourcesByProfileId[0]).toEqual({ panelOpen: true });
    expect(restored.recommendationsByProfileId[0]).toEqual({
      allowPoolArtifactSteals: false,
    });
  });
});

describe("cloud source adapters", () => {
  it("round-trips builds without derived runtime or validation fields", () => {
    const build: Build = {
      id: "custom-build",
      characterId: "amber",
      visible: true,
      name: "Amber",
      composition: "4pc",
      artifactSet: "gladiators_finale",
      substats: [],
      sandsWeights: [],
      gobletWeights: [],
      circletWeights: [],
      normalizer: 0,
    };
    const snapshot = {
      activePresetId: "preset-a",
      deltas: [{ kind: "custom", id: build.id, value: build }],
      hiddenCharacters: { amber: true },
      characterWeapons: { amber: ["black_tassel"] },
      computeOptions: { normalizeFlatStats: true },
      artifactScore: { global: { flatAtk: 1, flatHp: 2, flatDef: 3 } },
      author: "author",
      description: "description",
      validationErrors: { "custom-build": ["local only"] },
      activePresetPayload: { local: true },
    } satisfies BuildsCloudSnapshot & Record<string, unknown>;

    const [partition] = buildsToCloud(snapshot);
    expect(partition).toMatchObject({
      namespace: "builds",
      partitionKey: "all",
      schemaVersion: 1,
      conflictPolicy: "explicit-choice",
    });
    expect(partition.payload).not.toHaveProperty("validationErrors");
    expect(partition.payload).not.toHaveProperty("activePresetPayload");
    expect(buildsFromCloud([partition])).toEqual({
      activePresetId: "preset-a",
      deltas: snapshot.deltas,
      hiddenCharacters: { amber: true },
      characterWeapons: { amber: ["black_tassel"] },
      computeOptions: { normalizeFlatStats: true },
      artifactScore: snapshot.artifactScore,
      author: "author",
      description: "description",
    });
  });

  it("round-trips teams without result cache fields", () => {
    const snapshot = {
      activePresetId: null,
      compDeltas: [
        {
          kind: "custom",
          id: "team-1",
          value: {
            id: "team-1",
            name: "Team",
            slots: [
              {
                charId: "amber",
                weaponId: "black_tassel",
                artifactSet: { type: "4pc", setId: "gladiators_finale" },
              },
            ],
            reactions: ["vaporize"],
          },
        },
      ],
      configsByTeamId: {
        "team-1": {
          combatOptions: { aura: "pyro" },
          charConfigs: { amber: { minEr: 120 } },
        },
      },
      author: "author",
      description: "description",
      resultsByTeamId: { "team-1": { optimizationResult: {} } },
    } satisfies TeamCloudSnapshot & Record<string, unknown>;

    const partitions = teamToCloud(snapshot);
    expect(partitions).toHaveLength(1);
    expect(partitions[0]).toMatchObject({
      namespace: "teams",
      partitionKey: "all",
    });
    expect(partitions[0].payload).not.toHaveProperty("resultsByTeamId");
    expect(teamFromCloud(partitions)).toEqual({
      activePresetId: null,
      compDeltas: snapshot.compDeltas,
      configsByTeamId: snapshot.configsByTeamId,
      author: "author",
      description: "description",
    });
  });

  it("round-trips combined character, weapon, and artifact tier lists", () => {
    const characterSnapshot: CharacterTierListSnapshot = {
      activeTierListId: 1,
      nextId: 3,
      tierLists: {
        1: tierList(1, { linkedAccountId: 0 }),
        2: tierList(2, { linkedAccountId: null }),
      },
    };
    const genericSnapshot: GenericTierListSnapshot = {
      activeTierListId: 1,
      nextId: 2,
      tierLists: { 1: tierList(1) },
    };

    const partitions = tiersToCloud({
      character: characterSnapshot,
      weapon: genericSnapshot,
      artifact: genericSnapshot,
    });
    expect(partitions).toHaveLength(1);
    expect(partitions[0]).toMatchObject({
      namespace: "tiers",
      partitionKey: "all",
    });
    expect(tiersFromCloud(partitions).character.tierLists[1]).toEqual(
      characterSnapshot.tierLists[1]
    );
    expect(tiersFromCloud(partitions).weapon.tierLists[1]).toEqual(
      genericSnapshot.tierLists[1]
    );
    expect(tiersFromCloud(partitions).artifact.tierLists[1]).toEqual(
      genericSnapshot.tierLists[1]
    );
  });

  it("creates verifiable cloud payload envelopes", async () => {
    const [partition] = buildsToCloud({
      activePresetId: null,
      deltas: [],
      hiddenCharacters: {},
      characterWeapons: {},
      computeOptions: {},
      artifactScore: { global: { flatAtk: 1, flatHp: 2, flatDef: 3 } },
      author: "",
      description: "",
    });
    const envelope = await createEnvelope(partition, {
      rev: "rev-test",
      createdAt: 1,
    });
    expect(envelope.contentHash).toMatch(/^sha256:/);
    await expect(verifyEnvelopePayload(envelope)).resolves.toBe(true);
  });
});

function artifact(id: string): ArtifactData {
  return {
    id,
    setKey: "gladiators_finale",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: { cr: 3.9, cd: 7.8 },
  };
}

function tierList(id: number): GenericTierListSnapshot["tierLists"][number];
function tierList<TExtra extends object>(
  id: number,
  extra: TExtra
): GenericTierListSnapshot["tierLists"][number] & TExtra;
function tierList<TExtra extends object>(id: number, extra?: TExtra) {
  return {
    id,
    tierAssignments: {
      amber: { tier: "A" as const, position: 0 },
    },
    tierCustomization: {
      A: { displayName: "A", hidden: false },
    },
    customTitle: `List ${id}`,
    author: "author",
    description: "description",
    ...(extra ?? {}),
  };
}
