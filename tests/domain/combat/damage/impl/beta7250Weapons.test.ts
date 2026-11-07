import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import type { WeaponBase } from "@/domain/combat/damage/core/implModel";
import { createWeapon } from "@/domain/combat/damage/core/registry";
import { deduplicateBuffs } from "@/domain/combat/damage/core/statBuff";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
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

function weaponSheet(
  weapon: WeaponBase,
  targetCharId = weapon.charId,
  onField = true
) {
  return weapon.buffs.reduce((sheet, buff) => {
    if (!buff.isApplicable(weapon.charId, targetCharId, onField)) return sheet;
    return sheet.merge(
      StatSheet.fromEntries(buff.staticBuffs, buff.target.filter)
    );
  }, new StatSheet([]));
}

describe("Torrents of Spring", () => {
  it.each([
    [1, 0.16, 0.2],
    [2, 0.2, 0.25],
    [3, 0.24, 0.3],
    [4, 0.28, 0.35],
    [5, 0.32, 0.4],
  ])(
    "completes the R%i Decree from the wearer's Stellar-Conduct trigger",
    (refinement, atk, reactionDmg) => {
      const meta = new TeamMeta(["beidou", "mitya", "qiqi"]);
      const weapon = createWeapon(
        "torrents_of_spring",
        refinement,
        "beidou",
        meta
      );
      expect(meta.hasReaction("stellarConduct", "beidou")).toBe(true);
      const tag = {
        element: "Cryo",
        ability: "skill",
        reaction: "stellarConduct",
      } as const;
      for (const onField of [true, false]) {
        const self = weaponSheet(weapon, "beidou", onField);
        expect(self.getRaw("atk%")).toBeCloseTo(2 * atk);
        expect(self.get("reactionDmg%", tag)).toBeCloseTo(
          onField ? 2 * reactionDmg : 0
        );
        const teammate = weaponSheet(weapon, "qiqi", onField);
        expect(teammate.getRaw("atk%")).toBe(0);
        expect(teammate.get("reactionDmg%", tag)).toBeCloseTo(
          onField ? 2 * reactionDmg : 0
        );
        for (const reaction of [
          "none",
          "superconduct",
          "stellarSwirl",
        ] as const) {
          expect(teammate.get("reactionDmg%", { ...tag, reaction })).toBe(0);
        }
      }
      const decree = weapon.buffs.find(
        (buff) => buff.target.receiver === "teamOnField"
      )!;
      expect(decree.source.noStackId).toBe("torrents-of-spring-decree");
      expect(decree.source.triggers).toEqual(["electro-hit", "stellarConduct"]);
    }
  );

  it.each(["collapse", "stable"])(
    "completes from Mitya's enabled inherent SC damage without a Cryo teammate (%s)",
    (mode) => {
      const meta = new TeamMeta(["mitya"]);
      expect(meta.hasReaction("stellarConduct", "mitya")).toBe(false);
      const weapon = createWeapon("torrents_of_spring", 1, "mitya", meta, {
        mitya: mode,
      });
      expect(weaponSheet(weapon).getRaw("atk%")).toBeCloseTo(0.32);
      expect(
        weaponSheet(weapon).get("reactionDmg%", {
          element: "Electro",
          ability: "skill",
          reaction: "stellarConduct",
        })
      ).toBeCloseTo(0.4);
    }
  );

  it.each(["battle", "defense"])(
    "completes from Danica's inherent SC attacks without a Cryo aura (%s)",
    (mode) => {
      const meta = new TeamMeta(["danica", "beidou"]);
      expect(meta.hasReaction("stellarConduct", "danica")).toBe(false);
      const weapon = createWeapon("torrents_of_spring", 5, "danica", meta, {
        danica: mode,
      });
      expect(weaponSheet(weapon).getRaw("atk%")).toBeCloseTo(0.64);
      expect(
        weaponSheet(weapon, "beidou").get("reactionDmg%", {
          element: "Electro",
          ability: "skill",
          reaction: "stellarConduct",
        })
      ).toBeCloseTo(0.8);
    }
  );

  it("keeps the base Decree when the Electro wearer neither triggers nor deals SC", () => {
    const weapon = createWeapon(
      "torrents_of_spring",
      1,
      "beidou",
      new TeamMeta(["beidou"])
    );
    const sheet = weaponSheet(weapon);
    expect(sheet.getRaw("atk%")).toBeCloseTo(0.16);
    expect(
      sheet.get("reactionDmg%", {
        element: "Electro",
        ability: "burst",
        reaction: "stellarConduct",
      })
    ).toBeCloseTo(0.2);
    expect(
      weapon.buffs.find((buff) => buff.target.receiver === "teamOnField")
        ?.source.triggers
    ).toEqual(["electro-hit"]);
  });

  it.each(["diluc", "chongyun"])(
    "requires the wearer's own Electro hit before a party reaction can enhance %s",
    (charId) => {
      const meta = new TeamMeta([charId, "mitya", "qiqi"]);
      expect(meta.hasReaction("stellarConduct")).toBe(true);
      expect(meta.hasReaction("stellarConduct", charId)).toBe(
        charId === "chongyun"
      );
      const weapon = createWeapon("torrents_of_spring", 5, charId, meta);
      expect(weapon.buffs).toHaveLength(1);
      expect(weaponSheet(weapon).getRaw("atk%")).toBeCloseTo(0.32);
      expect(weapon.buffs[0].source.triggers).toBeUndefined();
    }
  );

  it("deduplicates the complete Decree magnitude across different refinements", () => {
    const complete = createWeapon(
      "torrents_of_spring",
      1,
      "beidou",
      new TeamMeta(["beidou", "mitya", "qiqi"])
    );
    const base = createWeapon(
      "torrents_of_spring",
      5,
      "razor",
      new TeamMeta(["razor"])
    );
    const buffs = deduplicateBuffs(
      [...complete.buffs, ...base.buffs].filter(
        (buff) => buff.target.receiver === "teamOnField"
      ),
      (buff) => buff.staticBuffs
    );
    expect(buffs).toHaveLength(1);
    expect(buffs[0].staticBuffs).toEqual([{ key: "reactionDmg%", value: 0.4 }]);
  });

  it("keeps unconditional ATK in idle stats and excludes the completed bonus", () => {
    const build = new TeamBuild([
      {
        charId: "beidou",
        charLevel: 90,
        constellation: 0,
        weaponId: "torrents_of_spring",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "qiqi",
        charLevel: 90,
        constellation: 0,
        weaponId: "favonius_sword",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "mitya",
        charLevel: 90,
        constellation: 0,
        weaponId: "starsealed_edict",
        refinement: 1,
        artifactSet: null,
      },
    ]);
    const baseline = build.charBuilds.beidou.baseStatSheet;
    for (const sheet of Object.values(build.teamStats.getIdleStats().beidou)) {
      expect(sheet.get("atk", null)).toBeCloseTo(
        baseline.get("atk", null) + baseline.get("baseAtk", null) * 0.16
      );
    }
    for (const onField of ["beidou", "qiqi"]) {
      expect(
        build.teamStats.getPostStats("beidou", onField).get("atk", null)
      ).toBeCloseTo(
        baseline.get("atk", null) + baseline.get("baseAtk", null) * 0.32
      );
    }
  });
});

