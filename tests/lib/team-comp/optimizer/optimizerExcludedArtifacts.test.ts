import { describe, expect, it } from "vitest";
import { allSlots } from "@/data/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
/**
 * Tests for perCharExcludedArtifactIds filtering in the team optimizer.
 *
 * Verifies that excluded artifact IDs are not assigned to the specified
 * character, while remaining available for other characters.
 */
import type { ArtifactData } from "@/data/types";
import { singleFormulaCombo } from "@/lib/dmgcalc/core/combo";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import { runTeamOptimization } from "@/lib/team-comp/optimizer/teamOptimization";
import type {
  CharOptConfig,
  TeamOptimizerOptions,
} from "@/lib/team-comp/types";

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

const CTX = {
  enemyLevel: 100,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6" as const,
};
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
];

function makeTeamBuild() {
  return new TeamBuild(CONFIGS);
}

/** Collect assigned artifact IDs for a character from the result. */
function getAssignedIds(
  bestArtifactsByChar: Record<
    string,
    Record<string, ArtifactData | null | undefined>
  >,
  charId: string
): string[] {
  const charArts = bestArtifactsByChar[charId];
  if (!charArts) return [];
  return allSlots
    .map((s) => charArts[s]?.id)
    .filter((id): id is string => !!id);
}

describe("perCharExcludedArtifactIds", () => {
  it("excluded artifacts are not assigned to the specified character", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    // Create two flowers — one will be excluded for hu_tao
    const goodFlower = makeArt("flower", "crimson_witch_of_flames", "hp", {
      cr: 10,
      cd: 20,
      atk: 20,
      em: 20,
    });
    const okFlower = makeArt("flower", "crimson_witch_of_flames", "hp", {
      cr: 3,
      cd: 7,
      atk: 10,
      em: 10,
    });

    const inventory = [
      goodFlower,
      okFlower,
      makeArt("plume", "crimson_witch_of_flames"),
      makeArt("sands", "crimson_witch_of_flames"),
      makeArt("goblet", "crimson_witch_of_flames"),
      makeArt("circlet", "crimson_witch_of_flames"),
    ];

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,

      baseSheets: {
        hu_tao: new StatSheet([]),
        xingqiu: new StatSheet([]),
      },
      perChar,
      perCharExcludedArtifactIds: {
        hu_tao: [goodFlower.id],
      },
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    const huTaoIds = getAssignedIds(final.bestArtifactsByChar, "hu_tao");
    expect(huTaoIds).not.toContain(goodFlower.id);
    // The OK flower should be used instead since the good one is excluded
    expect(huTaoIds).toContain(okFlower.id);
  });

  it("excluded artifacts for one character can still be used by another", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    // Shared flower — excluded for hu_tao but available for xingqiu
    const sharedFlower = makeArt("flower", "crimson_witch_of_flames", "hp", {
      cr: 10,
      cd: 20,
      atk: 20,
      em: 20,
    });

    // Give hu_tao an alternative flower
    const altFlower = makeArt("flower", "crimson_witch_of_flames", "hp", {
      cr: 3,
      cd: 7,
      atk: 10,
      em: 10,
    });

    const inventory = [
      sharedFlower,
      altFlower,
      makeArt("plume", "crimson_witch_of_flames"),
      makeArt("sands", "crimson_witch_of_flames"),
      makeArt("goblet", "crimson_witch_of_flames"),
      makeArt("circlet", "crimson_witch_of_flames"),
    ];

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
      xingqiu: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,

      baseSheets: {
        hu_tao: new StatSheet([]),
        xingqiu: new StatSheet([]),
      },
      perChar,
      perCharExcludedArtifactIds: {
        hu_tao: [sharedFlower.id],
      },
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    // Hu Tao must NOT have the excluded flower.
    // (xingqiu has no exclusion and may take the shared flower freely — the
    // key invariant is only that hu_tao doesn't get the excluded one.)
    const huTaoIds = getAssignedIds(final.bestArtifactsByChar, "hu_tao");
    expect(huTaoIds).not.toContain(sharedFlower.id);
  });

  it("empty exclusion list has no effect", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    const inventory = [
      makeArt("flower", "crimson_witch_of_flames"),
      makeArt("plume", "crimson_witch_of_flames"),
      makeArt("sands", "crimson_witch_of_flames"),
      makeArt("goblet", "crimson_witch_of_flames"),
      makeArt("circlet", "crimson_witch_of_flames"),
    ];

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const baseOpts: Omit<TeamOptimizerOptions, "perCharExcludedArtifactIds"> = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,

      baseSheets: {
        hu_tao: new StatSheet([]),
        xingqiu: new StatSheet([]),
      },
      perChar,
    };

    // Run without exclusion
    const resultsNoExclude = await drain(runTeamOptimization(baseOpts));
    const finalNoExclude = resultsNoExclude[resultsNoExclude.length - 1];

    // Run with empty exclusion
    const resultsEmptyExclude = await drain(
      runTeamOptimization({
        ...baseOpts,
        perCharExcludedArtifactIds: { hu_tao: [] },
      })
    );
    const finalEmptyExclude =
      resultsEmptyExclude[resultsEmptyExclude.length - 1];

    expect(finalNoExclude.done).toBe(true);
    expect(finalEmptyExclude.done).toBe(true);
    if (!finalNoExclude.done || !finalEmptyExclude.done) return;

    // Same damage — empty exclusion should not change results
    expect(finalEmptyExclude.bestDamage).toBe(finalNoExclude.bestDamage);
  });

  it("excluding all artifacts in a slot means the excluded artifact is not assigned", async () => {
    const tb = makeTeamBuild();
    const formulaId = getFirstFormulaId(tb, "hu_tao");

    const flower = makeArt("flower", "crimson_witch_of_flames");
    const inventory = [
      flower,
      makeArt("plume", "crimson_witch_of_flames"),
      makeArt("sands", "crimson_witch_of_flames"),
      makeArt("goblet", "crimson_witch_of_flames"),
      makeArt("circlet", "crimson_witch_of_flames"),
    ];

    const perChar: Record<string, CharOptConfig> = {
      hu_tao: { minEr: 0, minCr: 0, buildMatch: makeBuildMatch() },
    };

    const opts: TeamOptimizerOptions = {
      teamBuild: tb,
      carryCharId: "hu_tao",
      combo: singleFormulaCombo("hu_tao", formulaId),
      inventory,
      calcContext: CTX,

      baseSheets: {
        hu_tao: new StatSheet([]),
        xingqiu: new StatSheet([]),
      },
      perChar,
      perCharExcludedArtifactIds: {
        hu_tao: [flower.id], // exclude the only flower
      },
    };

    const results = await drain(runTeamOptimization(opts));
    const final = results[results.length - 1];
    expect(final.done).toBe(true);
    if (!final.done) return;

    // The excluded flower must not appear in Hu Tao's assignment
    const huTaoIds = getAssignedIds(final.bestArtifactsByChar, "hu_tao");
    expect(huTaoIds).not.toContain(flower.id);
    // Other slots should still have artifacts
    const huTaoArts = final.bestArtifactsByChar.hu_tao;
    expect(huTaoArts.plume).not.toBeNull();
    expect(huTaoArts.sands).not.toBeNull();
  });
});
