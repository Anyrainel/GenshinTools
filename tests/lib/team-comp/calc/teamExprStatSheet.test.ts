import { describe, expect, it } from "vitest";
import type { StatKey } from "@/data/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { evaluate, simplify } from "@/lib/dmgcalc/core/expr";
import { fillVarsFromSheet } from "@/lib/dmgcalc/core/formulaCompiler";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuffLedger } from "@/lib/dmgcalc/core/teamBuffLedger";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import { TeamExprStatSheet } from "@/lib/dmgcalc/core/teamExprStatSheet";
import { TeamStatSheet } from "@/lib/dmgcalc/core/teamStatSheet";
import type { CalcContext, TeamSlotConfig } from "@/lib/dmgcalc/types";

import "@/lib/dmgcalc";

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

const NATIONAL_TEAM: TeamSlotConfig[] = [
  {
    charId: "xiangling",
    charLevel: 90,
    constellation: 6,
    weaponId: "the_catch",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "noblesse_oblige" },
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
  {
    charId: "raiden_shogun",
    charLevel: 90,
    constellation: 0,
    weaponId: "the_catch",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
];

const KAZUHA_TEAM: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 1,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "viridescent_venerer" },
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
  {
    charId: "yelan",
    charLevel: 90,
    constellation: 0,
    weaponId: "aqua_simulacra",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
];

function emptySheets(...charIds: string[]): Record<string, StatSheet> {
  const sheets: Record<string, StatSheet> = {};
  for (const id of charIds) sheets[id] = new StatSheet([]);
  return sheets;
}

/**
 * Compare TeamExprStatSheet against the old buildPostExprStatsForContext path.
 *
 * Strategy: For each stat key, evaluate the ExprStatSheet's get(key, null)
 * with a set of random Float64Array values and compare the result against
 * TeamStatSheet.getPostStats(charId, onFieldCharId) with matching artifact sheets.
 *
 * The idea: if variable chars have artifact stats X, then:
 * - TeamStatSheet with those artifact sheets gives postStats
 * - TeamExprStatSheet's ExprStatSheet evaluated with those artifact stats gives same values
 */
function assertExprStatParity(
  configs: TeamSlotConfig[],
  swapCharId: string,
  onFieldCharId: string,
  label: string
): void {
  const tb = new TeamBuild(configs);
  const charIds = configs.map((c) => c.charId);
  const variableCharIds = new Set([swapCharId]);

  // Build artifact sheet for the variable char with representative values
  const artSheet = new StatSheet([
    { key: "atk%" as StatKey, value: 0.466 },
    { key: "cr" as StatKey, value: 0.311 },
    { key: "cd" as StatKey, value: 0.622 },
    { key: "er" as StatKey, value: 0.2 },
    { key: "em" as StatKey, value: 40 },
    { key: "atk" as StatKey, value: 50 },
    { key: "hp" as StatKey, value: 500 },
  ]);
  const baseSheets: Record<string, StatSheet> = {};
  for (const id of charIds) {
    baseSheets[id] = id === swapCharId ? artSheet : new StatSheet([]);
  }

  // TeamStatSheet with baked-in artifacts for the old path
  const ledger = new TeamBuffLedger(
    tb.buffLedger.allBuffs,
    tb.teamMeta,
    charIds
  );
  const teamStats = new TeamStatSheet(tb.charBuilds, ledger, charIds);
  teamStats.setArtifacts(baseSheets, CTX);

  // TeamExprStatSheet shares the TeamStatSheet
  const exprStatSheet = new TeamExprStatSheet(
    teamStats,
    baseSheets,
    variableCharIds,
    CTX
  );

  // Get ExprStats first (populates VarMapping), then build all expressions
  // to fully populate VarMapping before allocating Float64Array
  const exprStats = exprStatSheet.getExprStats(swapCharId, onFieldCharId);
  const postStats = teamStats.getPostStats(swapCharId, onFieldCharId);

  // Stats to compare: scaled stats (atk, hp, def) + non-scaled artifact stats
  const SCALED_STATS = ["atk", "hp", "def"] as StatKey[];
  const NON_SCALED_STATS = ["em", "er", "cr", "cd"] as StatKey[];

  // Build all expressions first (this registers all vars in VarMapping)
  const exprMap = new Map<string, ReturnType<typeof simplify>>();
  for (const key of SCALED_STATS) {
    exprMap.set(key, simplify(exprStats.get(key, null)));
  }
  for (const key of NON_SCALED_STATS) {
    exprMap.set(key, simplify(exprStats.get(key, null)));
  }

  // Now allocate Float64Array and fill from artifact sheet
  const charBuildOrder = Object.entries(tb.charBuilds);
  const charIdx = charBuildOrder.findIndex(([id]) => id === swapCharId);
  const vars = new Float64Array(exprStatSheet.varMapping.totalVars);
  fillVarsFromSheet(artSheet, exprStatSheet.varMapping, charIdx, vars);

  // Compare values
  for (const key of [...SCALED_STATS, ...NON_SCALED_STATS]) {
    const expr = exprMap.get(key)!;
    const exprVal = evaluate(expr, vars);
    const statVal = postStats.get(key, null);
    expect(
      exprVal,
      `${label}: ${key} mismatch (expr=${exprVal}, stat=${statVal})`
    ).toBeCloseTo(statVal, 4);
  }
}

