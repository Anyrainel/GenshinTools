import { describe, expect, it } from "vitest";

import {
  AmplifyFormula,
  CatalyzeFormula,
  DirectFormula,
  LunarFormula,
  ScalingBuff,
  ScalingSkillBuff,
  StatBuff,
  StatSheet,
  StaticSkillBuff,
  TransformFormula,
} from "@/lib/team-comp/damageModels";
import type { CalcContext, DamageTag } from "@/lib/team-comp/types";

/** Shared calc context for tests */
const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  assumeCrit: false,
};

// ═══════════════════════════════════════════════════════════════
// StatSheet
// ═══════════════════════════════════════════════════════════════

describe("StatSheet", () => {
  it("get(atk) applies base × (1 + %) + flat formula", () => {
    const sheet = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "atk%", value: 0.5 },
      { key: "atk", value: 100 },
    ]);

    // 800 × (1 + 0.5) + 100 = 1300
    expect(sheet.get("atk")).toBeCloseTo(1300);
  });

  it("get(hp) applies base × (1 + %) + flat formula", () => {
    const sheet = new StatSheet([
      { key: "baseHp", value: 15000 },
      { key: "hp%", value: 0.466 },
      { key: "hp", value: 4780 },
    ]);

    // 15000 × (1 + 0.466) + 4780 = 26770
    expect(sheet.get("hp")).toBeCloseTo(26770);
  });

  it("get(cr) returns raw value (no baseline — baselines are in character stats)", () => {
    const sheet = new StatSheet([{ key: "cr", value: 0.3 }]);
    expect(sheet.get("cr")).toBeCloseTo(0.3);
  });

  it("get(cd) returns raw value (no baseline)", () => {
    const sheet = new StatSheet([{ key: "cd", value: 0.622 }]);
    expect(sheet.get("cd")).toBeCloseTo(0.622);
  });

  it("get(er) returns raw value (no baseline)", () => {
    const sheet = new StatSheet([{ key: "er", value: 0.2 }]);
    expect(sheet.get("er")).toBeCloseTo(0.2);
  });

  it("get(em) returns raw value", () => {
    const sheet = new StatSheet([{ key: "em", value: 187 }]);
    expect(sheet.get("em")).toBe(187);
  });

  it("get(atk%) throws — use getRaw for intermediate % values", () => {
    const sheet = new StatSheet([{ key: "atk%", value: 0.5 }]);
    expect(() => sheet.get("atk%")).toThrow("not allowed");
  });

  it("aggregates duplicate keys", () => {
    const sheet = new StatSheet([
      { key: "atk%", value: 0.2 },
      { key: "atk%", value: 0.15 },
    ]);
    expect(sheet.getRaw("atk%")).toBeCloseTo(0.35);
  });

  it("getRaw returns 0 for missing keys", () => {
    const sheet = new StatSheet([]);
    expect(sheet.getRaw("atk")).toBe(0);
  });

  it("merge produces correct aggregation", () => {
    const a = new StatSheet([
      { key: "baseAtk", value: 600 },
      { key: "atk%", value: 0.2 },
    ]);
    const b = new StatSheet([
      { key: "baseAtk", value: 200 },
      { key: "cr", value: 0.1 },
    ]);
    const merged = a.merge(b);

    expect(merged.getRaw("baseAtk")).toBe(800);
    expect(merged.getRaw("atk%")).toBeCloseTo(0.2);
    expect(merged.getRaw("cr")).toBeCloseTo(0.1);
  });

  it("merge is non-destructive (returns new instance)", () => {
    const a = new StatSheet([{ key: "em", value: 100 }]);
    const b = new StatSheet([{ key: "em", value: 50 }]);
    const merged = a.merge(b);

    expect(a.getRaw("em")).toBe(100);
    expect(merged.getRaw("em")).toBe(150);
  });

  it("apply adds static buff entries", () => {
    const sheet = new StatSheet([{ key: "baseAtk", value: 800 }]);
    const buff = new StatBuff(
      { type: "weapon", id: "test" },
      { receiver: "self" },
      [{ key: "atk%", value: 0.2 }]
    );
    const applied = sheet.apply([buff]);

    expect(applied.getRaw("atk%")).toBeCloseTo(0.2);
    expect(sheet.getRaw("atk%")).toBe(0); // original unchanged
  });

  it("apply with empty buffs returns same sheet", () => {
    const sheet = new StatSheet([{ key: "em", value: 100 }]);
    const result = sheet.apply([]);
    expect(result.get("em")).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// StatBuff Hierarchy
// ═══════════════════════════════════════════════════════════════

describe("StatBuff", () => {
  it("base StatBuff has no dynamic buffs", () => {
    const buff = new StatBuff(
      { type: "character", id: "test" },
      { receiver: "self" },
      [{ key: "atk%", value: 0.25 }]
    );
    expect(buff.staticBuffs).toHaveLength(1);
    expect(buff.dynamicBuffs(new StatSheet([]), [])).toHaveLength(0);
  });
});

describe("StaticSkillBuff", () => {
  it("resolves entries based on constellation level", () => {
    const buffC0 = new StaticSkillBuff(
      { type: "character", id: "test" },
      { receiver: "self" },
      0,
      (c) => [{ key: "cr", value: c >= 2 ? 0.2 : 0.15 }]
    );
    expect(buffC0.staticBuffs[0]!.value).toBeCloseTo(0.15);

    const buffC2 = new StaticSkillBuff(
      { type: "character", id: "test" },
      { receiver: "self" },
      2,
      (c) => [{ key: "cr", value: c >= 2 ? 0.2 : 0.15 }]
    );
    expect(buffC2.staticBuffs[0]!.value).toBeCloseTo(0.2);
  });
});

describe("ScalingBuff", () => {
  it("computes dynamic buff from input stat", () => {
    const buff = new ScalingBuff(
      { type: "character", id: "test" },
      { receiver: "onField" },
      [],
      "em",
      "pyro%",
      0.0004
    );
    const stats = new StatSheet([{ key: "em", value: 800 }]);
    const dynamic = buff.dynamicBuffs(stats);

    // 800 × 0.0004 = 0.32
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0]!.key).toBe("pyro%");
    expect(dynamic[0]!.value).toBeCloseTo(0.32);
  });

  it("respects cap", () => {
    const buff = new ScalingBuff(
      { type: "character", id: "test" },
      { receiver: "onField" },
      [],
      "em",
      "pyro%",
      0.0004,
      0.2 // cap
    );
    const stats = new StatSheet([{ key: "em", value: 800 }]);
    const dynamic = buff.dynamicBuffs(stats);

    // 800 × 0.0004 = 0.32, capped to 0.20
    expect(dynamic[0]!.value).toBeCloseTo(0.2);
  });
});

