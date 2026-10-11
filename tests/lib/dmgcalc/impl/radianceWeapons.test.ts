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

function sheet(weapon: WeaponBase) {
  return weapon.buffs.reduce(
    (stats, buff) =>
      stats.merge(StatSheet.fromEntries(buff.staticBuffs, buff.target.filter)),
    new StatSheet([])
  );
}

function weapon(id: string, refinement: number, tm: TeamMeta, option?: string) {
  return createWeapon(
    id,
    refinement,
    id === "new_bough" ? "valeriy" : "mitya",
    tm,
    option ? { [id]: option } : {}
  );
}

describe("Radiance weapon field availability", () => {
  it.each([
    [1, 40, 0.12, 0.18, 0.24],
    [5, 80, 0.24, 0.36, 0.48],
  ])("R%i uses the replacement passives in Mitya's field without Cryo", (refinement, heartEm, heartReaction, boughAtk, boughReaction) => {
    const tm = new TeamMeta(["mitya", "valeriy", "bennett"]);
    expect(tm.hasReaction("stellarConduct")).toBe(false);
    expect(tm.hasReaction("stellarSwirl")).toBe(false);
    const heart = sheet(weapon("winters_heavy_heart", refinement, tm, "on"));
    const bough = sheet(weapon("new_bough", refinement, tm, "on"));
    expect(heart.get("em", null)).toBe(heartEm);
    expect(heart.getRaw("atk%")).toBe(0);
    expect(bough.getRaw("atk%")).toBeCloseTo(boughAtk);
    expect(bough.get("em", null)).toBe(0);
    for (const reaction of ["stellarConduct", "stellarSwirl"] as const) {
      const tag = {
        element: "Electro" as const,
        ability: "skill" as const,
        reaction,
      };
      expect(heart.get("reactionDmg%", tag)).toBeCloseTo(heartReaction);
      expect(bough.get("reactionDmg%", tag)).toBeCloseTo(boughReaction);
    }
    const ordinary = {
      element: "Electro" as const,
      ability: "skill" as const,
      reaction: "superconduct" as const,
    };
    expect(heart.get("reactionDmg%", ordinary)).toBe(0);
    expect(bough.get("reactionDmg%", ordinary)).toBe(0);
  });

  it.each([
    "winters_heavy_heart",
    "new_bough",
  ])("%s keeps Radiance opt-in and falls back without either state source", (id) => {
    const field = new TeamMeta(["mitya", "valeriy", "bennett"]);
    expect(weapon(id, 1, field).buffs).toEqual(
      weapon(id, 1, field, "off").buffs
    );
    const noField = new TeamMeta(["valeriy", "bennett"]);
    expect(weapon(id, 1, noField, "on").buffs).toEqual(
      weapon(id, 1, noField, "off").buffs
    );
  });

  it.each([
    "winters_heavy_heart",
    "new_bough",
  ])("%s still permits the Stellar Swirl Radiance branch without a field", (id) => {
    const tm = new TeamMeta(["sandrone", "sucrose"]);
    expect(tm.hasPolestarField()).toBe(false);
    expect(tm.hasReaction("stellarSwirl")).toBe(true);
    expect(
      sheet(weapon(id, 1, tm, "on")).get("reactionDmg%", {
        element: "Cryo",
        ability: "skill",
        reaction: "stellarSwirl",
      })
    ).toBeGreaterThan(0);
  });
});
