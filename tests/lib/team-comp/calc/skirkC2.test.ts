import { beforeAll, describe, expect, it } from "vitest";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import "@/lib/dmgcalc";
import { singleFormulaCombo } from "@/lib/dmgcalc/core/combo";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/lib/dmgcalc/core/formulaCompiler";
import { getBuffInstanceKey } from "@/lib/dmgcalc/core/statBuff";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { CalcContext, ComboFormula } from "@/lib/dmgcalc/types";

const CTX: CalcContext = {
  enemyLevel: 90,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

function setup(constellation: number) {
  const build = new TeamBuild(
    [
      {
        charId: "skirk",
        charLevel: 90,
        constellation,
        weaponId: "favonius_sword",
        refinement: 1,
        artifactSet: null,
      },
      {
        charId: "kaeya",
        charLevel: 90,
        constellation: 0,
        weaponId: "favonius_sword",
        refinement: 1,
        artifactSet: null,
      },
    ],
    { skirk: "1" }
  );
  const sheets = {
    kaeya: new StatSheet([]),
    skirk: new StatSheet([
      { key: "atk%", value: 0.466 },
      { key: "atk", value: 311 },
    ]),
  };
  build.teamStats.setArtifacts(sheets, CTX);
  const c2 = build.buffLedger.allBuffs.find(
    ({ buff }) => buff.source.origin === "C2"
  );
  const excluded = new Set(
    c2 ? [getBuffInstanceKey(c2.buff, c2.providerCharId)] : []
  );
  return { build, sheets, excluded };
}

function compiledDamage(
  build: TeamBuild,
  sheets: Record<string, StatSheet>,
  combo: ComboFormula
) {
  const compiled = compileComboTeamDamage(build, combo, "skirk", sheets, CTX);
  const vars = new Float64Array(compiled.numVars);
  fillVarsFromSheet(
    sheets.skirk,
    compiled.varMapping,
    compiled.charIdxMap?.get("skirk") ?? 0,
    vars
  );
  return compiled.evaluate(vars);
}

describe("Skirk C2 stance-only ATK bonus", () => {
  for (const constellation of [0, 2, 6]) {
    const formulas = [
      "skirk-burst",
      "skirk-e-normal",
      "skirk-e-normal-2",
      "skirk-e-charge",
    ];
    if (constellation === 6)
      formulas.push("skirk-c6-burst-coord", "skirk-c6-normal-coord");
    it.each(
      formulas
    )(`C${constellation} scopes C2 ATK correctly for %s in both evaluators`, (formulaId) => {
      const { build, sheets, excluded } = setup(constellation);
      const entry = build.catalog.formulaIndex.get(formulaId)!;
      // Independent reference: remove only C2's ATK, retaining subtlety and
      // all other constellation effects. Restore 70% base ATK only in stance.
      const withoutC2 = build.teamStats.getPostStats(
        "skirk",
        "skirk",
        excluded
      );
      const inStance = !formulaId.includes("burst");
      const tag = entry.parts[0].formula.tag;
      const atkRatio =
        constellation >= 2 && inStance
          ? 1 +
            (0.7 * withoutC2.get("baseAtk", null)) / withoutC2.get("atk", tag)
          : 1;
      const expected =
        entry.parts.reduce(
          (sum, part) =>
            sum + part.formula.calc(withoutC2, 90, CTX) * (part.hits ?? 1),
          0
        ) * atkRatio;
      expect(expected).toBeGreaterThan(0);
      expect(
        build.getDamageResult("skirk", formulaId, CTX).totalDamage
      ).toBeCloseTo(expected, 6);
      expect(
        compiledDamage(build, sheets, singleFormulaCombo("skirk", formulaId))
      ).toBeCloseTo(expected, 6);
    });
  }

  it.each([
    2, 6,
  ])("keeps stance ATK from leaking across a mixed C%s combo", (constellation) => {
    const { build, sheets } = setup(constellation);
    const combo: ComboFormula = {
      id: "mixed-skirk",
      label: { en: "Mixed Skirk", zh: "丝柯克混合伤害" },
      lines: [
        { charId: "skirk", formulaId: "skirk-e-normal-2", count: 2 },
        { charId: "skirk", formulaId: "skirk-e-charge", count: 1 },
        { charId: "skirk", formulaId: "skirk-burst", count: 1 },
        ...(constellation === 6
          ? [{ charId: "skirk", formulaId: "skirk-c6-burst-coord", count: 1 }]
          : []),
      ],
    };
    const expected = combo.lines.reduce(
      (sum, line) =>
        sum +
        line.count *
          build.getDamageResult("skirk", line.formulaId, CTX).totalDamage,
      0
    );
    expect(
      build.getComboDamageResult(combo, sheets, CTX).totalDamage
    ).toBeCloseTo(expected, 6);
    expect(compiledDamage(build, sheets, combo)).toBeCloseTo(expected, 6);
  });
});
