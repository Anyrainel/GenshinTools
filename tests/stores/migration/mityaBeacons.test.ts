import { beforeEach, describe, expect, it } from "vitest";
import {
  getBuffInstanceKey,
  StatBuff,
} from "@/domain/combat/damage/core/statBuff";
import type { BuffActivationMap } from "@/domain/combat/damage/types";
import type { TeamSetupConfig } from "@/domain/team/types";
import {
  teamFromCloud,
  teamToCloud,
} from "@/services/backup/adapters/teamAdapter";
import { migrateLegacyMityaBeaconConfigs } from "@/stores/migration/mityaBeacons";
import { useTeamStore } from "@/stores/useTeamStore";

function key(em: number, provider = "mitya") {
  return getBuffInstanceKey(
    new StatBuff(
      { type: "character", id: "mitya", origin: "P1", triggers: ["E"] },
      { receiver: "team" },
      [{ key: "em", value: em }]
    ),
    provider
  );
}

const oldKey = key(120);
const currentKey = key(90);
const oldActivation = { 0: 0 };

function config(buffs: BuffActivationMap): TeamSetupConfig {
  return {
    combatOptions: { mitya: "stable" },
    charConfigs: { mitya: { constellation: 0 } },
    damage: {
      combo: {
        id: "authored-core",
        label: { en: "My steady Core", zh: "稳态炉心" },
        lines: [
          { charId: "mitya", formulaId: "mitya-prism-shatter", count: 2 },
        ],
        buffOverrides: { 0: buffs },
      },
    },
  };
}

function snapshot(buffs: BuffActivationMap) {
  return {
    activePresetId: null,
    compDeltas: ["nonreactive", "reactive"].map((id) => ({
      kind: "custom" as const,
      id,
      value: {
        id,
        name: "Saved steady Core team",
        slots: [
          { charId: "mitya", weaponId: "starsealed_edict", artifactSet: null },
          {
            charId: id === "reactive" ? "qiqi" : "barbara",
            weaponId: id === "reactive" ? "favonius_sword" : "favonius_codex",
            artifactSet: null,
          },
        ],
        reactions: [],
      },
    })),
    configsByTeamId: {
      nonreactive: config(buffs),
      reactive: config(buffs),
    },
    author: "Player",
    description: "Saved before carried Beacons respected reaction feasibility",
    updatedAt: 123,
  };
}

function overrides(
  configs: Record<string, TeamSetupConfig>,
  id = "nonreactive"
) {
  return configs[id].damage?.combo?.buffOverrides?.[0];
}

beforeEach(() => localStorage.clear());

describe("Mitya carried-Beacon activation migration", () => {
  it.each([0, 0.25])(
    "hydrates v25 and restores cloud v7 preserving activation %s for both P1 variants",
    async (activation) => {
      const authored = { 0: activation };
      const before = snapshot({ [oldKey]: authored });
      const untouched = structuredClone(before);
      localStorage.setItem(
        "team-builder-storage",
        JSON.stringify({ version: 25, state: before })
      );
      await useTeamStore.persist.rehydrate();
      const local = useTeamStore.getState();
      const cloud = teamFromCloud([
        {
          namespace: "teams",
          partitionKey: "all",
          schemaVersion: 7,
          conflictPolicy: "explicit-choice",
          payload: before,
        },
      ]);
      for (const configs of [local.configsByTeamId, cloud.configsByTeamId]) {
        for (const id of ["nonreactive", "reactive"]) {
          expect(overrides(configs, id)).toEqual({
            [oldKey]: authored,
            [currentKey]: authored,
          });
          expect(configs[id].damage?.combo?.lines[0].count).toBe(2);
        }
      }
      expect(local.description).toBe(before.description);
      expect(
        JSON.parse(localStorage.getItem("team-builder-storage")!).version
      ).toBe(27);
      expect(before).toEqual(untouched);
    }
  );

  it("does not reseed a deliberately deleted 90 EM override on current hydration, cloud round-trip or replacement", async () => {
    localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({
        version: 25,
        state: snapshot({ [oldKey]: oldActivation }),
      })
    );
    await useTeamStore.persist.rehydrate();
    useTeamStore.getState().updateTeamSetupConfig("nonreactive", (saved) => {
      const combo = saved.damage!.combo!;
      const { [currentKey]: _removed, ...remaining } = combo.buffOverrides![0];
      return {
        ...saved,
        damage: {
          ...saved.damage,
          combo: { ...combo, buffOverrides: { 0: remaining } },
        },
      };
    });
    await useTeamStore.persist.rehydrate();
    expect(overrides(useTeamStore.getState().configsByTeamId)).toEqual({
      [oldKey]: oldActivation,
    });
    const current = {
      ...snapshot({ [oldKey]: oldActivation }),
      configsByTeamId: useTeamStore.getState().configsByTeamId,
    };
    const exported = teamToCloud(current);
    expect(exported[0].schemaVersion).toBe(9);
    const restored = teamFromCloud(exported);
    expect(overrides(restored.configsByTeamId)).toEqual({
      [oldKey]: oldActivation,
    });
    useTeamStore.getState().replaceSourceState(restored);
    expect(overrides(useTeamStore.getState().configsByTeamId)).toEqual({
      [oldKey]: oldActivation,
    });
  });

  it("preserves explicit new identities and unrelated source shapes without broad rewrites", () => {
    const unknown = [
      "opaque-mitya-em:120",
      key(120, "qiqi"),
      key(150),
      oldKey.replace("P1", "C2"),
      oldKey.replace("team", "self"),
      oldKey.replace("StatBuff", "ScalingBuff"),
    ];
    const buffs = {
      ...Object.fromEntries(unknown.map((id) => [id, { 0: 0.5 }])),
      [oldKey]: oldActivation,
      [currentKey]: { 0: 0.75 },
    };
    expect(
      overrides(migrateLegacyMityaBeaconConfigs({ nonreactive: config(buffs) }))
    ).toEqual(buffs);
    const onlyUnknowns = Object.fromEntries(
      unknown.map((id) => [id, { 0: 0.5 }])
    );
    expect(
      overrides(
        migrateLegacyMityaBeaconConfigs({ nonreactive: config(onlyUnknowns) })
      )
    ).toEqual(onlyUnknowns);
  });
});
