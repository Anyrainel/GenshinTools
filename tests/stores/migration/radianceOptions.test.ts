import "@/providers/reference/statLoaders";
import "@/domain/combat/damage/index";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createWeapon } from "@/domain/combat/damage/core/registry";
import {
  getBuffInstanceKey,
  StatBuff,
} from "@/domain/combat/damage/core/statBuff";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import { TeamResonance } from "@/domain/combat/damage/core/teamResonance";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import type { TeamSetupConfig } from "@/domain/team/types";
import {
  teamFromCloud,
  teamToCloud,
} from "@/services/backup/adapters/teamAdapter";
import { migrateRadianceSetupConfigs } from "@/stores/migration/radianceOptions";
import { useTeamResultCacheStore } from "@/stores/useTeamResultCacheStore";
import { useTeamStore } from "@/stores/useTeamStore";

beforeAll(() =>
  Promise.all([characterStatsResource.preload(), weaponStatsResource.preload()])
);
afterEach(() => {
  useTeamStore.getState().clearTeams();
  useTeamResultCacheStore.getState().clearAll();
  localStorage.clear();
});

const oldDiona = getBuffInstanceKey(
  new StatBuff(
    { type: "character", id: "diona", origin: "C6", triggers: ["Q"] },
    { receiver: "team", filter: { reactions: ["stellarSwirl"] } },
    [{ key: "reactionDmg%", value: 0.4 }]
  ),
  "diona"
);
const currentDiona = getBuffInstanceKey(
  new StatBuff(
    { type: "character", id: "diona", origin: "C6", triggers: ["Q"] },
    { receiver: "teamOnField", filter: { reactions: ["stellarSwirl"] } },
    [{ key: "reactionDmg%", value: 0.4 }]
  ),
  "diona"
);
const oldSuperconduct = getBuffInstanceKey(
  new StatBuff(
    { type: "teamResonance", id: "superconduct" },
    { receiver: "team", filter: { elements: ["Physical"] } },
    [{ key: "resReduction%", value: 0.4 }]
  ),
  "resonance"
);
const currentSuperconduct = getBuffInstanceKey(
  new StatBuff(
    {
      type: "teamResonance",
      id: "superconduct",
      triggers: ["superconduct"],
    },
    { receiver: "team", filter: { elements: ["Physical"] } },
    [{ key: "resReduction%", value: 0.4 }]
  ),
  "resonance"
);
const currentPolestarField = getBuffInstanceKey(
  new StatBuff(
    {
      type: "teamResonance",
      id: "stellarConduct",
      triggers: ["polestar-field"],
    },
    { receiver: "team", filter: { elements: ["Physical"] } },
    [{ key: "resReduction%", value: 0.4 }]
  ),
  "resonance"
);

function fixture() {
  const config: TeamSetupConfig = {
    combatOptions: {
      yumemizuki_mizuki: "off",
      cyno: "off",
      sandrone: "stellarSwirl",
      diona: "stellarSwirl",
      danica: "defense-stellar",
      valeriy: "normal-40",
      anastasya: "honor-stellarConduct-unsealed",
      new_bough: "on",
      winters_heavy_heart: "off",
      mitya: "stable",
      vodyanitsa: "low",
      the_widsith: "em",
      "infusion:cyno": "none",
    },
    charConfigs: { diona: { constellation: 6, minEr: 1.8 } },
    damage: {
      enemyAura: "Cryo",
      selectedFormula: { charId: "cyno", formulaId: "cyno-p1-starsame" },
      combo: {
        id: "authored",
        label: { en: "Saved rotation", zh: "已保存手法" },
        lines: [
          { charId: "cyno", formulaId: "cyno-p1-starsame", count: 7 },
          { charId: "cyno", formulaId: "cyno-c6-starsame", count: 2 },
          { charId: "diona", formulaId: "diona-skill", count: 1 },
        ],
        buffOverrides: {
          0: {
            [oldDiona]: { 0: 0 },
            [oldSuperconduct]: { 0: 0.25 },
            opaque: { 0: 0.75 },
          },
        },
      },
    },
    investment: {
      legacyCountOverrides: { "cyno|6|cyno-c6-starsame:0": 4 },
      futureCountChanges: [
        {
          charId: "cyno",
          constellation: 6,
          formulaId: "cyno-c6-starsame",
          delta: 3,
        },
      ],
      absoluteCountTargets: [
        {
          charId: "cyno",
          constellation: 1,
          formulaId: "cyno-p1-starsame",
          count: 8,
        },
      ],
    },
  };
  return {
    activePresetId: null,
    compDeltas: [
      {
        kind: "custom" as const,
        id: "saved",
        value: {
          id: "saved",
          name: "Before automatic Radiance",
          slots: ["cyno", "diona", "sandrone", "yumemizuki_mizuki"].map(
            (charId) => ({ charId, weaponId: null, artifactSet: null })
          ),
          reactions: [],
        },
      },
    ],
    configsByTeamId: { saved: config },
    author: "Player",
    description: "Authored before Radiance cleanup",
    updatedAt: 123,
  };
}

