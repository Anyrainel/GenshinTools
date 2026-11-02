import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import type { WeaponBase } from "@/domain/combat/damage/core/implModel";
import { createWeapon } from "@/domain/combat/damage/core/registry";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import "@/domain/combat/damage/index";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

function passiveSheet(weapon: WeaponBase, onField: boolean) {
  return weapon.buffs.reduce((sheet, buff) => {
    if (!buff.isApplicable(weapon.charId, weapon.charId, onField)) return sheet;
    return sheet.merge(
      StatSheet.fromEntries(buff.staticBuffs, buff.target.filter)
    );
  }, new StatSheet([]));
}

describe("7.2 beta weapons", () => {
  it.each([
    [1, 0.24, 120, 0.36],
    [2, 0.3, 150, 0.45],
    [3, 0.36, 180, 0.54],
    [4, 0.42, 210, 0.63],
    [5, 0.48, 240, 0.72],
  ])(
    "Starsealed Edict R%i grants personal EM and Stellar-Conduct CRIT DMG off-field",
    (refinement, cd, em, reactionCd) => {
      const weapon = createWeapon(
        "starsealed_edict",
        refinement,
        "mitya",
        new TeamMeta(["mitya", "qiqi"])
      );
      for (const onField of [true, false]) {
        const sheet = passiveSheet(weapon, onField);
        expect(sheet.get("cd", null)).toBeCloseTo(cd);
        expect(sheet.get("em", null)).toBe(em);
        expect(
          sheet.get("reactionCd", {
            element: "Electro",
            ability: "skill",
            reaction: "stellarConduct",
          })
        ).toBeCloseTo(reactionCd);
        for (const reaction of ["superconduct", "stellarSwirl"] as const) {
          expect(
            sheet.get("reactionCd", {
              element: "Cryo",
              ability: "skill",
              reaction,
            })
          ).toBe(0);
        }
      }
      for (const buff of weapon.buffs) {
        expect(buff.isApplicable("mitya", "qiqi", true)).toBe(false);
      }
      const reactionCrit = weapon.buffs.find((buff) =>
        buff.staticBuffs.some((entry) => entry.key === "reactionCd")
      );
      expect(reactionCrit?.source.triggers).toEqual([
        "E",
        "elemental-reaction",
      ]);
    }
  );

  it("keeps only the skill EM bonus in a team without reactions", () => {
    const weapon = createWeapon(
      "starsealed_edict",
      1,
      "lisa",
      new TeamMeta(["lisa"])
    );
    const sheet = passiveSheet(weapon, false);
    expect(sheet.get("em", null)).toBe(48);
    expect(sheet.get("cd", null)).toBe(0.24);
    expect(
      sheet.get("reactionCd", {
        element: "Electro",
        ability: "skill",
        reaction: "stellarConduct",
      })
    ).toBe(0);
  });

  it("gains reaction stacks without granting Stellar-Conduct CRIT to ordinary reactions", () => {
    const weapon = createWeapon(
      "starsealed_edict",
      1,
      "lisa",
      new TeamMeta(["lisa", "barbara"])
    );
    const sheet = passiveSheet(weapon, false);
    expect(sheet.get("em", null)).toBe(120);
    expect(
      sheet.get("reactionCd", {
        element: "Electro",
        ability: "skill",
        reaction: "electroCharged",
      })
    ).toBe(0);
  });
});
