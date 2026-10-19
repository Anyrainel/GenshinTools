import { afterEach, describe, expect, it } from "vitest";
import {
  getBuffInstanceKey,
  StatBuff,
} from "@/domain/combat/damage/core/statBuff";
import type {
  BuffActivationMap,
  BuffTarget,
} from "@/domain/combat/damage/types";
import type { TeamSetupConfig } from "@/domain/team/types";
import {
  teamFromCloud,
  teamToCloud,
} from "@/services/backup/adapters/teamAdapter";
import { migrateCharacterBuffActivationMap } from "@/stores/migration/characterBuffTriggers";
import { useTeamStore } from "@/stores/useTeamStore";

function buffKey(
  id: string,
  origin: string,
  triggers: string[],
  target: BuffTarget = { receiver: "self" },
  stat: "atk%" | "baseDmg%" = "atk%"
): string {
  return getBuffInstanceKey(
    new StatBuff({ type: "character", id, origin, triggers }, target, [
      { key: stat, value: stat === "atk%" ? 0.6 : 0.2 },
    ]),
    id
  );
}

function hpBuffKey(
  id: string,
  origin: string,
  triggers: string[],
  value: number
) {
  return getBuffInstanceKey(
    new StatBuff(
      { type: "character", id, origin, triggers },
      { receiver: "self" },
      [{ key: "hp%", value }]
    ),
    id
  );
}

const oldFurina = hpBuffKey("furina", "C2", [], 1.4);
const newFurina = hpBuffKey("furina", "C2", ["Q"], 1.4);
const oldYelan = hpBuffKey("yelan", "P1", ["A1"], 0.12);
const newYelan = hpBuffKey("yelan", "P1", [], 0.12);

function snapshot() {
  const config: TeamSetupConfig = {
    combatOptions: {},
    damage: {
      combo: {
        id: "authored",
        label: { en: "Saved", zh: "已保存" },
        lines: [
          { charId: "furina", formulaId: "furina-salon-total", count: 7 },
        ],
        buffOverrides: {
          0: { [oldFurina]: { 0: 0, 1: 0.5 }, [oldYelan]: { 0: 0.75 } },
        },
      },
    },
    investment: { legacyCountOverrides: { "furina|2|furina-salon-total": 9 } },
  };
  return {
    activePresetId: null,
    compDeltas: [
      {
        kind: "custom" as const,
        id: "saved-team",
        value: {
          id: "saved-team",
          name: "Saved team",
          reactions: [],
          slots: [
            { charId: "furina", weaponId: null, artifactSet: null },
            { charId: "yelan", weaponId: null, artifactSet: null },
            { charId: "kaedehara_kazuha", weaponId: null, artifactSet: null },
          ],
        },
      },
    ],
    configsByTeamId: { "saved-team": config },
    author: "Player",
    description: "Authored",
    updatedAt: 123,
  };
}

function expectMigrated(config: TeamSetupConfig) {
  expect(config.damage?.combo?.buffOverrides?.[0]).toEqual({
    [newFurina]: { 0: 0, 1: 0.5 },
    [newYelan]: { 0: 0.75 },
  });
  expect(config.damage?.combo?.lines[0].count).toBe(7);
  expect(config.investment?.legacyCountOverrides).toEqual({
    "furina|2|furina-salon-total": 9,
  });
}

afterEach(() => {
  useTeamStore.getState().clearTeams();
  window.localStorage.removeItem("team-builder-storage");
});