function expectMigrated(config: TeamSetupConfig) {
  expect(config.combatOptions).toEqual({
    diona: "above50",
    danica: "defense",
    valeriy: "40",
    anastasya: "honor-unsealed",
    mitya: "stable",
    vodyanitsa: "low",
    the_widsith: "em",
    "infusion:cyno": "none",
  });
  expect(config.charConfigs?.diona).toEqual({ constellation: 6, minEr: 1.8 });
  expect(config.damage?.enemyAura).toBe("Cryo");
  expect(config.damage?.selectedFormula?.formulaId).toBe("cyno-p1-bolts");
  expect(config.damage?.combo?.lines).toEqual([
    { charId: "cyno", formulaId: "cyno-p1-bolts", count: 7 },
    { charId: "cyno", formulaId: "cyno-c6-bolts", count: 2 },
    { charId: "diona", formulaId: "diona-skill", count: 1 },
  ]);
  expect(config.damage?.combo?.buffOverrides?.[0]).toEqual({
    [currentDiona]: { 0: 0 },
    [currentSuperconduct]: { 0: 0.25 },
    [currentPolestarField]: { 0: 0.25 },
    opaque: { 0: 0.75 },
  });
  expect(config.investment?.legacyCountOverrides).toEqual({
    "cyno|6|cyno-c6-bolts:0": 4,
  });
  expect(config.investment?.futureCountChanges?.[0].formulaId).toBe(
    "cyno-c6-bolts"
  );
  expect(config.investment?.absoluteCountTargets?.[0].formulaId).toBe(
    "cyno-p1-bolts"
  );
}

