/**
 * Tests for artifact conflict resolution in runTeamOptimization.
 *
 * Scenarios covered:
 * 1. No duplicate artifacts: after optimization, no artifact ID appears on 2+ characters
 * 2. Non-competitor artifacts are excluded during permutation phase
 * 3. Set-infeasible early exit: impossible 4pc set + ER target exits immediately
 *    instead of retrying with widening altCount
 * 4. Set-infeasible early exit for 2+2 sets
 */
import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import { allSlots } from "@/data/types";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { TeamBuild } from "@/lib/team-comp/damageCalc";
import {
  type OptimizationResult,
  runOptimization,
} from "@/lib/team-comp/optimizer";
import type {
  TeamOptYield,
  TeamOptimizationResult,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";
import type { CalcContext, CharCompConfig } from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";
import { runTeamOptimization } from "../../../tests/benchmark/gen/v1";

import "@/lib/team-comp/index";
import {
  drain,
  emptySheets,
  makeArt,
  makeBuildMatch,
} from "../../fixtures/optimizerHelpers";

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

async function getFinalResult(
  gen: AsyncGenerator<TeamOptYield>
): Promise<TeamOptimizationResult> {
  const results = await drain(gen);
  const final = results[results.length - 1];
  if (!final.done) throw new Error("Expected done result");
  return final;
}

async function drainOptimizer(
  gen: AsyncGenerator<OptimizationResult>
): Promise<OptimizationResult> {
  let last: OptimizationResult | null = null;
  for await (const item of gen) {
    last = item;
  }
  if (!last) throw new Error("No results from optimizer");
  return last;
}

const CW = "crimson_witch_of_flames";
const GL = "gladiators_finale";
const ESF = "emblem_of_severed_fate";
const WT = "wanderers_troupe";
const OFF = "thundering_fury";
const NO = "noblesse_oblige";
const TM = "tenacity_of_the_millelith";

// ── Tests: no duplicate artifacts ─────────────────────────────────────────────

describe("runTeamOptimization — no duplicate artifacts", () => {
  it("3-character team: no artifact assigned to multiple characters", async () => {
    // Hu Tao (carry, no set) + Xingqiu (support, no set) + Zhongli (support, no set)
    // Use no-set to simplify, with a constrained inventory so conflicts are likely.
    const configs: CharCompConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSetId: null,
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
    ];
    const tb = new TeamBuild(configs);
    const formulaId = Object.keys(tb.getFormulaIds().hu_tao)[0];

    // Small inventory: 3 artifacts per slot → characters MUST share the pool,
    // creating competition for the best pieces.
    const inventory: ArtifactData[] = [];
    const slotsAndMains: [
      ArtifactData["slotKey"],
      ArtifactData["mainStatKey"],
    ][] = [
      ["flower", "hp"],
      ["plume", "atk"],
      ["sands", "hp%"],
      ["goblet", "pyro%"],
      ["circlet", "cr"],
    ];
    for (const [slot, main] of slotsAndMains) {
      // 3 artifacts per slot with varying quality
      inventory.push(
        makeArt(slot, GL, main, { cr: 10.0, cd: 20.0, atk: 30, em: 30 }),
        makeArt(slot, CW, main, { cr: 7.0, cd: 14.0, atk: 20, em: 20 }),
        makeArt(slot, OFF, main, { cr: 3.5, cd: 7.0, atk: 10, em: 10 })
      );
    }

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      formulaId,
      inventory,
      calcContext: CTX,
      globalConfig: GLOBAL_CONFIG,
      baseSheets: emptySheets("hu_tao", "xingqiu", "zhongli"),
      perChar: {
        hu_tao: {
          targetEr: 1.0,
          targetCr: 0,
          buildMatch: makeBuildMatch(GL),
          artifactSetId: null,
          artifactHalfSetIds: [],
        },
        xingqiu: {
          targetEr: 1.0,
          targetCr: 0,
          artifactSetId: null,
          artifactHalfSetIds: [],
        },
        zhongli: {
          targetEr: 1.0,
          targetCr: 0,
          artifactSetId: null,
          artifactHalfSetIds: [],
        },
      },
    };

    const result = await getFinalResult(runTeamOptimization(opts));

    // Collect all artifact IDs across all characters
    const allArtIds: string[] = [];
    for (const [_charId, arts] of Object.entries(result.bestArtifactsByChar)) {
      for (const slot of allSlots) {
        const a = arts[slot];
        if (a) allArtIds.push(a.id);
      }
    }

    // No artifact ID should appear more than once
    const idCounts = new Map<string, number>();
    for (const id of allArtIds) {
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
    const duplicates = [...idCounts.entries()].filter(([, count]) => count > 1);
    expect(duplicates).toEqual([]);
  });

  it(
    "4-character team with tight inventory: no duplicates",
    { timeout: 30000 },
    async () => {
      const configs: CharCompConfig[] = [
        {
          charId: "hu_tao",
          charLevel: 90,
          constellation: 1,
          weaponId: "staff_of_homa",
          refinement: 1,
          artifactSetId: null,
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
          refinement: 5,
          artifactSetId: null,
          artifactHalfSetIds: [],
        },
      ];
      const tb = new TeamBuild(configs);
      const formulaId = Object.keys(tb.getFormulaIds().hu_tao)[0];

      // 4 artifacts per slot → exactly enough for 4 characters, all will compete
      const inventory: ArtifactData[] = [];
      const sets = [GL, CW, OFF, NO];
      for (const slot of allSlots) {
        const main =
          slot === "flower"
            ? "hp"
            : slot === "plume"
              ? "atk"
              : slot === "sands"
                ? "hp%"
                : slot === "goblet"
                  ? "pyro%"
                  : "cr";
        for (let i = 0; i < sets.length; i++) {
          inventory.push(
            makeArt(slot, sets[i], main as ArtifactData["mainStatKey"], {
              cr: 10 - i * 2,
              cd: 20 - i * 4,
              atk: 30 - i * 5,
              em: 30 - i * 5,
            })
          );
        }
      }

      const opts: TeamOptimizerOptions = {
        teamBuild: tb,
        carryCharId: "hu_tao",
        formulaId,
        inventory,
        calcContext: CTX,
        globalConfig: GLOBAL_CONFIG,
        baseSheets: emptySheets(
          "hu_tao",
          "xingqiu",
          "zhongli",
          "kaedehara_kazuha"
        ),
        perChar: {
          hu_tao: {
            targetEr: 1.0,
            targetCr: 0,
            artifactSetId: null,
            artifactHalfSetIds: [],
          },
          xingqiu: {
            targetEr: 1.0,
            targetCr: 0,
            artifactSetId: null,
            artifactHalfSetIds: [],
          },
          zhongli: {
            targetEr: 1.0,
            targetCr: 0,
            artifactSetId: null,
            artifactHalfSetIds: [],
          },
          kaedehara_kazuha: {
            targetEr: 1.0,
            targetCr: 0,
            artifactSetId: null,
            artifactHalfSetIds: [],
          },
        },
      };

      const result = await getFinalResult(runTeamOptimization(opts));

      const allArtIds: string[] = [];
      for (const arts of Object.values(result.bestArtifactsByChar)) {
        for (const slot of allSlots) {
          const a = arts[slot];
          if (a) allArtIds.push(a.id);
        }
      }

      const idCounts = new Map<string, number>();
      for (const id of allArtIds) {
        idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
      }
      const duplicates = [...idCounts.entries()].filter(
        ([, count]) => count > 1
      );
      expect(duplicates).toEqual([]);
    }
  );
});

