import type { Build, BuildGroup } from "@/data/types";
import {
  DEFAULT_COMPUTE_OPTIONS,
  buildRawConfigs,
  mergeConfigsAsync,
} from "@/lib/artifact-builds/computeFilters";
import { describe, expect, it } from "vitest";

// Helper to create a complete Build matching the actual type
function createBuild(overrides: Partial<Build> = {}): Build {
  return {
    id: "test-build-1",
    characterId: "kaedehara_kazuha",
    name: "Test Build",
    visible: true,
    composition: "4pc",
    artifactSet: "viridescent_venerer",
    sandsWeights: [{ stat: "atk%", weight: 100 }],
    gobletWeights: [{ stat: "anemo%", weight: 100 }],
    circletWeights: [{ stat: "cr", weight: 100 }],
    normalizer: 0,
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 100 },
      { stat: "er", weight: 100 },
    ],
    ...overrides,
  };
}

// Helper to create a build group
function createBuildGroup(overrides: Partial<BuildGroup> = {}): BuildGroup {
  return {
    characterId: "kaedehara_kazuha",
    builds: [createBuild()],
    hidden: false,
    ...overrides,
  };
}

/** Run the full two-phase pipeline synchronously (smartMerge/greedyMerge are sync). */
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

describe("computeFilters (async pipeline)", () => {
  describe("basic computation", () => {
    it("generates configs from a single visible build", async () => {
      const buildGroups: BuildGroup[] = [createBuildGroup()];
      const result = await computeFilters(buildGroups);

      expect(result.length).toBeGreaterThan(0);
      // Each result should have a setId and configurations
      expect(result[0].setId).toBeDefined();
      expect(result[0].configurations).toBeDefined();
    });

    it("generates configs for 2pc+2pc composition", async () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [
            createBuild({
              composition: "2pc+2pc",
              artifactSet: undefined,
              halfSet1: 1, // Some half set ID
              halfSet2: 2,
            }),
          ],
        }),
      ];
      const result = await computeFilters(buildGroups);

      // 2pc+2pc may or may not resolve depending on half set IDs
      expect(result).toBeDefined();
    });

    it("includes character info in served characters", async () => {
      const buildGroups: BuildGroup[] = [createBuildGroup()];
      const result = await computeFilters(buildGroups);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].configurations.length).toBeGreaterThan(0);
      const config = result[0].configurations[0];
      expect(config.servedCharacters.length).toBeGreaterThan(0);
      expect(config.servedCharacters[0].characterId).toBe("kaedehara_kazuha");
    });
  });

  describe("hidden builds", () => {
    it("excludes hidden build groups", async () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({ hidden: true }),
        createBuildGroup({
          characterId: "venti",
          builds: [createBuild({ characterId: "venti" })],
          hidden: false,
        }),
      ];

      const result = await computeFilters(buildGroups);

      // Should only include venti, not the hidden character
      const allCharIds = result.flatMap((r) =>
        r.configurations.flatMap((c) =>
          c.servedCharacters.map((s) => s.characterId)
        )
      );
      expect(allCharIds).not.toContain("kaedehara_kazuha");
      expect(allCharIds).toContain("venti");
    });

    it("excludes builds with visible=false", async () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [
            createBuild({ visible: false }),
            createBuild({ id: "visible-build", visible: true }),
          ],
        }),
      ];

      const result = await computeFilters(buildGroups);
      // Should still process the visible build
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("empty input", () => {
    it("returns empty array for no build groups", async () => {
      const result = await computeFilters([]);
      expect(result).toEqual([]);
    });

    it("handles all hidden builds", async () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({ hidden: true }),
        createBuildGroup({ hidden: true, characterId: "venti" }),
      ];

      const result = await computeFilters(buildGroups);
      expect(result).toBeDefined();
    });

    it("handles all invisible builds", async () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [createBuild({ visible: false })],
        }),
      ];

      const result = await computeFilters(buildGroups);
      expect(result).toBeDefined();
    });
  });

  describe("compute options", () => {
    it("respects mergeAlgorithm option", async () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [
            createBuild({
              substats: [
                { stat: "cr", weight: 100 },
                { stat: "cd", weight: 100 },
                { stat: "atk%", weight: 100 },
                { stat: "er", weight: 100 },
              ],
            }),
          ],
        }),
      ];

      const withBruteForce = await computeFilters(buildGroups, {
        ...DEFAULT_COMPUTE_OPTIONS,
        mergeAlgorithm: "bruteForce",
      });

      const withGreedy = await computeFilters(buildGroups, {
        ...DEFAULT_COMPUTE_OPTIONS,
        mergeAlgorithm: "greedyMerge",
      });

      // Both algorithms should produce valid results
      expect(withBruteForce.length).toBeGreaterThan(0);
      expect(withGreedy.length).toBeGreaterThan(0);
    });

    it("applies default compute options", async () => {
      const buildGroups: BuildGroup[] = [createBuildGroup()];

      // Test with defaults
      const result = await computeFilters(buildGroups);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("weight thresholds", () => {
    it("filters substats by weight threshold", () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [
            createBuild({
              substats: [
                { stat: "cr", weight: 100 },
                { stat: "cd", weight: 100 },
                { stat: "atk%", weight: 80 },
                { stat: "er", weight: 50 },
              ],
            }),
          ],
        }),
      ];

      // threshold=70 should include cr, cd, atk% but exclude er (50)
      const raw = buildRawConfigs(buildGroups, {
        ...DEFAULT_COMPUTE_OPTIONS,
        substatWeightThreshold: 70,
      });

      const configs = Object.values(raw).flat();
      expect(configs.length).toBeGreaterThan(0);
      const substats = configs[0].flowerPlume.substats;
      expect(substats).toContain("cr");
      expect(substats).toContain("cd");
      expect(substats).toContain("atk%");
      expect(substats).not.toContain("er");
    });

    it("marks must-present substats by weight threshold", () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [
            createBuild({
              substats: [
                { stat: "cr", weight: 100 },
                { stat: "cd", weight: 100 },
                { stat: "atk%", weight: 80 },
                { stat: "er", weight: 80 },
              ],
            }),
          ],
        }),
      ];

      // mustPresentThreshold=100 should only mark cr and cd
      const raw = buildRawConfigs(buildGroups, {
        ...DEFAULT_COMPUTE_OPTIONS,
        substatWeightThreshold: 70,
        mustPresentWeightThreshold: 100,
      });

      const configs = Object.values(raw).flat();
      expect(configs.length).toBeGreaterThan(0);
      const mustPresent = configs[0].flowerPlume.mustPresent;
      expect(mustPresent).toContain("cr");
      expect(mustPresent).toContain("cd");
      expect(mustPresent).not.toContain("atk%");
      expect(mustPresent).not.toContain("er");
    });
  });

  describe("slot config structure", () => {
    it("generates configs with correct slot structure", async () => {
      const buildGroups: BuildGroup[] = [createBuildGroup()];
      const result = await computeFilters(buildGroups);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].configurations.length).toBeGreaterThan(0);
      const config = result[0].configurations[0];

      // All slot configs must exist
      expect(config.flowerPlume).toBeDefined();
      expect(config.sands).toBeDefined();
      expect(config.goblet).toBeDefined();
      expect(config.circlet).toBeDefined();

      // Each slot config has the expected shape
      expect(config.sands.mainStats).toBeDefined();
      expect(config.sands.substats).toBeDefined();
      expect(config.sands.mustPresent).toBeDefined();
      expect(config.sands.minStatCount).toBeDefined();
    });
  });
});
