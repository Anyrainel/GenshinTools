import { preloadGameStats } from "@/data/gameStatsLoader";
/**
 * Tests for the ignoreArtifactSets fallback feature in runTeamOptimization.
 *
 * Scenarios covered:
 * 1. Flag off + set failure → failReason preserved, no retry
 * 2. Flag on + set failure → retry without sets, no failReason in result
 * 3. Flag on + no failure  → no retry needed, result unchanged
 * 4. Multiple chars fail   → each retried individually
 * 5. Accidental set bonus  → detected post-optimization, teamBuild rebuilt
 * 6. No accidental bonus   → no teamBuild on result
 * 7. Per-character flag     → only flagged char retried
 */
import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { runTeamOptimization } from "@/lib/team-comp/optimizer";
import type {
  TeamOptYield,
  TeamOptimizationResult,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";
import type { CalcContext, TeamSlotConfig } from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

import "@/lib/team-comp/index";
import {
  drain,
  emptySheets,
  getFirstFormulaId,
  makeArt,
  makeBuildMatch,
} from "../../../fixtures/optimizerHelpers";

await preloadGameStats();

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

async function getFinalResult(
  gen: AsyncGenerator<TeamOptYield>
): Promise<TeamOptimizationResult> {
  const results = await drain(gen);
  const final = results[results.length - 1];
  if (!final.done) throw new Error("Expected done result");
  return final;
}

const CW = "crimson_witch_of_flames";
const GL = "gladiators_finale";
const ESF = "emblem_of_severed_fate";
const WT = "wanderers_troupe";
const OFF = "thundering_fury";

// Hu Tao (carry, CW 4pc) + Xingqiu (support, ESF 4pc)
const CONFIGS: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 1,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSet: { type: "4pc", setId: CW },
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSet: { type: "4pc", setId: ESF },
  },
];

function makeTeamBuild(configs = CONFIGS) {
  return new TeamBuild(configs);
}

/** Inventory that has NO CW pieces — will cause CW 4pc to fail. */
function makeNonCwInventory(): ArtifactData[] {
  return [
    makeArt("flower", GL),
    makeArt("plume", GL),
    makeArt("sands", GL),
    makeArt("goblet", GL),
    makeArt("circlet", GL),
    makeArt("flower", WT),
    makeArt("plume", WT),
    makeArt("sands", WT),
    makeArt("goblet", WT),
    makeArt("circlet", WT),
  ];
}

/** Inventory with CW pieces — will succeed with CW 4pc. */
function makeCwInventory(): ArtifactData[] {
  return [
    makeArt("flower", CW),
    makeArt("plume", CW),
    makeArt("sands", CW),
    makeArt("goblet", CW),
    makeArt("circlet", CW),
  ];
}

/** Inventory with no ESF pieces — ESF 4pc will fail. */
function makeNonEsfInventory(): ArtifactData[] {
  return [
    makeArt("flower", OFF),
    makeArt("plume", OFF),
    makeArt("sands", OFF, "er"),
    makeArt("goblet", OFF),
    makeArt("circlet", OFF),
  ];
}

