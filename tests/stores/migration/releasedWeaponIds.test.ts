import { describe, expect, it } from "vitest";
import {
  accountFromCloud,
  accountToCloud,
} from "@/cloud/adapters/accountAdapter";
import { buildsFromCloud, buildsToCloud } from "@/cloud/adapters/buildsAdapter";
import { teamFromCloud, teamToCloud } from "@/cloud/adapters/teamAdapter";
import { tiersFromCloud, tiersToCloud } from "@/cloud/adapters/tierAdapter";
import type { AccountData, TierAssignment } from "@/data/types";
import { convertGOODToAccountData } from "@/lib/account-data/import/goodConversion";
import { getBuffInstanceKey, StatBuff } from "@/lib/dmgcalc/core/statBuff";
import type { TeamSetupConfig } from "@/lib/team-comp/types";
import { selectActiveTierAssignments } from "@/stores/createTierStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useTeamResultCacheStore } from "@/stores/useTeamResultCacheStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";

const accountData: AccountData = {
  characters: [
    {
      key: "qiqi",
      level: 90,
      constellation: 0,
      talent: { auto: 1, skill: 10, burst: 10 },
      artifacts: {},
      weapon: {
        id: "inventory-sword",
        key: "weapon_sword",
        level: 90,
        refinement: 5,
        lock: true,
      },
    },
  ],
  extraWeapons: [
    {
      id: "inventory-bow",
      key: "weapon_bow",
      level: 90,
      refinement: 5,
      lock: false,
    },
    {
      id: "future-catalyst",
      key: "weapon_catalyst",
      level: 90,
      refinement: 1,
      lock: true,
    },
  ],
  extraArtifacts: [],
};

const assignments: TierAssignment = {
  weapon_sword: { tier: "A", position: 0 },
  weapon_bow: { tier: "S", position: 1 },
  new_bough: { tier: "B", position: 2 },
  weapon_catalyst: { tier: "C", position: 0 },
};

function tierSnapshot() {
  return {
    tierLists: {
      1: {
        id: 1,
        tierAssignments: assignments,
        tierCustomization: {},
        customTitle: "Mine",
        author: "",
        description: "",
      },
    },
    activeTierListId: 1,
    nextId: 2,
    updatedAt: 100,
  };
}

function teamSnapshot() {
  const oldBuff = new StatBuff(
    {
      type: "weapon",
      id: "weapon_bow",
      origin: "R5",
      noStackId: "weapon-bow-stellar-dmg",
    },
    {
      receiver: "team",
      filter: { reactions: ["stellarConduct", "stellarSwirl"] },
    },
    [{ key: "reactionDmg%", value: 0.16 }]
  );
  const oldBuffKey = getBuffInstanceKey(oldBuff, "diona");
  const config: TeamSetupConfig = {
    combatOptions: {
      weapon_sword: "on",
      new_bough: "off",
      weapon_bow: "on",
      weapon_catalyst: "on",
    },
    investment: {
      configs: [
        {
          charId: "qiqi",
          altWeapon: { id: "weapon_sword", refinement: 5 },
          startConstellation: 0,
          startRefinement: 1,
          maxConstellation: 6,
          maxRefinement: 5,
        },
      ],
    },
    damage: {
      combo: {
        id: "authored-combo",
        label: { en: "Mine", zh: "自定义" },
        lines: [{ charId: "diona", formulaId: "diona-q", count: 7 }],
        buffOverrides: { 0: { [oldBuffKey]: { 0: 0 } } },
      },
    },
  };
  return {
    activePresetId: null,
    compDeltas: [
      {
        kind: "custom" as const,
        id: "stable-team",
        value: {
          id: "stable-team",
          name: "Saved beta team",
          reactions: [],
          slots: [
            { charId: "qiqi", weaponId: "weapon_sword", artifactSet: null },
            { charId: "diona", weaponId: "weapon_bow", artifactSet: null },
            { charId: "mitya", weaponId: "weapon_catalyst", artifactSet: null },
          ],
        },
      },
    ],
    configsByTeamId: { "stable-team": config },
    author: "",
    description: "",
    updatedAt: 100,
  };
}

