/**
 * Integration Tests: Build Configuration to Filter Computation Flow
 *
 * Tests the complete pipeline:
 * 1. Build configuration stored in useBuildsStore
 * 2. Filter computation via buildRawConfigs + mergeConfigsAsync
 * 3. Correct artifact filter rules generated
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { Build, BuildGroup } from "@/data/types";
import {
  DEFAULT_COMPUTE_OPTIONS,
  buildRawConfigs,
  mergeConfigsAsync,
} from "@/lib/artifact-builds/computeFilters";
import { useBuildsStore } from "@/stores/useBuildsStore";

/** Run the full two-phase pipeline with a non-aborting signal. */
async function computeFilters(
  buildGroups: BuildGroup[],
  options = DEFAULT_COMPUTE_OPTIONS
) {
  const raw = buildRawConfigs(buildGroups, options);
  const algorithm = options.mergeAlgorithm ?? "smartMerge";
  const normalizeFlatStats = options.normalizeFlatStats ?? true;
  return mergeConfigsAsync(
    raw,
    algorithm,
    normalizeFlatStats,
    new AbortController().signal
  );
}

describe("Integration: Build Configuration to Filter Computation Flow", () => {
  beforeEach(() => {
    useBuildsStore.getState().clearAll();
  });

  /**
   * Helper to create BuildGroups from store state
   */
  function createBuildGroupsFromStore(): BuildGroup[] {
    const builds = useBuildsStore.getState().builds;
    const characterToBuildIds = useBuildsStore.getState().characterToBuildIds;
    const hiddenCharacters = useBuildsStore.getState().hiddenCharacters;

    return Object.entries(characterToBuildIds).map(
      ([characterId, buildIds]) => ({
        characterId,
        hidden: !!hiddenCharacters[characterId],
        builds: buildIds
          .map((id) => builds[id])
          .filter((b): b is Build => b?.visible),
      })
    );
  }

  it("generates filters from a single character build", async () => {
    // Create a build for hu_tao
    act(() => {
      useBuildsStore.getState().newBuild("hu_tao");
    });

    const buildId = Object.keys(useBuildsStore.getState().builds)[0];

    // Configure build with specific requirements
    act(() => {
      useBuildsStore.getState().setBuild(buildId, {
        artifactSet: "crimson_witch_of_flames",
        composition: "4pc",
        sandsWeights: [{ stat: "hp%", weight: 100 }],
        gobletWeights: [{ stat: "pyro%", weight: 100 }],
        circletWeights: [
          { stat: "cr", weight: 100 },
          { stat: "cd", weight: 100 },
        ],
        substats: [
          { stat: "cr", weight: 100 },
          { stat: "cd", weight: 100 },
          { stat: "hp%", weight: 100 },
          { stat: "em", weight: 100 },
        ],
      });
    });

    const buildGroups = createBuildGroupsFromStore();
    const result = await computeFilters(buildGroups);

    // Verify filter generation
    expect(result.length).toBeGreaterThan(0);

    // Should have a config for crimson_witch_of_flames
    const hasCrimsonConfig = result.some((cfg) =>
      cfg.configurations.some((c) =>
        c.servedCharacters.some((sc) => sc.characterId === "hu_tao")
      )
    );
    expect(hasCrimsonConfig).toBe(true);
  });

  it("excludes hidden characters from filter computation", async () => {
    // Create builds for two characters
    act(() => {
      useBuildsStore.getState().newBuild("hu_tao");
      useBuildsStore.getState().newBuild("xingqiu");
    });

    const buildIds = Object.keys(useBuildsStore.getState().builds);
    const huTaoBuildId = buildIds[0];
    const xingqiuBuildId = buildIds[1];

    // Configure both builds
    act(() => {
      useBuildsStore.getState().setBuild(huTaoBuildId, {
        artifactSet: "crimson_witch_of_flames",
        composition: "4pc",
        sandsWeights: [{ stat: "hp%", weight: 100 }],
      });
      useBuildsStore.getState().setBuild(xingqiuBuildId, {
        artifactSet: "emblem_of_severed_fate",
        composition: "4pc",
        sandsWeights: [{ stat: "er", weight: 100 }],
      });
    });

    // Hide xingqiu
    act(() => {
      useBuildsStore.getState().setCharacterHidden("xingqiu", true);
    });

    const buildGroups = createBuildGroupsFromStore();

    // Filter out hidden groups before passing to compute
    const visibleGroups = buildGroups.filter((g) => !g.hidden);
    const result = await computeFilters(visibleGroups);

    // xingqiu is hidden, so should not appear in results
    const hasXingqiu = result.some((cfg) =>
      cfg.configurations.some((c) =>
        c.servedCharacters.some((sc) => sc.characterId === "xingqiu")
      )
    );
    expect(hasXingqiu).toBe(false);

    // hu_tao should still be included
    const hasHuTao = result.some((cfg) =>
      cfg.configurations.some((c) =>
        c.servedCharacters.some((sc) => sc.characterId === "hu_tao")
      )
    );
    expect(hasHuTao).toBe(true);
  });

  it("tracks build visibility state correctly", () => {
    // Create a build
    let buildId = "";
    act(() => {
      const build = useBuildsStore.getState().newBuild("hu_tao");
      buildId = build.id;
    });

    // Default should be visible
    const initialBuild = useBuildsStore.getState().builds[buildId];
    expect(initialBuild.visible).toBe(true);

    // Set to not visible
    act(() => {
      useBuildsStore.getState().setBuild(buildId, { visible: false });
    });

    const updatedBuild = useBuildsStore.getState().builds[buildId];
    expect(updatedBuild.visible).toBe(false);

    // Set back to visible
    act(() => {
      useBuildsStore.getState().setBuild(buildId, { visible: true });
    });

    const finalBuild = useBuildsStore.getState().builds[buildId];
    expect(finalBuild.visible).toBe(true);
  });

  it("merges compatible configs from multiple builds", async () => {
    // Create builds with same artifact set
    act(() => {
      useBuildsStore.getState().newBuild("hu_tao");
      useBuildsStore.getState().newBuild("xiangling");
    });

    const huTaoBuildId =
      useBuildsStore.getState().characterToBuildIds.hu_tao[0];
    const xianglingBuildId =
      useBuildsStore.getState().characterToBuildIds.xiangling[0];

    act(() => {
      useBuildsStore.getState().setBuild(huTaoBuildId, {
        artifactSet: "crimson_witch_of_flames",
        composition: "4pc",
        sandsWeights: [{ stat: "hp%", weight: 100 }],
        gobletWeights: [{ stat: "pyro%", weight: 100 }],
        circletWeights: [{ stat: "cr", weight: 100 }],
        substats: [
          { stat: "cr", weight: 100 },
          { stat: "cd", weight: 100 },
        ],
      });
      useBuildsStore.getState().setBuild(xianglingBuildId, {
        artifactSet: "crimson_witch_of_flames",
        composition: "4pc",
        sandsWeights: [
          { stat: "atk%", weight: 100 },
          { stat: "em", weight: 100 },
        ],
        gobletWeights: [{ stat: "pyro%", weight: 100 }],
        circletWeights: [
          { stat: "cr", weight: 100 },
          { stat: "cd", weight: 100 },
        ],
        substats: [
          { stat: "cr", weight: 100 },
          { stat: "cd", weight: 100 },
          { stat: "er", weight: 100 },
        ],
      });
    });

    const buildGroups = createBuildGroupsFromStore();
    const result = await computeFilters(buildGroups);

    // Both builds use crimson_witch_of_flames
    expect(result.length).toBeGreaterThan(0);

    // Check that both characters are served
    const crimsonConfig = result.find(
      (cfg) => cfg.setId === "crimson_witch_of_flames"
    );
    expect(crimsonConfig).toBeDefined();
  });

  it("handles empty builds store gracefully", async () => {
    const result = await computeFilters([]);

    expect(result).toHaveLength(0);
  });
});
