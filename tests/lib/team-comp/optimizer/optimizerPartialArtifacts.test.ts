import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
/**
 * Tests for the optimizer when characters have fewer than 5 equipped artifacts.
 * Verifies that both single-pass and multi-pass optimization handle partial
 * artifact inventories without errors.
 */
import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import { singleFormulaCombo } from "@/lib/dmgcalc/core/combo";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { CalcContext, TeamSlotConfig } from "@/lib/dmgcalc/types";
import { runTeamOptimization } from "@/lib/team-comp/optimizer/teamOptimization";
import type {
  CharOptConfig,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";
import { type OptimizerOptions, runOptimization } from "./optimizerV1";

import "@/lib/dmgcalc";
import {
  drain,
  getFirstFormulaId,
  makeArt,
  makeBuildMatch,
} from "../../../fixtures/optimizerHelpers";

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

const GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 1,
  flatHp: 0,
  flatDef: 0,
};

// ── Team setup ──────────────────────────────────────────────────────────────

// Hu Tao + Xingqiu + Zhongli + Kazuha
const CONFIGS: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 1,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSet: null,
  },
  {
    charId: "zhongli",
    charLevel: 90,
    constellation: 0,
    weaponId: "black_tassel",
    refinement: 5,
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

/** Create a full 5-piece inventory for a single slot set */
function makeFullInventory(): ArtifactData[] {
  return [
    makeArt("flower"),
    makeArt("plume"),
    makeArt("sands"),
    makeArt("goblet"),
    makeArt("circlet"),
  ];
}

// ── Single-pass optimizer (runOptimization) ─────────────────────────────────

describe("runOptimization — partial artifact inventory", () => {
  it("completes with an empty inventory (0 artifacts)", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const opts: OptimizerOptions = {
      teamBuild: tb,
      targetCharId: "hu_tao",
      formulaId,
      minEr: 1.0,
      minCr: 0,
      inventory: [],
      buildMatch: makeBuildMatch(),
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: new StatSheet([]),
        xingqiu: new StatSheet([]),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      calcContext: CTX,
    };

    const results = await drain(runOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    // With only dummy artifacts, damage should be very low or still valid
    expect(final.combinationsEvaluated).toBeGreaterThan(0);
  });

  it("completes with artifacts in only 2 of 5 slots", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = [makeArt("flower"), makeArt("plume")];
    const opts: OptimizerOptions = {
      teamBuild: tb,
      targetCharId: "hu_tao",
      formulaId,
      minEr: 1.0,
      inventory,
      minCr: 0,
      buildMatch: makeBuildMatch(),
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(inventory),
        xingqiu: new StatSheet([]),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      calcContext: CTX,
    };

    const results = await drain(runOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    expect(final.bestDamage).toBeGreaterThan(0);
  });

  it("completes with artifacts in only 4 of 5 slots", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = [
      makeArt("flower"),
      makeArt("plume"),
      makeArt("sands"),
      makeArt("goblet"),
    ];
    const opts: OptimizerOptions = {
      teamBuild: tb,
      targetCharId: "hu_tao",
      formulaId,
      minEr: 1.0,
      inventory,
      minCr: 0,
      buildMatch: makeBuildMatch(),
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(inventory),
        xingqiu: new StatSheet([]),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      calcContext: CTX,
    };

    const results = await drain(runOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    expect(final.bestDamage).toBeGreaterThan(0);
  });

  it("completes with full 5-slot inventory", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = makeFullInventory();
    const opts: OptimizerOptions = {
      teamBuild: tb,
      targetCharId: "hu_tao",
      formulaId,
      minEr: 1.0,
      inventory,
      minCr: 0,
      buildMatch: makeBuildMatch(),
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(inventory),
        xingqiu: new StatSheet([]),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      calcContext: CTX,
    };

    const results = await drain(runOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    expect(final.bestDamage).toBeGreaterThan(0);
  });

  it("can pick a better circlet even when topN is set to 1", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const setKey = "crimson_witch_of_flames";
    const highCrSubs = { cr: 25.0, cd: 7.0, atk: 20, em: 20 };
    const inventory = [
      makeArt("flower", setKey, "hp", highCrSubs),
      makeArt("plume", setKey, "atk", highCrSubs),
      makeArt("sands", setKey, "hp%", highCrSubs),
      makeArt("goblet", setKey, "pyro%", highCrSubs),
      makeArt("circlet", setKey, "cr", {}),
      makeArt("circlet", setKey, "cd", {}),
    ];

    const opts: OptimizerOptions = {
      teamBuild: tb,
      targetCharId: "hu_tao",
      formulaId,
      minEr: 1.0,
      inventory,
      minCr: 0,
      buildMatch: makeBuildMatch(),
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(inventory.slice(0, 5)),
        xingqiu: new StatSheet([]),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      calcContext: CTX,
      artifactSet: { type: "4pc", setId: setKey },
    };

    const results = await drain(runOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    expect(final.bestArtifacts.circlet?.mainStatKey).toBe("cd");
  });

  it("completes when baseSheets is missing entries for some characters", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = makeFullInventory();

    // Only provide sheets for hu_tao, not teammates
    const opts: OptimizerOptions = {
      teamBuild: tb,
      targetCharId: "hu_tao",
      formulaId,
      minEr: 1.0,
      inventory,
      minCr: 0,
      buildMatch: makeBuildMatch(),
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(inventory),
      },
      calcContext: CTX,
    };

    const results = await drain(runOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    expect(final.bestDamage).toBeGreaterThan(0);
  });
});

// ── Multi-pass team optimizer (runTeamOptimization) ─────────────────────────

describe("runTeamOptimization — partial artifact inventory", () => {
  it("completes with an empty inventory", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 1.4, minCr: 0, buildMatch: makeBuildMatch() },
      zhongli: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
      kaedehara_kazuha: {
        minEr: 1.6,
        minCr: 0,
        buildMatch: makeBuildMatch(),
      },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory: [],
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: new StatSheet([]),
        xingqiu: new StatSheet([]),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      perChar,
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
  });

  it("completes when carry has partial artifacts (3 of 5 slots)", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const carryArtifacts = [
      makeArt("flower"),
      makeArt("plume"),
      makeArt("sands"),
    ];
    const supportArtifacts = makeFullInventory();
    const inventory = [...carryArtifacts, ...supportArtifacts];

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(carryArtifacts),
        xingqiu: StatSheet.fromArtifacts(supportArtifacts),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      perChar,
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) expect(final.bestDamage).toBeGreaterThan(0);
  });

  it("completes when support has 0 artifacts", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const carryArtifacts = makeFullInventory();

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory: carryArtifacts,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(carryArtifacts),
        xingqiu: new StatSheet([]),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      perChar,
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) expect(final.bestDamage).toBeGreaterThan(0);
  });

  it("completes when baseSheets omits characters not in perChar", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = makeFullInventory();

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 1.0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(inventory),
      },
      perChar,
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) expect(final.bestDamage).toBeGreaterThan(0);
  });
});
