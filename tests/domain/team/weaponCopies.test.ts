import { describe, expect, it } from "vitest";
import type { AccountData } from "@/domain/models";
import { buildEnergyTeamSlots } from "@/domain/team/energyTeamSlots";
import {
  buildTeamSlotConfigs,
  resetFiveStarRosterConfig,
  useAccountRosterConfig,
} from "@/domain/team/teamConfigUtils";
import { teamCompInputToComp } from "@/domain/team/teamDeltas";
import {
  collectOwnedWeaponCopies,
  resolveRosterWeaponCopies,
} from "@/domain/team/weaponCopies";

const comp = teamCompInputToComp({
  id: "copies",
  characters: ["bennett", "xingqiu", "jean", "hu_tao"],
  weapons: [
    "favonius_sword",
    "favonius_sword",
    "favonius_sword",
    "staff_of_homa",
  ],
});
function account(): AccountData {
  return {
    characters: [
      {
        key: "bennett",
        constellation: 4,
        level: 80,
        talent: { auto: 3, skill: 8, burst: 9 },
        artifacts: {},
        weapon: {
          id: "equipped",
          key: "favonius_sword",
          refinement: 2,
          level: 90,
          lock: true,
        },
      },
    ],
    extraArtifacts: [],
    extraWeapons: [
      {
        id: "inventory",
        key: "favonius_sword",
        refinement: 5,
        level: 90,
        lock: false,
      },
      {
        id: "equipped",
        key: "favonius_sword",
        refinement: 5,
        level: 90,
        lock: true,
      },
    ],
  };
}

