import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import { createArtifactSet } from "@/domain/combat/damage/core/registry";
import { validateStatBuff } from "@/domain/combat/damage/core/statBuff";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import type {
  AbilityType,
  DamageTag,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
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

function makeTeam(setId?: string): TeamBuild {
  const slots: TeamSlotConfig[] = [
    {
      charId: "kaeya",
      weaponId: "favonius_sword",
      charLevel: 90,
      constellation: 0,
      refinement: 1,
      artifactSet: setId ? { type: "4pc", setId } : null,
    },
    {
      charId: "amber",
      weaponId: "favonius_warbow",
      charLevel: 90,
      constellation: 0,
      refinement: 1,
      artifactSet: null,
    },
  ];
  return new TeamBuild(slots);
}

describe("肇史之遗 (artifact_15049)", () => {
  it("preserves the Cryo-only Stellar CRIT scope", () => {
    const set = createArtifactSet(
      "artifact_15049",
      "kaeya",
      new TeamMeta(["kaeya"])
    );
    expect(set.halfSetId).toBe("atk%-18");
    expect(set.stats).toEqual([]);
    for (const buff of set.buffs) {
      expect(buff.source.triggers).toEqual(["E", "Q", "normal-attack"]);
      expect(buff.source.maxStacks).toBeUndefined();
      expect(() =>
        validateStatBuff(buff.staticBuffs, buff.target, buff.source)
      ).not.toThrow();
    }
    const stellar = set.buffs.find((buff) =>
      buff.staticBuffs.some(({ key }) => key === "reactionCr")
    )!;
    expect(() =>
      validateStatBuff(stellar.staticBuffs, stellar.target, {
        ...stellar.source,
        id: "unreviewed",
      })
    ).toThrow("elements filter");
  });

  it.each(["kaeya", "amber"])(
    "grants fixed Cryo bonuses in the %s on-field context without sharing them",
    (onFieldCharId) => {
      const base = makeTeam().getTeamStats({}, onFieldCharId);
      const equipped = makeTeam("artifact_15049").getTeamStats(
        {},
        onFieldCharId
      );
      const cases: [DamageTag, number, number][] = [
        [{ element: "Cryo", ability: "skill", reaction: "none" }, 0.2, 0],
        [
          { element: "Cryo", ability: "burst", reaction: "stellarConduct" },
          0.2,
          0.2,
        ],
        [
          { element: "Cryo", ability: "normal", reaction: "stellarSwirl" },
          0.2,
          0.2,
        ],
        [
          { element: "Electro", ability: "skill", reaction: "stellarConduct" },
          0,
          0,
        ],
        [
          { element: "Anemo", ability: "skill", reaction: "stellarSwirl" },
          0,
          0,
        ],
        [
          { element: "Cryo", ability: "skill", reaction: "superconduct" },
          0.2,
          0,
        ],
        [{ element: "Physical", ability: "normal", reaction: "none" }, 0, 0],
      ];
      for (const [tag, cr, reactionCr] of cases) {
        for (const charId of ["kaeya", "amber"]) {
          const wearer = charId === "kaeya";
          expect(
            equipped[charId]!.get("cr", tag) - base[charId]!.get("cr", tag)
          ).toBeCloseTo(wearer ? cr : 0);
          expect(
            equipped[charId]!.get("reactionCr", tag) -
              base[charId]!.get("reactionCr", tag)
          ).toBeCloseTo(wearer ? reactionCr : 0);
        }
      }
    }
  );

  it("keeps only ATK +18% from the set in both idle field states", () => {
    const base = makeTeam().teamStats.getIdleStats().kaeya!;
    const equipped = makeTeam("artifact_15049").teamStats.getIdleStats().kaeya!;
    const tag: DamageTag = {
      element: "Cryo",
      ability: "skill",
      reaction: "stellarConduct",
    };
    for (const state of ["onField", "offField"] as const) {
      expect(
        equipped[state].getRaw("atk%") - base[state].getRaw("atk%")
      ).toBeCloseTo(0.18);
      expect(equipped[state].get("cr", tag)).toBe(base[state].get("cr", tag));
      expect(equipped[state].get("reactionCr", tag)).toBe(0);
    }
  });
});

describe("遥天奉翠华引 (artifact_15050)", () => {
  it("registers only the revealed unconditional Skill/Burst damage bonus", () => {
    const set = createArtifactSet(
      "artifact_15050",
      "kaeya",
      new TeamMeta(["kaeya"])
    );
    expect(set.halfSetId).toBe("er-20");
    expect(set.stats).toEqual([]);
    expect(set.buffs).toHaveLength(1);
    const buff = set.buffs[0]!;
    expect(buff.source.triggers).toBeUndefined();
    expect(() =>
      validateStatBuff(buff.staticBuffs, buff.target, buff.source)
    ).not.toThrow();
  });

  it.each(["kaeya", "amber"])(
    "boosts only the wearer's Skill/Burst damage with %s on-field",
    (onFieldCharId) => {
      const base = makeTeam().getTeamStats({}, onFieldCharId);
      const equipped = makeTeam("artifact_15050").getTeamStats(
        {},
        onFieldCharId
      );
      const abilities: AbilityType[] = [
        "normal",
        "charge",
        "plunge",
        "skill",
        "burst",
        "sprint",
        "special",
      ];
      for (const ability of abilities) {
        const expected = ability === "skill" || ability === "burst" ? 0.25 : 0;
        for (const element of ["Cryo", "Physical", "Pyro"] as const) {
          const tag: DamageTag = { element, ability, reaction: "none" };
          for (const charId of ["kaeya", "amber"]) {
            expect(
              equipped[charId]!.get("dmg%", tag) -
                base[charId]!.get("dmg%", tag)
            ).toBeCloseTo(charId === "kaeya" ? expected : 0);
          }
        }
      }
      const stellar: DamageTag = {
        element: "Cryo",
        ability: "skill",
        reaction: "stellarConduct",
      };
      expect(equipped.kaeya!.get("reactionDmg%", stellar)).toBe(
        base.kaeya!.get("reactionDmg%", stellar)
      );
    }
  );

  it("includes ER +20% without a universal idle damage bonus", () => {
    const base = makeTeam().teamStats.getIdleStats().kaeya!;
    const equipped = makeTeam("artifact_15050").teamStats.getIdleStats().kaeya!;
    for (const state of ["onField", "offField"] as const) {
      expect(
        equipped[state].get("er", null) - base[state].get("er", null)
      ).toBeCloseTo(0.2);
      expect(equipped[state].get("dmg%", null)).toBe(
        base[state].get("dmg%", null)
      );
    }
  });
});
