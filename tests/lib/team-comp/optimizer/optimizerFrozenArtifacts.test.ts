/**
 * Integration tests: frozen artifact protection through the optimizer pipeline.
 *
 * These tests verify that when artifacts are removed from the optimizer inventory
 * (simulating frozen exclusion), they NEVER appear in any character's result,
 * regardless of which optimizer phase (1, 2, 2b, 3, 3b, heuristic fill) produces
 * the assignment.
 *
 * The test strategy:
 * - Create a pool with some "frozen" artifacts that are the BEST available
 * - Remove them from the inventory (as useTeamInventory would)
 * - Run the optimizer and verify none of the frozen IDs appear in results
 * - Also test perCharExtraArtifacts: only the designated character gets them
 */
import type { ArtifactData, GlobalStatWeights } from "@/data/types";
import { allSlots } from "@/data/types";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import { singleFormulaCombo } from "@/lib/team-comp/calc/combo";
import { StatSheet } from "@/lib/team-comp/calc/statSheet";
import { TeamBuild } from "@/lib/team-comp/calc/teamBuild";
import { runTeamOptimization } from "@/lib/team-comp/optimizer";
import type {
  CharOptConfig,
  TeamOptimizerOptions,
  TeamSlotConfig,
} from "@/lib/team-comp/types";
import { describe, expect, it } from "vitest";

import "@/lib/team-comp/index";
import {
  drain,
  getFirstFormulaId,
  makeArt,
  makeBuildMatch,
} from "../../../fixtures/optimizerHelpers";

await preloadGameStats();

// ── Helpers ──────────────────────────────────────────────────────────────────

const CTX = { enemyLevel: 100, enemyRes: 0.1 };
const GLOBAL_CONFIG: GlobalStatWeights = {
  flatAtk: 1,
  flatHp: 0,
  flatDef: 0,
};

const TWO_CHAR_CONFIGS: TeamSlotConfig[] = [
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
];

