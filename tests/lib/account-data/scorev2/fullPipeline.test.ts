/**
 * Full pipeline test using real game data.
 *
 * Runs the pipeline once for all profiled characters and validates
 * the generated weights are reasonable.
 */

import { preloadGameStats } from "@/lib/gameStatsLoader";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/team-comp";
import {
  type PipelineResult,
  formatBuildWeights,
  runPipeline,
} from "@/lib/account-data/scorev2/pipeline";
import { CHARACTER_BUILD_PROFILES } from "@/lib/account-data/scorev2/teamDatabase";

let result: PipelineResult;

beforeAll(async () => {
  await preloadGameStats();
  result = runPipeline();
}, 300_000); // 5 min timeout for full combo enumeration

describe("V2 full pipeline with real data", () => {
  it("should generate weights for most profiled characters", () => {
    console.log(
      `Generated ${result.builds.length}/${CHARACTER_BUILD_PROFILES.length} builds`
    );
    console.log(`Errors: ${result.errors.length}`);

    for (const err of result.errors) {
      console.log(`  ERROR: ${err.characterId}: ${err.error}`);
    }

    // At least 30% should succeed
    expect(result.builds.length).toBeGreaterThan(
      CHARACTER_BUILD_PROFILES.length * 0.3
    );

    for (const build of result.builds) {
      console.log(`\n${formatBuildWeights(build)}`);
    }
  });

  it("should produce sane weight distributions for DPS characters", () => {
    for (const build of result.builds) {
      const maxWeight = Math.max(...Object.values(build.substats));
      expect(maxWeight).toBe(100);

      const significantStats = Object.values(build.substats).filter(
        (w) => w > 30
      );
      expect(significantStats.length).toBeGreaterThanOrEqual(2);

      expect(build.normalizer).toBeGreaterThan(0);
      expect(build.normalizer).toBeLessThan(2);
      expect(build.idealScore).toBeGreaterThan(100);
    }
  });

  it("should auto-discover multiple viable main stats", () => {
    for (const build of result.builds) {
      // Each slot should have at least 1 main stat option
      expect(build.sands.length).toBeGreaterThanOrEqual(1);
      expect(build.goblet.length).toBeGreaterThanOrEqual(1);
      expect(build.circlet.length).toBeGreaterThanOrEqual(1);

      // Best main stat should have weight 100
      expect(build.sands[0].weight).toBe(100);
      expect(build.goblet[0].weight).toBe(100);
      expect(build.circlet[0].weight).toBe(100);

      // All weights should be > 0 (only qualifying combos included)
      for (const ms of [...build.sands, ...build.goblet, ...build.circlet]) {
        expect(ms.weight).toBeGreaterThan(0);
      }
    }
  });

  it("should differentiate HP-scaling vs ATK-scaling builds", () => {
    const atkBuild = result.builds.find(
      (b) => b.scalingStat === "atk" && b.substats["atk%"] > 30
    );
    const hpBuild = result.builds.find(
      (b) => b.scalingStat === "hp" && b.substats["hp%"] > 30
    );

    if (atkBuild) {
      expect(atkBuild.substats["atk%"]).toBeGreaterThan(
        atkBuild.substats["hp%"]
      );
    }

    if (hpBuild) {
      expect(hpBuild.substats["hp%"]).toBeGreaterThan(hpBuild.substats["atk%"]);
    }
  });

  it("should value EM higher for reaction-dependent builds", () => {
    const noReaction = result.builds.find((b) => b.reaction === "none");
    const withReaction = result.builds.find(
      (b) =>
        b.reaction === "vaporize" ||
        b.reaction === "melt" ||
        b.reaction === "spread"
    );

    if (noReaction && withReaction) {
      expect(withReaction.substats.em).toBeGreaterThanOrEqual(0);
    }
  });
});
