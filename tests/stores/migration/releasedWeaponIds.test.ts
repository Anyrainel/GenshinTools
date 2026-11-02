import { describe, expect, it } from "vitest";
import {
  getBuffInstanceKey,
  StatBuff,
} from "@/domain/combat/damage/core/statBuff";
import type { BuffSource, BuffTarget } from "@/domain/combat/damage/types";
import type { AccountData, StatEntry, TierAssignment } from "@/domain/models";
import type { TeamSetupConfig } from "@/domain/team/types";
import { convertGOODToAccountData } from "@/providers/scanner/formats/goodConversion";
import {
  type AccountRosterPayload,
  accountFromCloud,
  accountToCloud,
} from "@/services/backup/adapters/accountAdapter";
import {
  buildsFromCloud,
  buildsToCloud,
} from "@/services/backup/adapters/buildsAdapter";
import {
  teamFromCloud,
  teamToCloud,
} from "@/services/backup/adapters/teamAdapter";
import {
  tiersFromCloud,
  tiersToCloud,
} from "@/services/backup/adapters/tierAdapter";
import { selectActiveTierAssignments } from "@/stores/createTierStore";
import { migrateReleasedWeaponSetup } from "@/stores/migration/releasedWeaponIds";
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

function changedBetaBuffs() {
  const cases: {
    source: BuffSource;
    target: BuffTarget;
    before: StatEntry;
    after: StatEntry;
    provider: string;
    nextSource?: BuffSource;
  }[] = [
    {
      source: { type: "character", id: "mitya", origin: "C1", triggers: ["E"] },
      target: { receiver: "teamOnField" },
      before: { key: "cd", value: 0.5 },
      after: { key: "cd", value: 0.4 },
      provider: "mitya",
    },
    {
      source: { type: "character", id: "mitya", origin: "C2", triggers: ["E"] },
      target: { receiver: "team", filter: { elements: ["Cryo", "Electro"] } },
      before: { key: "resReduction%", value: 0.25 },
      after: { key: "resReduction%", value: 0.2 },
      provider: "mitya",
    },
    {
      source: { type: "character", id: "mitya", origin: "C2", triggers: ["E"] },
      target: { receiver: "team" },
      before: { key: "em", value: 100 },
      after: { key: "em", value: 123 },
      provider: "mitya",
    },
    {
      source: { type: "character", id: "mitya", origin: "C2", triggers: ["E"] },
      target: { receiver: "teamOnField" },
      before: { key: "em", value: 200 },
      after: { key: "em", value: 234 },
      provider: "mitya",
    },
    ...(["superconduct", "melt"] as const).map((reaction) => ({
      source: {
        type: "artifactSet" as const,
        id: "glacier_and_snowfield",
        triggers: ["on-reaction"],
      },
      nextSource: { type: "artifactSet" as const, id: "glacier_and_snowfield" },
      target: { receiver: "self" as const, filter: { reactions: [reaction] } },
      before: {
        key: "reactionDmg%" as const,
        value: reaction === "melt" ? 0.15 : 1,
      },
      after: {
        key: "reactionDmg%" as const,
        value: reaction === "melt" ? 0.15 : 1,
      },
      provider: "qiqi",
    })),
    {
      source: {
        type: "artifactSet",
        id: "glacier_and_snowfield",
        triggers: ["burst"],
      },
      nextSource: {
        type: "artifactSet",
        id: "glacier_and_snowfield",
        triggers: ["Q"],
      },
      target: { receiver: "self" },
      before: { key: "cryo%", value: 0.3 },
      after: { key: "cryo%", value: 0.3 },
      provider: "qiqi",
    },
  ];
  for (const oldId of ["weapon_catalyst", "starsealed_edict"]) {
    [0.12, 0.15, 0.18, 0.21, 0.24].forEach((value, index) => {
      cases.push({
        source: {
          type: "weapon",
          id: oldId,
          origin: `R${index + 1}`,
          triggers: ["E", "stellarConduct"],
        },
        nextSource: {
          type: "weapon",
          id: "starsealed_edict",
          origin: `R${index + 1}`,
          triggers: ["E", "elemental-reaction"],
        },
        target: { receiver: "self", filter: { reactions: ["stellarConduct"] } },
        before: { key: "reactionCd", value: 3 * value },
        after: { key: "reactionCd", value: 3 * value },
        provider: "mitya",
      });
    });
  }
  return cases.map(
    ({ source, nextSource, target, before, after, provider }) => ({
      before: getBuffInstanceKey(
        new StatBuff(source, target, [before]),
        provider
      ),
      after: getBuffInstanceKey(
        new StatBuff(nextSource ?? source, target, [after]),
        provider
      ),
    })
  );
}

