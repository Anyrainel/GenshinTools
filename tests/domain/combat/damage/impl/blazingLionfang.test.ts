import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import { createWeapon } from "@/domain/combat/damage/core/registry";
import { validateStatBuff } from "@/domain/combat/damage/core/statBuff";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
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

describe("Blazing Lionfang", () => {
  it.each([
    [1, 0.2],
    [2, 0.25],
    [3, 0.3],
    [4, 0.35],
    [5, 0.4],
  ])(
    "retains the R%i personal ATK effect after entering the field",
    (refinement, atk) => {
      const weapon = createWeapon(
        "blazing_lionfang",
        refinement,
        "beidou",
        new TeamMeta(["beidou", "kaeya"])
      );
      expect(weapon.stats.map(({ key }) => key)).toEqual(["baseAtk", "er"]);
      expect(weapon.stats[0].value).toBe(510);
      expect(weapon.stats[1].value).toBeCloseTo(0.459);
      expect(weapon.buffs).toHaveLength(1);
      const buff = weapon.buffs[0]!;
      expect(buff.staticBuffs).toEqual([{ key: "atk%", value: atk }]);
      expect(buff.source.origin).toBe(`R${refinement}`);
      expect(buff.source.triggers).toEqual(["off-field"]);
      expect(buff.target).toEqual({ receiver: "self" });
      expect(() =>
        validateStatBuff(buff.staticBuffs, buff.target, buff.source)
      ).not.toThrow();
      for (const onField of [true, false]) {
        expect(buff.isApplicable("beidou", "beidou", onField)).toBe(true);
        expect(buff.isApplicable("beidou", "kaeya", onField)).toBe(false);
      }
    }
  );

  it.each([
    [1, 0.2],
    [5, 0.4],
  ])(
    "excludes the R%i triggered ATK effect from both idle states",
    (refinement, atk) => {
      const build = new TeamBuild([
        {
          charId: "beidou",
          charLevel: 90,
          constellation: 0,
          weaponId: "blazing_lionfang",
          refinement,
          artifactSet: null,
        },
        {
          charId: "kaeya",
          charLevel: 90,
          constellation: 0,
          weaponId: "favonius_sword",
          refinement: 1,
          artifactSet: null,
        },
      ]);
      const baseline = build.charBuilds.beidou.baseStatSheet;
      for (const sheet of Object.values(
        build.teamStats.getIdleStats().beidou
      )) {
        expect(sheet.get("atk", null)).toBeCloseTo(baseline.get("atk", null));
      }
      for (const onFieldCharId of ["beidou", "kaeya"]) {
        const stats = build.getTeamStats({}, onFieldCharId);
        expect(stats.beidou.get("atk", null)).toBeCloseTo(
          baseline.get("atk", null) + baseline.get("baseAtk", null) * atk
        );
        expect(stats.kaeya.get("atk", null)).toBeCloseTo(
          build.charBuilds.kaeya.baseStatSheet.get("atk", null)
        );
      }
    }
  );
});
