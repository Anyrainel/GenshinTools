import { beforeEach, describe, expect, it } from "vitest";
import {
  applyCloudRestorePlan,
  buildCloudRestorePlan,
  buildLocalBackupPartitions,
} from "@/cloud/storeAdapters";
import type {
  CloudConflictPolicy,
  CloudExportPartition,
  CloudNamespace,
  CloudPartitionKey,
} from "@/cloud/types";
import type { ArtifactData, Build } from "@/data/types";
import type { AccountProfileId, AccountState } from "@/lib/account-data/types";
import { useAccountStore } from "@/stores/useAccountStore";
import { useAchievementStore } from "@/stores/useAchievementStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import type { ResourceRecState } from "@/stores/useResourceRecStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
import type { ScoreUpSettingsState } from "@/stores/useScoreUpSettingsStore";
import { useScoreUpSettingsStore } from "@/stores/useScoreUpSettingsStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
import type { TriageState } from "@/stores/useTriageStore";
import { useTriageStore } from "@/stores/useTriageStore";

describe("cloud store adapters", () => {
  beforeEach(() => {
    useAccountStore.getState().clearAccounts();
    useFreezeStore.getState().clearAll();
    useTriageStore.setState({ settingsByProfileId: {} });
    useResourceRecStore.setState({ settingsByProfileId: {} });
    useScoreUpSettingsStore.setState({ settingsByProfileId: {} });
    useBuildsStore.getState().clearAll();
    useTeamStore.getState().clearTeams();
    useArtifactScoreStore.getState().resetConfig();
    useTierStore.setState({
      tierLists: {
        1: {
          id: 1,
          tierAssignments: {},
          tierCustomization: {},
          customTitle: "",
          author: "",
          description: "",
          linkedAccountId: null,
        },
      },
      activeTierListId: 1,
      nextId: 2,
    });
  });

  it("only includes restore sections for downloaded namespaces", () => {
    const plan = buildCloudRestorePlan([
      partition("builds", "all", {
        activePresetId: null,
        deltas: [],
        characterWeapons: { amber: ["black_tassel"] },
        artifactScore: { global: { cr: 1 } },
      }),
    ]);

    expect(plan).toMatchObject({
      builds: {
        activePresetId: null,
        deltas: [],
        characterWeapons: { amber: ["black_tassel"] },
      },
      artifactScore: { global: { cr: 1 } },
    });
    expect(plan.accounts).toBeUndefined();
    expect(plan.teams).toBeUndefined();
    expect(plan.characterTierLists).toBeUndefined();
  });

  it("never includes local achievement completion in cloud partitions", () => {
    useAchievementStore.getState().replaceEarnedIds(0, [81001, 82001]);

    const serialized = JSON.stringify(buildLocalBackupPartitions());

    expect(serialized).not.toContain("achievement");
    expect(serialized).not.toContain("81001");
    expect(serialized).not.toContain("82001");
  });

  it("does not replace local achievement completion during cloud restore", () => {
    useAchievementStore.getState().replaceEarnedIds(0, [81001, 82001]);

    applyCloudRestorePlan(
      buildCloudRestorePlan([
        partition("profile.game", "0", {
          accountProfileId: 0,
          characters: [],
          weapons: [],
        }),
      ])
    );

    expect(useAchievementStore.getState().earnedIdsByProfileId[0]).toEqual([
      81001, 82001,
    ]);
  });

  it("applies restore sections through store APIs and refreshes derived state", () => {
    const build = customBuild();
    const result = applyCloudRestorePlan({
      builds: {
        activePresetId: null,
        deltas: [{ kind: "custom", id: build.id, value: build }],
        characterWeapons: { amber: ["black_tassel"] },
        computeOptions: {},
        artifactScore: { global: { flatAtk: 2, flatHp: 30, flatDef: 30 } },
        author: "build author",
        description: "build description",
        updatedAt: 3000,
      },
      artifactScore: { global: { flatAtk: 2, flatHp: 30, flatDef: 30 } },
      teams: {
        activePresetId: null,
        compDeltas: [
          {
            kind: "custom",
            id: "team-1",
            value: {
              id: "team-1",
              name: "Cloud Team",
              slots: [{ charId: "amber" }],
            },
          },
        ],
        configsByTeamId: {},
        author: "team author",
        description: "team description",
        updatedAt: 4000,
      },
      characterTierLists: {
        activeTierListId: 3,
        nextId: 4,
        updatedAt: 5000,
        tierLists: {
          3: {
            id: 3,
            tierAssignments: { amber: { tier: "A", position: 0 } },
            tierCustomization: {},
            customTitle: "Cloud tiers",
            author: "",
            description: "",
            linkedAccountId: null,
          },
        },
      },
    });

    expect(result.appliedSections).toEqual([
      "builds",
      "artifactScore",
      "teams",
      "characterTierLists",
    ]);
    expect(useBuildsStore.getState().resolvedBuildGroups).toMatchObject([
      { characterId: "amber", weapons: ["black_tassel"] },
    ]);
    expect(useArtifactScoreStore.getState().config.global.flatAtk).toBe(2);
    expect(useTeamStore.getState().teamComps[0]).toMatchObject({
      id: "team-1",
      name: "Cloud Team",
    });
    expect(useTierStore.getState().tierLists[3].customTitle).toBe(
      "Cloud tiers"
    );
    expect(useBuildsStore.getState().updatedAt).toBe(3000);
    expect(useTeamStore.getState().updatedAt).toBe(4000);
    expect(useTierStore.getState().updatedAt).toBe(5000);
  });

  it("merges partial account restores without dropping unrelated local profiles", () => {
    useAccountStore.setState({
      accounts: {
        0: accountState(0, "Local Default"),
      },
      activeAccountId: 0,
    });
    useFreezeStore.setState({
      freezesByProfileId: {
        0: {
          frozenTeamLoadouts: {},
          reuseMode: "none",
          frozenArtifactIds: ["local-artifact"],
        },
      },
    });
    useTriageStore.setState({
      settingsByProfileId: {
        0: { local: "triage" },
      } as unknown as TriageState["settingsByProfileId"],
    });
    useResourceRecStore.setState({
      settingsByProfileId: {
        0: { local: "resource" },
      } as unknown as ResourceRecState["settingsByProfileId"],
    });
    useScoreUpSettingsStore.setState({
      settingsByProfileId: {
        0: { local: "score-up" },
      } as unknown as ScoreUpSettingsState["settingsByProfileId"],
    });

    const plan = buildCloudRestorePlan([
      partition("profile.app", "600000001", {
        accountProfileId: 600000001,
        name: "Cloud UID",
        lastImportedAt: 200,
        freeze: {
          frozenTeamLoadouts: {},
          reuseMode: "forceReuse",
          frozenArtifactIds: [],
        },
        triageSettings: { remote: "triage" },
        resourceSettings: { remote: "resource" },
        recommendationSettings: { remote: "score-up" },
      }),
      partition("profile.game", "600000001", {
        accountProfileId: 600000001,
        characters: [],
        weapons: [],
      }),
      partition("profile.artifacts", "600000001", {
        accountProfileId: 600000001,
        artifacts: [],
      }),
    ]);

    applyCloudRestorePlan(plan);

    expect(Object.keys(useAccountStore.getState().accounts).sort()).toEqual([
      "0",
      "600000001",
    ]);
    expect(useAccountStore.getState().accounts[0].name).toBe("Local Default");
    expect(useAccountStore.getState().accounts[600000001].name).toBe(
      "Cloud UID"
    );
    expect(useAccountStore.getState().activeAccountId).toBe(0);
    expect(
      useFreezeStore.getState().freezesByProfileId[0].frozenArtifactIds
    ).toEqual(["local-artifact"]);
    expect(useTriageStore.getState().settingsByProfileId[0]).toEqual({
      local: "triage",
    });
    expect(useResourceRecStore.getState().settingsByProfileId[0]).toEqual({
      local: "resource",
    });
    expect(useScoreUpSettingsStore.getState().settingsByProfileId[0]).toEqual({
      local: "score-up",
    });
  });

  it("applies a profile game shard without replacing local artifacts", () => {
    const localArtifact = artifactData("local-artifact");
    useAccountStore.setState({
      accounts: {
        0: {
          id: 0,
          name: "Local Default",
          lastUpdate: 100,
          data: {
            characters: [
              {
                key: "amber",
                level: 80,
                constellation: 0,
                talent: { auto: 1, skill: 1, burst: 1 },
                artifacts: { flower: localArtifact },
              },
            ],
            extraWeapons: [],
            extraArtifacts: [],
          },
        },
      },
      activeAccountId: 0,
    });

    const plan = buildCloudRestorePlan([
      partition("profile.game", "0", {
        accountProfileId: 0,
        characters: [
          {
            key: "amber",
            level: 90,
            constellation: 1,
            talent: [2, 3, 4],
          },
        ],
        weapons: [],
      }),
    ]);

    applyCloudRestorePlan(plan);

    const restored = useAccountStore.getState().accounts[0];
    expect(restored.data.characters[0]).toMatchObject({
      key: "amber",
      level: 90,
      constellation: 1,
      talent: { auto: 2, skill: 3, burst: 4 },
    });
    expect(restored.data.characters[0].artifacts.flower?.id).toBe(
      "local-artifact"
    );
  });

  it("applies a profile artifact shard without replacing local characters", () => {
    useAccountStore.setState({
      accounts: {
        0: {
          id: 0,
          name: "Local Default",
          lastUpdate: 100,
          data: {
            characters: [
              {
                key: "amber",
                level: 80,
                constellation: 0,
                talent: { auto: 1, skill: 1, burst: 1 },
                artifacts: {},
              },
            ],
            extraWeapons: [],
            extraArtifacts: [],
          },
        },
      },
      activeAccountId: 0,
    });

    const plan = buildCloudRestorePlan([
      partition("profile.artifacts", "0", {
        accountProfileId: 0,
        artifacts: [
          {
            id: "cloud-artifact",
            identity: { kind: "exact", fingerprint: "cloud-artifact" },
            setKey: "gladiators_finale",
            slotKey: "flower",
            level: 20,
            rarity: 5,
            mainStatKey: "hp",
            lock: true,
            substats: {},
            equippedCharacterId: "amber",
          },
        ],
      }),
    ]);

    applyCloudRestorePlan(plan);

    const restored = useAccountStore.getState().accounts[0];
    expect(restored.data.characters[0]).toMatchObject({
      key: "amber",
      level: 80,
      constellation: 0,
    });
    expect(restored.data.characters[0].artifacts.flower?.id).toBe(
      "cloud-artifact"
    );
    expect(restored.data.extraArtifacts).toEqual([]);
  });

  it("creates placeholder characters from cloud item locations when roster is absent", () => {
    const plan = buildCloudRestorePlan([
      partition("profile.game", "0", {
        accountProfileId: 0,
        characters: [],
        weapons: [
          {
            id: "cloud-weapon",
            identity: { kind: "exact", fingerprint: "cloud-weapon" },
            key: "favonius_warbow",
            level: 80,
            refinement: 3,
            lock: false,
            equippedCharacterId: "amber",
          },
        ],
      }),
      partition("profile.artifacts", "0", {
        accountProfileId: 0,
        artifacts: [
          {
            id: "cloud-artifact",
            identity: { kind: "exact", fingerprint: "cloud-artifact" },
            setKey: "gladiators_finale",
            slotKey: "flower",
            level: 20,
            rarity: 5,
            mainStatKey: "hp",
            lock: true,
            substats: {},
            equippedCharacterId: "amber",
          },
        ],
      }),
    ]);

    applyCloudRestorePlan(plan);

    const restored = useAccountStore.getState().accounts[0];
    const amber = restored.data.characters.find(
      (character) => character.key === "amber"
    );
    expect(amber).toMatchObject({
      key: "amber",
      level: 1,
      constellation: 0,
      talent: { auto: 1, skill: 1, burst: 1 },
    });
    expect(amber?.weapon?.key).toBe("favonius_warbow");
    expect(amber?.artifacts.flower?.id).toBe("cloud-artifact");
  });
});

function partition(
  namespace: CloudNamespace,
  partitionKey: CloudPartitionKey,
  payload: unknown,
  conflictPolicy: CloudConflictPolicy = "explicit-choice"
): CloudExportPartition {
  return {
    namespace,
    partitionKey,
    schemaVersion: 1,
    conflictPolicy,
    payload,
  };
}

function customBuild(): Build {
  return {
    id: "cloud-build",
    characterId: "amber",
    visible: true,
    name: "Cloud Build",
    composition: "4pc",
    artifactSet: "gladiators_finale",
    substats: [],
    sandsWeights: [],
    gobletWeights: [],
    circletWeights: [],
    normalizer: 0,
  };
}

function accountState(id: AccountProfileId, name: string): AccountState {
  return {
    id,
    name,
    lastUpdate: 100,
    data: {
      characters: [],
      extraWeapons: [],
      extraArtifacts: [],
    },
  };
}

function artifactData(id: string): ArtifactData {
  return {
    id,
    setKey: "gladiators_finale",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: true,
    substats: {},
  };
}
