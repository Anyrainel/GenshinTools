import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import type { CharacterBase } from "@/domain/combat/damage/core/implModel";
import { createCharacter } from "@/domain/combat/damage/core/registry";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import type { CalcContext } from "@/domain/combat/damage/types";
import { characterStatsResource } from "@/domain/reference/stats";
import "@/domain/combat/damage/index";

beforeAll(() => characterStatsResource.preload());

function mitya(constellation: number, mode = "stable") {
  return createCharacter(
    "mitya",
    90,
    constellation,
    new TeamMeta(["mitya", "qiqi"]),
    {
      mitya: mode,
    }
  );
}

function buffsFor(
  character: CharacterBase,
  recipient: string,
  onField: boolean
) {
  return character.buffs.reduce((sheet, buff) => {
    if (!buff.isApplicable(character.charId, recipient, onField)) return sheet;
    return sheet.merge(
      StatSheet.fromEntries(buff.staticBuffs, buff.target.filter)
    );
  }, new StatSheet([]));
}

describe("7.2 beta character updates", () => {
  it("grants Mitya C1 CRIT DMG only to the active character", () => {
    expect(buffsFor(mitya(0), "qiqi", true).get("cd", null)).toBe(0);
    expect(buffsFor(mitya(1), "qiqi", true).get("cd", null)).toBe(0.4);
    expect(buffsFor(mitya(1), "qiqi", false).get("cd", null)).toBe(0);
  });

  it("keeps C2 mode EM recipients distinct and shreds only Cryo/Electro", () => {
    const stable = buffsFor(mitya(2), "qiqi", false);
    const collapseActive = buffsFor(mitya(2, "collapse"), "qiqi", true);
    const collapseOff = buffsFor(mitya(2, "collapse"), "qiqi", false);
    expect(stable.get("em", null)).toBe(150 + 123);
    expect(collapseActive.get("em", null)).toBe(234);
    expect(collapseOff.get("em", null)).toBe(0);
    for (const element of ["Cryo", "Electro", "Pyro"] as const) {
      expect(
        stable.get("resReduction%", {
          element,
          ability: "skill",
          reaction: "none",
        })
      ).toBe(element === "Pyro" ? 0 : 0.2);
    }
  });

  it("uses the 300% EM C4 proc and gates it below C4", () => {
    expect(mitya(3).formulaIds).not.toHaveProperty("mitya-c4");
    const proc = mitya(4).getFormulaEntry("mitya-c4")!.parts[0];
    expect(proc.formula.scalingKey).toBe("em");
    expect(proc.formula.talentMultiplier).toBe(3);
    expect(proc.formula.tag.reaction).toBe("stellarConduct");
  });

  it("enhances all four steady Core attacks at C6 without affecting casts or charged attacks", () => {
    const context: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 1,
      substatBudget: "8_6",
    };
    const base = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "em", value: 500 },
    ]);
    for (const mode of ["stable", "collapse"]) {
      const character = mitya(6, mode);
      for (const id of Object.keys(character.formulaIds)) {
        const entry = character.getFormulaEntry(id)!;
        for (const part of entry.parts) {
          const sheet = (part.bespokeBuffs ?? []).reduce(
            (stats, buff) =>
              stats.merge(
                StatSheet.fromEntries(buff.staticBuffs, buff.target.filter)
              ),
            base
          );
          const isCore =
            mode === "stable" &&
            [
              "mitya-stable-pulse",
              "mitya-prism-surge",
              "mitya-prism-shatter",
              "mitya-c4",
            ].includes(id);
          expect(
            part.formula.calc(sheet, 90, context) /
              part.formula.calc(base, 90, context)
          ).toBeCloseTo(isCore ? 1.15 : 1);
        }
      }
      const teamBuffs = buffsFor(character, "qiqi", false);
      expect(
        teamBuffs.get("elevated%", {
          element: "Electro",
          ability: "skill",
          reaction: "stellarConduct",
        })
      ).toBe(0.2);
    }
    for (const id of [
      "mitya-stable-pulse",
      "mitya-prism-surge",
      "mitya-prism-shatter",
      "mitya-c4",
    ]) {
      expect(mitya(5).getFormulaEntry(id)!.parts[0].bespokeBuffs).toEqual([]);
    }
  });
});
