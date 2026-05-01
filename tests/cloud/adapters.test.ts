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
  type FreezeCloudSnapshot,
  freezeFromCloud,
  freezeToCloud,
} from "@/cloud/adapters/freezeAdapter";
import {
  type SettingsCloudSnapshot,
  settingsFromCloud,
  settingsToCloud,
} from "@/cloud/adapters/settingsAdapter";
import {
  type TeamCloudSnapshot,
  teamFromCloud,
  teamToCloud,
} from "@/cloud/adapters/teamAdapter";
import {
  type CharacterTierListSnapshot,
  characterTiersFromCloud,
  characterTiersToCloud,
  type GenericTierListSnapshot,
  genericTiersFromCloud,
  genericTiersToCloud,
} from "@/cloud/adapters/tierAdapter";
import { createEnvelope, verifyEnvelopePayload } from "@/cloud/payload";
import type { ArtifactData, Build, WeaponData } from "@/data/types";

describe("account cloud adapter", () => {
  it("partitions profiles, source data, equipment, set groups, and disposable weapons", () => {
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
      partitions.filter(
        (partition) => partition.namespace === "account.profile"
      )
    ).toHaveLength(2);
    const weaponPayload = partitions.find(
      (partition) =>
        partition.namespace === "account.weapons" &&
        partition.partitionKey === "0"
    )?.payload as { weapons: { key: string }[] };
    expect(weaponPayload.weapons).toEqual([
      {
        id: expect.any(String),
        identity: expect.any(Object),
        key: "black_tassel",
        level: 1,
        refinement: 1,
        lock: false,
      },
    ]);

    const artifactPayload = partitions.find(
      (partition) =>
        partition.namespace === "account.artifacts" &&
        partition.partitionKey === "0:gladiators_finale"
    )?.payload as {
      artifacts: { id: string; identity: { occurrence: number } }[];
    };
    expect(artifactPayload.artifacts).toHaveLength(2);
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
      author: "author",
      description: "description",
      validationErrors: { "custom-build": ["local only"] },
      activePresetPayload: { local: true },
    } satisfies BuildsCloudSnapshot & Record<string, unknown>;

    const [partition] = buildsToCloud(snapshot);
    expect(partition.payload).not.toHaveProperty("validationErrors");
    expect(partition.payload).not.toHaveProperty("activePresetPayload");
    expect(buildsFromCloud([partition])).toEqual({
      activePresetId: "preset-a",
      deltas: snapshot.deltas,
      hiddenCharacters: { amber: true },
      characterWeapons: { amber: ["black_tassel"] },
      computeOptions: { normalizeFlatStats: true },
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
    expect(
      partitions.find((partition) => partition.namespace === "team.comp")
        ?.payload
    ).not.toHaveProperty("resultsByTeamId");
    expect(teamFromCloud(partitions)).toEqual({
      activePresetId: null,
      compDeltas: snapshot.compDeltas,
      configsByTeamId: snapshot.configsByTeamId,
      author: "author",
      description: "description",
    });
  });

  it("round-trips freeze intent as account-scoped flat loadouts", () => {
    const snapshot: FreezeCloudSnapshot = {
      freezesByProfileId: {
        0: {
          reuseMode: "forceReuse",
          frozenArtifactIds: ["artifact-standalone"],
          frozenTeamLoadouts: {
            "team-1": {
              frozenCharIds: ["amber"],
              artifactIdsByChar: {
                amber: { flower: "artifact-1" },
              },
            },
          },
        },
      },
    };
    const partitions = freezeToCloud(snapshot);
    expect(partitions[0].payload.loadouts).toEqual([
      {
        teamId: "team-1",
        charId: "amber",
        artifactIds: { flower: "artifact-1" },
      },
    ]);
    expect(freezeFromCloud(partitions)).toEqual(snapshot);
  });

  it("round-trips character, weapon, and artifact tier list partitions", () => {
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

    const characterPartitions = characterTiersToCloud(characterSnapshot);
    expect(characterPartitions.map((partition) => partition.namespace)).toEqual(
      ["tier.character.account", "tier.character.custom"]
    );
    expect(characterTiersFromCloud(characterPartitions).tierLists[1]).toEqual(
      characterSnapshot.tierLists[1]
    );

    const weaponPartitions = genericTiersToCloud(
      genericSnapshot,
      "tier.weapon"
    );
    const artifactPartitions = genericTiersToCloud(
      genericSnapshot,
      "tier.artifact"
    );
    expect(
      genericTiersFromCloud(weaponPartitions, "tier.weapon").tierLists[1]
    ).toEqual(genericSnapshot.tierLists[1]);
    expect(
      genericTiersFromCloud(artifactPartitions, "tier.artifact").tierLists[1]
    ).toEqual(genericSnapshot.tierLists[1]);
  });

  it("round-trips settings by global and account-scoped namespaces", () => {
    const snapshot: SettingsCloudSnapshot = {
      artifactScore: { global: { flatAtk: 1, flatHp: 2, flatDef: 3 } },
      triageByProfileId: { 0: { triageMode: "strict" } },
      resourcesByProfileId: { 0: { panelOpen: true } },
    };
    const partitions = settingsToCloud(snapshot);
    expect(settingsFromCloud(partitions)).toEqual(snapshot);
  });

  it("creates verifiable cloud payload envelopes", async () => {
    const [partition] = settingsToCloud({
      artifactScore: { global: { flatAtk: 1, flatHp: 2, flatDef: 3 } },
      triageByProfileId: {},
      resourcesByProfileId: {},
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
