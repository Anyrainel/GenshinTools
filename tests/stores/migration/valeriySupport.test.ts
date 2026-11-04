import { describe, expect, it, vi } from "vitest";
import { betaEnabled } from "@/config/beta";
import {
  getBuffInstanceKey,
  ScalingBuff,
} from "@/domain/combat/damage/core/statBuff";
import type { BuffActivationMap } from "@/domain/combat/damage/types";
import type { TeamSetupConfig } from "@/domain/team/types";
import {
  teamFromCloud,
  teamToCloud,
} from "@/services/backup/adapters/teamAdapter";
import { migrateValeriySupportConfig } from "@/stores/migration/valeriySupport";
import { useTeamStore } from "@/stores/useTeamStore";

vi.hoisted(() => {
  process.env.__BETA_ENABLED_OVERRIDE__ = "false";
});

// Frozen pre-release A6/A7 and official A7/A8 values, levels 1–15.
const ROWS = [
  [0.2432, 0.7296, 0.2432, 0.7296],
  [0.2614, 0.7843, 0.26144, 0.78432],
  [0.2797, 0.839, 0.27968, 0.83904],
  [0.304, 0.912, 0.304, 0.912],
  [0.3222, 0.9667, 0.32224, 0.96672],
  [0.3405, 1.0214, 0.34048, 1.02144],
  [0.3648, 1.0944, 0.3648, 1.0944],
  [0.3891, 1.1674, 0.38912, 1.16736],
  [0.4134, 1.2403, 0.41344, 1.24032],
  [0.4378, 1.3133, 0.43776, 1.31328],
  [0.4621, 1.3862, 0.46208, 1.38624],
  [0.4864, 1.4592, 0.4864, 1.4592],
  [0.5168, 1.5504, 0.5168, 1.5504],
  [0.5472, 1.6416, 0.5472, 1.6416],
  [0.5776, 1.7328, 0.5776, 1.7328],
];

function supportKey(scale: number, stellar: boolean, provider = "valeriy") {
  return getBuffInstanceKey(
    new ScalingBuff(
      {
        type: "character",
        id: "valeriy",
        origin: "A/P2",
        triggers: ["charge"],
        maxStacks: 15,
      },
      {
        receiver: "teamOnField",
        filter: {
          elements: ["Electro"],
          abilities: ["normal", "charge", "plunge", "skill", "burst"],
          ...(stellar ? { reactions: ["stellarConduct" as const] } : {}),
        },
      },
      [],
      "atk",
      "baseDmg",
      scale
    ),
    provider
  );
}

function config(buffs: BuffActivationMap): TeamSetupConfig {
  return {
    combatOptions: { valeriy: "normal-100" },
    charConfigs: {
      valeriy: { constellation: 0, talentLevels: { auto: 10 } },
    },
    damage: {
      formulaMode: "combo",
      combo: {
        id: "authored-support",
        label: { en: "My support rotation", zh: "辅助循环" },
        lines: [{ charId: "valeriy", formulaId: "valeriy-skill", count: 2 }],
        buffOverrides: { 0: buffs },
      },
    },
  };
}

function snapshot(configsByTeamId: Record<string, TeamSetupConfig>) {
  return {
    activePresetId: null,
    compDeltas: Object.keys(configsByTeamId).map((id) => ({
      kind: "custom" as const,
      id,
      value: {
        id,
        name: "Saved Valeriy support",
        slots: [
          { charId: "valeriy", weaponId: "favonius_sword", artifactSet: null },
        ],
        reactions: [],
      },
    })),
    configsByTeamId,
    author: "Player",
    description: "Authored before official talent rows were corrected",
    updatedAt: 123,
  };
}