describe("released 7.1 weapon ID persistence", () => {
  it("imports retired GOOD underscore, PascalCase and display-name keys", () => {
    const imported = convertGOODToAccountData({
      format: "GOOD",
      version: 3,
      source: "legacy-scanner",
      weapons: [
        "weapon_sword",
        "WeaponSword",
        "Weapon: Sword",
        "weapon_bow",
        "WeaponBow",
        "Weapon: Bow",
        "WeaponCatalyst",
      ].map((key) => ({
        key,
        level: 90,
        ascension: 6,
        refinement: 5,
        location: "",
        lock: true,
      })),
    });
    // Future beta entities retain the importer's ordinary unknown-key path.
    expect(imported.warnings).toEqual([
      { type: "weapon", key: "WeaponCatalyst" },
    ]);
    expect(imported.data.extraWeapons.map((weapon) => weapon.key)).toEqual([
      "new_bough",
      "new_bough",
      "new_bough",
      "breezeborne_refrain",
      "breezeborne_refrain",
      "breezeborne_refrain",
    ]);
  });

  it("reports unknown GOOD weapon keys while preserving valid imported weapons", () => {
    const imported = convertGOODToAccountData({
      format: "GOOD",
      version: 3,
      source: "unknown-scanner",
      weapons: [
        "constructor",
        "toString",
        "__proto__",
        "unrecognized",
        "weapon_bow",
      ].map((key) => ({
        key,
        level: 90,
        ascension: 6,
        refinement: 5,
        location: "",
        lock: false,
      })),
    });
    expect(imported.warnings.map((warning) => warning.key)).toEqual([
      "constructor",
      "toString",
      "__proto__",
      "unrecognized",
    ]);
    expect(imported.data.extraWeapons.map((weapon) => weapon.key)).toEqual([
      "breezeborne_refrain",
    ]);
  });

  it("hydrates real v21 team data while preserving authored IDs, choices, combo counts and buff overrides", async () => {
    window.localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({ version: 21, state: teamSnapshot() })
    );
    await useTeamStore.persist.rehydrate();
    const state = useTeamStore.getState();
    expect(state.teamComps[0].id).toBe("stable-team");
    expect(state.teamComps[0].slots.map((slot) => slot.weaponId)).toEqual([
      "new_bough",
      "breezeborne_refrain",
      "weapon_catalyst",
    ]);
    const config = state.configsByTeamId["stable-team"];
    expect(config.combatOptions).toEqual({
      new_bough: "off",
      breezeborne_refrain: "on",
      weapon_catalyst: "on",
    });
    expect(config.investment?.configs?.[0].altWeapon).toEqual({
      id: "new_bough",
      refinement: 5,
    });
    expect(config.damage?.combo?.lines[0].count).toBe(7);
    const buffKeys = Object.keys(
      config.damage?.combo?.buffOverrides?.[0] ?? {}
    );
    expect(buffKeys).toHaveLength(1);
    expect(buffKeys[0]).toContain("weapon\u0000breezeborne_refrain\u0000");
    expect(buffKeys[0]).toContain("breezeborne-refrain-stellar-dmg");
    expect(config.damage?.combo?.buffOverrides?.[0][buffKeys[0]]).toEqual({
      0: 0,
    });
  });

  it("hydrates v6 account weapon keys without changing inventory IDs or the future catalyst", async () => {
    window.localStorage.setItem(
      "genshin-account-storage",
      JSON.stringify({
        version: 6,
        state: {
          accounts: {
            0: { id: 0, name: "Mine", lastUpdate: 100, data: accountData },
          },
          activeAccountId: 0,
        },
      })
    );
    await useAccountStore.persist.rehydrate();
    const data = useAccountStore.getState().accounts[0].data;
    expect(data.characters[0].weapon).toMatchObject({
      id: "inventory-sword",
      key: "new_bough",
      refinement: 5,
    });
    expect(data.extraWeapons.map((weapon) => [weapon.id, weapon.key])).toEqual([
      ["inventory-bow", "breezeborne_refrain"],
      ["future-catalyst", "weapon_catalyst"],
    ]);
  });

  it("hydrates and imports weapon tiers, preserving current-ID values on collisions", async () => {
    window.localStorage.setItem(
      "weapon-tierlist-storage",
      JSON.stringify({ version: 2, state: tierSnapshot() })
    );
    await useWeaponTierStore.persist.rehydrate();
    const check = () => {
      const tier = selectActiveTierAssignments(useWeaponTierStore.getState());
      expect(tier.new_bough).toEqual({ tier: "B", position: 2 });
      expect(tier.breezeborne_refrain).toEqual({ tier: "S", position: 1 });
      expect(tier.weapon_catalyst).toEqual({ tier: "C", position: 0 });
      expect(tier).not.toHaveProperty("weapon_sword");
      expect(tier).not.toHaveProperty("weapon_bow");
    };
    check();
    useWeaponTierStore.getState().loadTierListData({
      tierAssignments: assignments,
      tierCustomization: {},
    });
    check();
  });

  it("imports legacy team files and exports released IDs", () => {
    useTeamStore.getState().importTeams({
      teams: [
        {
          id: "imported-stable",
          name: "Imported",
          characters: ["qiqi", "diona"],
          weapons: ["weapon_sword", "weapon_bow"],
          artifacts: [],
        },
      ],
    });
    expect(useTeamStore.getState().teamComps[0].id).toBe("imported-stable");
    expect(
      useTeamStore.getState().exportTeams("", "").teams[0].weapons.slice(0, 2)
    ).toEqual(["new_bough", "breezeborne_refrain"]);
    const imported = convertGOODToAccountData({
      format: "GOOD",
      version: 3,
      source: "legacy-scanner",
      weapons: [
        {
          key: "weapon_sword",
          level: 90,
          ascension: 6,
          refinement: 5,
          location: "",
          lock: true,
        },
      ],
    });
    expect(imported.warnings).toEqual([]);
    expect(imported.data.extraWeapons[0].key).toBe("new_bough");
  });

  it("hydrates build weapon preferences from v8 and imports the same old IDs", async () => {
    window.localStorage.setItem(
      "artifact-filter-builds",
      JSON.stringify({
        version: 8,
        state: {
          activePresetId: null,
          deltas: [],
          characterWeapons: {
            qiqi: [
              "weapon_sword",
              "new_bough",
              "weapon_bow",
              "weapon_catalyst",
            ],
          },
          updatedAt: 100,
        },
      })
    );
    await useBuildsStore.persist.rehydrate();
    expect(useBuildsStore.getState().characterWeapons.qiqi).toEqual([
      "new_bough",
      "breezeborne_refrain",
      "weapon_catalyst",
    ]);
    useBuildsStore.getState().importBuilds({
      version: 5,
      author: "",
      description: "",
      builds: {},
      characterBuilds: {},
      characterWeapons: { qiqi: ["weapon_sword"] },
    });
    expect(useBuildsStore.getState().characterWeapons.qiqi).toEqual([
      "new_bough",
    ]);
  });

  it("restores old cloud team, account, build and tier schemas using the same mappings", () => {
    const teams = teamToCloud(teamSnapshot());
    teams[0].schemaVersion = 3;
    expect(
      teamFromCloud(teams).configsByTeamId["stable-team"].combatOptions
    ).toMatchObject({ new_bough: "off", breezeborne_refrain: "on" });
    const account = accountToCloud({
      accounts: {
        0: { id: 0, name: "Mine", lastUpdate: 100, data: accountData },
      },
      activeAccountId: 0,
    });
    for (const partition of account) partition.schemaVersion = 1;
    expect(
      accountFromCloud(account).accounts[0].data.characters[0].weapon?.key
    ).toBe("new_bough");
    const tier = tierSnapshot();
    const tiers = tiersToCloud({
      character: {
        ...tier,
        tierLists: {
          1: {
            ...tier.tierLists[1],
            tierAssignments: {},
            linkedAccountId: null,
          },
        },
      },
      weapon: tier,
      artifact: {
        ...tier,
        tierLists: { 1: { ...tier.tierLists[1], tierAssignments: {} } },
      },
    });
    tiers[0].schemaVersion = 1;
    expect(
      tiersFromCloud(tiers).weapon.tierLists[1].tierAssignments.new_bough
    ).toEqual({ tier: "B", position: 2 });
    const builds = buildsToCloud({
      activePresetId: null,
      deltas: [],
      characterWeapons: { qiqi: ["weapon_sword", "weapon_catalyst"] },
      computeOptions: {},
      artifactScore: { global: {} },
      author: "",
      description: "",
      updatedAt: 100,
    });
    builds[0].schemaVersion = 1;
    expect(buildsFromCloud(builds).characterWeapons.qiqi).toEqual([
      "new_bough",
      "weapon_catalyst",
    ]);
    expect(teamToCloud(teamSnapshot())[0].schemaVersion).toBe(4);
    expect(
      tiersToCloud({
        character: { ...tier, tierLists: {} },
        weapon: tier,
        artifact: tier,
      })[0].schemaVersion
    ).toBe(2);
  });

  it("invalidates derived team results from v3", async () => {
    window.localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 3,
        state: {
          resultsByTeamId: {
            "stable-team": {
              weaponChoiceResult: { timestamp: 100, perCharacter: {} },
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().resultsByTeamId).toEqual({});
  });
});
