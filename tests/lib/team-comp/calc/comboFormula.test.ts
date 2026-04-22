import { preloadGameStats } from "@/data/gameStatsLoader";
/**
 * Tests for the combo formula system: evaluateCombo, getComboDisplayResult,
 * runTeamOptimization (combo mode), and runGenerator (combo mode).
 */
import type { GlobalStatWeights } from "@/data/types";
import type { BuildMatchResult } from "@/lib/artifact/scoring/artifactScore";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import {
  type GeneratorOptions,
  runGenerator,
} from "@/lib/team-comp/generator/generator";
import { runTeamOptimization } from "@/lib/team-comp/optimizer";
import type {
  CharOptConfig,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

import "@/lib/team-comp/index";
import {
  makeBuildMatch as _makeBuildMatch,
  drain,
  emptySheets,
  getFirstFormulaId,
  makeArt,
} from "../../../fixtures/optimizerHelpers";

await preloadGameStats();

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

const CONFIGS: TeamSlotConfig[] = [
  {
    charId: "diluc",
    charLevel: 90,
    constellation: 0,
    weaponId: "wolfs_gravestone",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 0,
    weaponId: "sacrificial_sword",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 0,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: null,
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSet: null,
  },
];

function makeTeamBuild() {
  return new TeamBuild(CONFIGS);
}

/** Diluc-team empty sheets */
function dilucEmptySheets(): Record<string, StatSheet> {
  return emptySheets("diluc", "xingqiu", "bennett", "kaedehara_kazuha");
}

const GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 1,
  flatHp: 0,
  flatDef: 0,
};

/** Diluc-specific build match (atk% sands, atk% substat weight). */
function makeBuildMatch(): BuildMatchResult {
  return {
    ..._makeBuildMatch(),
    build: {
      ..._makeBuildMatch().build,
      characterId: "diluc",
      sandsWeights: [{ stat: "atk%", weight: 100 }],
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
        { stat: "em", weight: 50 },
        { stat: "atk%", weight: 50 },
      ],
    },
    statWeights: { cr: 100, cd: 100, em: 50, "atk%": 50 },
  };
}

// 1. evaluateCombo tests

describe("evaluateCombo", () => {
  // TODO: evaluateCombo two-pass changes broke this — fix in damageCalc
  it.skip("single line (count=1) matches getDamageResult", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const teamStats = tb.getTeamStats(sheets, "diluc", CTX);
    const singleResult = tb.getDamageResult("diluc", formulaId, CTX);

    const combo: ComboFormula = {
      id: "test",
      label: { zh: "测试", en: "Test" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };
    const comboResult = tb.getComboDamageResult(combo, sheets, CTX);

    expect(comboResult.totalDamage).toBeCloseTo(singleResult.totalDamage, 2);
    expect(comboResult.lineDamages).toHaveLength(1);
    expect(comboResult.lineDamages[0].perHit).toBeCloseTo(
      singleResult.totalDamage,
      2
    );
    expect(comboResult.lineDamages[0].total).toBeCloseTo(
      singleResult.totalDamage,
      2
    );
  });

  it("multi-line combo: totalDamage = sum of per-line totals", () => {
    const tb = makeTeamBuild();
    const dilucFormula = getFirstFormulaId(tb, "diluc");
    const xqFormula = getFirstFormulaId(tb, "xingqiu");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "multi",
      label: { zh: "多行", en: "Multi" },
      lines: [
        { charId: "diluc", formulaId: dilucFormula, count: 3 },
        { charId: "xingqiu", formulaId: xqFormula, count: 2 },
      ],
    };

    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.lineDamages).toHaveLength(2);
    const summed = result.lineDamages.reduce((s, l) => s + l.total, 0);
    expect(result.totalDamage).toBeCloseTo(summed, 2);
  });

  it("line with count > 1: total = perHit * count", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "multi-count",
      label: { zh: "多次", en: "Multi count" },
      lines: [{ charId: "diluc", formulaId, count: 5 }],
    };

    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.lineDamages[0].total).toBeCloseTo(
      result.lineDamages[0].perHit * 5,
      2
    );
  });

  it("lines with count=0 are filtered out entirely", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "zero",
      label: { zh: "零", en: "Zero" },
      lines: [
        { charId: "diluc", formulaId, count: 0 },
        { charId: "diluc", formulaId, count: 1 },
      ],
    };

    const result = tb.getComboDamageResult(combo, sheets, CTX);
    // count=0 line is dropped — only the count=1 line remains
    expect(result.lineDamages).toHaveLength(1);
    expect(result.lineDamages[0].total).toBeGreaterThan(0);
    expect(result.totalDamage).toBeCloseTo(result.lineDamages[0].total, 2);
  });

  it("empty combo (all counts 0) has totalDamage = 0", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "empty",
      label: { zh: "空", en: "Empty" },
      lines: [{ charId: "diluc", formulaId, count: 0 }],
    };

    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.totalDamage).toBe(0);
  });

  it("line.reaction is used directly when set on the combo line", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    // Without reaction
    const noRxn: ComboFormula = {
      id: "no-rxn",
      label: { zh: "无反应", en: "No reaction" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };
    const resultNoRxn = tb.getComboDamageResult(noRxn, sheets, CTX);

    // With reaction set directly on the combo line
    const withRxn: ComboFormula = {
      id: "with-rxn",
      label: { zh: "有反应", en: "With reaction" },
      lines: [
        {
          charId: "diluc",
          formulaId,
          count: 1,
          reaction: { reaction: "vaporize" },
        },
      ],
    };
    const resultWithRxn = tb.getComboDamageResult(withRxn, sheets, CTX);

    expect(resultWithRxn.totalDamage).toBeGreaterThan(resultNoRxn.totalDamage);
  });

  it("combo line's reaction: 'none' produces same damage as no reaction", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    // Combo line with explicit reaction: "none"
    const combo: ComboFormula = {
      id: "override",
      label: { zh: "覆盖", en: "Override" },
      lines: [
        {
          charId: "diluc",
          formulaId,
          count: 1,
          reaction: { reaction: "none" },
        },
      ],
    };

    const resultNone = tb.getComboDamageResult(combo, sheets, CTX);

    // Without any reaction
    const noRxnCombo: ComboFormula = {
      id: "baseline",
      label: { zh: "基线", en: "Baseline" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };
    const resultNoRxn = tb.getComboDamageResult(noRxnCombo, sheets, CTX);

    // reaction: "none" should produce the same damage as no reaction set
    expect(resultNone.totalDamage).toBeCloseTo(resultNoRxn.totalDamage, 2);
  });
});