describe("TeamExprStatSheet", () => {
  describe("getCharLevel", () => {
    it("returns correct character levels", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const exprSheet = new TeamExprStatSheet(
        tb.teamStats,
        emptySheets(...charIds),
        new Set(["xiangling"]),
        CTX
      );

      expect(exprSheet.getCharLevel("xiangling")).toBe(90);
      expect(exprSheet.getCharLevel("bennett")).toBe(90);
      expect(exprSheet.getCharLevel("raiden_shogun")).toBe(90);
    });
  });

  describe("parity: ExprStatSheet evaluated values match TeamStatSheet postStats", () => {
    it("National team: xiangling as variable, xiangling on-field", () => {
      assertExprStatParity(
        NATIONAL_TEAM,
        "xiangling",
        "xiangling",
        "XL on-field"
      );
    });

    it("National team: xiangling as variable, raiden on-field", () => {
      assertExprStatParity(
        NATIONAL_TEAM,
        "xiangling",
        "raiden_shogun",
        "XL off-field (Raiden on)"
      );
    });

    it("National team: raiden as variable, raiden on-field", () => {
      assertExprStatParity(
        NATIONAL_TEAM,
        "raiden_shogun",
        "raiden_shogun",
        "Raiden on-field"
      );
    });

    it("National team: bennett as variable, xiangling on-field", () => {
      assertExprStatParity(
        NATIONAL_TEAM,
        "bennett",
        "xiangling",
        "Bennett off-field (XL on)"
      );
    });

    it("Kazuha team: hu_tao as variable, hu_tao on-field", () => {
      assertExprStatParity(KAZUHA_TEAM, "hu_tao", "hu_tao", "Hu Tao on-field");
    });

    it("Kazuha team: kazuha as variable, hu_tao on-field", () => {
      assertExprStatParity(
        KAZUHA_TEAM,
        "kaedehara_kazuha",
        "hu_tao",
        "Kazuha off-field (Hu Tao on)"
      );
    });
  });

  describe("support chars: ExprStatSheet matches TeamStatSheet for non-variable chars", () => {
    it("support char stats are constant and match postStats", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const swapCharId = "xiangling";
      const onFieldCharId = "xiangling";

      const baseSheets = emptySheets(...charIds);

      const ledger = new TeamBuffLedger(
        tb.buffLedger.allBuffs,
        tb.teamMeta,
        charIds
      );
      const teamStats = new TeamStatSheet(tb.charBuilds, ledger, charIds);
      teamStats.setArtifacts(baseSheets, CTX);

      const exprSheet = new TeamExprStatSheet(
        teamStats,
        baseSheets,
        new Set([swapCharId]),
        CTX
      );

      const CHECK_KEYS = [
        "atk",
        "hp",
        "def",
        "cr",
        "cd",
        "er",
        "em",
      ] as StatKey[];

      // Build all expressions first to fully populate VarMapping
      const exprData: {
        supportId: string;
        key: StatKey;
        expr: ReturnType<typeof simplify>;
        expected: number;
      }[] = [];
      for (const supportId of ["bennett", "xingqiu", "raiden_shogun"]) {
        const exprStats = exprSheet.getExprStats(supportId, onFieldCharId);
        const postStats = teamStats.getPostStats(supportId, onFieldCharId);
        for (const key of CHECK_KEYS) {
          exprData.push({
            supportId,
            key,
            expr: simplify(exprStats.get(key, null)),
            expected: postStats.get(key, null),
          });
        }
      }

      const vars = new Float64Array(exprSheet.varMapping.totalVars);
      for (const { supportId, key, expr, expected } of exprData) {
        const exprVal = evaluate(expr, vars);
        expect(
          exprVal,
          `${supportId}.${key}: expr=${exprVal} vs stat=${expected}`
        ).toBeCloseTo(expected, 6);
      }
    });
  });

  describe("VarMapping consistency", () => {
    it("same VarMapping is shared across multiple getExprStats calls", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const exprSheet = new TeamExprStatSheet(
        tb.teamStats,
        emptySheets(...charIds),
        new Set(["xiangling"]),
        CTX
      );

      const vm1 = exprSheet.varMapping;
      exprSheet.getExprStats("xiangling", "xiangling");
      exprSheet.getExprStats("xiangling", "raiden_shogun");
      const vm2 = exprSheet.varMapping;

      expect(vm1).toBe(vm2);
    });
  });

  describe("caching: same call returns same result", () => {
    it("getExprStats returns cached result on second call", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const exprSheet = new TeamExprStatSheet(
        tb.teamStats,
        emptySheets(...charIds),
        new Set(["xiangling"]),
        CTX
      );

      const first = exprSheet.getExprStats("xiangling", "xiangling");
      const second = exprSheet.getExprStats("xiangling", "xiangling");
      expect(first).toBe(second);
    });

    it("different onFieldCharId returns different ExprStatSheet", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);
      const exprSheet = new TeamExprStatSheet(
        tb.teamStats,
        emptySheets(...charIds),
        new Set(["xiangling"]),
        CTX
      );

      const onField = exprSheet.getExprStats("xiangling", "xiangling");
      const offField = exprSheet.getExprStats("xiangling", "raiden_shogun");
      // They should be different objects (different on-field contexts)
      // but may or may not have the same values depending on field-dependent buffs
      expect(onField).not.toBe(offField);
    });
  });

  describe("perCharCrTarget integration", () => {
    it("applies CR delta to the specified character", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const charIds = NATIONAL_TEAM.map((c) => c.charId);

      const ctxWithCr: CalcContext = {
        ...CTX,
        perCharCrTarget: { xiangling: 70 },
      };

      const exprSheet = new TeamExprStatSheet(
        tb.teamStats,
        emptySheets(...charIds),
        new Set(["xiangling"]),
        ctxWithCr
      );

      const exprSheetNoCr = new TeamExprStatSheet(
        tb.teamStats,
        emptySheets(...charIds),
        new Set(["xiangling"]),
        CTX
      );

      // Build expressions first to populate VarMapping
      const crExprWithTarget = simplify(
        exprSheet.getExprStats("xiangling", "xiangling").get("cr", null)
      );
      const crExprNoTarget = simplify(
        exprSheetNoCr.getExprStats("xiangling", "xiangling").get("cr", null)
      );

      // Then allocate vars of correct size
      const vars1 = new Float64Array(exprSheet.varMapping.totalVars);
      const vars2 = new Float64Array(exprSheetNoCr.varMapping.totalVars);

      const crWithTarget = evaluate(crExprWithTarget, vars1);
      const crNoTarget = evaluate(crExprNoTarget, vars2);

      // CR target = 70 means crDelta = (100 - 70) / 100 = 0.3
      expect(crWithTarget - crNoTarget).toBeCloseTo(0.3, 6);
    });
  });
});
