import { describe, expect, it } from "vitest";
import type { TeamSetupConfig } from "@/lib/team-comp/types";
import { migrateTeamStore } from "@/stores/migration/team";

/** v18 persisted shape: the ER scenario was React state in ErCalcCard, so
 *  `energy` carried nothing but the authored timelines. */
function v18State(energy: Record<string, unknown>) {
  return {
    activePresetId: null,
    compDeltas: [],
    configsByTeamId: {
      "team-1": { combatOptions: {}, energy },
    },
    author: "",
    description: "",
    updatedAt: 1_700_000_000_000,
  };
}

const TIMELINES = [
  { actions: [{ char: "bennett", action: "E" }], periodic: [] },
];

function migratedEnergy(
  energy: Record<string, unknown>,
  version = 18
): (TeamSetupConfig["energy"] & Record<string, unknown>) | undefined {
  const result = migrateTeamStore(v18State(energy), version) as {
    configsByTeamId: Record<string, TeamSetupConfig>;
  };
  return result.configsByTeamId["team-1"]?.energy as
    | (TeamSetupConfig["energy"] & Record<string, unknown>)
    | undefined;
}

describe("migrateTeamStore — v19 ER scenario persistence", () => {
  it("keeps pre-v19 energy configs untouched so they read as the old defaults", () => {
    const energy = migratedEnergy({ timelines: TIMELINES });
    expect(energy?.timelines).toEqual(TIMELINES);
    expect(energy?.mode).toBeUndefined();
    expect(energy?.particleMode).toBeUndefined();
  });

  it("folds the removed 'min' particle mode into 'expected'", () => {
    const energy = migratedEnergy({
      timelines: TIMELINES,
      particleMode: "min",
    });
    expect(energy?.particleMode).toBe("expected");
  });

  it("preserves recognized scenario values", () => {
    const energy = migratedEnergy({
      timelines: TIMELINES,
      mode: "zero-energy-repeat",
      particleMode: "max",
    });
    expect(energy?.mode).toBe("zero-energy-repeat");
    expect(energy?.particleMode).toBe("max");
  });

  it("drops unrecognized scenario values back to the defaults", () => {
    const energy = migratedEnergy({
      timelines: TIMELINES,
      mode: "full-energy-once",
      particleMode: "percentile",
    });
    expect(energy?.mode).toBeUndefined();
    expect(energy?.particleMode).toBeUndefined();
    expect(energy?.timelines).toEqual(TIMELINES);
  });

  it("keeps a scenario-only energy config that has no timelines", () => {
    const energy = migratedEnergy({ mode: "zero-energy-start" });
    expect(energy?.mode).toBe("zero-energy-start");
  });

  it("tolerates configs without an energy block", () => {
    const result = migrateTeamStore(
      {
        activePresetId: null,
        compDeltas: [],
        configsByTeamId: { "team-1": { combatOptions: { a: "b" } } },
        author: "",
        description: "",
        updatedAt: 1_700_000_000_000,
      },
      18
    ) as { configsByTeamId: Record<string, TeamSetupConfig> };
    expect(result.configsByTeamId["team-1"]?.combatOptions).toEqual({ a: "b" });
  });
});

describe("migrateTeamStore — v20 formula entry units", () => {
  function comboLineState(version = 19) {
    return migrateTeamStore(
      {
        activePresetId: null,
        compDeltas: [],
        configsByTeamId: {
          "team-1": {
            combatOptions: {},
            damage: {
              combo: {
                id: "legacy-combo",
                label: { en: "Legacy", zh: "旧版" },
                lines: [
                  {
                    charId: "yae_miko",
                    formulaId: "yae_miko-skill",
                    count: 15,
                    reaction: { reaction: "aggravate" },
                    forceOnField: true,
                  },
                  { charId: "cyno", formulaId: "cyno-c6-bolts", count: 6 },
                  { charId: "amber", formulaId: "amber-skill", count: 15 },
                  { charId: "yae_miko", formulaId: "yae_miko-skill", count: 2 },
                  { charId: "kinich", formulaId: "kinich-cannon", count: 4 },
                  { charId: "kinich", formulaId: "kinich-burst", count: 1 },
                ],
                buffOverrides: {
                  0: { oldYaeBuff: { 0: 1 } },
                  4: { cannonBuff: { 0: 1 } },
                  5: { burstBuff: { 0: 1 } },
                },
              },
            },
            investment: {
              comboOverrides: {
                "yae_miko|6|yae_miko-skill": 15,
                "yae_miko|6|yae_miko-skill:aggravate": 15,
                "cyno|6|cyno-c6-bolts": 6,
                "kinich|2|kinich-cannon": 4,
                "amber|0|amber-skill": 15,
                "yae_miko|6|yae_miko-skill:custom": 2,
              },
            },
          },
        },
        author: "",
        description: "",
        updatedAt: 1_700_000_000_000,
      },
      version
    ) as { configsByTeamId: Record<string, TeamSetupConfig> };
  }

  it("repairs legacy aggregate counts and the Kinich formula split", () => {
    const config = comboLineState().configsByTeamId["team-1"];
    const combo = config.damage?.combo;

    expect(combo?.lines).toEqual([
      {
        charId: "yae_miko",
        formulaId: "yae_miko-skill",
        count: 1,
        reaction: { reaction: "aggravate" },
        forceOnField: true,
      },
      { charId: "cyno", formulaId: "cyno-c6-bolts", count: 1 },
      { charId: "amber", formulaId: "amber-skill", count: 15 },
      { charId: "yae_miko", formulaId: "yae_miko-skill", count: 2 },
      { charId: "kinich", formulaId: "kinich-cannon-first", count: 1 },
      { charId: "kinich", formulaId: "kinich-cannon", count: 3 },
      { charId: "kinich", formulaId: "kinich-burst", count: 1 },
    ]);
    expect(combo?.buffOverrides).toEqual({
      4: { cannonBuff: { 0: 1 } },
      5: { cannonBuff: { 0: 1 } },
      6: { burstBuff: { 0: 1 } },
    });
  });

  it("normalizes analyzer counts but preserves unrelated and custom counts", () => {
    expect(
      comboLineState().configsByTeamId["team-1"]?.investment?.comboOverrides
    ).toEqual({
      "yae_miko|6|yae_miko-skill": 1,
      "yae_miko|6|yae_miko-skill:aggravate": 1,
      "cyno|6|cyno-c6-bolts": 1,
      "kinich|2|kinich-cannon": 3,
      "kinich|2|kinich-cannon-first": 1,
      "amber|0|amber-skill": 15,
      "yae_miko|6|yae_miko-skill:custom": 2,
    });
  });

  it("does not reapply the migration to v20 data", () => {
    const combo = comboLineState(20).configsByTeamId["team-1"]?.damage?.combo;
    expect(combo?.lines[0]?.count).toBe(15);
    expect(combo?.lines[1]?.count).toBe(6);
    expect(combo?.lines[4]?.formulaId).toBe("kinich-cannon");
    expect(combo?.lines[4]?.count).toBe(4);
  });
});

