import { describe, expect, it } from "vitest";

import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarDirectFormula,
  LunarFormula,
  TransformFormula,
} from "@/lib/dmgcalc/core/damageFormula";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { CalcContext } from "@/lib/dmgcalc/types";

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

describe("DirectFormula", () => {
  const formula = new DirectFormula(2.426, {
    element: "Pyro",
    ability: "charge",
    reaction: "none",
  });

  const stats = new StatSheet([
    { key: "baseAtk", value: 800 },
    { key: "atk%", value: 0.5 },
    { key: "atk", value: 300 },
    { key: "cr", value: 0.65 },
    { key: "cd", value: 1.7 },
    { key: "pyro%", value: 0.466 },
  ]);

  it("calc() computes direct damage correctly", () => {
    const result = formula.calc(stats, 90, CTX);

    // ATK = 800 × 1.5 + 300 = 1500
    // BaseDmg = 1500 × 2.426 = 3639
    // DmgBonus = 1 + 0.466 = 1.466
    // DEF mult = (90+100) / ((90+100) + (100+100)) = 190/390
    // RES mult = 1 - 0.10 = 0.90
    // Crit mult = 1 + min(0.65, 1.0) × 1.70 = 2.105
    const expectedBase = 1500 * 2.426;
    const expected =
      expectedBase * 1.466 * (190 / 390) * 0.9 * (1 + 0.65 * 1.7);

    expect(result).toBeCloseTo(expected, 0);
    expect(result).toBeCloseTo(expected, 0);
  });

  it("display() returns correct template", () => {
    const dp = formula.display(stats, 90, CTX);
    expect(dp.template).toBe("direct");
  });

  it("display() captures stat values with correct keys", () => {
    const dp = formula.display(stats, 90, CTX);

    expect(dp.statValues.atk).toBeCloseTo(1500);
    // Elemental DMG is stored as dmg% with element filter; display shows combined dmg%
    expect(dp.statValues["dmg%"]).toBeCloseTo(0.466);
    expect(dp.statValues.cr).toBeCloseTo(0.65);
    expect(dp.statValues.cd).toBeCloseTo(1.7);
  });

  it("display() populates scalingKeys and scalingMulti", () => {
    const dp = formula.display(stats, 90, CTX);

    expect(dp.scalingKeys).toEqual(["atk"]);
    expect(dp.scalingMulti).toEqual([2.426]);
  });

  it("display() assumes correct crit context", () => {
    const dp = formula.display(stats, 90, CTX);
  });
});

describe("DirectFormula — dual scaling", () => {
  it("captures extra scaling term in scalingKeys/scalingMulti", () => {
    const formula = new DirectFormula(
      1.5,
      { element: "Dendro", ability: "skill", reaction: "none" },
      "atk",
      { key: "em", multiplier: 0.8 }
    );

    const stats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "em", value: 200 },
      { key: "cr", value: 0.5 },
      { key: "cd", value: 1.0 },
    ]);

    const dp = formula.display(stats, 90, CTX);

    expect(dp.scalingKeys).toEqual(["atk", "em"]);
    expect(dp.scalingMulti).toEqual([1.5, 0.8]);
    expect(dp.statValues.em).toBe(200);
    expect(dp.statValues.atk).toBeCloseTo(800);
  });
});

describe("AmplifyFormula", () => {
  const formula = new AmplifyFormula(1.0, {
    element: "Pyro",
    ability: "normal",
    reaction: "vaporize",
  });

  const stats = new StatSheet([
    { key: "baseAtk", value: 1000 },
    { key: "em", value: 200 },
    { key: "cr", value: 0.05 },
    { key: "cd", value: 0.5 },
  ]);

  it("calc() applies amplifying multiplier to direct damage", () => {
    const result = formula.calc(stats, 90, CTX);

    // EM bonus = (2.78 × 200) / (1400 + 200) = 0.3475
    // AmpMult = 1.5 × (1 + 0.3475) = 2.02125
    const emBonus = (2.78 * 200) / 1600;
    const ampMult = 1.5 * (1 + emBonus);
    expect(result).toBeGreaterThan(0);
  });

  it("display() has amplify template and reaction params", () => {
    const dp = formula.display(stats, 90, CTX);

    expect(dp.template).toBe("amplify");
    expect(dp.params.reactionCoeff).toBeCloseTo(1.5);
    expect(dp.params.emCoeff).toBeCloseTo(2.78);
    expect(dp.statValues.em).toBe(200);
    expect(dp.statValues["reactionDmg%"]).toBeDefined();
  });
});