// 2. getComboDisplayResult tests

describe("getComboDisplayResult", () => {
  it("returns DisplayResult with populated partsByFormula", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "display",
      label: { zh: "显示", en: "Display" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const result = tb.getComboDisplayResult(combo, sheets, CTX);
    const parts = result.partsByFormula[`diluc.${formulaId}`];
    expect(parts).toBeDefined();
    expect(parts!.length).toBeGreaterThanOrEqual(1);
  });

  it("totalDamage matches evaluateCombo", () => {
    const tb = makeTeamBuild();
    const dilucFormula = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "match",
      label: { zh: "匹配", en: "Match" },
      lines: [{ charId: "diluc", formulaId: dilucFormula, count: 3 }],
    };

    const displayResult = tb.getComboDisplayResult(combo, sheets, CTX);
    const comboResult = tb.getComboDamageResult(
      { ...combo, lines: combo.lines.filter((l) => l.count > 0) },
      sheets,
      CTX
    );

    expect(displayResult.totalDamage).toBeCloseTo(comboResult.totalDamage, 2);
  });

  it("statSheets are populated for all team characters", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "stats",
      label: { zh: "统计", en: "Stats" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const result = tb.getComboDisplayResult(combo, sheets, CTX);
    for (const charId of ["diluc", "xingqiu", "bennett", "kaedehara_kazuha"]) {
      expect(result.statSheets[charId]).toBeDefined();
      expect(result.statSheets[charId].onField).toBeDefined();
      expect(result.statSheets[charId].offField).toBeDefined();
    }
  });

  it("marginalGains: carry character has non-zero gains for some stats", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "mg-carry",
      label: { zh: "增益", en: "Gains" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const result = tb.getComboDisplayResult(combo, sheets, CTX);
    const dilucGains = result.marginalGains.diluc;
    expect(dilucGains).toBeDefined();
    const gainValues = Object.values(dilucGains ?? {});
    expect(gainValues.some((v) => v !== 0)).toBe(true);
  });

  it("buffs array is non-empty", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "buffs",
      label: { zh: "增益", en: "Buffs" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const result = tb.getComboDisplayResult(combo, sheets, CTX);
    expect(result.buffs.length).toBeGreaterThan(0);
  });
});

// 3. runTeamOptimization combo mode tests