describe("migrateTeamStore — v21 Skirk C6 shared stack pool", () => {
  function persistedSkirkState(version = 20) {
    return migrateTeamStore(
      {
        activePresetId: null,
        compDeltas: [],
        configsByTeamId: {
          "both-branches": {
            combatOptions: {},
            damage: {
              combo: {
                id: "legacy-skirk-default",
                label: { en: "Legacy Skirk", zh: "旧版丝柯克" },
                lines: [
                  {
                    charId: "skirk",
                    formulaId: "skirk-c6-burst-coord",
                    count: 1,
                  },
                  {
                    charId: "skirk",
                    formulaId: "skirk-c6-normal-coord",
                    count: 4,
                  },
                  { charId: "shenhe", formulaId: "shenhe-burst", count: 1 },
                ],
                buffOverrides: {
                  0: { burstBuff: { 0: 1 } },
                  1: { normalBuff: { 0: 1 } },
                  2: { shenheBuff: { 0: 1 } },
                },
              },
            },
            investment: {
              comboOverrides: {
                "skirk|6|skirk-c6-normal-coord": 4,
              },
            },
          },
          "normal-only": {
            combatOptions: {},
            damage: {
              combo: {
                id: "legacy-skirk-normal",
                label: { en: "Normal branch", zh: "普攻分支" },
                lines: [
                  {
                    charId: "skirk",
                    formulaId: "skirk-c6-normal-coord",
                    count: 4,
                  },
                  { charId: "furina", formulaId: "furina-burst", count: 1 },
                ],
                buffOverrides: {
                  0: { normalBuff: { 0: 0 } },
                  1: { furinaBuff: { 0: 1 } },
                },
              },
            },
            investment: {
              comboOverrides: {
                "skirk|6|skirk-c6-normal-coord": 4,
                "skirk|6|skirk-c6-burst-coord": 0,
              },
            },
          },
        },
        author: "",
        description: "",
        updatedAt: 1_700_000_000_000,
      },
      version
    ) as { configsByTeamId: Record<string, TeamSetupConfig> };
  }

  it("removes the repeated Normal branch when the Burst branch spends the pool", () => {
    const config = persistedSkirkState().configsByTeamId["both-branches"];
    expect(config.damage?.combo?.lines).toEqual([
      {
        charId: "skirk",
        formulaId: "skirk-c6-burst-coord",
        count: 1,
      },
      { charId: "shenhe", formulaId: "shenhe-burst", count: 1 },
    ]);
    expect(config.damage?.combo?.buffOverrides).toEqual({
      0: { burstBuff: { 0: 1 } },
      1: { shenheBuff: { 0: 1 } },
    });
    expect(config.investment?.comboOverrides).toEqual({});
  });

  it("keeps a Normal-only branch once and preserves its line overrides", () => {
    const config = persistedSkirkState().configsByTeamId["normal-only"];
    expect(config.damage?.combo?.lines).toEqual([
      {
        charId: "skirk",
        formulaId: "skirk-c6-normal-coord",
        count: 1,
      },
      { charId: "furina", formulaId: "furina-burst", count: 1 },
    ]);
    expect(config.damage?.combo?.buffOverrides).toEqual({
      0: { normalBuff: { 0: 0 } },
      1: { furinaBuff: { 0: 1 } },
    });
    expect(config.investment?.comboOverrides).toEqual({
      "skirk|6|skirk-c6-normal-coord": 1,
      "skirk|6|skirk-c6-burst-coord": 0,
    });
  });

  it("does not reinterpret current v21 data", () => {
    const configs = persistedSkirkState(21).configsByTeamId;
    expect(configs["both-branches"].damage?.combo?.lines[1]).toMatchObject({
      formulaId: "skirk-c6-normal-coord",
      count: 4,
    });
    expect(configs["both-branches"].investment?.comboOverrides).toMatchObject({
      "skirk|6|skirk-c6-normal-coord": 4,
    });
  });
});
