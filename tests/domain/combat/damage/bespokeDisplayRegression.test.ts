import "@/providers/reference/statLoaders";
import "@/domain/combat/damage/index";
import { describe, expect, it } from "vitest";
import { singleFormulaCombo } from "@/domain/combat/damage/core/combo";
import {
  compileComboTeamDamage,
  fillVarsFromSheet,
} from "@/domain/combat/damage/core/formulaCompiler";
import {
  evaluateFormulaDamage,
  evaluateFormulaDisplay,
} from "@/domain/combat/damage/core/formulaEval";
import { getBuffInstanceKey } from "@/domain/combat/damage/core/statBuff";
import { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type {
  CalcContext,
  ReactionOverride,
  TeamSlotConfig,
} from "@/domain/combat/damage/types";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/domain/reference/stats";
import { emptySheets } from "../../../fixtures/optimizerHelpers";

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};
const TEAM: TeamSlotConfig[] = [
  {
    charId: "dehya",
    charLevel: 90,
    constellation: 2,
    weaponId: "favonius_greatsword",
    refinement: 1,
    artifactSet: null,
  },
];
const FORMULA = "dehya-molten-inferno";
const COMBINATIONS = Array.from({ length: 5 }, (_, reactingHits) =>
  [1, 2, 3].map((count) => ({ reactingHits, count }))
).flat();