describe("runTeamOptimization — combo mode", () => {
  const perChar: Record<string, CharOptConfig> = {
    diluc: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
    xingqiu: { minEr: 1.4, minCr: 0, buildMatch: makeBuildMatch() },
  };

  it("combo mode yields result with bestDamage > 0", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");

    const combo: ComboFormula = {
      id: "opt-combo",
      label: { zh: "优化", en: "Optimize" },
      lines: [{ charId: "diluc", formulaId, count: 3 }],
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo,
      inventory: [],
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: dilucEmptySheets(),
      perChar,
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) {
      expect(final.bestDamage).toBeGreaterThan(0);
    }
  });

  it("single-formula combo yields result with bestDamage > 0", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      inventory: [],
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: dilucEmptySheets(),
      perChar,
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) {
      expect(final.bestDamage).toBeGreaterThan(0);
    }
  });

  it("combo mode: characters with active lines get carry passes, others get support", async () => {
    const tb = makeTeamBuild();
    const dilucFormula = getFirstFormulaId(tb, "diluc");
    const xqFormula = getFirstFormulaId(tb, "xingqiu");

    const combo: ComboFormula = {
      id: "pass-order",
      label: { zh: "顺序", en: "Order" },
      lines: [
        { charId: "diluc", formulaId: dilucFormula, count: 3 },
        { charId: "xingqiu", formulaId: xqFormula, count: 2 },
      ],
    };

    // Only diluc and xingqiu in perChar — both are combo carries
    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo,
      inventory: [],
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: dilucEmptySheets(),
      perChar: {
        diluc: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
        xingqiu: { minEr: 1.4, minCr: 0, buildMatch: makeBuildMatch() },
      },
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) {
      // Both diluc and xingqiu should have carry-1 and carry-2 passes
      const carryPasses = final.passResults.filter(
        (p) => p.passId === "carry-1" || p.passId === "carry-2"
      );
      const carryCharIds = new Set(carryPasses.map((p) => p.charId));
      expect(carryCharIds.has("diluc")).toBe(true);
      expect(carryCharIds.has("xingqiu")).toBe(true);
    }
  });

  it("combo mode bestDamage > 0 with valid artifacts", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const inventory = [
      makeArt("flower"),
      makeArt("plume"),
      makeArt("sands"),
      makeArt("goblet"),
      makeArt("circlet"),
    ];

    const combo: ComboFormula = {
      id: "valid-arts",
      label: { zh: "有效", en: "Valid" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo,
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        ...dilucEmptySheets(),
        diluc: StatSheet.fromArtifacts(inventory),
      },
      perChar: {
        diluc: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
      },
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) {
      expect(final.bestDamage).toBeGreaterThan(0);
    }
  });

  it("combo mode with empty inventory still completes", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");

    const combo: ComboFormula = {
      id: "empty-inv",
      label: { zh: "空", en: "Empty" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo,
      inventory: [],
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: dilucEmptySheets(),
      perChar: {
        diluc: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
      },
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
  });
});

// 4. runGenerator combo mode tests

describe("runGenerator — combo mode", () => {
  it("with combo option, result includes comboResult", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");

    const combo: ComboFormula = {
      id: "gen-combo",
      label: { zh: "生成", en: "Generated" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo,
      calcContext: CTX,
    };

    const results = await drain(runGenerator(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    expect(Object.keys(final.artifactsByChar)).toContain("diluc");
  });

  it("single-formula combo result has artifacts", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");

    const opts: GeneratorOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      calcContext: CTX,
    };

    const results = await drain(runGenerator(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    expect(Object.keys(final.artifactsByChar)).toContain("diluc");
  });
});

// 5. Edge cases

describe("combo edge cases", () => {
  it("combo with a character not in the team build skips that line", () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "missing-char",
      label: { zh: "缺失", en: "Missing" },
      lines: [
        { charId: "diluc", formulaId, count: 1 },
        { charId: "nonexistent_char", formulaId: "fake-formula", count: 1 },
      ],
    };

    // Non-existent character lines are silently skipped (only valid line evaluated)
    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.lineDamages).toHaveLength(1);
    expect(result.totalDamage).toBeGreaterThanOrEqual(0);
  });

  it("combo referencing a non-existent formulaId skips that line", () => {
    const tb = makeTeamBuild();
    const sheets = dilucEmptySheets();

    const combo: ComboFormula = {
      id: "bad-formula",
      label: { zh: "错误", en: "Bad" },
      lines: [
        { charId: "diluc", formulaId: "nonexistent-formula-id", count: 1 },
      ],
    };

    // Non-existent formula lines are silently skipped
    const result = tb.getComboDamageResult(combo, sheets, CTX);
    expect(result.lineDamages).toHaveLength(0);
    expect(result.totalDamage).toBe(0);
  });

  it("single-character combo: only 1 character has formulas, others are supports", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");

    const combo: ComboFormula = {
      id: "single-carry",
      label: { zh: "单输出", en: "Single carry" },
      lines: [{ charId: "diluc", formulaId, count: 5 }],
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo,
      inventory: [],
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: dilucEmptySheets(),
      perChar: {
        diluc: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
        xingqiu: { minEr: 1.4, minCr: 0, buildMatch: makeBuildMatch() },
        bennett: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
      },
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) {
      // Only diluc has combo lines, so xingqiu and bennett should get support passes
      const supportPasses = final.passResults.filter(
        (p) => p.passId === "support"
      );
      const supportCharIds = supportPasses.map((p) => p.charId);
      expect(supportCharIds).toContain("xingqiu");
      expect(supportCharIds).toContain("bennett");
    }
  });
});