describe("Silverdawn", () => {
  it.each([
    [1, 0.4],
    [2, 0.52],
    [3, 0.64],
    [4, 0.76],
    [5, 0.88],
  ])(
    "grants R%i ATK and both Stellar CRIT DMG bonuses",
    (refinement, bonus) => {
      const weapon = createWeapon(
        "silverdawn",
        refinement,
        "fischl",
        new TeamMeta(["fischl", "vesna"])
      );
      for (const onField of [true, false]) {
        const sheet = weaponSheet(weapon, "fischl", onField);
        expect(sheet.getRaw("atk%")).toBeCloseTo(bonus);
        expect(sheet.get("cd", null)).toBe(0);
        for (const reaction of ["stellarConduct", "stellarSwirl"] as const) {
          expect(
            sheet.get("reactionCd", {
              element: "Electro",
              ability: "skill",
              reaction,
            })
          ).toBeCloseTo(bonus);
        }
        for (const reaction of [
          "none",
          "superconduct",
          "swirl",
          "lunarCharged",
        ] as const) {
          expect(
            sheet.get("reactionCd", {
              element: "Electro",
              ability: "skill",
              reaction,
            })
          ).toBe(0);
        }
        expect(weaponSheet(weapon, "vesna", onField).getRaw("atk%")).toBe(0);
      }
      for (const buff of weapon.buffs) {
        expect(buff.source.triggers).toEqual(["E", "Q"]);
      }
    }
  );

  it("grants its cast bonus without a Stellar reaction and excludes it from idle ATK", () => {
    const weapon = createWeapon(
      "silverdawn",
      1,
      "fischl",
      new TeamMeta(["fischl"])
    );
    expect(weaponSheet(weapon).getRaw("atk%")).toBeCloseTo(0.4);
    const build = new TeamBuild([
      {
        charId: "fischl",
        charLevel: 90,
        constellation: 0,
        weaponId: "silverdawn",
        refinement: 1,
        artifactSet: null,
      },
    ]);
    const baseline = build.charBuilds.fischl.baseStatSheet;
    for (const sheet of Object.values(build.teamStats.getIdleStats().fischl)) {
      expect(sheet.get("atk", null)).toBeCloseTo(baseline.get("atk", null));
    }
    expect(
      build.teamStats.getPostStats("fischl", "fischl").get("atk", null)
    ).toBeCloseTo(
      baseline.get("atk", null) + baseline.get("baseAtk", null) * 0.4
    );
  });
});
