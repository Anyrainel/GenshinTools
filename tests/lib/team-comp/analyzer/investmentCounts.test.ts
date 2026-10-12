import { describe, expect, it } from "vitest";
import type { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { ComboFormula } from "@/lib/dmgcalc/types";
import {
  deriveFutureInvestmentCombo,
  getFutureInvestmentChanges,
} from "@/lib/team-comp/analyzer/investmentCounts";
import type { TeamInvestment } from "@/lib/team-comp/analyzer/types";

const team = {
  catalog: {
    resolveCombo: (_char: string, c: number) => ({
      skill: c >= 2 ? 5 : 3,
      ...(c >= 4 ? { followup: 2 } : {}),
    }),
    getReactionComboGrid: () => [
      {
        baseId: "rx-vaporize",
        onFieldCharId: "carry",
        eligible: new Set(["carry", "support"]),
        bonus: [
          { charId: "carry", minC: 2, delta: 2 },
          { charId: "carry", minC: 4, delta: 3 },
        ],
      },
    ],
  },
} as unknown as TeamBuild;
const baseline: ComboFormula = {
  id: "base",
  label: { en: "Base", zh: "起点" },
  lines: [
    { charId: "carry", formulaId: "skill", count: 10 },
    { charId: "carry", formulaId: "rx-vaporize-carry", count: 7 },
  ],
};
const allocation = (c: number): TeamInvestment => ({
  carry: {
    constellation: c,
    weaponId: "weapon",
    refinement: 1,
    is5StarWeapon: true,
  },
});

describe("future investment counts", () => {
  it("does not reapply bonuses already included at the configured starting constellation", () => {
    const actual = deriveFutureInvestmentCombo(allocation(3), baseline, team, {
      carry: 2,
    });
    expect(actual.lines).toEqual(baseline.lines);
    expect(
      getFutureInvestmentChanges(team, { carry: 2 }).some(
        (change) => change.constellation === 2
      )
    ).toBe(false);
  });
  it("preserves authored counts and adds only future direct/reaction differences, including new formulas", () => {
    const actual = deriveFutureInvestmentCombo(allocation(4), baseline, team, {
      carry: 2,
    });
    expect(actual.lines).toContainEqual({
      charId: "carry",
      formulaId: "skill",
      count: 10,
    });
    expect(actual.lines).toContainEqual({
      charId: "carry",
      formulaId: "followup",
      count: 2,
    });
    expect(actual.lines).toContainEqual({
      charId: "carry",
      formulaId: "rx-vaporize-carry",
      count: 10,
    });
  });
  it("supports explicit zero and negative replacement deltas at thresholds", () => {
    const custom = [
      { charId: "carry", constellation: 4, formulaId: "followup", delta: 0 },
      { charId: "carry", constellation: 3, formulaId: "skill", delta: -4 },
      {
        charId: "carry",
        constellation: 4,
        formulaId: "rx-vaporize",
        delta: -2,
      },
    ];
    const actual = deriveFutureInvestmentCombo(
      allocation(4),
      baseline,
      team,
      { carry: 2 },
      custom
    );
    expect(actual.lines).toContainEqual({
      charId: "carry",
      formulaId: "skill",
      count: 6,
    });
    expect(actual.lines).toContainEqual({
      charId: "carry",
      formulaId: "rx-vaporize-carry",
      count: 5,
    });
    expect(actual.lines.some((l) => l.formulaId === "followup")).toBe(false);
    expect(
      deriveFutureInvestmentCombo(
        allocation(2),
        baseline,
        team,
        { carry: 2 },
        custom
      ).lines
    ).toEqual(baseline.lines);
  });
  it("keeps legacy exact authored counts and reaction counts losslessly", () => {
    const actual = deriveFutureInvestmentCombo(
      allocation(4),
      baseline,
      team,
      { carry: 2 },
      [],
      {
        "carry|4|skill": 23,
        "_rx-char|carry|rx-vaporize": 9,
        "carry|4|extra": 2,
      }
    );
    expect(actual.lines).toContainEqual({
      charId: "carry",
      formulaId: "skill",
      count: 23,
    });
    expect(actual.lines).toContainEqual({
      charId: "carry",
      formulaId: "rx-vaporize-carry",
      count: 9,
    });
    expect(actual.lines).toContainEqual({
      charId: "carry",
      formulaId: "extra",
      count: 2,
    });
  });
  it("sums negative and positive direct thresholds before clamping and preserves reaction variants", () => {
    const template: ComboFormula = {
      ...baseline,
      lines: [
        {
          charId: "carry",
          formulaId: "skill",
          count: 7,
          reaction: { reaction: "vaporize" },
        },
        { charId: "carry", formulaId: "skill", count: 3 },
      ],
    };
    const actual = deriveFutureInvestmentCombo(
      allocation(4),
      template,
      team,
      { carry: 2 },
      [
        { charId: "carry", constellation: 3, formulaId: "skill", delta: -20 },
        { charId: "carry", constellation: 4, formulaId: "skill", delta: 15 },
      ]
    );
    expect(actual.lines.filter((line) => line.formulaId === "skill")).toEqual([
      {
        charId: "carry",
        formulaId: "skill",
        count: 3.5,
        reaction: { reaction: "vaporize" },
      },
      { charId: "carry", formulaId: "skill", count: 1.5 },
    ]);
  });
  it("keeps the selected single hit and reaction without silently adding the full rotation", () => {
    const single = {
      ...baseline,
      lines: [
        {
          charId: "carry",
          formulaId: "skill",
          count: 1,
          reaction: { reaction: "vaporize" as const },
          forceOnField: true,
        },
      ],
    };
    expect(
      deriveFutureInvestmentCombo(
        allocation(6),
        single,
        team,
        { carry: 2 },
        [],
        { "carry|6|skill:vaporize": 40 },
        true
      )
    ).toBe(single);
  });
  it("does not reintroduce ignored contributors through future default formulas", () => {
    expect(
      deriveFutureInvestmentCombo(
        allocation(4),
        baseline,
        team,
        { carry: 2 },
        [],
        {},
        false,
        ["carry"]
      ).lines
    ).toEqual([]);
    expect(
      deriveFutureInvestmentCombo(
        allocation(4),
        baseline,
        team,
        { carry: 2 },
        [],
        {},
        true,
        ["carry"]
      )
    ).toBe(baseline);
  });
});