describe("automatic Radiance persistence migration", () => {
  it("hydrates realistic v26 data and applies the same transform to cloud imports, exports and source replacement", async () => {
    const old = fixture();
    const untouched = structuredClone(old);
    localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({ version: 26, state: old })
    );
    await useTeamStore.persist.rehydrate();
    expectMigrated(useTeamStore.getState().configsByTeamId.saved);
    expect(
      JSON.parse(localStorage.getItem("team-builder-storage")!).version
    ).toBe(27);
    const restored = teamFromCloud([
      {
        namespace: "teams",
        partitionKey: "all",
        schemaVersion: 8,
        conflictPolicy: "explicit-choice",
        payload: old,
      },
    ]);
    expectMigrated(restored.configsByTeamId.saved);
    const exported = teamToCloud(old);
    expect(exported[0].schemaVersion).toBe(9);
    expectMigrated(exported[0].payload.configsByTeamId.saved);
    expect(teamFromCloud(exported)).toEqual(restored);
    useTeamStore.getState().replaceSourceState(old);
    expectMigrated(useTeamStore.getState().configsByTeamId.saved);
    expect(old).toEqual(untouched);
    expect(migrateRadianceSetupConfigs(restored.configsByTeamId)).toEqual(
      restored.configsByTeamId
    );
    expect(
      migrateRadianceSetupConfigs({ empty: { combatOptions: {} } })
    ).toEqual({
      empty: { combatOptions: {} },
    });
  });

  it("preserves every genuine legacy choice and only strips its derived Radiance dimension", () => {
    for (const hp of ["above50", "below50"]) {
      for (const form of ["battle", "defense"]) {
        for (const charge of ["40", "100", "130"]) {
          for (const radiance of ["stellarConduct", "stellarSwirl", "off"]) {
            for (const blessing of ["love", "honor"]) {
              for (const seal of ["sealed", "unsealed"]) {
                const migrated = migrateRadianceSetupConfigs({
                  saved: {
                    combatOptions: {
                      diona: hp,
                      danica: `${form}-stellar`,
                      valeriy: `${radiance === "off" ? "normal" : "stellar"}-${charge}`,
                      anastasya: `${blessing}-${radiance}-${seal}`,
                    },
                  },
                });
                expect(migrated.saved.combatOptions).toEqual({
                  diona: hp,
                  danica: form,
                  valeriy: charge,
                  anastasya: `${blessing}-${seal}`,
                });
              }
            }
          }
        }
      }
    }
  });

  it("keeps explicit current identities and count overrides when old aliases collide", () => {
    const config = fixture().configsByTeamId.saved;
    config.damage!.combo!.buffOverrides![0][currentDiona] = { 0: 0.5 };
    config.damage!.combo!.buffOverrides![0][currentSuperconduct] = { 0: 0.75 };
    config.damage!.combo!.buffOverrides![0][currentPolestarField] = { 0: 0 };
    config.investment!.legacyCountOverrides!["cyno|6|cyno-c6-bolts:0"] = 9;
    config.investment!.absoluteCountTargets!.push({
      charId: "cyno",
      constellation: 1,
      formulaId: "cyno-p1-bolts",
      count: 11,
    });
    const migrated = migrateRadianceSetupConfigs({ saved: config }).saved;
    expect(migrated.damage?.combo?.buffOverrides?.[0][currentDiona]).toEqual({
      0: 0.5,
    });
    expect(
      migrated.damage?.combo?.buffOverrides?.[0][currentSuperconduct]
    ).toEqual({ 0: 0.75 });
    expect(
      migrated.damage?.combo?.buffOverrides?.[0][currentPolestarField]
    ).toEqual({ 0: 0 });
    expect(migrated.damage?.combo?.buffOverrides?.[0]).not.toHaveProperty(
      oldSuperconduct
    );
    expect(migrated.investment?.legacyCountOverrides).toEqual({
      "cyno|6|cyno-c6-bolts:0": 9,
    });
    expect(migrated.investment?.absoluteCountTargets).toEqual([
      {
        charId: "cyno",
        constellation: 1,
        formulaId: "cyno-p1-bolts",
        count: 11,
      },
    ]);
  });

  it("matches the field-only Mitya debuff identity without loading a saved team preset", () => {
    const migrated = migrateRadianceSetupConfigs(fixture().configsByTeamId);
    const field = new TeamResonance(new TeamMeta(["mitya"])).buffs.find(
      (buff) => buff.source.id === "stellarConduct"
    );

    expect(field).toBeDefined();
    expect(getBuffInstanceKey(field!, "resonance")).toBe(currentPolestarField);
    expect(
      migrated.saved.damage?.combo?.buffOverrides?.[0][
        getBuffInstanceKey(field!, "resonance")
      ]
    ).toEqual({ 0: 0.25 });
  });

  it("does not recreate a removed field override from a current Superconduct key", async () => {
    const current = fixture();
    current.configsByTeamId.saved = migrateRadianceSetupConfigs(
      current.configsByTeamId
    ).saved;
    const overrides =
      current.configsByTeamId.saved.damage!.combo!.buffOverrides![0];
    delete overrides[currentPolestarField];

    const repeated = migrateRadianceSetupConfigs(current.configsByTeamId);
    expect(repeated).toEqual(current.configsByTeamId);
    localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({ version: 27, state: current })
    );
    await useTeamStore.persist.rehydrate();
    const hydrated = useTeamStore.getState().configsByTeamId.saved;
    expect(hydrated.damage?.combo?.buffOverrides?.[0]).not.toHaveProperty(
      currentPolestarField
    );
    expect(
      hydrated.damage?.combo?.buffOverrides?.[0][currentSuperconduct]
    ).toEqual({ 0: 0.25 });
    const exported = teamToCloud(current);
    expect(
      exported[0].payload.configsByTeamId.saved.damage?.combo
        ?.buffOverrides?.[0]
    ).not.toHaveProperty(currentPolestarField);
  });

  it("invalidates v10 derived results through public hydration", async () => {
    localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 10,
        state: {
          resultsByTeamId: { saved: { investmentResult: { stale: true } } },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().resultsByTeamId).toEqual({});
    expect(JSON.parse(localStorage.getItem("team-result-cache")!).version).toBe(
      11
    );
  });

  it("does not activate both historical Cyno branches and reindexes surviving line overlays", () => {
    const config = fixture().configsByTeamId.saved;
    config.damage!.combo!.lines.push({
      charId: "cyno",
      formulaId: "cyno-p1-bolts",
      count: 11,
      reaction: { reaction: "aggravate" },
    });
    config.damage!.combo!.buffOverrides![3] = { current: { 0: 0.5 } };
    const migrated = migrateRadianceSetupConfigs({ saved: config }).saved;
    expect(migrated.damage?.combo?.lines).toEqual([
      { charId: "cyno", formulaId: "cyno-c6-bolts", count: 2 },
      { charId: "diona", formulaId: "diona-skill", count: 1 },
      {
        charId: "cyno",
        formulaId: "cyno-p1-bolts",
        count: 11,
        reaction: { reaction: "aggravate" },
      },
    ]);
    expect(migrated.damage?.combo?.buffOverrides).toEqual({
      2: { current: { 0: 0.5 } },
    });
    expect(migrateRadianceSetupConfigs({ saved: migrated }).saved).toEqual(
      migrated
    );
  });
});