describe("Dehya C2 bespoke one-hit bonus across damage and display paths", () => {
  it("collects buffs from both on-field and off-field repeated lines regardless of order", () => {
    const tb = new TeamBuild([
      ...TEAM,
      {
        charId: "bennett",
        charLevel: 90,
        constellation: 1,
        weaponId: "aquila_favonia",
        refinement: 1,
        artifactSet: null,
      },
    ]);
    const sheets = emptySheets("dehya", "bennett");
    const combo = singleFormulaCombo("dehya", FORMULA);
    combo.lines.push({ ...combo.lines[0], forceOnField: true });
    for (const lines of [combo.lines, [...combo.lines].reverse()]) {
      const display = tb.getComboDisplayResult(
        { ...combo, lines },
        sheets,
        CTX
      );
      const bennettBuff = display.buffs.find(
        (buff) =>
          buff.providerCharId === "bennett" && buff.source.origin === "Q"
      );
      expect(bennettBuff).toBeDefined();
      expect(bennettBuff!.active).toBe(true);
    }
  });

  it("does not apply the same one-hit cap twice for a one-cast combo", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets("dehya");
    tb.teamStats.setArtifacts(sheets, CTX);
    const damage = tb.getDamageResult("dehya", FORMULA, CTX);
    const combo = tb.getComboDamageResult(
      singleFormulaCombo("dehya", FORMULA),
      sheets,
      CTX
    );
    expect(combo.totalDamage).toBeCloseTo(damage.totalDamage, 8);
  });

  it("shares the one-hit bonus between reacting and nonreacting hits", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets("dehya");
    tb.teamStats.setArtifacts(sheets, CTX);
    const reaction: ReactionOverride = {
      reaction: "vaporize",
      rxnPartHits: { 0: 2 },
    };
    const damage = tb.getDamageResult("dehya", FORMULA, CTX, reaction);
    const display = evaluateFormulaDisplay(
      tb.catalog.formulaIndex.get(FORMULA)!,
      "dehya",
      tb.teamStats,
      CTX,
      reaction
    );
    expect(damage.totalDamage).toBeCloseTo(display.totalDamage, 8);
  });

  it("keeps displayed hit totals and damage when assembling a one-cast combo", () => {
    const tb = new TeamBuild(TEAM);
    const sheets = emptySheets("dehya");
    const display = tb.getComboDisplayResult(
      singleFormulaCombo("dehya", FORMULA),
      sheets,
      CTX
    );
    const parts = display.partsByFormula[`dehya.${FORMULA}`];
    expect(parts.reduce((sum, part) => sum + (part.hits ?? 1), 0)).toBe(4);
    expect(
      parts.reduce((sum, part) => sum + part.damage * (part.hits ?? 1), 0)
    ).toBeCloseTo(display.totalDamage, 8);
  });

  it.each(COMBINATIONS)(
    "agrees with compiled damage for $reactingHits reacting hits and $count casts",
    ({ reactingHits, count }) => {
      const tb = new TeamBuild(TEAM);
      const sheets = emptySheets("dehya");
      const reaction: ReactionOverride = {
        reaction: "vaporize",
        rxnPartHits: { 0: reactingHits },
      };
      const combo = singleFormulaCombo("dehya", FORMULA, reaction);
      combo.lines[0].count = count;
      tb.teamStats.setArtifacts(sheets, CTX);
      const scalar = evaluateFormulaDamage(
        tb.catalog.formulaIndex.get(FORMULA)!,
        "dehya",
        tb.teamStats,
        CTX,
        reaction,
        undefined,
        undefined,
        count
      );
      const damage = tb.getComboDamageResult(combo, sheets, CTX);
      const compiled = compileComboTeamDamage(tb, combo, "dehya", sheets, CTX);
      const vars = new Float64Array(compiled.numVars);
      fillVarsFromSheet(
        sheets.dehya,
        compiled.varMapping,
        compiled.charIdxMap!.get("dehya")!,
        vars
      );
      const expected = compiled.evaluate(vars);
      const display = tb.getComboDisplayResult(combo, sheets, CTX);
      const parts = display.partsByFormula[`dehya.${FORMULA}`];
      expect(scalar.totalDamage * count).toBeCloseTo(expected, 8);
      expect(damage.totalDamage).toBeCloseTo(expected, 8);
      expect(display.totalDamage).toBeCloseTo(expected, 8);
      expect(
        parts.reduce((sum, part) => sum + (part.hits ?? 1), 0)
      ).toBeCloseTo(4, 8);
      expect(
        parts.reduce((sum, part) => sum + part.damage * (part.hits ?? 1), 0) *
          count
      ).toBeCloseTo(expected, 8);
    }
  );

  it.each(COMBINATIONS)(
    "agrees with compiled damage with partial Bennett buffs for $reactingHits reacting hits and $count casts",
    ({ reactingHits, count }) => {
      const tb = new TeamBuild([
        ...TEAM,
        {
          charId: "bennett",
          charLevel: 90,
          constellation: 1,
          weaponId: "aquila_favonia",
          refinement: 1,
          artifactSet: null,
        },
      ]);
      const sheets = emptySheets("dehya", "bennett");
      const buff = tb.buffLedger.allBuffs.find(
        ({ providerCharId, buff }) =>
          providerCharId === "bennett" &&
          buff.source.type === "character" &&
          buff.source.origin === "Q"
      );
      expect(buff).toBeDefined();
      const buffKey = getBuffInstanceKey(buff!.buff, buff!.providerCharId);
      const reaction: ReactionOverride = {
        reaction: "vaporize",
        rxnPartHits: { 0: reactingHits },
      };
      const combo = singleFormulaCombo("dehya", FORMULA, reaction, true);
      combo.lines[0].count = count;
      for (const activatedHits of [0, 2, 4]) {
        const activation = { [buffKey]: { 0: activatedHits } };
        const damage = tb.getComboDamageResult(combo, sheets, CTX, {
          0: activation,
        });
        const compiled = compileComboTeamDamage(
          tb,
          combo,
          "dehya",
          sheets,
          CTX,
          { "line:0": activation }
        );
        const vars = new Float64Array(compiled.numVars);
        fillVarsFromSheet(
          sheets.dehya,
          compiled.varMapping,
          compiled.charIdxMap!.get("dehya")!,
          vars
        );
        const expected = compiled.evaluate(vars);
        const display = tb.getComboDisplayResult(combo, sheets, CTX, {
          0: activation,
        });
        const parts = display.partsByFormula[`dehya.${FORMULA}`];
        expect(damage.totalDamage, `activation=${activatedHits}`).toBeCloseTo(
          expected,
          8
        );
        expect(display.totalDamage, `activation=${activatedHits}`).toBeCloseTo(
          expected,
          8
        );
        expect(
          parts.reduce((sum, part) => sum + part.damage * (part.hits ?? 1), 0) *
            count,
          `activation=${activatedHits}`
        ).toBeCloseTo(expected, 8);
      }
    }
  );
});