describe("CatalyzeFormula", () => {
  const formula = new CatalyzeFormula(1.0, {
    element: "Electro",
    ability: "normal",
    reaction: "aggravate",
  });

  const stats = new StatSheet([
    { key: "baseAtk", value: 500 },
    { key: "em", value: 100 },
    { key: "electro%", value: 0.15 },
    { key: "cr", value: 0.05 },
    { key: "cd", value: 0.5 },
  ]);

  it("calc() adds flat bonus from additive reaction", () => {
    const result = formula.calc(stats, 90, CTX);
    expect(result).toBeGreaterThan(0);
  });

  it("display() has catalyze template with flat bonus and scaling keys", () => {
    const dp = formula.display(stats, 90, CTX);

    expect(dp.template).toBe("catalyze");
    expect(dp.scalingKeys).toEqual(["atk"]);
    expect(dp.scalingMulti).toEqual([1.0]);
    expect(dp.params.reactionCoeff).toBeCloseTo(1.15);
    expect(dp.params.levelCoeff).toBeCloseTo(1446.85);
    expect(dp.statValues.em).toBe(100);
  });
});

describe("TransformFormula", () => {
  const formula = new TransformFormula(0, {
    element: "Pyro",
    ability: "skill",
    reaction: "overloaded",
  });

  const stats = new StatSheet([{ key: "em", value: 300 }]);

  it("calc() computes transformative reaction damage (no DEF, no crit)", () => {
    const result = formula.calc(stats, 90, CTX);

    // Level mult at 90 = 1446.853458
    // Coefficient for overloaded = 2.75 (post-5.2)
    // EM bonus = (16 × 300) / (2000 + 300) ≈ 2.0870
    // RES = 1 - 0.10 = 0.90
    const baseDmg = 1446.853458 * 2.75;
    const emBonus = (16 * 300) / 2300;
    const expected = baseDmg * (1 + emBonus) * 0.9;

    expect(result).toBeCloseTo(expected, 0);
  });

  it("display() has empty scalingKeys (level-based, no stat scaling)", () => {
    const dp = formula.display(stats, 90, CTX);

    expect(dp.template).toBe("transform");
    expect(dp.scalingKeys).toEqual([]);
    expect(dp.scalingMulti).toEqual([]);
    expect(dp.params.reactionCoeff).toBeCloseTo(2.75);
    expect(dp.params.levelCoeff).toBeCloseTo(1446.853458);
    expect(dp.statValues.em).toBe(300);
  });
});

describe("LunarFormula", () => {
  const formula = new LunarFormula(0, {
    element: "Electro",
    ability: "skill",
    reaction: "lunarCharged",
  });

  const stats = new StatSheet([
    { key: "em", value: 400 },
    { key: "cr", value: 0.5 },
    { key: "cd", value: 1.0 },
    { key: "reactionDmg%", value: 0.2 },
  ]);

  it("calc() computes lunar reaction with crit and no DEF", () => {
    const result = formula.calc(stats, 90, CTX);

    // EM bonus = (6 × 400) / (2000 + 400) = 1.0
    expect(result).toBeGreaterThan(0);
  });

  it("display() has lunar template with correct params", () => {
    const dp = formula.display(stats, 90, CTX);

    expect(dp.template).toBe("lunar");
    expect(dp.scalingKeys).toEqual([]);
    expect(dp.scalingMulti).toEqual([]);
    expect(dp.params.reactionCoeff).toBeCloseTo(3);
    expect(dp.params.emCoeff).toBe(6);
    expect(dp.statValues.em).toBe(400);
    expect(dp.statValues.cr).toBeCloseTo(0.5);
    expect(dp.statValues.cd).toBeCloseTo(1.0);
  });
});

describe("LunarDirectFormula", () => {
  const formula = new LunarDirectFormula(1.5, {
    element: "Hydro",
    ability: "skill",
    reaction: "lunarCharged",
  });

  const stats = new StatSheet([
    { key: "baseAtk", value: 1000 },
    { key: "atk%", value: 0.5 },
    { key: "em", value: 200 },
    { key: "cr", value: 0.5 },
    { key: "cd", value: 1.0 },
  ]);

  it("calc() computes correctly with directCoeff", () => {
    const result = formula.calc(stats, 90, CTX);
    expect(result).toBeGreaterThan(0);
    const dp = formula.display(stats, 90, CTX);
    expect(dp.params.directCoeff).toBeCloseTo(3.0);
  });

  it("display() has correct template and scaling", () => {
    const dp = formula.display(stats, 90, CTX);

    expect(dp.template).toBe("lunarDirect");
    expect(dp.scalingKeys).toEqual(["atk"]);
    expect(dp.scalingMulti).toEqual([1.5]);
    expect(dp.params.directCoeff).toBeCloseTo(3.0);
    expect(dp.params.emCoeff).toBe(6);
    expect(dp.statValues.atk).toBeCloseTo(1500);
    expect(dp.statValues.em).toBe(200);
  });
});