describe("runTeamOptimization — ignoreArtifactSets", () => {
  it("without flag: set failure produces a failReason when ER is impossible", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    // Give only 1 piece per slot so no CW 4pc can form
    const inventory = [
      makeArt("flower", GL),
      makeArt("plume", GL),
      makeArt("sands", GL),
      makeArt("goblet", GL),
      makeArt("circlet", GL),
    ];

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: emptySheets(),
      perChar: {
        hu_tao: {
          minEr: 5.0, // impossibly high ER to force failure
          minCr: 0,
          buildMatch: makeBuildMatch(),
          artifactSet: { type: "4pc", setId: CW },
        },
      },
    };

    const result = await getFinalResult(runTeamOptimization(opts));
    // hu_tao should have a fail reason (set-impossible, no-seeds, or er-unmet)
    expect(result.failReasons.hu_tao).toBeDefined();
  });

  it("with flag: retries without sets on failure, clears failReason", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = makeNonCwInventory();

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: emptySheets(),
      perChar: {
        hu_tao: {
          minEr: 1.0,
          minCr: 0,
          buildMatch: makeBuildMatch(),
          artifactSet: { type: "4pc", setId: CW },
        },
      },
      ignoreArtifactSets: { hu_tao: true },
    };

    const result = await getFinalResult(runTeamOptimization(opts));
    // Retry should succeed — no CW set but GL pieces are available
    expect(result.failReasons.hu_tao).toBeUndefined();
    expect(result.bestDamage).toBeGreaterThan(0);
    // TeamBuild should be rebuilt (sets changed)
    expect(result.teamBuild).toBeDefined();
  });

  it("with flag but no failure: no retry needed, result unchanged", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = makeCwInventory();

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: emptySheets(),
      perChar: {
        hu_tao: {
          minEr: 1.0,
          minCr: 0,
          buildMatch: makeBuildMatch(),
          artifactSet: { type: "4pc", setId: CW },
        },
      },
      ignoreArtifactSets: { hu_tao: true },
    };

    const result = await getFinalResult(runTeamOptimization(opts));
    expect(result.failReasons.hu_tao).toBeUndefined();
    expect(result.bestDamage).toBeGreaterThan(0);
  });

  it("per-character: only flagged character is retried", async () => {
    // Both hu_tao and xingqiu have set constraints.
    // Only xingqiu has the ignore flag.
    // Give inventory with NO CW and NO ESF → both will fail initially.
    // Use high ER target for hu_tao to force a definite failure.
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = [...makeNonCwInventory(), ...makeNonEsfInventory()];

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: emptySheets(),
      perChar: {
        hu_tao: {
          minEr: 5.0, // impossibly high ER to force failure
          minCr: 0,
          buildMatch: makeBuildMatch(),
          artifactSet: { type: "4pc", setId: CW },
        },
        xingqiu: {
          minEr: 1.0,
          minCr: 0,
          artifactSet: { type: "4pc", setId: ESF },
        },
      },
      ignoreArtifactSets: { xingqiu: true },
    };

    const result = await getFinalResult(runTeamOptimization(opts));
    // hu_tao should still fail (no CW, no ignore flag, impossible ER)
    expect(result.failReasons.hu_tao).toBeDefined();
    // xingqiu should succeed after retry (ignore flag set)
    expect(result.failReasons.xingqiu).toBeUndefined();
  });

  it("multiple characters fail: each retried individually", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = [...makeNonCwInventory(), ...makeNonEsfInventory()];

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: emptySheets(),
      perChar: {
        hu_tao: {
          minEr: 1.0,
          minCr: 0,
          buildMatch: makeBuildMatch(),
          artifactSet: { type: "4pc", setId: CW },
        },
        xingqiu: {
          minEr: 1.0,
          minCr: 0,
          artifactSet: { type: "4pc", setId: ESF },
        },
      },
      ignoreArtifactSets: { hu_tao: true, xingqiu: true },
    };

    const result = await getFinalResult(runTeamOptimization(opts));
    // Both should succeed after retry
    expect(result.failReasons.hu_tao).toBeUndefined();
    expect(result.failReasons.xingqiu).toBeUndefined();
    expect(result.bestDamage).toBeGreaterThan(0);
    expect(result.teamBuild).toBeDefined();
  });
});

