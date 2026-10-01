import { beforeAll, describe, expect, it } from "vitest";
import { characterStatsResource } from "@/data/gameStatsLoader";
import {
  DirectFormula,
  StellarDirectFormula,
} from "@/lib/dmgcalc/core/damageFormula";
import { createCharacter } from "@/lib/dmgcalc/core/registry";
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
    [0, 0.1, 0.3, 0.5],
    [1, 0.1, 0.35, 0.6],
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
});
