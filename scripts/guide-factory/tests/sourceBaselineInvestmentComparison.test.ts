import { describe, expect, it } from "vitest";
import {
  compareSourceToBaselineConstellationScope,
  constellationScopeFromInvestment,
} from "../src/sourceBaselineInvestmentComparison";

describe("source-to-baseline constellation scope comparison", () => {
  it("does not constrain an unspecified source and does not evaluate talents", () => {
    expect(
      compareSourceToBaselineConstellationScope(
        { status: "unspecified" },
        {
          status: "specified",
          constellation: 6,
          talentLevels: [10, 10, 10],
        },
      ),
    ).toEqual({
      sourceScope: { type: "unspecified" },
      baselineScope: { type: "exact", constellation: 6 },
      outcome: "not-constrained-by-source",
      talentLevelsEvaluated: false,
    });
  });

  it("keeps a constrained source unresolved when baseline constellation is unspecified", () => {
    expect(
      compareSourceToBaselineConstellationScope(
        { status: "partial", constellation: 2 },
        { status: "partial", talentLevels: [1, 2, 3] },
      ),
    ).toEqual({
      sourceScope: { type: "exact", constellation: 2 },
      baselineScope: { type: "unspecified" },
      outcome: "unresolved-baseline-unspecified",
      talentLevelsEvaluated: false,
    });
    expect(
      compareSourceToBaselineConstellationScope(
        { status: "partial", minConstellation: 2 },
        { status: "unspecified" },
      ),
    ).toMatchObject({
      sourceScope: { type: "range", minConstellation: 2 },
      baselineScope: { type: "unspecified" },
      outcome: "unresolved-baseline-unspecified",
      talentLevelsEvaluated: false,
    });
  });

  it("recognizes exact and bounded baselines wholly inside source scope", () => {
    expect(
      compareSourceToBaselineConstellationScope(
        { status: "partial", constellation: 2 },
        {
          status: "specified",
          constellation: 2,
          talentLevels: [1, 1, 1],
        },
      ).outcome,
    ).toBe("guaranteed-satisfies");
    expect(
      compareSourceToBaselineConstellationScope(
        { status: "partial", minConstellation: 2 },
        { status: "partial", minConstellation: 4 },
      ),
    ).toEqual({
      sourceScope: { type: "range", minConstellation: 2 },
      baselineScope: { type: "range", minConstellation: 4 },
      outcome: "guaranteed-satisfies",
      talentLevelsEvaluated: false,
    });
    expect(
      compareSourceToBaselineConstellationScope(
        { status: "partial", maxConstellation: 4 },
        {
          status: "partial",
          minConstellation: 1,
          maxConstellation: 3,
        },
      ),
    ).toEqual({
      sourceScope: { type: "range", maxConstellation: 4 },
      baselineScope: {
        type: "range",
        minConstellation: 1,
        maxConstellation: 3,
      },
      outcome: "guaranteed-satisfies",
      talentLevelsEvaluated: false,
    });
  });

  it("distinguishes disjoint scopes from partial overlap", () => {
    expect(
      compareSourceToBaselineConstellationScope(
        {
          status: "partial",
          minConstellation: 2,
          maxConstellation: 4,
        },
        { status: "partial", maxConstellation: 1 },
      ).outcome,
    ).toBe("guaranteed-conflict");
    expect(
      compareSourceToBaselineConstellationScope(
        {
          status: "partial",
          minConstellation: 2,
          maxConstellation: 4,
        },
        { status: "partial", minConstellation: 5 },
      ).outcome,
    ).toBe("guaranteed-conflict");
    expect(
      compareSourceToBaselineConstellationScope(
        {
          status: "partial",
          minConstellation: 2,
          maxConstellation: 4,
        },
        { status: "partial", minConstellation: 3 },
      ).outcome,
    ).toBe("unresolved-partial-overlap");
    expect(
      compareSourceToBaselineConstellationScope(
        { status: "partial", constellation: 2 },
        {
          status: "partial",
          minConstellation: 1,
          maxConstellation: 3,
        },
      ).outcome,
    ).toBe("unresolved-partial-overlap");
  });

  it("preserves raw one-sided scopes instead of serializing implicit C0 or C6", () => {
    expect(
      constellationScopeFromInvestment({
        status: "partial",
        minConstellation: 2,
      }),
    ).toEqual({ type: "range", minConstellation: 2 });
    expect(
      constellationScopeFromInvestment({
        status: "partial",
        maxConstellation: 4,
      }),
    ).toEqual({ type: "range", maxConstellation: 4 });
  });

  it("ignores conflicting talent levels even when both sides specify them", () => {
    expect(
      compareSourceToBaselineConstellationScope(
        {
          status: "partial",
          constellation: 2,
          talentLevels: [1, 1, 1],
        },
        {
          status: "specified",
          constellation: 2,
          talentLevels: [10, 10, 10],
        },
      ),
    ).toMatchObject({
      outcome: "guaranteed-satisfies",
      talentLevelsEvaluated: false,
    });
  });
});
