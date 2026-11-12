import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import {
  DirectFormula,
  StellarDirectFormula,
} from "@/domain/combat/damage/core/damageFormula";
import {
  createCharacter,
  getOptionDef,
} from "@/domain/combat/damage/core/registry";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import { characterStatsResource } from "@/domain/reference/stats";
import "@/domain/combat/damage/index";

beforeAll(() => characterStatsResource.preload());

describe("automatic character Radiance", () => {
  it.each([
    "yumemizuki_mizuki",
    "wriothesley",
    "yae_miko",
    "cyno",
    "beidou",
    "alyosha",
    "vesna",
    "qiqi",
    "sandrone",
    "odette",
    "traveler_cryo",
  ])("does not expose a redundant state option for %s", (charId) => {
    expect(getOptionDef(charId)).toBeNull();
    const ids = [...new Set([charId, "sandrone", "fischl", "venti"])];
    const team = new TeamMeta(ids);
    const automatic = createCharacter(charId, 90, 6, team);
    const legacyOff = createCharacter(charId, 90, 6, team, {
      [charId]: "off",
    });
    expect(legacyOff.combo).toEqual(automatic.combo);
    expect(legacyOff.allFormulaEntries).toEqual(automatic.allFormulaEntries);
    expect(legacyOff.buffs).toEqual(automatic.buffs);
  });

  it("enables Mizuki's extra P4 hit and replaces her C1 hit automatically", () => {
    const mizuki = createCharacter(
      "yumemizuki_mizuki",
      90,
      1,
      new TeamMeta(["yumemizuki_mizuki", "odette"])
    );
    expect(mizuki.combo["mizuki-p4-stellar"]).toBe(4);
    const p4 = mizuki.getFormulaEntry("mizuki-p4-stellar")!.parts[0].formula;
    expect(p4).toBeInstanceOf(StellarDirectFormula);
    expect(p4.talentMultiplier).toBe(10);
    const c1 = mizuki.getFormulaEntry("mizuki-skill-swirl")!.parts.at(-1)!;
    expect(c1.formula).toBeInstanceOf(StellarDirectFormula);
    expect(c1.formula.talentMultiplier).toBe(4);
    expect(c1.formula.tag.reaction).toBe("stellarSwirl");
  });

  it.each([["kaeya"], ["mitya"]])(
    "does not invent Mizuki Radiance from %s or a legacy On value",
    (teammate) => {
      const mizuki = createCharacter(
        "yumemizuki_mizuki",
        90,
        1,
        new TeamMeta(["yumemizuki_mizuki", teammate]),
        { yumemizuki_mizuki: "on" }
      );
      expect(mizuki.formulaIds).not.toHaveProperty("mizuki-p4-stellar");
      expect(mizuki.combo).not.toHaveProperty("mizuki-p4-stellar");
      const c1 = mizuki.getFormulaEntry("mizuki-skill-swirl")!.parts.at(-1)!;
      expect(c1.formula).toBeInstanceOf(DirectFormula);
      expect(c1.formula.talentMultiplier).toBe(10);
      expect(c1.formula.tag.reaction).toBe("none");
    }
  );

  it.each([0, 6])(
    "keeps Cyno's bolt IDs stable and C6 counts gated at C%d",
    (cons) => {
      for (const [teammates, reaction, multiplier] of [
        [[], "none", 1],
        [["mitya"], "stellarConduct", 2],
      ] as const) {
        const cyno = createCharacter(
          "cyno",
          90,
          cons,
          new TeamMeta(["cyno", ...teammates]),
          { cyno: "off" }
        );
        const p1 = cyno.getFormulaEntry("cyno-p1-bolts")!.parts[0];
        expect(p1.formula.tag.reaction).toBe(reaction);
        expect(p1.formula.talentMultiplier).toBe(multiplier);
        expect(p1.hits).toBe(3);
        expect(cyno.combo["cyno-p1-bolts"]).toBe(6);
        expect(
          cyno.rawComboDescriptor.find((line) => line.id === "cyno-c6-bolts")
        ).toEqual({
          id: "cyno-c6-bolts",
          count: 0,
          bonus: [{ minC: 6, delta: 1 }],
        });
        expect(cyno.combo["cyno-c6-bolts"] ?? 0).toBe(cons === 6 ? 1 : 0);
        expect(cyno.allFormulaIds).not.toHaveProperty("cyno-p1-starsame");
        expect(cyno.allFormulaIds).not.toHaveProperty("cyno-c6-starsame");
      }
    }
  );
});

describe("Diona's HP choice and automatic Radiance", () => {
  it.each([
    [["sandrone", "fischl"], "stellarConduct"],
    [["vesna"], "stellarSwirl"],
  ] as const)("preserves the HP choice on a %s team", (teammates, reaction) => {
    const team = new TeamMeta(["diona", ...teammates]);
    for (const hp of ["above50", "below50"]) {
      const diona = createCharacter("diona", 90, 6, team, { diona: hp });
      const c6 = diona.buffs.filter((buff) => buff.source.origin === "C6");
      expect(c6.flatMap((buff) => buff.staticBuffs)).toContainEqual({
        key: "hp%",
        value: 0.25,
      });
      const em = c6.find((buff) =>
        buff.staticBuffs.some((entry) => entry.key === "em")
      );
      expect(em?.staticBuffs).toEqual(
        hp === "above50" ? [{ key: "em", value: 200 }] : undefined
      );
      expect(
        c6
          .flatMap((buff) => buff.staticBuffs)
          .some((entry) => entry.key === "heal%")
      ).toBe(false);
      const radiance = c6.find((buff) =>
        buff.target.filter?.reactions?.includes(reaction)
      )!;
      expect(radiance.staticBuffs).toEqual([
        { key: "reactionDmg%", value: 0.4 },
      ]);
      expect(radiance.isApplicable("diona", teammates[0], true)).toBe(true);
      expect(radiance.isApplicable("diona", teammates[0], false)).toBe(false);
    }
  });

  it("keeps the C6 HP increase without Radiance and does not grant it before C6", () => {
    const team = new TeamMeta(["diona", "kaeya"]);
    const c5 = createCharacter("diona", 90, 5, team);
    const c6 = createCharacter("diona", 90, 6, team, { diona: "below50" });
    expect(c5.buffs.some((buff) => buff.source.origin === "C6")).toBe(false);
    const hp = c6.buffs.find(
      (buff) =>
        buff.source.origin === "C6" &&
        buff.staticBuffs.some((entry) => entry.key === "hp%")
    )!;
    expect(hp.staticBuffs).toEqual([{ key: "hp%", value: 0.25 }]);
    expect(hp.isApplicable("diona", "diona", false)).toBe(true);
    expect(hp.isApplicable("diona", "kaeya", true)).toBe(false);
    expect(
      c6.buffs.some(
        (buff) => buff.source.origin === "C6" && buff.target.filter?.reactions
      )
    ).toBe(false);
  });
});