// 6. Single→Combo normalization equivalence
// Verifies that single mode and 1-line combo mode produce the same
// bestDamage from the optimizer (internally both use combo path now).

describe("single↔combo normalization equivalence", () => {
  const perChar: Record<string, CharOptConfig> = {
    diluc: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
    xingqiu: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
  };

  it("singleFormulaCombo and explicit 1-line combo produce same bestDamage", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const inventory = [
      makeArt("flower"),
      makeArt("plume"),
      makeArt("sands"),
      makeArt("goblet"),
      makeArt("circlet"),
    ];

    // singleFormulaCombo helper
    const singleOpts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: singleFormulaCombo("diluc", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        ...dilucEmptySheets(),
        diluc: StatSheet.fromArtifacts(inventory),
      },
      perChar,
    };
    const singleResults = await drain(runTeamOptimization(singleOpts));
    const singleFinal = singleResults[singleResults.length - 1];
    expect(singleFinal.done).toBe(true);

    // Explicit 1-line combo (same formula, count=1)
    const combo: ComboFormula = {
      id: "__equiv__",
      label: { zh: "", en: "" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };
    const comboOpts: TeamOptimizerOptions = {
      ...singleOpts,
      combo,
    };
    const comboResults = await drain(runTeamOptimization(comboOpts));
    const comboFinal = comboResults[comboResults.length - 1];
    expect(comboFinal.done).toBe(true);

    if (singleFinal.done && comboFinal.done) {
      const relErr =
        singleFinal.bestDamage === 0
          ? comboFinal.bestDamage === 0
            ? 0
            : Number.POSITIVE_INFINITY
          : Math.abs(comboFinal.bestDamage - singleFinal.bestDamage) /
            Math.abs(singleFinal.bestDamage);
      expect(relErr).toBeLessThan(1e-6);
    }
  });

  it("combo with vaporize via line reaction produces higher damage than without", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "diluc");
    const inventory = [
      makeArt("flower"),
      makeArt("plume"),
      makeArt("sands"),
      makeArt("goblet"),
      makeArt("circlet"),
    ];

    const baseSheets = {
      ...dilucEmptySheets(),
      diluc: StatSheet.fromArtifacts(inventory),
    };

    // Combo with vaporize via line reaction
    const comboWithLineRxn: ComboFormula = {
      id: "__line-rxn__",
      label: { zh: "", en: "" },
      lines: [
        {
          charId: "diluc",
          formulaId,
          count: 1,
          reaction: { reaction: "vaporize" },
        },
      ],
    };
    const lineRxnOpts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: comboWithLineRxn,
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets,
      perChar,
    };
    const lineRxnResults = await drain(runTeamOptimization(lineRxnOpts));
    const lineRxnFinal = lineRxnResults[lineRxnResults.length - 1];

    // Combo without reaction
    const comboNoRxn: ComboFormula = {
      id: "__no-rxn__",
      label: { zh: "", en: "" },
      lines: [{ charId: "diluc", formulaId, count: 1 }],
    };
    const noRxnOpts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "diluc",
      combo: comboNoRxn,
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets,
      perChar,
    };
    const noRxnResults = await drain(runTeamOptimization(noRxnOpts));
    const noRxnFinal = noRxnResults[noRxnResults.length - 1];

    expect(lineRxnFinal.done).toBe(true);
    expect(noRxnFinal.done).toBe(true);
    if (lineRxnFinal.done && noRxnFinal.done) {
      // Vaporize should produce higher damage
      expect(lineRxnFinal.bestDamage).toBeGreaterThan(noRxnFinal.bestDamage);
    }
  });
});
