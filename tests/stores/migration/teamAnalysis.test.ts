import { beforeEach, describe, expect, it } from "vitest";
import {
  teamFromCloud,
  teamToCloud,
} from "@/services/backup/adapters/teamAdapter";
import { useTeamResultCacheStore } from "@/stores/useTeamResultCacheStore";
import { useTeamStore } from "@/stores/useTeamStore";

function fixture() {
  return {
    activePresetId: null,
    compDeltas: [
      {
        kind: "custom",
        id: "custom-team",
        value: {
          id: "custom-team",
          name: "Imported",
          slots: [
            { charId: "hu_tao", weaponId: "staff_of_homa", artifactSet: null },
          ],
          reactions: [],
        },
      },
      { kind: "preset", id: "preset-team", displayIndex: 2 },
    ],
    configsByTeamId: {
      "custom-team": {
        combatOptions: { "hu_tao.lowHp": "on" },
        charConfigs: { hu_tao: { constellation: 2, refinement: 3 } },
        damage: {
          formulaMode: "single",
          selectedFormula: { charId: "hu_tao", formulaId: "hu_tao-charged" },
          singleReaction: { reaction: "vaporize" },
          enemyAura: "Hydro",
          combo: {
            id: "saved",
            label: { en: "Saved", zh: "已保存" },
            lines: [
              {
                charId: "hu_tao",
                formulaId: "hu_tao-charged",
                count: 11,
                reaction: { reaction: "vaporize" },
              },
            ],
          },
        },
        investment: {
          configs: [
            {
              charId: "hu_tao",
              startConstellation: 0,
              startRefinement: 1,
              maxConstellation: 6,
              maxRefinement: 5,
            },
          ],
          comboOverrides: {
            "hu_tao|3|hu_tao-charged": 15,
            "_rx-delta|hu_tao|rx-vaporize": 4,
          },
          enemyAura: "Cryo",
          extraBuffs: [],
          reactionOverrides: { "hu_tao.hu_tao-charged": { reaction: "melt" } },
        },
        energy: {
          timelines: [
            { actions: [{ char: "hu_tao", action: "E" }], periodic: [] },
          ],
          mode: "zero-energy-start",
        },
      },
      "preset-team": {
        combatOptions: {},
        investment: { minErOverrides: { "hu_tao|4": 1.5 } },
      },
      malformed: {
        combatOptions: {},
        investment: {
          configs: "unexpected optional blob",
          futureCountChanges: [
            null,
            {
              charId: "hu_tao",
              constellation: 4,
              formulaId: "hu_tao-charged",
              delta: -1,
            },
          ],
        },
      },
    },
    author: "User",
    description: "Keep me",
    updatedAt: 1700000000000,
  };
}

beforeEach(() => {
  useTeamStore.getState().clearTeams();
  useTeamResultCacheStore.getState().clearAll();
});