describe("runTeamOptimization — accidental set detection", () => {
  it("detects accidental 4pc bonus and rebuilds TeamBuild", async () => {
    // Config has NO set requirement, but inventory is all GL → optimizer picks GL pieces
    // → detectEquippedSets finds 4pc GL → teamBuild rebuilt with GL 4pc
    const configs: TeamSlotConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSet: null, // no set requirement
      },
    ];
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    // All GL inventory — optimizer will pick all GL
    const inventory = [
      makeArt("flower", GL),
      makeArt("plume", GL),
      makeArt("sands", GL, "hp%"),
      makeArt("goblet", GL, "pyro%"),
      makeArt("circlet", GL, "cr"),
    ];

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: { hu_tao: new StatSheet([]) },
      perChar: {
        hu_tao: {
          minEr: 1.0,
          minCr: 0,
          buildMatch: makeBuildMatch(),
          artifactSet: null,
        },
      },
    };

    const result = await getFinalResult(runTeamOptimization(opts));
    expect(result.bestDamage).toBeGreaterThan(0);
    // Should detect GL 4pc and rebuild
    expect(result.teamBuild).toBeDefined();
    if (result.teamBuild) {
      // The rebuilt TeamBuild should have GL as the carry's artifact set
      const rebuilt = result.teamBuild;
      expect(rebuilt.teamMeta.artifactSets.hu_tao).toBe(GL);
    }
  });

  it("no accidental bonus → no teamBuild on result", async () => {
    // Config requests CW 4pc, inventory has CW 4pc → sets match, no rebuild
    const configs: TeamSlotConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSet: { type: "4pc", setId: CW },
      },
    ];
    const tb = new TeamBuild(configs);
    const formulaId = getFirstFormulaId(tb, "hu_tao");
    const inventory = makeCwInventory();

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: { hu_tao: new StatSheet([]) },
      perChar: {
        hu_tao: {
          minEr: 1.0,
          minCr: 0,
          buildMatch: makeBuildMatch(),
          artifactSet: { type: "4pc", setId: CW },
        },
      },
    };

    const result = await getFinalResult(runTeamOptimization(opts));
    expect(result.bestDamage).toBeGreaterThan(0);
    // No sets changed — no teamBuild
    expect(result.teamBuild).toBeUndefined();
  });

  it("accidental 2pc+2pc detected after ignoreArtifactSets retry", async () => {
    // Config requests CW 4pc, inventory has GL+WT only → CW fails.
    // With ignoreArtifactSets, retry succeeds. Optimizer picks 2 GL + 2 WT + 1 OFF
    // → detectEquippedSets finds 2pc+2pc → teamBuild rebuilt.
    const tb = makeTeamBuild([
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSet: { type: "4pc", setId: CW },
      },
    ]);
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    const inventory = [
      makeArt("flower", GL),
      makeArt("plume", GL),
      makeArt("sands", WT, "hp%"),
      makeArt("goblet", WT, "pyro%"),
      makeArt("circlet", OFF, "cr"),
    ];

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: { hu_tao: new StatSheet([]) },
      perChar: {
        hu_tao: {
          minEr: 1.0,
          minCr: 0,
          buildMatch: makeBuildMatch(),
          artifactSet: { type: "4pc", setId: CW },
        },
      },
      ignoreArtifactSets: { hu_tao: true },
    };

    const result = await getFinalResult(runTeamOptimization(opts));
    expect(result.bestDamage).toBeGreaterThan(0);
    expect(result.failReasons.hu_tao).toBeUndefined();
    // TeamBuild should be rebuilt (sets changed from CW 4pc → GL+WT 2pc+2pc or similar)
    expect(result.teamBuild).toBeDefined();
  });
});

describe("TeamBuild — configs and combatOpts stored", () => {
  it("stores configs on TeamBuild for reconstruction", () => {
    const configs: TeamSlotConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSet: { type: "4pc", setId: CW },
      },
    ];
    const tb = new TeamBuild(configs, { someOpt: "val" });
    expect(tb.configs).toEqual(configs);
    expect(tb.combatOpts).toEqual({ someOpt: "val" });
  });

  it("configs are the original array, not mutated", () => {
    const configs: TeamSlotConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSet: { type: "4pc", setId: CW },
      },
    ];
    const tb = new TeamBuild(configs);
    expect(tb.configs).toBe(configs);
    expect(tb.configs[0].artifactSet).toEqual({ type: "4pc", setId: CW });
  });
});