describe("released and beta weapon ID persistence", () => {
  it("hydrates authored beta buff overrides from origin v25 and restores raw cloud v7 payloads", async () => {
    const snapshot = teamSnapshot();
    const cases = changedBetaBuffs();
    const oldOverrides = Object.fromEntries(
      cases.map(({ before }) => [before, { 0: 0.25 }])
    );
    snapshot.configsByTeamId["stable-team"].damage!.combo!.buffOverrides = {
      0: oldOverrides,
    };
    window.localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({ version: 25, state: snapshot })
    );
    await useTeamStore.persist.rehydrate();
    const check = (configs: Record<string, TeamSetupConfig>) => {
      const overrides =
        configs["stable-team"].damage?.combo?.buffOverrides?.[0] ?? {};
      const uniqueExpected = new Set(cases.map(({ after }) => after));
      expect(Object.keys(overrides)).toHaveLength(uniqueExpected.size);
      for (const { before, after } of cases) {
        expect(overrides[after]).toEqual({ 0: 0.25 });
        expect(overrides).not.toHaveProperty(before);
      }
    };
    check(useTeamStore.getState().configsByTeamId);
    const rawCloud = [
      {
        namespace: "teams" as const,
        partitionKey: "all",
        schemaVersion: 7,
        conflictPolicy: "explicit-choice" as const,
        payload: snapshot,
      },
    ];
    check(teamFromCloud(rawCloud).configsByTeamId);
    check(teamToCloud(snapshot)[0].payload.configsByTeamId);
    expect(teamFromCloud(rawCloud).compDeltas[0]).toMatchObject({
      value: {
        slots: [
          { weaponId: "new_bough" },
          { weaponId: "breezeborne_refrain" },
          { weaponId: "starsealed_edict" },
        ],
      },
    });
  });

  it("preserves canonical collisions, opaque keys and unrelated beta buff identities", () => {
    const [changed] = changedBetaBuffs();
    const unrelated = getBuffInstanceKey(
      new StatBuff(
        { type: "character", id: "mitya", origin: "C1", triggers: ["E"] },
        { receiver: "self" },
        [{ key: "cd", value: 0.5 }]
      ),
      "mitya"
    );
    const config = teamSnapshot().configsByTeamId["stable-team"];
    config.damage!.combo!.buffOverrides = {
      0: {
        [changed.before]: { 0: 0 },
        [changed.after]: { 0: 0.75 },
        [unrelated]: { 0: 0.5 },
        opaque: { 0: 0 },
      },
    };
    const migrated = migrateReleasedWeaponSetup(config);
    expect(migrated.damage?.combo?.buffOverrides?.[0]).toEqual({
      [changed.after]: { 0: 0.75 },
      [unrelated]: { 0: 0.5 },
      opaque: { 0: 0 },
    });
    expect(migrateReleasedWeaponSetup(migrated)).toEqual(migrated);
    const weaponCases = changedBetaBuffs();
    const oldWeapon = weaponCases.find(({ before }) =>
      before.includes("weapon\u0000weapon_catalyst\u0000R1")
    )!;
    const currentWeapon = weaponCases.find(({ before }) =>
      before.includes("weapon\u0000starsealed_edict\u0000R1")
    )!;
    for (const keys of [
      [oldWeapon.before, currentWeapon.before],
      [currentWeapon.before, oldWeapon.before],
    ]) {
      config.damage!.combo!.buffOverrides = {
        0: Object.fromEntries(
          keys.map((key) => [
            key,
            { 0: key === currentWeapon.before ? 0.75 : 0 },
          ])
        ),
      };
      expect(
        migrateReleasedWeaponSetup(config).damage?.combo?.buffOverrides?.[0]
      ).toEqual({ [currentWeapon.after]: { 0: 0.75 } });
    }
  });

  it("restores raw origin account v2, builds v3 and tiers v2 cloud weapon keys", () => {
    const account = accountToCloud({
      accounts: {
        0: { id: 0, name: "Mine", lastUpdate: 100, data: accountData },
      },
      activeAccountId: 0,
    });
    const game = account.find(
      (partition) => partition.namespace === "profile.game"
    )!;
    game.schemaVersion = 2;
    const roster = game.payload as AccountRosterPayload;
    roster.weapons.find((weapon) => weapon.key === "starsealed_edict")!.key =
      "weapon_catalyst";
    expect(
      accountFromCloud(account).accounts[0].data.extraWeapons.some(
        (weapon) => weapon.key === "starsealed_edict"
      )
    ).toBe(true);
    expect(
      roster.weapons.some((weapon) => weapon.key === "weapon_catalyst")
    ).toBe(true);

    const builds = buildsToCloud({
      activePresetId: null,
      deltas: [],
      characterWeapons: {},
      computeOptions: {},
      artifactScore: { global: {} },
      author: "",
      description: "",
      updatedAt: 100,
    });
    builds[0].schemaVersion = 3;
    builds[0].payload.characterWeapons = { mitya: ["weapon_catalyst"] };
    expect(buildsFromCloud(builds).characterWeapons.mitya).toEqual([
      "starsealed_edict",
    ]);
    expect(buildsToCloud(buildsFromCloud(builds))[0].schemaVersion).toBe(4);

    const tier = tierSnapshot();
    const tiers = tiersToCloud({
      character: { ...tier, tierLists: {} },
      weapon: tier,
      artifact: { ...tier, tierLists: {} },
    });
    tiers[0].schemaVersion = 2;
    tiers[0].payload.weapon.lists[0].tierAssignments = assignments;
    expect(
      tiersFromCloud(tiers).weapon.tierLists[1].tierAssignments.starsealed_edict
    ).toEqual({ tier: "C", position: 0 });
    expect(assignments).toHaveProperty("weapon_catalyst");
    expect(
      accountToCloud({
        accounts: {
          0: { id: 0, name: "Mine", lastUpdate: 100, data: accountData },
        },
        activeAccountId: 0,
      }).find((partition) => partition.namespace === "profile.game")
        ?.schemaVersion
    ).toBe(3);
  });
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
    expect(imported.warnings).toEqual([]);
    expect(imported.data.extraWeapons.map((weapon) => weapon.key)).toEqual([
      "new_bough",
      "new_bough",
      "new_bough",
      "breezeborne_refrain",
      "breezeborne_refrain",
      "breezeborne_refrain",
      "starsealed_edict",
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

  it.each([21, 25])(
    "hydrates real v%s team data while preserving authored IDs, choices, combo counts and buff overrides",
    async (version) => {
      window.localStorage.setItem(
        "team-builder-storage",
        JSON.stringify({ version, state: teamSnapshot() })
      );
      await useTeamStore.persist.rehydrate();
      const state = useTeamStore.getState();
      expect(state.teamComps[0].id).toBe("stable-team");
      expect(state.teamComps[0].slots.map((slot) => slot.weaponId)).toEqual([
        "new_bough",
        "breezeborne_refrain",
        "starsealed_edict",
      ]);
      const config = state.configsByTeamId["stable-team"];
      expect(config.combatOptions).toEqual({
        new_bough: "off",
        breezeborne_refrain: "on",
        starsealed_edict: "on",
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
    }
  );

  it.each([6, 7])(
    "hydrates v%s account weapon keys without changing inventory IDs",
    async (version) => {
      window.localStorage.setItem(
        "genshin-account-storage",
        JSON.stringify({
          version,
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
      expect(
        data.extraWeapons.map((weapon) => [weapon.id, weapon.key])
      ).toEqual([
        ["inventory-bow", "breezeborne_refrain"],
        ["future-catalyst", "starsealed_edict"],
      ]);
    }
  );

  it.each([2, 3])(
    "hydrates v%s and imports weapon tiers, preserving current-ID values on collisions",
    async (version) => {
      window.localStorage.setItem(
        "weapon-tierlist-storage",
        JSON.stringify({ version, state: tierSnapshot() })
      );
      await useWeaponTierStore.persist.rehydrate();
      const check = () => {
        const tier = selectActiveTierAssignments(useWeaponTierStore.getState());
        expect(tier.new_bough).toEqual({ tier: "B", position: 2 });
        expect(tier.breezeborne_refrain).toEqual({ tier: "S", position: 1 });
        expect(tier.starsealed_edict).toEqual({ tier: "C", position: 0 });
        expect(tier).not.toHaveProperty("weapon_sword");
        expect(tier).not.toHaveProperty("weapon_bow");
      };
      check();
      useWeaponTierStore.getState().loadTierListData({
        tierAssignments: assignments,
        tierCustomization: {},
      });
      check();
    }
  );

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

  it.each([8, 10])(
    "hydrates build weapon preferences from v%s and imports the same old IDs",
    async (version) => {
      window.localStorage.setItem(
        "artifact-filter-builds",
        JSON.stringify({
          version,
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
        "starsealed_edict",
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
    }
  );

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
      "starsealed_edict",
    ]);
    expect(teamToCloud(teamSnapshot())[0].schemaVersion).toBe(8);
    expect(
      tiersToCloud({
        character: { ...tier, tierLists: {} },
        weapon: tier,
        artifact: tier,
      })[0].schemaVersion
    ).toBe(3);
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
