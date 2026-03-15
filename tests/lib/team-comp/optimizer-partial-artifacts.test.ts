/**
 * Tests for the optimizer when characters have fewer than 5 equipped artifacts.
 * Verifies that both single-pass and multi-pass optimization handle partial
 * artifact inventories without errors.
 */
import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import type { BuildMatchResult } from "@/lib/account-data/artifactScore";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import {
  type OptimizerOptions,
  runOptimization,
} from "@/lib/team-comp/optimizer";
import {
  type PerCharConfig,
  type TeamOptimizerOptions,
  runTeamOptimization,
} from "@/lib/team-comp/teamOptimizer";
import type { CalcContext, CharCompConfig } from "@/lib/team-comp/types";
import { beforeAll, describe, expect, it } from "vitest";

import "@/lib/team-comp/index";

await preloadGameStats();

// ── Helpers ──────────────────────────────────────────────────────────────────

const CTX: CalcContext = {
  enemyLevel: 100,
  enemyRes: 0.1,
  assumeCrit: false,
};

const GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 1,
  flatHp: 0,
  flatDef: 0,
};

let artCounter = 0;
function makeArt(
  slot: ArtifactData["slotKey"],
  setKey = "crimson_witch_of_flames",
  mainStat: ArtifactData["mainStatKey"] = "hp",
  substats: ArtifactData["substats"] = { cr: 7.0, cd: 14.0, atk: 20, em: 20 }
): ArtifactData {
  const mainStats: Record<string, ArtifactData["mainStatKey"]> = {
    flower: "hp",
    plume: "atk",
    sands: "hp%",
    goblet: "pyro%",
    circlet: "cr",
  };
  return {
    id: `partial-test-${++artCounter}`,
    setKey,
    slotKey: slot,
    rarity: 5,
    level: 20,
    mainStatKey: mainStat === "hp" ? (mainStats[slot] ?? "hp") : mainStat,
    lock: false,
    substats,
  };
}

/** Minimal build match result for optimizer scoring. */
function makeBuildMatch(): BuildMatchResult {
  return {
    build: {
      id: "test-build",
      characterId: "hu_tao",
      visible: true,
      name: "Test Build",
      composition: "4pc",
      artifactSet: "crimson_witch_of_flames",
      roles: ["dps"],
      sandsWeights: [{ stat: "hp%", weight: 100 }],
      gobletWeights: [{ stat: "pyro%", weight: 100 }],
      circletWeights: [{ stat: "cr", weight: 100 }],
      normalizer: 0,
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
        { stat: "em", weight: 50 },
        { stat: "hp%", weight: 50 },
      ],
    },
    buildIndex: 0,
    statWeights: { cr: 100, cd: 100, em: 50, "hp%": 50 },
    setMatched: true,
    setDifferent: false,
    mainStatMatches: 3,
    mainStatMismatches: [],
  };
}

// ── Team setup ──────────────────────────────────────────────────────────────

// Hu Tao + Xingqiu + Zhongli + Kazuha
const CONFIGS: CharCompConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 1,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSetId: "crimson_witch_of_flames",
    artifactHalfSetIds: [],
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "zhongli",
    charLevel: 90,
    constellation: 0,
    weaponId: "black_tassel",
    refinement: 5,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSetId: null,
    artifactHalfSetIds: [],
  },
];

function makeTeamBuild() {
  return new TeamBuild(CONFIGS);
}

function getFirstFormulaId(tb: TeamBuild, charId: string): string {
  const formulas = tb.getFormulaIds()[charId];
  return Object.keys(formulas)[0];
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

/** Collect all yields from an async generator */
async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
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
      targetEr: 1.0,
      targetCr: 0,
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
      targetEr: 1.0,
      inventory,
      targetCr: 0,
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
      targetEr: 1.0,
      inventory,
      targetCr: 0,
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
      targetEr: 1.0,
      inventory,
      targetCr: 0,
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
      targetEr: 1.0,
      inventory,
      targetCr: 0,
      buildMatch: makeBuildMatch(),
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(inventory.slice(0, 5)),
        xingqiu: new StatSheet([]),
        zhongli: new StatSheet([]),
        kaedehara_kazuha: new StatSheet([]),
      },
      calcContext: CTX,
      artifactSetId: setKey,
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
      targetEr: 1.0,
      inventory,
      targetCr: 0,
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
    const perChar: Record<string, PerCharConfig> = {
      hu_tao: { targetEr: 1.0, targetCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { targetEr: 1.4, targetCr: 0, buildMatch: makeBuildMatch() },
      zhongli: { targetEr: 1.0, targetCr: 0, buildMatch: makeBuildMatch() },
      kaedehara_kazuha: {
        targetEr: 1.6,
        targetCr: 0,
        buildMatch: makeBuildMatch(),
      },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      formulaId,
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

    const perChar: Record<string, PerCharConfig> = {
      hu_tao: { targetEr: 1.0, targetCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { targetEr: 1.0, targetCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      formulaId,
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

    const perChar: Record<string, PerCharConfig> = {
      hu_tao: { targetEr: 1.0, targetCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { targetEr: 1.0, targetCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      formulaId,
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

    const perChar: Record<string, PerCharConfig> = {
      hu_tao: { targetEr: 1.0, targetCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      formulaId,
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: {
        hu_tao: StatSheet.fromArtifacts(inventory),
        // Teammates omitted — simulates characters not in accountData
      },
      perChar,
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (final.done) expect(final.bestDamage).toBeGreaterThan(0);
  });
});
