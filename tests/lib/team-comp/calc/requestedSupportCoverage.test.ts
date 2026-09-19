import { beforeAll, describe, expect, it } from "vitest";
import { characterStatsResource, getTalentParam } from "@/data/gameStatsLoader";
import { createCharacter } from "@/lib/dmgcalc/core/registry";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import "@/lib/dmgcalc";

beforeAll(() => characterStatsResource.preload());

function character(id: string, constellation: number) {
  return createCharacter(id, 90, constellation, new TeamMeta([id]));
}

describe("requested support damage coverage", () => {
  it("uses Candace HP talent scaling and gates the separate C6 burst proc", () => {
    const c0 = character("candace", 0);
    const c6 = character("candace", 6);
    for (const [id, talent, index] of [
      ["candace-skill-tap", "E", 3],
      ["candace-skill-hold", "E", 4],
      ["candace-burst", "Q", 1],
      ["candace-wave", "Q", 4],
    ] as const) {
      const formula = c0.getFormulaEntry(id)!.parts[0].formula;
      expect(formula.scalingKey).toBe("hp");
      expect(formula.talentMultiplier).toBe(
        getTalentParam("candace", talent, 9, index - 1)
      );
    }
    expect(c0.formulaIds).not.toHaveProperty("candace-c6-wave");
    expect(c6.formulaIds).toHaveProperty("candace-c6-wave");
    const proc = c6.getFormulaEntry("candace-c6-wave")!.parts[0];
    expect(proc.formula.talentMultiplier).toBe(0.15);
    expect(proc.formula.tag.ability).toBe("burst");
    expect(proc.offField).toBe(true);
  });

  it("models Dori C1 extra round and keeps C2 out of skill/burst bonus scopes", () => {
    const c0 = character("dori", 0);
    const c1 = character("dori", 1);
    const c2 = character("dori", 2);
    expect(c0.getFormulaEntry("dori-skill")!.parts[1].hits).toBe(2);
    expect(c1.getFormulaEntry("dori-skill")!.parts[1].hits).toBe(3);
    expect(c0.formulaIds).not.toHaveProperty("dori-c2-toop");
    const proc = c2.getFormulaEntry("dori-c2-toop")!.parts[0];
    expect(proc.formula.tag).toEqual({
      element: "Electro",
      ability: "special",
      reaction: "none",
    });
    expect(proc.formula.talentMultiplier).toBe(0.5);
    expect(proc.offField).toBe(true);
    expect(
      c0.getFormulaEntry("dori-connector")!.parts[0].formula.talentMultiplier
    ).toBe(getTalentParam("dori", "Q", 9, 0));
  });

  it("counts each hit of normal strings and gates Dori self infusion", () => {
    const candace = character("candace", 0);
    expect(candace.getFormulaEntry("candace-normal")!.parts).toHaveLength(5);
    const dori = character("dori", 6);
    const physical = dori.getFormulaEntry("dori-normal")!.parts;
    const infused = dori.getFormulaEntry("dori-c6-normal")!.parts;
    expect(physical).toHaveLength(4);
    expect(infused.map((p) => p.formula.talentMultiplier)).toEqual(
      physical.map((p) => p.formula.talentMultiplier)
    );
    expect(infused.every((p) => p.formula.tag.element === "Electro")).toBe(
      true
    );
    expect(character("dori", 5).formulaIds).not.toHaveProperty(
      "dori-c6-normal"
    );
  });
});