describe("character activation identity migration", () => {
  it.each([
    ["yanfei", "P1", "A1", "charge"],
    ["yun_jin", "P2", "A4,Q", "Q"],
    ["kirara", "P2", "A4", ""],
    ["zibai", "P3", "passive", ""],
    ["yelan", "P2", "A4,Q", "Q"],
    ["qiqi", "C2", "passive", "polestar-field,stellarSwirl"],
    ["yumemizuki_mizuki", "P2", "A4,E", "E,teammate-elemental-hit"],
    ["yumemizuki_mizuki", "C1", "passive", "E"],
    ["yoimiya", "P1", "A1", "E,normal"],
    ["yoimiya", "P2", "A4,Q", "Q"],
    ["yae_miko", "P2", "A4", ""],
    ["wriothesley", "P4", "passive", "polestar-field"],
    ["wriothesley", "C4", "passive", "polestar-field"],
    ["xilonen", "P1", "A1", "Nightsoul"],
    ["nefer", "P3", "passive", ""],
    ["flins", "P3", "passive", ""],
    ["flins", "P1", "passive", ""],
    ["lauma", "P3", "passive", ""],
    ["lauma", "P2", "passive", ""],
    ["ineffa", "P3", "passive", ""],
    ["linnea", "P3", "passive", ""],
    ["sandrone", "P3", "passive", ""],
    ["vesna", "P3", "passive", ""],
    ["traveler_cryo", "P3", "passive", ""],
    ["traveler_dendro", "P2", "A4", ""],
    ["kachina", "P2", "A2", ""],
  ])("migrates provenance cleanup for %s %s", (id, origin, before, after) => {
    for (const target of [
      { receiver: "self" },
      { receiver: "teamOnField" },
    ] satisfies BuffTarget[]) {
      const oldKey = buffKey(id, origin, before.split(","), target);
      const currentKey = buffKey(
        id,
        origin,
        after ? after.split(",") : [],
        target
      );
      const migrated = migrateCharacterBuffActivationMap({
        [oldKey]: { 0: 0.5 },
      });
      expect(migrated).toEqual({ [currentKey]: { 0: 0.5 } });
      expect(migrateCharacterBuffActivationMap(migrated)).toEqual(migrated);
      expect(
        migrateCharacterBuffActivationMap({
          [oldKey]: { 0: 0 },
          [currentKey]: { 0: 0.75 },
        })
      ).toEqual({ [currentKey]: { 0: 0.75 } });
    }
  });

  it.each([24, 25])(
    "hydrates a v%i team with legacy activation keys",
    async (version) => {
      window.localStorage.setItem(
        "team-builder-storage",
        JSON.stringify({
          version,
          state: snapshot(),
        })
      );
      await useTeamStore.persist.rehydrate();
      expectMigrated(useTeamStore.getState().configsByTeamId["saved-team"]);
      expect(useTeamStore.getState().teamComps[0].id).toBe("saved-team");
    }
  );

  it("normalizes config imports and exports/restores versioned cloud snapshots", () => {
    useTeamStore.getState().replaceSourceState(snapshot());
    expectMigrated(useTeamStore.getState().configsByTeamId["saved-team"]);
    const oldPartition = {
      ...teamToCloud(snapshot())[0],
      schemaVersion: 6,
      payload: snapshot(),
    };
    const restored = teamFromCloud([oldPartition]);
    expectMigrated(restored.configsByTeamId["saved-team"]);
    const unpublished = teamFromCloud([{ ...oldPartition, schemaVersion: 7 }]);
    expectMigrated(unpublished.configsByTeamId["saved-team"]);
    const exported = teamToCloud(restored);
    expect(exported[0].schemaVersion).toBe(7);
    expectMigrated(exported[0].payload.configsByTeamId["saved-team"]);
    expect(teamFromCloud(exported)).toEqual(restored);
  });

  it("distinguishes shared origins and preserves current/opaque keys idempotently", () => {
    const kleeTarget: BuffTarget = { receiver: "selfOnField" };
    const kleeAtk = buffKey("klee", "C1", [], kleeTarget);
    const kleeProc = buffKey("klee", "C1", [], kleeTarget, "baseDmg%");
    const varkaTarget: BuffTarget = {
      receiver: "selfOnField",
      filter: { abilities: ["normal", "charge", "skill"] },
    };
    const varkaMode = buffKey("varka", "P1", [], varkaTarget);
    const varkaConversion = buffKey("varka", "P1", []);
    const linneaSelf = buffKey("linnea", "P2", ["passive"]);
    const linneaTeam = buffKey("linnea", "P2", ["passive"], {
      receiver: "teamOnField",
    });
    const odetteSelf = buffKey("odette", "C6", []);
    const odetteTeam = buffKey("odette", "C6", [], { receiver: "team" });
    const buffs: BuffActivationMap = {
      [oldFurina]: { 0: 0 },
      [newFurina]: { 0: 0.25 },
      [kleeAtk]: { 0: 0.5 },
      [kleeProc]: { 0: 0 },
      [varkaMode]: { 0: 0.5 },
      [varkaConversion]: { 0: 0 },
      [linneaSelf]: { 0: 0.2 },
      [linneaTeam]: { 0: 0.4 },
      [odetteSelf]: { 0: 0.3 },
      [odetteTeam]: { 0: 0.6 },
      "future-opaque-key": { 0: 0.7 },
    };
    const migrated = migrateCharacterBuffActivationMap(buffs);
    expect(migrated).toEqual({
      [newFurina]: { 0: 0.25 },
      [buffKey(
        "klee",
        "C1",
        ["normal", "charge", "plunge", "E", "Q"],
        kleeTarget
      )]: { 0: 0.5 },
      [kleeProc]: { 0: 0 },
      [buffKey("varka", "P1", ["E"], varkaTarget)]: { 0: 0.5 },
      [varkaConversion]: { 0: 0 },
      [buffKey("linnea", "P2", [])]: { 0: 0.2 },
      [buffKey("linnea", "P2", [], { receiver: "teamOnField" })]: { 0: 0.4 },
      [odetteSelf]: { 0: 0.3 },
      [buffKey("odette", "C6", ["E", "Q"], { receiver: "team" })]: { 0: 0.6 },
      "future-opaque-key": { 0: 0.7 },
    });
    expect(migrateCharacterBuffActivationMap(migrated)).toEqual(migrated);
    expect(buffs[oldFurina]).toEqual({ 0: 0 });
  });
});
