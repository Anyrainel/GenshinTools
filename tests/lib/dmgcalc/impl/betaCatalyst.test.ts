import { beforeAll, describe, expect, it } from "vitest";
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

function passiveSheet(
  weapon: WeaponBase,
  charId = weapon.charId,
  onField = true
) {
  return weapon.buffs.reduce((sheet, buff) => {
    if (!buff.isApplicable(weapon.charId, charId, onField)) return sheet;
    return sheet.merge(
      StatSheet.fromEntries(buff.staticBuffs, buff.target.filter)
    );
  }, new StatSheet([]));
}

describe("beta catalyst Formula Association", () => {
  it.each([
    [1, 0.24, 48, 72, 0.36],
    [2, 0.3, 60, 90, 0.45],
    [3, 0.36, 72, 108, 0.54],
    [4, 0.42, 84, 126, 0.63],
    [5, 0.48, 96, 144, 0.72],
  ])("R%i grants personal CRIT DMG, skill EM and three Stellar-Conduct stacks", (refinement, cd, skillEm, stackEm, reactionCd) => {
    const weapon = createWeapon(
      "weapon_catalyst",
      refinement,
      "sucrose",
      new TeamMeta(["sucrose", "fischl", "odette"])
    );
    const sheet = passiveSheet(weapon);
    expect(sheet.get("cd", null)).toBeCloseTo(cd);
    expect(sheet.get("em", null)).toBe(skillEm + stackEm);
    expect(
      sheet.get("reactionCd", {
        element: "Electro",
        ability: "skill",
        reaction: "stellarConduct",
      })
    ).toBeCloseTo(reactionCd);
    for (const reaction of ["superconduct", "stellarSwirl", "swirl"] as const) {
      expect(
        sheet.get("reactionCd", {
          element: "Electro",
          ability: "skill",
          reaction,
        })
      ).toBe(0);
    }
    expect(passiveSheet(weapon, "fischl").get("em", null)).toBe(0);
    expect(passiveSheet(weapon, "sucrose", false).get("em", null)).toBe(
      skillEm + stackEm
    );
    expect(weapon.stats.some((entry) => entry.key === "em")).toBe(false);
    expect(
      weapon.buffs
        .filter((buff) => buff.staticBuffs.some((entry) => entry.key === "em"))
        .every((buff) => buff.source.triggers?.includes("E"))
    ).toBe(true);
  });

  it("gains EM stacks from ordinary reactions without Stellar-Conduct CRIT DMG", () => {
    const weapon = createWeapon(
      "weapon_catalyst",
      1,
      "sucrose",
      new TeamMeta(["sucrose", "fischl", "qiqi"])
    );
    const sheet = passiveSheet(weapon);
    expect(sheet.get("em", null)).toBe(120);
    expect(weapon.buffs.flatMap((buff) => buff.staticBuffs)).not.toContainEqual(
      expect.objectContaining({ key: "reactionCd" })
    );
  });

  it("retains the skill EM buff but gains no reaction stacks without a reaction", () => {
    const weapon = createWeapon(
      "weapon_catalyst",
      1,
      "ningguang",
      new TeamMeta(["ningguang", "zhongli"])
    );
    const sheet = passiveSheet(weapon);
    expect(sheet.get("cd", null)).toBeCloseTo(0.24);
    expect(sheet.get("em", null)).toBe(48);
    expect(weapon.buffs).toHaveLength(2);
  });
});
