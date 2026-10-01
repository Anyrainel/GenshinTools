import { beforeAll, describe, expect, it } from "vitest";
import type { StatKey } from "@/data/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { WeaponBase } from "@/lib/dmgcalc/core/implModel";
import { createWeapon } from "@/lib/dmgcalc/core/registry";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import "@/lib/dmgcalc";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

function passiveSheet(weapon: WeaponBase, onField = true) {
  return weapon.buffs.reduce((sheet, buff) => {
    if (!buff.isApplicable(weapon.charId, weapon.charId, onField)) return sheet;
    return sheet.merge(
      StatSheet.fromEntries(buff.staticBuffs, buff.target.filter)
    );
  }, new StatSheet([]));
}

function passiveValue(weapon: WeaponBase, key: StatKey) {
  return weapon.buffs
    .flatMap((buff) => buff.staticBuffs)
    .filter((entry) => entry.key === key)
    .reduce((sum, entry) => sum + entry.value, 0);
}

describe("7.1 released swords", () => {
  it.each([
    [1, 0.56, 0.36],
    [2, 0.72, 0.45],
    [3, 0.88, 0.54],
    [4, 1.04, 0.63],
    [5, 1.2, 0.72],
  ])("Beyond the Chrysalis R%i scopes both buffs to the active wearer", (refinement, cd, reactionDmg) => {
    const weapon = createWeapon(
      "beyond_the_chrysalis",
      refinement,
      "vesna",
      new TeamMeta(["vesna", "qiqi"])
    );
    const sheet = passiveSheet(weapon);
    expect(sheet.get("cd", null)).toBeCloseTo(cd);
    expect(
      sheet.get("reactionDmg%", {
        element: "Cryo",
        ability: "skill",
        reaction: "stellarSwirl",
      })
    ).toBeCloseTo(reactionDmg);
    for (const reaction of ["stellarConduct", "swirl"] as const) {
      expect(
        sheet.get("reactionDmg%", {
          element: "Cryo",
          ability: "skill",
          reaction,
        })
      ).toBe(0);
    }
    expect(passiveSheet(weapon, false).get("cd", null)).toBe(0);
    for (const buff of weapon.buffs) {
      expect(buff.isApplicable("vesna", "qiqi", true)).toBe(false);
      expect(buff.source.triggers).toEqual(["E", "Q"]);
    }
  });

  it.each([
    [1, 0.12, 60, 0.18, 0.24],
    [2, 0.15, 75, 0.225, 0.3],
    [3, 0.18, 90, 0.27, 0.36],
    [4, 0.21, 105, 0.315, 0.42],
    [5, 0.24, 120, 0.36, 0.48],
  ])("New Bough R%i replaces EM with Stellar damage in Radiance", (refinement, atk, em, radianceAtk, reactionDmg) => {
    const team = new TeamMeta(["vesna", "qiqi"]);
    const base = createWeapon("new_bough", refinement, "qiqi", team);
    expect(passiveValue(base, "atk%")).toBeCloseTo(atk);
    expect(passiveValue(base, "em")).toBe(em);
    expect(passiveValue(base, "reactionDmg%")).toBe(0);
    const radiance = createWeapon("new_bough", refinement, "qiqi", team, {
      new_bough: "on",
    });
    expect(passiveValue(radiance, "atk%")).toBeCloseTo(radianceAtk);
    expect(passiveValue(radiance, "em")).toBe(0);
    for (const reaction of ["stellarConduct", "stellarSwirl"] as const) {
      expect(
        passiveSheet(radiance, false).get("reactionDmg%", {
          element: "Cryo",
          ability: "skill",
          reaction,
        })
      ).toBeCloseTo(reactionDmg);
    }
    expect(
      passiveSheet(radiance).get("reactionDmg%", {
        element: "Cryo",
        ability: "skill",
        reaction: "superconduct",
      })
    ).toBe(0);
  });

  it("New Bough falls back to ATK and EM when Radiance cannot be enabled", () => {
    const weapon = createWeapon(
      "new_bough",
      5,
      "kaedehara_kazuha",
      new TeamMeta(["kaedehara_kazuha", "bennett"]),
      { new_bough: "on" }
    );
    expect(passiveValue(weapon, "atk%")).toBeCloseTo(0.24);
    expect(passiveValue(weapon, "em")).toBe(120);
    expect(passiveValue(weapon, "reactionDmg%")).toBe(0);
  });

  it.each([
    [1, 104],
    [2, 130],
    [3, 156],
    [4, 182],
    [5, 208],
  ])("Silver Light R%i grants two skill stacks to its wearer off-field", (refinement, em) => {
    const weapon = createWeapon(
      "silver_light",
      refinement,
      "kaedehara_kazuha",
      new TeamMeta(["kaedehara_kazuha", "bennett"])
    );
    expect(passiveSheet(weapon, false).get("em", null)).toBe(em);
    expect(weapon.buffs[0].source.triggers).toEqual(["E"]);
    expect(
      weapon.buffs[0].isApplicable("kaedehara_kazuha", "bennett", true)
    ).toBe(false);
    expect(
      weapon.stats.some((entry) => entry.key === "em" && entry.value === em)
    ).toBe(false);
  });
});