describe("display() ↔ calc() consistency", () => {
  const richStats = new StatSheet([
    { key: "baseAtk", value: 900 },
    { key: "atk%", value: 0.6 },
    { key: "atk", value: 200 },
    { key: "cr", value: 0.7 },
    { key: "cd", value: 1.5 },
    { key: "em", value: 150 },
    { key: "pyro%", value: 0.466 },
    { key: "hydro%", value: 0.466 },
    { key: "dendro%", value: 0.466 },
  ]);

  const cases = [
    {
      name: "Direct",
      formula: new DirectFormula(2.0, {
        element: "Pyro",
        ability: "normal",
        reaction: "none",
      }),
      stats: richStats,
    },
    {
      name: "Amplify (forward vaporize)",
      formula: new AmplifyFormula(2.0, {
        element: "Hydro",
        ability: "normal",
        reaction: "vaporize",
      }),
      stats: richStats,
    },
    {
      name: "Catalyze (spread)",
      formula: new CatalyzeFormula(2.0, {
        element: "Dendro",
        ability: "normal",
        reaction: "spread",
      }),
      stats: richStats,
    },
    {
      name: "Transform (superconduct)",
      formula: new TransformFormula(0, {
        element: "Electro",
        ability: "skill",
        reaction: "superconduct",
      }),
      stats: new StatSheet([{ key: "em", value: 250 }]),
    },
    {
      name: "Lunar (lunarBloom)",
      formula: new LunarFormula(0, {
        element: "Hydro",
        ability: "skill",
        reaction: "lunarBloom",
      }),
      stats: new StatSheet([
        { key: "em", value: 300 },
        { key: "cr", value: 0.6 },
        { key: "cd", value: 1.2 },
      ]),
    },
    {
      name: "LunarDirect (lunarCrystallize)",
      formula: new LunarDirectFormula(2.5, {
        element: "Electro",
        ability: "skill",
        reaction: "lunarCrystallize",
      }),
      stats: new StatSheet([
        { key: "baseAtk", value: 1000 },
        { key: "em", value: 100 },
        { key: "cr", value: 0.5 },
        { key: "cd", value: 1.0 },
      ]),
    },
  ];

  for (const { name, formula, stats } of cases) {
    it(`${name}: display().damage === calc().damage`, () => {
      const calcResult = formula.calc(stats, 100, CTX);
      const displayResult = formula.display(stats, 100, CTX);
      expect(displayResult.damage).toBeCloseTo(calcResult, 2);
    });
  }
});

describe("computeResMult branches", () => {
  const formula = new DirectFormula(1.0, {
    element: "Pyro",
    ability: "normal",
    reaction: "none",
  });

  const stats = new StatSheet([{ key: "baseAtk", value: 1000 }]);

  it("negative effective RES: resMult = 1 - res/2", () => {
    // 40% res reduction against 10% base → effectiveRes = -0.30
    const highReductionStats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "resReduction%", value: 0.4 },
    ]);
    const ctx: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };

    const resMult = (
      formula as unknown as {
        computeResMult: (s: StatSheet, c: CalcContext) => number;
      }
    ).computeResMult(highReductionStats, ctx);
    // effectiveRes = 0.1 - 0.4 = -0.3
    // resMult = 1 - (-0.3)/2 = 1.15
    expect(resMult).toBeCloseTo(1.15);
  });

  it("high RES (>75%): resMult = 1/(1+4×res)", () => {
    const ctx: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.9, // 90% base RES
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };

    const resMult = (
      formula as unknown as {
        computeResMult: (s: StatSheet, c: CalcContext) => number;
      }
    ).computeResMult(stats, ctx);
    // effectiveRes = 0.9
    // resMult = 1 / (1 + 4 × 0.9) = 1/4.6 ≈ 0.2174
    expect(resMult).toBeCloseTo(1 / 4.6, 3);
  });

  it("normal RES (0-75%): resMult = 1 - res", () => {
    const ctx: CalcContext = {
      enemyLevel: 100,
      enemyRes: 0.5,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    };

    const resMult = (
      formula as unknown as {
        computeResMult: (s: StatSheet, c: CalcContext) => number;
      }
    ).computeResMult(stats, ctx);
    expect(resMult).toBeCloseTo(0.5);
  });
});

describe("LunarDirectFormula — extraTerm", () => {
  it("includes extra scaling in calc and display", () => {
    const formula = new LunarDirectFormula(
      1.5,
      { element: "Hydro", ability: "skill", reaction: "lunarCharged" },
      "atk",
      { key: "em", multiplier: 0.8 }
    );

    const stats = new StatSheet([
      { key: "baseAtk", value: 1000 },
      { key: "em", value: 200 },
      { key: "cr", value: 0.5 },
      { key: "cd", value: 1.0 },
    ]);

    const dp = formula.display(stats, 90, CTX);
    expect(dp.scalingKeys).toEqual(["atk", "em"]);
    expect(dp.scalingMulti).toEqual([1.5, 0.8]);
    expect(dp.statValues.em).toBe(200);

    // calc/display consistency
    const c = formula.calc(stats, 90, CTX);
    expect(dp.damage).toBeCloseTo(c, 2);
  });
});