describe("slot-aware weapon copies", () => {
  it("defaults Traveler to C6 while roster account values and overrides remain authoritative", () => {
    const team = teamCompInputToComp({
      id: "traveler",
      characters: ["traveler_cryo"],
      weapons: ["exaiphanes_blade"],
    });
    const setup = { combatOptions: {} };
    expect(buildTeamSlotConfigs(team, setup, null)[0]).toMatchObject({
      constellation: 6,
      refinement: 5,
    });
    const imported = account();
    imported.characters[0].key = "traveler_cryo";
    imported.characters[0].constellation = 2;
    imported.characters[0].weapon!.key = "exaiphanes_blade";
    imported.characters[0].weapon!.refinement = 3;
    expect(buildTeamSlotConfigs(team, setup, imported)[0]).toMatchObject({
      constellation: 2,
      refinement: 3,
    });
    expect(
      buildTeamSlotConfigs(
        team,
        {
          combatOptions: {},
          charConfigs: { traveler_cryo: { constellation: 1, refinement: 2 } },
        },
        imported
      )[0]
    ).toMatchObject({ constellation: 1, refinement: 2 });
    expect(
      buildEnergyTeamSlots(team, setup, null, null)[0]?.constellation
    ).toBe(6);
  });
  it("defaults the gift sword to R5 while preserving explicit refinements", () => {
    const team = teamCompInputToComp({
      id: "gift",
      characters: ["traveler_cryo"],
      weapons: ["exaiphanes_blade"],
    });
    expect(
      resolveRosterWeaponCopies(team, { combatOptions: {} }, null)[0].refinement
    ).toBe(5);
    expect(
      resolveRosterWeaponCopies(
        team,
        {
          combatOptions: {},
          charConfigs: { traveler_cryo: { refinement: 2 } },
        },
        null
      )[0].refinement
    ).toBe(2);
    expect(
      resetFiveStarRosterConfig(team, { combatOptions: {} }).charConfigs
        ?.traveler_cryo.refinement
    ).toBe(5);
  });
  it("energy conversion uses the same assigned copies and preserves slot positions across empty slots", () => {
    const team = teamCompInputToComp({
      id: "energy",
      characters: ["bennett", null, "xingqiu", null],
      weapons: ["favonius_sword", null, "favonius_sword", null],
    });
    const slots = buildEnergyTeamSlots(
      team,
      { combatOptions: {} },
      account(),
      null
    );
    expect(
      slots.map((slot) => [slot.charId, slot.weaponId, slot.refinement])
    ).toEqual([
      ["bennett", "favonius_sword", 4],
      ["xingqiu", "favonius_sword", 1],
    ]);
    const overridden = buildEnergyTeamSlots(
      team,
      { combatOptions: { "xingqiu.overrideRefinement": "4" } },
      account(),
      null
    );
    expect(overridden[1].refinement).toBe(3);
  });
  it("deduplicates equipped/inventory IDs and assigns highest R once, then next R, then shortage", () => {
    const data = account();
    expect(
      collectOwnedWeaponCopies(data).map((copy) => [copy.id, copy.refinement])
    ).toEqual([
      ["inventory", 5],
      ["equipped", 2],
    ]);
    const slots = resolveRosterWeaponCopies(comp, { combatOptions: {} }, data);
    expect(slots.map((slot) => slot.refinement)).toEqual([5, 2, 1, 1]);
    expect(slots.map((slot) => slot.copy?.id ?? null)).toEqual([
      "inventory",
      "equipped",
      null,
      null,
    ]);
    expect(slots[2].source).toBe("unowned");
  });
  it("keeps explicit hypothetical overrides without borrowing a second copy", () => {
    const slots = resolveRosterWeaponCopies(
      comp,
      {
        combatOptions: { "xingqiu.overrideRefinement": "4" },
        charConfigs: { jean: { refinement: 5 } },
      },
      account()
    );
    expect(slots.map((slot) => slot.refinement)).toEqual([5, 4, 5, 1]);
    expect(slots[1].copy?.refinement).toBe(2);
    expect(slots[1].hypothetical).toBe(true);
    expect(slots[2].copy).toBeNull();
    expect(slots[2].hypothetical).toBe(true);
  });
  it("labels unavailable account data without invented copies", () => {
    const slots = resolveRosterWeaponCopies(comp, { combatOptions: {} }, null);
    expect(
      slots.every((slot) => slot.copy === null && slot.source === "no-account")
    ).toBe(true);
  });
  it("prefills owned ranks and defaults missing characters/weapons to C0/R1", () => {
    const original = {
      combatOptions: { "bennett.overrideConstellation": "6", enemy: "custom" },
      charConfigs: { jean: { constellation: 6, refinement: 4 } },
      damage: { calcContext: { enemyLevel: 105 } },
    };
    const next = useAccountRosterConfig(comp, original, account());
    expect(next.charConfigs?.bennett).toMatchObject({
      level: 80,
      constellation: 4,
      refinement: 5,
      talentLevels: { auto: 3, skill: 8, burst: 9 },
    });
    expect(next.charConfigs?.xingqiu?.refinement).toBe(2);
    expect(next.charConfigs?.jean).toMatchObject({
      constellation: 0,
      refinement: 1,
    });
    expect(next.combatOptions).toEqual({ enemy: "custom" });
    expect(next.damage).toEqual(original.damage);
    expect(original.combatOptions["bennett.overrideConstellation"]).toBe("6");
  });
  it("resets only configured five-star ranks and preserves equipment/custom counts", () => {
    const original = {
      combatOptions: {},
      charConfigs: {
        bennett: { constellation: 6, refinement: 5 },
        jean: { constellation: 4, refinement: 3 },
        hu_tao: { constellation: 2, refinement: 4 },
      },
      damage: {
        combo: {
          id: "authored",
          label: { en: "custom", zh: "自定义" },
          lines: [{ charId: "hu_tao", formulaId: "custom", count: 17 }],
        },
      },
    };
    const next = resetFiveStarRosterConfig(comp, original);
    expect(next.charConfigs?.bennett).toEqual(original.charConfigs.bennett);
    expect(next.charConfigs?.jean).toEqual({ constellation: 0, refinement: 3 });
    expect(next.charConfigs?.hu_tao).toEqual({
      constellation: 0,
      refinement: 1,
    });
    expect(next.damage).toEqual(original.damage);
    expect(comp.slots[3].weaponId).toBe("staff_of_homa");
  });
});