// ── Tests: set-infeasible early exit ──────────────────────────────────────────

describe("runOptimization — set-infeasible early exit", () => {
  it("4pc set impossible (only 3 slots covered): exits with set-impossible, not er-unmet", async () => {
    // Inventory has CW pieces in only 3 slots (flower, plume, sands).
    // Goblet and circlet have no CW pieces.
    // With ER target set, the old code would retry with widening altCount.
    // The fix should exit immediately with set-impossible.
    const configs: CharCompConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSetId: CW,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(configs);
    const formulaId = Object.keys(tb.getFormulaIds().hu_tao)[0];

    const inventory: ArtifactData[] = [
      // CW in only 3 slots
      makeArt("flower", CW),
      makeArt("plume", CW),
      makeArt("sands", CW, "hp%"),
      // Goblet and circlet are off-set only
      makeArt("goblet", GL, "pyro%"),
      makeArt("circlet", GL, "cr"),
    ];

    const startTime = Date.now();
    const result = await drainOptimizer(
      runOptimization({
        teamBuild: tb,
        targetCharId: "hu_tao",
        formulaId,
        targetEr: 1.5, // ER target that would trigger retries in old code
        targetCr: 0,
        inventory,
        buildMatch: makeBuildMatch(),
        globalConfig: GLOBAL_CONFIG,
        baseSheets: emptySheets("hu_tao"),
        calcContext: CTX,
        artifactSetId: CW,
        artifactHalfSetIds: [],
      })
    );
    const elapsed = Date.now() - startTime;

    expect(result.done).toBe(true);
    expect(result.failReason).toBeDefined();
    expect(result.failReason!.kind).toBe("set-impossible");
    // Should exit quickly (< 2 seconds), not burn time retrying
    expect(elapsed).toBeLessThan(2000);
  });

  it("4pc set feasible (4 slots covered): does NOT early-exit", async () => {
    const configs: CharCompConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSetId: CW,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(configs);
    const formulaId = Object.keys(tb.getFormulaIds().hu_tao)[0];

    const inventory: ArtifactData[] = [
      makeArt("flower", CW),
      makeArt("plume", CW),
      makeArt("sands", CW, "hp%"),
      makeArt("goblet", CW, "pyro%"),
      makeArt("circlet", GL, "cr"), // 1 off-set is fine for 4pc (flex slot)
    ];

    const result = await drainOptimizer(
      runOptimization({
        teamBuild: tb,
        targetCharId: "hu_tao",
        formulaId,
        targetEr: 1.0,
        targetCr: 0,
        inventory,
        buildMatch: makeBuildMatch(),
        globalConfig: GLOBAL_CONFIG,
        baseSheets: emptySheets("hu_tao"),
        calcContext: CTX,
        artifactSetId: CW,
        artifactHalfSetIds: [],
      })
    );

    expect(result.done).toBe(true);
    // Should find a valid build (4 CW pieces available)
    expect(result.bestDamage).toBeGreaterThan(0);
    expect(result.failReason).toBeUndefined();
  });

  it("2+2 set impossible (half-set has pieces in only 1 slot): exits with set-impossible", async () => {
    const configs: CharCompConfig[] = [
      {
        charId: "hu_tao",
        charLevel: 90,
        constellation: 1,
        weaponId: "staff_of_homa",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: ["atk%-18", "er-20"],
      },
    ];
    const tb = new TeamBuild(configs);
    const formulaId = Object.keys(tb.getFormulaIds().hu_tao)[0];

    // ESF (er-20) only in 1 slot → can't form 2pc
    const inventory: ArtifactData[] = [
      makeArt("flower", GL),
      makeArt("plume", GL),
      makeArt("sands", ESF, "hp%"), // only 1 ESF slot
      makeArt("goblet", OFF, "pyro%"),
      makeArt("circlet", OFF, "cr"),
    ];

    const result = await drainOptimizer(
      runOptimization({
        teamBuild: tb,
        targetCharId: "hu_tao",
        formulaId,
        targetEr: 1.5, // ER target that would trigger retries in old code
        targetCr: 0,
        inventory,
        buildMatch: makeBuildMatch(),
        globalConfig: GLOBAL_CONFIG,
        baseSheets: emptySheets("hu_tao"),
        calcContext: CTX,
        artifactSetId: null,
        artifactHalfSetIds: ["atk%-18", "er-20"],
      })
    );

    expect(result.done).toBe(true);
    expect(result.failReason).toBeDefined();
    expect(result.failReason!.kind).toBe("set-impossible");
  });
});