describe("ScalingSkillBuff", () => {
  it("resolves scale/cap from constellation", () => {
    const buff = new ScalingSkillBuff(
      { type: "character", id: "test" },
      { receiver: "onField" },
      [],
      "hp",
      "atk",
      0,
      (c) => ({ scale: c >= 3 ? 0.0626 : 0.0556, cap: 4000 })
    );
    const stats = new StatSheet([
      { key: "baseHp", value: 15000 },
      { key: "hp%", value: 0.466 },
      { key: "hp", value: 4780 },
    ]);
    const dynamic = buff.dynamicBuffs(stats);

    // HP = 15000 × (1 + 0.466) + 4780 = 26770
    // ATK bonus = 26770 × 0.0556 = 1488.41, under cap
    expect(dynamic[0]!.key).toBe("atk");
    expect(dynamic[0]!.value).toBeCloseTo(1488.41, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// DamageFormula Hierarchy
// ═══════════════════════════════════════════════════════════════

describe("DirectFormula", () => {
  it("computes direct damage correctly", () => {
    const formula = new DirectFormula(
      2.426, // talent multiplier
      { element: "Pyro", ability: "charge", reaction: "none" }
    );

    // Baselines (5% CR, 50% CD) are now part of character stats, not StatSheet.
    // Tests must include them explicitly.
    const stats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "atk%", value: 0.5 },
      { key: "atk", value: 300 },
      { key: "cr", value: 0.65 }, // 0.05 base + 0.60 from artifacts
      { key: "cd", value: 1.7 }, // 0.50 base + 1.20 from artifacts
      { key: "pyro%", value: 0.466 },
    ]);

    const result = formula.calc(stats, 90, CTX);

    // ATK = 800 × 1.5 + 300 = 1500
    // BaseDmg = 1500 × 2.426 = 3639
    // DmgBonus = 1 + 0.466 = 1.466
    // DEF mult = (90+100) / ((90+100) + (100+100)) = 190/390
    // RES mult = 1 - 0.10 = 0.90
    // Crit mult = 1 + min(0.65, 1.0) × 1.70 = 2.105
    const expectedAtk = 1500;
    const expectedBase = expectedAtk * 2.426;
    const expectedDmgBonus = 1.466;
    const expectedDef = 190 / 390;
    const expectedRes = 0.9;
    const expectedCrit = 1 + 0.65 * 1.7;
    const expected =
      expectedBase *
      expectedDmgBonus *
      expectedDef *
      expectedRes *
      expectedCrit;

    expect(result.damage).toBeCloseTo(expected, 0);
    expect(result.components.baseDmg).toBeCloseTo(expectedBase, 0);
  });
});

describe("AmplifyFormula", () => {
  it("applies amplifying multiplier to direct damage", () => {
    const amplifyCtx: CalcContext = {
      enemyLevel: 90,
      enemyRes: 0.1,
      assumeCrit: false,
    };
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

    const result = formula.calc(stats, 90, amplifyCtx);

    // EM bonus = (2.78 × 200) / (1400 + 200) = 556 / 1600 = 0.3475
    // AmpMult = 1.5 × (1 + 0.3475) = 2.02125
    const emBonus = (2.78 * 200) / 1600;
    const ampMult = 1.5 * (1 + emBonus);
    expect(result.components.ampMult).toBeCloseTo(ampMult);
    expect(result.damage).toBeGreaterThan(0);
  });
});

describe("TransformFormula", () => {
  it("computes transformative reaction damage (no DEF, no crit)", () => {
    const transformCtx: CalcContext = {
      enemyLevel: 90,
      enemyRes: 0.1,
      assumeCrit: false,
    };
    const formula = new TransformFormula(
      0, // talent multiplier unused for transform
      { element: "Pyro", ability: "skill", reaction: "overloaded" }
    );

    const stats = new StatSheet([{ key: "em", value: 300 }]);

    const result = formula.calc(stats, 90, transformCtx);

    // Level mult at 90 = 1446.85
    // Coefficient for overloaded = 2.0
    // EM bonus = (16 × 300) / (2000 + 300) = 4800 / 2300 ≈ 2.0870
    // RES = 1 - 0.10 = 0.90
    const baseDmg = 1446.85 * 2.0;
    const emBonus = (16 * 300) / 2300;
    const expected = baseDmg * (1 + emBonus) * 0.9;

    expect(result.damage).toBeCloseTo(expected, 0);
  });
});

describe("CatalyzeFormula", () => {
  it("adds flat bonus from additive reaction", () => {
    const catalyzeCtx: CalcContext = {
      enemyLevel: 90,
      enemyRes: 0.1,
      assumeCrit: false,
    };
    const formula = new CatalyzeFormula(
      1.0, // talent multiplier
      { element: "Electro", ability: "normal", reaction: "aggravate" }
    );

    const stats = new StatSheet([
      { key: "baseAtk", value: 500 },
      { key: "em", value: 100 },
      { key: "electro%", value: 0.15 },
      { key: "cr", value: 0.05 },
      { key: "cd", value: 0.5 },
    ]);

    const result = formula.calc(stats, 90, catalyzeCtx);
    expect(result.components.flatBonus).toBeGreaterThan(0);
    expect(result.damage).toBeGreaterThan(0);
  });
});

describe("LunarFormula", () => {
  it("computes lunar reaction with crit and no DEF", () => {
    const lunarCtx: CalcContext = {
      enemyLevel: 90,
      enemyRes: 0.1,
      assumeCrit: false,
    };
    const formula = new LunarFormula(
      0, // unused for lunar
      { element: "Electro", ability: "skill", reaction: "lunarCharged" }
    );

    const stats = new StatSheet([
      { key: "em", value: 400 },
      { key: "cr", value: 0.5 },
      { key: "cd", value: 1.0 },
      { key: "reactionDmg%", value: 0.2 },
    ]);

    const result = formula.calc(stats, 90, lunarCtx);

    // EM bonus = (6 × 400) / (2000 + 400) = 2400 / 2400 = 1.0
    expect(result.components.emBonus).toBeCloseTo(1.0);
    expect(result.damage).toBeGreaterThan(0);
  });
});
