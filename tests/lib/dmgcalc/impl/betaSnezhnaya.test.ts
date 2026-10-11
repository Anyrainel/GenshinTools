import { beforeAll, describe, expect, it } from "vitest";
import { characterStatsResource, getTalentParam } from "@/data/gameStatsLoader";
import { getCrBudget } from "@/lib/account-data/maxCrBuff";
import {
  DirectFormula,
  StellarDirectFormula,
} from "@/lib/dmgcalc/core/damageFormula";
import { compileExpr } from "@/lib/dmgcalc/core/expr";
import { ExprStatSheet, VarMapping } from "@/lib/dmgcalc/core/exprStatSheet";
import { createCharacter } from "@/lib/dmgcalc/core/registry";
import { ScalingBuff } from "@/lib/dmgcalc/core/statBuff";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import "@/lib/dmgcalc";

beforeAll(async () => {
  await characterStatsResource.preload();
});

function character(
  id: string,
  cons = 0,
  option?: string,
  ids = ["mitya", "valeriy", "qiqi"]
) {
  return createCharacter(
    id,
    90,
    cons,
    new TeamMeta(ids, { [id]: cons }),
    option ? { [id]: option } : {}
  );
}

function staticSheet(
  id: string,
  cons: number,
  option: string,
  receiver = id,
  onField = true
) {
  const char = character(id, cons, option);
  return char.buffs.reduce(
    (sheet, buff) =>
      buff.isApplicable(id, receiver, onField)
        ? sheet.merge(
            StatSheet.fromEntries(buff.staticBuffs, buff.target.filter)
          )
        : sheet,
    new StatSheet([])
  );
}

