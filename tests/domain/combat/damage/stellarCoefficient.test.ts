import "@/providers/reference/statLoaders";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_CALC_CONTEXT } from "@/domain/combat/damage/constants";
import {
  StellarDirectFormula,
  StellarFormula,
} from "@/domain/combat/damage/core/damageFormula";
import { evaluate } from "@/domain/combat/damage/core/expr";
import {
  ExprStatSheet,
  VarMapping,
} from "@/domain/combat/damage/core/exprStatSheet";
import { StatSheet } from "@/domain/combat/damage/core/statSheet";
import { TeamMeta } from "@/domain/combat/damage/core/teamMeta";
import { characterStatsResource } from "@/domain/reference/stats";

beforeAll(() => characterStatsResource.preload());

describe("Stellar reaction coefficient bonuses", () => {
  it("multiplies inherent Swirl coefficients separately from base-DMG bonuses", () => {
    const formula = new StellarFormula(3, {
      element: "Cryo",
      ability: "special",
      reaction: "stellarSwirl",
    });
    const base = new StatSheet([{ key: "reactionBaseDmg%", value: 0.14 }]);
    const buffed = base.merge(
      new StatSheet([{ key: "reactionCoeff%", value: 0.15 }])
    );
    expect(formula.calc(buffed, 90, DEFAULT_CALC_CONTEXT)).toBeCloseTo(
      formula.calc(base, 90, DEFAULT_CALC_CONTEXT) * 1.15,
      8
    );
    const expr = formula.buildExpr(
      new ExprStatSheet(buffed, 0, new VarMapping(), new Set()),
      90,
      DEFAULT_CALC_CONTEXT
    );
    expect(evaluate(expr, new Float64Array())).toBeCloseTo(
      formula.calc(buffed, 90, DEFAULT_CALC_CONTEXT),
      8
    );
    expect(
      formula.display(buffed, 90, DEFAULT_CALC_CONTEXT).params.reactionCoeff
    ).toBeCloseTo(3.45);
  });

  it("does not increase flat additive damage or talent-tagged Stellar damage", () => {
    const tag = {
      element: "Cryo",
      ability: "special",
      reaction: "stellarSwirl",
    } as const;
    const formula = new StellarFormula(3, tag);
    const flat = new StatSheet([{ key: "baseDmg", value: 1000 }]);
    const bonus = new StatSheet([{ key: "reactionCoeff%", value: 0.15 }]);
    const empty = new StatSheet([]);
    const flatIncrement =
      formula.calc(flat, 90, DEFAULT_CALC_CONTEXT) -
      formula.calc(empty, 90, DEFAULT_CALC_CONTEXT);
    expect(
      formula.calc(flat.merge(bonus), 90, DEFAULT_CALC_CONTEXT) -
        formula.calc(bonus, 90, DEFAULT_CALC_CONTEXT)
    ).toBeCloseTo(flatIncrement, 8);
    const direct = new StellarDirectFormula(2, { ...tag, ability: "skill" });
    const directStats = new StatSheet([{ key: "baseAtk", value: 1000 }]);
    expect(
      direct.calc(directStats.merge(bonus), 90, DEFAULT_CALC_CONTEXT)
    ).toBe(direct.calc(directStats, 90, DEFAULT_CALC_CONTEXT));
  });
});

it("enables only the Stellar reactions named in the new characters' passives", () => {
  expect(new TeamMeta(["danica", "kaeya"]).hasReaction("stellarConduct")).toBe(
    true
  );
  expect(
    new TeamMeta(["danica", "kaeya", "venti"]).hasReaction("stellarSwirl")
  ).toBe(false);
  expect(
    new TeamMeta(["anastasya", "fischl"]).hasReaction("stellarConduct")
  ).toBe(true);
  expect(new TeamMeta(["anastasya", "venti"]).hasReaction("stellarSwirl")).toBe(
    true
  );
});