describe("team analysis persistence boundaries", () => {
  it("hydrates the public v23 envelope without reinterpreting delta/exact maps and roundtrips new absolute targets", async () => {
    const prior = teamFromCloud([
      {
        namespace: "teams",
        partitionKey: "all",
        schemaVersion: 4,
        conflictPolicy: "explicit-choice",
        isDefaultState: false,
        payload: fixture(),
      },
    ]);
    prior.configsByTeamId["custom-team"].investment!.futureCountChanges = [
      {
        charId: "hu_tao",
        constellation: 4,
        formulaId: "hu_tao-charged",
        delta: -2,
      },
    ];
    const original = structuredClone(
      prior.configsByTeamId["custom-team"].investment
    );
    localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({ version: 23, state: prior })
    );
    await useTeamStore.persist.rehydrate();
    expect(
      useTeamStore.getState().configsByTeamId["custom-team"].investment
    ).toEqual(original);
    expect(original?.absoluteCountTargets).toBeUndefined();
    const targets = [
      {
        charId: "hu_tao",
        constellation: 4,
        formulaId: "hu_tao-charged",
        count: 15,
      },
    ];
    useTeamStore.getState().updateTeamSetupConfig("custom-team", (config) => ({
      ...config,
      investment: { ...config.investment, absoluteCountTargets: targets },
    }));
    await useTeamStore.persist.rehydrate();
    expect(
      useTeamStore.getState().configsByTeamId["custom-team"].investment
        ?.absoluteCountTargets
    ).toEqual(targets);
    const cloud = teamToCloud({
      ...prior,
      configsByTeamId: useTeamStore.getState().configsByTeamId,
    })[0];
    expect(
      teamFromCloud([cloud]).configsByTeamId["custom-team"].investment
        ?.absoluteCountTargets
    ).toEqual(targets);
    expect(
      teamFromCloud([{ ...cloud, schemaVersion: 5, payload: prior }])
        .configsByTeamId["custom-team"].investment
    ).toEqual(original);
  });
  it("hydrates realistic v22 custom/preset data and preserves divergent inputs, exact overrides and timelines", async () => {
    const old = fixture();
    localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({ state: old, version: 22 })
    );
    await useTeamStore.persist.rehydrate();
    const state = useTeamStore.getState();
    const config = state.configsByTeamId["custom-team"];
    expect(state.description).toBe(old.description);
    expect(state.compDeltas.some((delta) => delta.id === "preset-team")).toBe(
      true
    );
    expect(config.damage).toEqual(old.configsByTeamId["custom-team"].damage);
    expect(config.energy).toEqual(old.configsByTeamId["custom-team"].energy);
    expect(config.investment?.legacyCountOverrides).toEqual(
      old.configsByTeamId["custom-team"].investment.comboOverrides
    );
    expect(config.investment?.legacyInputs).toMatchObject({
      enemyAura: "Cryo",
      extraBuffs: [],
      startingValues: { hu_tao: { constellation: 0, refinement: 1 } },
      reactionOverrides: { "hu_tao.hu_tao-charged": { reaction: "melt" } },
    });
    expect(config.investment?.configs?.[0]).not.toHaveProperty(
      "startConstellation"
    );
    expect(
      state.configsByTeamId.malformed.investment?.futureCountChanges
    ).toHaveLength(1);
    expect(
      JSON.parse(localStorage.getItem("team-builder-storage")!).version
    ).toBe(26);
  });
  it("uses the same transform for old cloud snapshots and exports only the new semantics", () => {
    const old = fixture();
    const restored = teamFromCloud([
      {
        namespace: "teams",
        partitionKey: "all",
        schemaVersion: 4,
        conflictPolicy: "explicit-choice",
        isDefaultState: false,
        payload: old,
      },
    ]);
    const investment = restored.configsByTeamId["custom-team"].investment;
    expect(investment?.legacyCountOverrides).toEqual(
      old.configsByTeamId["custom-team"].investment.comboOverrides
    );
    expect(investment?.legacyInputs?.enemyAura).toBe("Cryo");
    const exported = teamToCloud(restored)[0];
    expect(exported.schemaVersion).toBe(8);
    expect(
      teamFromCloud([exported]).configsByTeamId["custom-team"].investment
    ).toEqual(investment);
    expect(teamFromCloud([]).configsByTeamId).toEqual({});
  });
  it("invalidates old derived results through public hydration, even when their internal blobs are malformed", async () => {
    localStorage.setItem(
      "team-result-cache",
      JSON.stringify({
        version: 5,
        state: {
          resultsByTeamId: {
            "custom-team": {
              investmentResult: { sequence: "bad", nodesByJin: null },
            },
          },
        },
      })
    );
    await useTeamResultCacheStore.persist.rehydrate();
    expect(useTeamResultCacheStore.getState().resultsByTeamId).toEqual({});
  });
  it("keeps composition-only export free of calculation configs and invalidates results on real shared edits", () => {
    const id = useTeamStore.getState().addTeam({
      name: "Custom",
      characters: ["hu_tao"],
      weapons: ["staff_of_homa"],
    });
    useTeamResultCacheStore
      .getState()
      .setChoiceResult(
        id,
        "weapon",
        { mode: "weapon", timestamp: 1, perCharacter: {} },
        "before-edit"
      );
    useTeamStore
      .getState()
      .updateTeamSetupConfig(id, { damage: { formulaMode: "single" } });
    expect(useTeamResultCacheStore.getState().getForTeam(id)).toBeUndefined();
    expect(
      useTeamStore.getState().exportTeams("", "").teams[0]
    ).not.toHaveProperty("damage");
    expect(
      useTeamStore.getState().exportTeams("", "").teams[0]
    ).not.toHaveProperty("investment");
  });
});