describe("Mitya", () => {
  it("enables Stellar-Conduct and replaces ordinary Superconduct", () => {
    const tm = new TeamMeta(["mitya", "qiqi"]);
    expect(tm.hasReaction("stellarConduct")).toBe(true);
    expect(tm.hasReaction("superconduct")).toBe(false);
    expect(
      new TeamMeta(["mitya", "valeriy"]).hasReaction("stellarConduct")
    ).toBe(false);
  });

  it("separates the ATK-scaled detonation from EM-scaled Stellar hits", () => {
    const char = character("mitya");
    const first = char.getFormulaEntry("mitya-prism-detonation")?.parts[0]
      .formula;
    const stellar = char.getFormulaEntry("mitya-prism-consume")?.parts[0]
      .formula;
    expect(first).toBeInstanceOf(DirectFormula);
    expect(first?.scalingKey).toBe("atk");
    expect(stellar).toBeInstanceOf(StellarDirectFormula);
    expect(stellar?.scalingKey).toBe("em");
    expect(stellar?.tag).toEqual({
      element: "Electro",
      ability: "charge",
      reaction: "stellarConduct",
    });
    const q = char.getFormulaEntry("mitya-burst")?.parts[0].formula;
    expect(q?.extraTerm).toEqual({
      key: "em",
      multiplier: getTalentParam("mitya", "Q", 9, 1),
    });
    expect(char.formulaIds).not.toHaveProperty("mitya-stable-pulse");
  });

  it("stable mode grants Prism EM and marks device attacks off field", () => {
    const char = character("mitya", 2, "stable");
    expect(
      staticSheet("mitya", 2, "stable", "qiqi", false).get("em", null)
    ).toBe(250);
    expect(char.formulaIds).not.toHaveProperty("mitya-prism-consume");
    for (const id of [
      "mitya-stable-pulse",
      "mitya-prism-surge",
      "mitya-prism-shatter",
    ]) {
      expect(char.getFormulaEntry(id)?.parts[0].offField).toBe(true);
    }
  });

  it.each([0, 1])("shatters all capped Prisms in one hit at C%d", (cons) => {
    const char = character("mitya", cons, "stable");
    const entry = char.getFormulaEntry("mitya-prism-shatter")!;
    expect(entry.parts).toHaveLength(1);
    expect(entry.parts[0].hits ?? 1).toBe(1);
    expect(char.combo["mitya-prism-shatter"]).toBe(1);
    const formula = entry.parts[0].formula;
    expect(formula.talentMultiplier).toBe(
      getTalentParam("mitya", "E", 9, 4) * (cons >= 1 ? 5 : 4)
    );
    const ctx = {
      enemyLevel: 90,
      enemyRes: 0.1,
      rollMultiplier: 1,
      substatBudget: "8_6" as const,
    };
    const base = new StatSheet([{ key: "em", value: 500 }]);
    // A single damage instance receives a flat quill once, regardless of the
    // number of Prisms contributing to its talent coefficient.
    const buffed = base.merge(
      StatSheet.fromEntries([{ key: "baseDmg", value: 1000 }])
    );
    expect(
      formula.calc(buffed, 90, ctx) - formula.calc(base, 90, ctx)
    ).toBeCloseTo(900);
    const expr = formula.buildExpr(
      new ExprStatSheet(buffed, 0, new VarMapping(), new Set()),
      90,
      ctx
    );
    expect(compileExpr(expr)(new Float64Array())).toBeCloseTo(
      formula.calc(buffed, 90, ctx)
    );
  });

  it("C1/C2 active buffs exclude off-field teammates, while RES shred is team-wide", () => {
    const on = staticSheet("mitya", 2, "collapse", "qiqi", true);
    const off = staticSheet("mitya", 2, "collapse", "qiqi", false);
    expect(on.get("em", null)).toBe(200);
    expect(off.get("em", null)).toBe(0);
    expect(on.get("cd", null)).toBe(0.5);
    expect(off.get("cd", null)).toBe(0);
    expect(
      off.get("resReduction%", {
        element: "Cryo",
        ability: "burst",
        reaction: "none",
      })
    ).toBe(0.25);
    expect(
      off.get("resReduction%", {
        element: "Pyro",
        ability: "burst",
        reaction: "none",
      })
    ).toBe(0);
  });

  it("caps P3 at 14%, gates C4, and elevates only Stellar-Conduct at C6", () => {
    const char = character("mitya", 6);
    const p3 = char.buffs.find(
      (b) => b.source.origin === "P3" && b instanceof ScalingBuff
    ) as ScalingBuff | undefined;
    expect(
      p3?.dynamicBuffs(new StatSheet([{ key: "em", value: 1000 }]))
    ).toEqual([{ key: "reactionBaseDmg%", value: 0.14 }]);
    expect(character("mitya", 3).formulaIds).not.toHaveProperty("mitya-c4");
    expect(
      char.getFormulaEntry("mitya-c4")?.parts[0].formula.talentMultiplier
    ).toBe(4);
    const sheet = staticSheet("mitya", 6, "collapse", "qiqi", false);
    expect(
      sheet.get("elevated%", {
        element: "Electro",
        ability: "skill",
        reaction: "stellarConduct",
      })
    ).toBe(0.2);
    expect(
      sheet.get("elevated%", {
        element: "Electro",
        ability: "skill",
        reaction: "superconduct",
      })
    ).toBe(0);
  });

  it("applies C3 to E and C5 to A, with a matching 20% CR recommendation budget", () => {
    const c3 = character("mitya", 3);
    const c5 = character("mitya", 5);
    expect(
      c3.getFormulaEntry("mitya-e-tap")?.parts[0].formula.talentMultiplier
    ).toBe(getTalentParam("mitya", "E", 12, 0));
    expect(
      c5.getFormulaEntry("mitya-prism-consume")?.parts[0].formula
        .talentMultiplier
    ).toBe(getTalentParam("mitya", "A", 12, 8));
    expect(
      getCrBudget({
        characterId: "mitya",
        characterLevel: 90,
        constellation: 0,
      }).characterBuffCr
    ).toBe(0.2);
  });
});