describe("Winter's Heavy Heart authored Radiance overlays", () => {
  it.each([1, 2, 3, 4, 5])(
    "preserves zero and partial activation at refinement %i for actual current buff identities",
    (refinement) => {
      const cryoIds = ["sandrone", "qiqi", "kaeya", "layla"];
      const electroIds = ["mitya", "fischl", "lisa", "beidou"];
      const cases: {
        ids: string[];
        owner: string;
        aura?: "Cryo" | "Electro";
      }[] = [];
      for (let count = 1; count <= 4; count++) {
        for (let cryo = 0; cryo <= count; cryo++) {
          const electro = count - cryo;
          cases.push({
            ids: [...cryoIds.slice(0, cryo), ...electroIds.slice(0, electro)],
            owner: electro > 0 ? "mitya" : "sandrone",
            ...(electro === 0 ? { aura: "Electro" } : {}),
          });
        }
      }
      for (let count = 1; count <= 2; count++) {
        for (let cryo = 0; cryo <= count; cryo++) {
          cases.push({
            ids: [
              "yumemizuki_mizuki",
              "vesna",
              ...["qiqi", "kaeya"].slice(0, cryo),
              ...["fischl", "lisa"].slice(0, count - cryo),
            ],
            owner: "yumemizuki_mizuki",
            ...(cryo === 0 ? { aura: "Cryo" } : {}),
          });
        }
      }
      for (const { ids, owner, aura } of cases) {
        const meta = new TeamMeta(ids, {}, {}, aura);
        const count =
          meta.countByElement("Cryo") + meta.countByElement("Electro");
        const source = {
          type: "weapon" as const,
          id: "winters_heavy_heart",
          origin: `R${refinement}`,
        };
        const oldEm = getBuffInstanceKey(
          new StatBuff(source, { receiver: "self" }, [
            { key: "em", value: count * [20, 25, 30, 35, 40][refinement - 1] },
          ]),
          owner
        );
        const oldReaction = getBuffInstanceKey(
          new StatBuff(
            source,
            {
              receiver: "self",
              filter: { reactions: ["stellarConduct", "stellarSwirl"] },
            },
            [
              {
                key: "reactionDmg%",
                value: count * [0.06, 0.075, 0.09, 0.105, 0.12][refinement - 1],
              },
            ]
          ),
          owner
        );
        const config: TeamSetupConfig = {
          combatOptions: { winters_heavy_heart: "on" },
          damage: {
            combo: {
              id: "saved",
              label: { en: "Saved", zh: "保存" },
              lines: [
                {
                  charId: owner,
                  formulaId:
                    owner === "mitya"
                      ? "mitya-prism-shatter"
                      : owner === "sandrone"
                        ? "sandrone-skill"
                        : "mizuki-skill-initial",
                  count: 1,
                },
              ],
              buffOverrides: {
                0: {
                  [oldEm]: { 0: 0 },
                  [oldReaction]: { 0: 0.25 },
                  opaque: { 0: 0.5 },
                },
              },
            },
          },
        };
        const migrated = migrateRadianceSetupConfigs({ saved: config });
        const overlays = migrated.saved.damage!.combo!.buffOverrides![0];
        const weapon = createWeapon(
          "winters_heavy_heart",
          refinement,
          owner,
          meta
        );
        const triggered = weapon.buffs.filter(
          (buff) => buff.source.triggers?.length
        );
        expect(triggered).toHaveLength(2);
        for (const buff of triggered) {
          expect(overlays[getBuffInstanceKey(buff, owner)]).toEqual({
            0: buff.target.filter?.reactions ? 0.25 : 0,
          });
        }
        expect(overlays).not.toHaveProperty(oldEm);
        expect(overlays).not.toHaveProperty(oldReaction);
        expect(overlays.opaque).toEqual({ 0: 0.5 });
        expect(migrateRadianceSetupConfigs(migrated)).toEqual(migrated);
      }
    }
  );
});