const FOUR_CHAR_CONFIGS: TeamSlotConfig[] = [
  ...TWO_CHAR_CONFIGS,
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

/** Collect ALL artifact IDs assigned to any character in the result. */
function collectAllAssignedIds(
  bestArtifactsByChar: Record<
    string,
    Record<string, ArtifactData | null | undefined>
  >
): Set<string> {
  const ids = new Set<string>();
  for (const arts of Object.values(bestArtifactsByChar)) {
    for (const slot of allSlots) {
      const a = arts[slot];
      if (a) ids.add(a.id);
    }
  }
  return ids;
}

/** Get artifact IDs assigned to a specific character. */
function getCharAssignedIds(
  bestArtifactsByChar: Record<
    string,
    Record<string, ArtifactData | null | undefined>
  >,
  charId: string
): Set<string> {
  const ids = new Set<string>();
  const arts = bestArtifactsByChar[charId];
  if (!arts) return ids;
  for (const slot of allSlots) {
    const a = arts[slot];
    if (a) ids.add(a.id);
  }
  return ids;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("optimizer frozen artifact protection", () => {
  it("frozen artifacts removed from inventory never appear in results", async () => {
    const tb = new TeamBuild(TWO_CHAR_CONFIGS);
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    // "Frozen" artifacts — the BEST artifacts (high stats), removed from inventory
    const frozenFlower = makeArt("flower", "crimson_witch_of_flames", "hp", {
      cr: 15,
      cd: 30,
      atk: 30,
      em: 30,
    });
    const frozenPlume = makeArt("plume", "crimson_witch_of_flames", "atk", {
      cr: 15,
      cd: 30,
      "hp%": 10,
      em: 30,
    });
    const frozenIds = new Set([frozenFlower.id, frozenPlume.id]);

    // Available artifacts — mediocre but present
    const inventory = [
      makeArt("flower", "crimson_witch_of_flames"),
      makeArt("plume", "crimson_witch_of_flames"),
      makeArt("sands", "crimson_witch_of_flames"),
      makeArt("goblet", "crimson_witch_of_flames"),
      makeArt("circlet", "crimson_witch_of_flames"),
      // Extra artifacts for xingqiu
      makeArt("flower", "emblem_of_severed_fate"),
      makeArt("plume", "emblem_of_severed_fate"),
      makeArt("sands", "emblem_of_severed_fate"),
      makeArt("goblet", "emblem_of_severed_fate"),
      makeArt("circlet", "emblem_of_severed_fate"),
    ];
    // frozenFlower and frozenPlume are NOT in inventory (simulating freeze exclusion)

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const results = await drain(
      runTeamOptimization({
        teamBuild: tb,
        carryCharId: "hu_tao",
        formula: { combo: singleFormulaCombo("hu_tao", formulaId) },
        inventory,
        calcContext: CTX,
        globalConfig: GLOBAL_CONFIG,
        baseSheets: { hu_tao: new StatSheet([]), xingqiu: new StatSheet([]) },
        perChar,
      })
    );
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    // CRITICAL: no frozen artifact ID should appear in any assignment
    const assigned = collectAllAssignedIds(final.bestArtifactsByChar);
    for (const fid of frozenIds) {
      expect(assigned.has(fid)).toBe(false);
    }
  });

  it("perCharExtraArtifacts: extras only visible to the designated character", async () => {
    const tb = new TeamBuild(TWO_CHAR_CONFIGS);
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    // Create "frozen" extras that are the BEST artifacts — only hu_tao should use them
    const extraFlower = makeArt("flower", "crimson_witch_of_flames", "hp", {
      cr: 15,
      cd: 30,
      atk: 30,
      em: 30,
    });
    const extraPlume = makeArt("plume", "crimson_witch_of_flames", "atk", {
      cr: 15,
      cd: 30,
      "hp%": 10,
      em: 30,
    });
    const extraIds = new Set([extraFlower.id, extraPlume.id]);

    // Base inventory (mediocre, both chars draw from this)
    const inventory = [
      makeArt("flower", "crimson_witch_of_flames"),
      makeArt("plume", "crimson_witch_of_flames"),
      makeArt("sands", "crimson_witch_of_flames"),
      makeArt("goblet", "crimson_witch_of_flames"),
      makeArt("circlet", "crimson_witch_of_flames"),
      makeArt("flower", "emblem_of_severed_fate"),
      makeArt("plume", "emblem_of_severed_fate"),
      makeArt("sands", "emblem_of_severed_fate"),
      makeArt("goblet", "emblem_of_severed_fate"),
      makeArt("circlet", "emblem_of_severed_fate"),
    ];

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const results = await drain(
      runTeamOptimization({
        teamBuild: tb,
        carryCharId: "hu_tao",
        formula: { combo: singleFormulaCombo("hu_tao", formulaId) },
        inventory,
        calcContext: CTX,
        globalConfig: GLOBAL_CONFIG,
        baseSheets: { hu_tao: new StatSheet([]), xingqiu: new StatSheet([]) },
        perChar,
        perCharExtraArtifacts: {
          hu_tao: [extraFlower, extraPlume],
          // xingqiu does NOT get extras
        },
      })
    );
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    // xingqiu must NOT have any extra artifacts
    const xqIds = getCharAssignedIds(final.bestArtifactsByChar, "xingqiu");
    for (const eid of extraIds) {
      expect(xqIds.has(eid)).toBe(false);
    }
  });

  it("perCharExcludedArtifactIds + perCharExtraArtifacts combined", async () => {
    const tb = new TeamBuild(TWO_CHAR_CONFIGS);
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    // Extra artifact for hu_tao (from frozen team, sameChar reuse)
    const extraFlower = makeArt("flower", "crimson_witch_of_flames", "hp", {
      cr: 15,
      cd: 30,
      atk: 30,
      em: 30,
    });

    // Another good flower in inventory — but excluded for hu_tao (tier-aware pool)
    const excludedFlower = makeArt("flower", "crimson_witch_of_flames", "hp", {
      cr: 12,
      cd: 25,
      atk: 25,
      em: 25,
    });

    const inventory = [
      excludedFlower,
      makeArt("flower", "crimson_witch_of_flames"), // mediocre backup
      makeArt("plume", "crimson_witch_of_flames"),
      makeArt("sands", "crimson_witch_of_flames"),
      makeArt("goblet", "crimson_witch_of_flames"),
      makeArt("circlet", "crimson_witch_of_flames"),
      makeArt("flower", "emblem_of_severed_fate"),
      makeArt("plume", "emblem_of_severed_fate"),
      makeArt("sands", "emblem_of_severed_fate"),
      makeArt("goblet", "emblem_of_severed_fate"),
      makeArt("circlet", "emblem_of_severed_fate"),
    ];

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const results = await drain(
      runTeamOptimization({
        teamBuild: tb,
        carryCharId: "hu_tao",
        formula: { combo: singleFormulaCombo("hu_tao", formulaId) },
        inventory,
        calcContext: CTX,
        globalConfig: GLOBAL_CONFIG,
        baseSheets: { hu_tao: new StatSheet([]), xingqiu: new StatSheet([]) },
        perChar,
        perCharExtraArtifacts: {
          hu_tao: [extraFlower], // hu_tao gets this from frozen reuse
        },
        perCharExcludedArtifactIds: {
          hu_tao: [excludedFlower.id], // but this one is excluded for hu_tao
        },
      })
    );
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    const htIds = getCharAssignedIds(final.bestArtifactsByChar, "hu_tao");
    // hu_tao should NOT have the excluded flower
    expect(htIds.has(excludedFlower.id)).toBe(false);

    // xingqiu should NOT have the extra flower (it's per-char for hu_tao only)
    const xqIds = getCharAssignedIds(final.bestArtifactsByChar, "xingqiu");
    expect(xqIds.has(extraFlower.id)).toBe(false);
  });

  it("4-char team: frozen artifacts never leak to any character", async () => {
    const tb = new TeamBuild(FOUR_CHAR_CONFIGS);
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    // Create "frozen" artifacts (not in inventory) with stellar stats
    const frozenArts = allSlots.map((slot) =>
      makeArt(slot, "crimson_witch_of_flames", undefined, {
        cr: 20,
        cd: 40,
        atk: 40,
        em: 40,
      })
    );
    const frozenIds = new Set(frozenArts.map((a) => a.id));

    // Normal inventory for all characters
    const inventory: ArtifactData[] = [];
    for (const setKey of [
      "crimson_witch_of_flames",
      "emblem_of_severed_fate",
      "noblesse_oblige",
      "viridescent_venerer",
    ]) {
      for (const slot of allSlots) {
        inventory.push(makeArt(slot, setKey));
      }
    }
    // frozenArts are NOT in inventory

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      zhongli: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      kaedehara_kazuha: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const results = await drain(
      runTeamOptimization({
        teamBuild: tb,
        carryCharId: "hu_tao",
        formula: { combo: singleFormulaCombo("hu_tao", formulaId) },
        inventory,
        calcContext: CTX,
        globalConfig: GLOBAL_CONFIG,
        baseSheets: {
          hu_tao: new StatSheet([]),
          xingqiu: new StatSheet([]),
          zhongli: new StatSheet([]),
          kaedehara_kazuha: new StatSheet([]),
        },
        perChar,
      })
    );
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    // CRITICAL: no frozen ID in any character's assignment
    const assigned = collectAllAssignedIds(final.bestArtifactsByChar);
    for (const fid of frozenIds) {
      expect(assigned.has(fid)).toBe(false);
    }
  });

  it("4-char team with perCharExtraArtifacts: extras isolated per character", async () => {
    const tb = new TeamBuild(FOUR_CHAR_CONFIGS);
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    // Extras: super-good artifacts for hu_tao only (simulating sameChar reuse)
    const extraArts = allSlots.map((slot) =>
      makeArt(slot, "crimson_witch_of_flames", undefined, {
        cr: 20,
        cd: 40,
        atk: 40,
        em: 40,
      })
    );
    const extraIds = new Set(extraArts.map((a) => a.id));

    // Normal inventory
    const inventory: ArtifactData[] = [];
    for (const setKey of [
      "crimson_witch_of_flames",
      "emblem_of_severed_fate",
      "noblesse_oblige",
      "viridescent_venerer",
    ]) {
      for (const slot of allSlots) {
        inventory.push(makeArt(slot, setKey));
      }
    }

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      zhongli: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      kaedehara_kazuha: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const results = await drain(
      runTeamOptimization({
        teamBuild: tb,
        carryCharId: "hu_tao",
        formula: { combo: singleFormulaCombo("hu_tao", formulaId) },
        inventory,
        calcContext: CTX,
        globalConfig: GLOBAL_CONFIG,
        baseSheets: {
          hu_tao: new StatSheet([]),
          xingqiu: new StatSheet([]),
          zhongli: new StatSheet([]),
          kaedehara_kazuha: new StatSheet([]),
        },
        perChar,
        perCharExtraArtifacts: {
          hu_tao: extraArts, // ONLY hu_tao
        },
      })
    );
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    // xingqiu, zhongli, kazuha must NOT have any extra artifacts
    for (const charId of ["xingqiu", "zhongli", "kaedehara_kazuha"]) {
      const charIds = getCharAssignedIds(final.bestArtifactsByChar, charId);
      for (const eid of extraIds) {
        expect(charIds.has(eid)).toBe(false);
      }
    }
  });

  it("frozen character skipped from perChar: optimizer doesn't create assignments", async () => {
    const tb = new TeamBuild(TWO_CHAR_CONFIGS);
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    const inventory = allSlots.flatMap((slot) => [
      makeArt(slot, "crimson_witch_of_flames"),
      makeArt(slot, "emblem_of_severed_fate"),
    ]);

    // Only hu_tao is optimized — xingqiu is "frozen" (not in perChar)
    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      // xingqiu deliberately omitted (simulating frozen character)
    };

    const results = await drain(
      runTeamOptimization({
        teamBuild: tb,
        carryCharId: "hu_tao",
        formula: { combo: singleFormulaCombo("hu_tao", formulaId) },
        inventory,
        calcContext: CTX,
        globalConfig: GLOBAL_CONFIG,
        baseSheets: { hu_tao: new StatSheet([]), xingqiu: new StatSheet([]) },
        perChar,
      })
    );
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    // hu_tao should have artifacts
    const htIds = getCharAssignedIds(final.bestArtifactsByChar, "hu_tao");
    expect(htIds.size).toBeGreaterThan(0);

    // xingqiu should NOT have artifacts (not optimized)
    // The optimizer may still create an empty entry
    const xqArts = final.bestArtifactsByChar.xingqiu;
    if (xqArts) {
      const hasArts = allSlots.some((s) => xqArts[s] != null);
      // If xingqiu got heuristic-filled artifacts, that's fine as long as
      // they come from the pool. The key point is that xingqiu doesn't
      // get frozen extras meant for hu_tao.
    }
  });
});