describe("Valeriy", () => {
  it("replaces the ordinary assault order with a shared, on-field Stellar-only buff", () => {
    const char = character("valeriy", 0, "stellar-100");
    const buff = char.buffs[0] as ScalingBuff;
    expect(buff.scale).toBeCloseTo(getTalentParam("valeriy", "A", 9, 6) + 0.9);
    expect(buff.source.maxStacks).toBe(15);
    expect(buff.target.filter?.reactions).toEqual(["stellarConduct"]);
    expect(buff.isApplicable("valeriy", "mitya", true)).toBe(true);
    expect(buff.isApplicable("valeriy", "mitya", false)).toBe(false);
    const plain = character("valeriy", 0, "normal-40").buffs[0] as ScalingBuff;
    expect(plain.scale).toBeCloseTo(
      getTalentParam("valeriy", "A", 9, 5) + 0.12
    );
    expect(plain.target.filter?.reactions).toBeUndefined();
  });

  it("clamps 130 Charge until C4 and falls back outside Stellar teams", () => {
    const c0 = character("valeriy", 0, "stellar-130").buffs[0] as ScalingBuff;
    const c4 = character("valeriy", 4, "stellar-130").buffs[0] as ScalingBuff;
    expect(c4.scale - c0.scale).toBeCloseTo(
      getTalentParam("valeriy", "A", 12, 6) -
        getTalentParam("valeriy", "A", 9, 6) +
        0.27
    );
    const noStellar = character("valeriy", 0, "stellar-100", [
      "valeriy",
      "bennett",
    ]).buffs[0] as ScalingBuff;
    expect(noStellar.target.filter?.reactions).toBeUndefined();
  });

  it("keeps C6 bonus off the Q cast and ordinary physical charge", () => {
    const char = character("valeriy", 6);
    expect(
      char.getFormulaEntry("valeriy-burst")?.parts[0].bespokeBuffs
    ).toBeUndefined();
    expect(
      char.getFormulaEntry("valeriy-charge")?.parts[0].bespokeBuffs
    ).toBeUndefined();
    for (const id of ["valeriy-thunderclap", "valeriy-stormshell"]) {
      expect(
        char.getFormulaEntry(id)?.parts[0].bespokeBuffs?.[0].staticBuffs
      ).toEqual([{ key: "dmg%", value: 1 }]);
    }
    const shell = char.getFormulaEntry("valeriy-stormshell")?.parts[0];
    expect(shell?.formula.tag.ability).toBe("burst");
    expect(shell?.offField).toBe(true);
    const sheet = staticSheet("valeriy", 6, "normal-100", "mitya");
    expect(
      sheet.get("cr", {
        element: "Electro",
        ability: "burst",
        reaction: "none",
      })
    ).toBe(0.1);
    expect(
      sheet.get("cr", {
        element: "Physical",
        ability: "normal",
        reaction: "none",
      })
    ).toBe(0);
    expect(
      sheet.get("reactionCd", {
        element: "Electro",
        ability: "charge",
        reaction: "stellarConduct",
      })
    ).toBe(0.4);
    expect(
      getCrBudget({
        characterId: "valeriy",
        characterLevel: 90,
        constellation: 6,
      }).characterBuffCr
    ).toBe(0.1);
  });

  it("C2 EM is team-wide and C3/C5 boost A/E rather than Q", () => {
    expect(
      staticSheet("valeriy", 2, "normal-100", "mitya", false).get("em", null)
    ).toBe(100);
    const char = character("valeriy", 5);
    expect(
      char.getFormulaEntry("valeriy-thunderclap")?.parts[0].formula
        .talentMultiplier
    ).toBe(getTalentParam("valeriy", "A", 12, 4));
    expect(
      char.getFormulaEntry("valeriy-skill")?.parts[0].formula.talentMultiplier
    ).toBe(getTalentParam("valeriy", "E", 12, 0));
    expect(
      char.getFormulaEntry("valeriy-burst")?.parts[0].formula.talentMultiplier
    ).toBe(getTalentParam("valeriy", "Q", 9, 0));
  });
});