describe("Valeriy released support override identities", () => {
  it("recovers old beta and Stellar keys while preserving ambiguous official keys through public hydration and cloud paths", async () => {
    expect(betaEnabled()).toBe(false);
    const configs: Record<string, TeamSetupConfig> = {};
    const expected: Record<string, string> = {};
    ROWS.forEach((row, index) => {
      for (const charge of [40, 100, 130]) {
        // C4 is needed for 130 charge; its C3 adds three normal talent levels.
        if (charge === 130 && index < 3) continue;
        for (const constellation of charge === 130 ? [4, 6] : [0, 2, 3]) {
          if (constellation >= 3 && index < 3) continue;
          for (const stellar of [false, true]) {
            for (const format of ["beta", "misindexed-official"]) {
              const rate = stellar ? 0.009 : 0.003;
              const base =
                format === "beta"
                  ? row[stellar ? 1 : 0]
                  : stellar
                    ? row[2]
                    : 20;
              const oldKey = supportKey(base + charge * rate, stellar);
              const currentKey = supportKey(
                row[stellar ? 3 : 2] + charge * rate,
                stellar
              );
              const id = `${format}-${index + 1}-${charge}-${constellation}-${stellar}`;
              configs[id] = {
                ...config({ [oldKey]: { 0: 0, 1: 0.25 } }),
                combatOptions: {
                  valeriy: `${stellar ? "stellar" : "normal"}-${charge}`,
                },
                charConfigs: {
                  valeriy: {
                    constellation,
                    talentLevels: {
                      auto: index + 1 - (constellation >= 3 ? 3 : 0),
                    },
                  },
                },
              };
              expected[id] =
                format === "misindexed-official" && !stellar
                  ? oldKey
                  : currentKey;
            }
          }
        }
      }
    });
    const original = snapshot(configs);
    const before = structuredClone(original);
    const verify = (result: Record<string, TeamSetupConfig>) => {
      for (const [id, key] of Object.entries(expected)) {
        expect(result[id].damage?.combo?.buffOverrides?.[0], id).toEqual({
          [key]: { 0: 0, 1: 0.25 },
        });
        expect(result[id].damage?.combo?.lines[0].count).toBe(2);
      }
    };
    for (const version of [25, 26]) {
      window.localStorage.setItem(
        "team-builder-storage",
        JSON.stringify({ version, state: original })
      );
      await useTeamStore.persist.rehydrate();
      verify(useTeamStore.getState().configsByTeamId);
    }
    for (const schemaVersion of [7, 8]) {
      verify(
        teamFromCloud([
          {
            namespace: "teams",
            partitionKey: "all",
            schemaVersion,
            conflictPolicy: "explicit-choice",
            payload: original,
          },
        ]).configsByTeamId
      );
    }
    verify(teamToCloud(original)[0].payload.configsByTeamId);
    useTeamStore.getState().replaceSourceState(original);
    verify(useTeamStore.getState().configsByTeamId);
    // All transforms are pure, including the cloud export normalization.
    expect(original).toEqual(before);
  });

  it("keeps canonical collisions and unknown identities without broad rewrites", () => {
    const oldKey = supportKey(0.4378 + 100 * 0.003, false);
    const currentKey = supportKey(0.43776 + 100 * 0.003, false);
    const unknowns = [
      "opaque-valeriy-0.7378",
      supportKey(0.4378 + 100 * 0.003, false, "qiqi"),
      oldKey.replace("A/P2", "P2"),
      oldKey.replace("ScalingBuff", "OtherBuff"),
      oldKey.replace("teamOnField", "team"),
      oldKey.replace("Electro", "Cryo"),
      oldKey.replace("atk\u0000baseDmg", "em\u0000baseDmg"),
      oldKey.replace("\u0000\u0000charge", "\u0000\u0000E"),
      supportKey(999, false),
    ];
    for (const keys of [
      [oldKey, currentKey],
      [currentKey, oldKey],
    ]) {
      const buffs = {
        ...Object.fromEntries(unknowns.map((key) => [key, { 0: 0.5 }])),
        ...Object.fromEntries(
          keys.map((key) => [key, { 0: key === currentKey ? 0.75 : 0 }])
        ),
      };
      const migrated = migrateValeriySupportConfig(config(buffs));
      expect(migrated.damage?.combo?.buffOverrides?.[0]).toEqual({
        ...Object.fromEntries(unknowns.map((key) => [key, { 0: 0.5 }])),
        [currentKey]: { 0: 0.75 },
      });
      expect(migrateValeriySupportConfig(migrated)).toEqual(migrated);
    }
  });

  it("preserves ambiguous temporary stamina identities with or without saved talents", () => {
    const oldKey = supportKey(20 + 100 * 0.003, false);
    // Historical cloud data can omit combatOptions before schema healing.
    const legacy = {
      damage: config({ [oldKey]: { 0: 0 } }).damage,
    } as TeamSetupConfig;
    expect(migrateValeriySupportConfig(legacy)).toEqual(legacy);
    for (const charConfigs of [
      undefined,
      { valeriy: { constellation: 2 } },
      { valeriy: { talentLevels: { auto: 10 } } },
      { valeriy: { constellation: 0, talentLevels: { auto: 10 } } },
      { valeriy: { constellation: 3, talentLevels: { auto: 10 } } },
    ]) {
      const saved = { ...config({ [oldKey]: { 0: 0 } }), charConfigs };
      expect(migrateValeriySupportConfig(saved)).toEqual(saved);
    }
  });

  it("preserves ambiguous stamina keys when Tartaglia may add a talent level", async () => {
    const oldKey = supportKey(20 + 130 * 0.003, false);
    const saved = {
      ...config({ [oldKey]: { 0: 0.25 } }),
      charConfigs: undefined,
      combatOptions: {
        valeriy: "normal-130",
        "valeriy.overrideTalentAuto": "10",
        "valeriy.overrideConstellation": "4",
      },
    };
    const original = snapshot({ "tartaglia-support": saved });
    original.compDeltas[0].value.slots.push({
      charId: "tartaglia",
      weaponId: "favonius_warbow",
      artifactSet: null,
    });
    const expected = { [oldKey]: { 0: 0.25 } };
    window.localStorage.setItem(
      "team-builder-storage",
      JSON.stringify({ version: 25, state: original })
    );
    await useTeamStore.persist.rehydrate();
    expect(
      useTeamStore.getState().configsByTeamId["tartaglia-support"].damage?.combo
        ?.buffOverrides?.[0]
    ).toEqual(expected);
    expect(
      teamToCloud(original)[0].payload.configsByTeamId["tartaglia-support"]
        .damage?.combo?.buffOverrides?.[0]
    ).toEqual(expected);
    expect(migrateValeriySupportConfig(saved)).toEqual(saved);
  });
});
