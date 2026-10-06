import { beforeAll, describe, expect, it } from "vitest";
import { characterStatsResource } from "@/data/gameStatsLoader";
import { DEFAULT_CALC_CTX } from "@/lib/artifact-builds/auto-tune/autoTune";
import {
  DirectFormula,
  StellarDirectFormula,
} from "@/lib/dmgcalc/core/damageFormula";
import { createCharacter } from "@/lib/dmgcalc/core/registry";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import "@/lib/dmgcalc";

let team: TeamMeta;
beforeAll(async () => {
  await characterStatsResource.preload();
  team = new TeamMeta(["vesna", "kaeya"]);
});

describe("released Vesna", () => {
  it("uses the high-plunge damage row after the release stamina row", () => {
    const character = createCharacter("vesna", 90, 0, team);
    const plunge =
      character.getFormulaEntry("vesna-plunge-high")?.parts[0].formula;
    expect(plunge?.talentMultiplier).toBeCloseTo(3.15639, 5);
    expect(plunge?.tag.element).toBe("Anemo");
  });

  it("grants the released 40% ATK at C2", () => {
    const character = createCharacter("vesna", 90, 2, team);
    const c2 = character.buffs.find((buff) => buff.source.origin === "C2");
    expect(c2?.staticBuffs).toEqual([{ key: "atk%", value: 0.4 }]);
  });

  it.each([
    "on",
    "off",
  ])("keeps Lv. 1 ordinary and changes only the blade portions with Radiance %s", (radiance) => {
    const character = createCharacter("vesna", 90, 6, team, {
      vesna: radiance,
    });
    const lv1 = character.getFormulaEntry("vesna-blade-pierce")?.parts;
    const lv2 = character.getFormulaEntry("vesna-blade-plunge")?.parts;
    const transpose = character.getFormulaEntry("vesna-c6-tread")?.parts;
    expect(lv1).toHaveLength(1);
    expect(lv1?.[0].formula).toBeInstanceOf(DirectFormula);
    expect(lv1?.[0].formula.tag.reaction).toBe("none");
    expect(lv1?.[0].bespokeBuffs).toBeUndefined();
    expect(lv2?.[0].formula.tag.reaction).toBe("none");
    const bladeClass = radiance === "on" ? StellarDirectFormula : DirectFormula;
    expect(lv2?.[1].formula).toBeInstanceOf(bladeClass);
    expect(transpose).toHaveLength(3);
    expect(transpose?.[0].formula.talentMultiplier).toBe(1.5);
    expect(transpose?.[1].formula).toBeInstanceOf(bladeClass);
    expect(transpose?.[1].formula.talentMultiplier).toBe(2);
    expect(transpose?.[2].formula.talentMultiplier).toBe(
      character.getFormulaEntry("vesna-feather")?.parts[0].formula
        .talentMultiplier
    );
    expect(transpose?.[2].formula.tag.reaction).toBe("none");
  });

  it.each([
    [0, 0.1, 0.4, 0.2],
    [1, 0.1, 0.45, 0.2],
    [2, 0.6, 0.6, 0.6],
  ])("respects the achievable P1 stack ramp at C%d", (c, lv2, lv3, burst) => {
    const character = createCharacter("vesna", 90, c, team);
    for (const [id, partIndex, bonus] of [
      ["vesna-blade-plunge", 1, lv2],
      ["vesna-blade-dance", 0, lv3],
      ["vesna-blade-dance", 1, lv3],
      ["vesna-burst", 0, burst],
    ] as const) {
      const buffs =
        character.getFormulaEntry(id)?.parts[partIndex].bespokeBuffs;
      expect(buffs?.[0].staticBuffs).toEqual([
        { key: "baseDmg%", value: bonus },
      ]);
    }
  });

  it.each([
    0, 1, 6,
  ])("funds every default sword cast with attainable pinions at C%d", (c) => {
    const character = createCharacter("vesna", 90, c, team);
    const counts = character.combo;
    const transposePinions =
      (counts["vesna-c6-tread"] ?? 0) *
      (character.getFormulaEntry("vesna-c6-tread")?.parts[2].hits ?? 0);
    const totalPinions = counts["vesna-feather"] + transposePinions;
    const swords =
      counts["vesna-blade-pierce"] +
      counts["vesna-blade-plunge"] +
      counts["vesna-blade-dance"];
    expect(totalPinions).toBe(12);
    expect(
      2 + counts["vesna-burst"] + totalPinions / 6 + (c >= 1 ? 1 : 0)
    ).toBe(swords);
    expect(counts["vesna-normal-1"]).toBe(c === 6 ? 1 : 4);
    expect(counts["vesna-charge"]).toBe(counts["vesna-normal-1"]);
    expect(counts["vesna-normal"] ?? 0).toBe(0);
    expect(counts["vesna-blade-pierce"]).toBe(1);
    expect(counts["vesna-blade-plunge"]).toBe(1);
    expect(counts["vesna-blade-dance"]).toBe(c >= 1 ? 4 : 3);
    expect(counts["vesna-burst"]).toBe(1);
    expect(
      character
        .getFormulaEntry("vesna-blade-dance")
        ?.parts.map((p) => p.hits ?? 1)
    ).toEqual([4, 1]);
  });

  it("matches ATK-scaled direct Stellar damage with CRIT and additive EM/reaction bonuses", () => {
    const character = createCharacter("vesna", 90, 0, team);
    const stats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "atk%", value: 1 },
      { key: "em", value: 200 },
      { key: "cr", value: 0.7 },
      { key: "cd", value: 1.5 },
      { key: "reactionDmg%", value: 0.6 },
      { key: "reactionBaseDmg%", value: 0.14 },
      { key: "baseDmg%", value: 0.2 },
      { key: "anemo%", value: 2 },
      { key: "defReduction%", value: 0.5 },
    ]);
    // Released Lv10 coefficients, independently checked against talent tables.
    for (const [id, index, multiplier] of [
      ["vesna-blade-plunge", 1, 2.016],
      ["vesna-blade-dance", 0, 0.8064],
      ["vesna-blade-dance", 1, 2.8224],
      ["vesna-burst", 0, 4.7376],
    ] as const) {
      const formula = character.getFormulaEntry(id)!.parts[index].formula;
      const expected =
        2000 *
        multiplier *
        1.2 *
        1.14 *
        (1 + (6 * 200) / 2200 + 0.6) *
        (1 + 0.7 * 1.5) *
        0.9;
      expect(formula.calc(stats, 90, DEFAULT_CALC_CTX)).toBeCloseTo(
        expected,
        2
      );
      expect(
        formula.calc(stats, 100, { ...DEFAULT_CALC_CTX, enemyLevel: 200 })
      ).toBeCloseTo(expected, 2);
      expect(
        formula.calc(stats.withDelta("atk%", 0.2), 90, DEFAULT_CALC_CTX) /
          expected
      ).toBeCloseTo(1.1, 5);
      expect(
        formula.calc(stats.withDelta("anemo%", 1), 90, DEFAULT_CALC_CTX)
      ).toBeCloseTo(expected, 2);
      expect(
        formula.calc(
          stats.withDelta("defReduction%", 0.5),
          90,
          DEFAULT_CALC_CTX
        )
      ).toBeCloseTo(expected, 2);
    }
  });
});
