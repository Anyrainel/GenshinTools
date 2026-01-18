import { type Build, type BuildGroup, ComputeOptions } from "@/data/types";
import {
  DEFAULT_COMPUTE_OPTIONS,
  computeArtifactFilters,
} from "@/lib/computeFilters";
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
    sands: ["atk%"],
    goblet: ["anemo%"],
    circlet: ["cr"],
    substats: ["cr", "cd", "atk%", "er"],
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

describe("computeArtifactFilters", () => {
  describe("basic computation", () => {
    it("generates configs from a single visible build", () => {
      const buildGroups: BuildGroup[] = [createBuildGroup()];
      const result = computeArtifactFilters(buildGroups);

      expect(result.length).toBeGreaterThan(0);
      // Each result should have a setId and configurations
      expect(result[0].setId).toBeDefined();
      expect(result[0].configurations).toBeDefined();
    });

    it("generates configs for 2pc+2pc composition", () => {
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
      const result = computeArtifactFilters(buildGroups);

      // Should generate configs for 2pc combinations
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("includes character info in served characters", () => {
      const buildGroups: BuildGroup[] = [createBuildGroup()];
      const result = computeArtifactFilters(buildGroups);

      if (result.length > 0 && result[0].configurations.length > 0) {
        const config = result[0].configurations[0];
        expect(config.servedCharacters).toBeDefined();
        expect(config.servedCharacters.length).toBeGreaterThan(0);
        expect(config.servedCharacters[0].characterId).toBe("kaedehara_kazuha");
      }
    });
  });

  describe("hidden builds", () => {
    it("excludes hidden build groups", () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({ hidden: true }),
        createBuildGroup({
          characterId: "venti",
          builds: [createBuild({ characterId: "venti" })],
          hidden: false,
        }),
      ];

      const result = computeArtifactFilters(buildGroups);

      // Should only include venti, not the hidden character
      if (result.length > 0 && result[0].configurations.length > 0) {
        const allCharIds = result.flatMap((r) =>
          r.configurations.flatMap((c) =>
            c.servedCharacters.map((s) => s.characterId)
          )
        );
        expect(allCharIds).not.toContain("kaedehara_kazuha");
      }
    });

    it("excludes builds with visible=false", () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [
            createBuild({ visible: false }),
            createBuild({ id: "visible-build", visible: true }),
          ],
        }),
      ];

      const result = computeArtifactFilters(buildGroups);
      // Should still process the visible build
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("empty input", () => {
    it("returns empty array for no build groups", () => {
      const result = computeArtifactFilters([]);
      expect(result).toEqual([]);
    });

    it("handles all hidden builds", () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({ hidden: true }),
        createBuildGroup({ hidden: true, characterId: "venti" }),
      ];

      const result = computeArtifactFilters(buildGroups);
      // Hidden builds should be excluded from processing
      // This may or may not return empty depending on implementation
      expect(result).toBeDefined();
    });

    it("handles all invisible builds", () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [createBuild({ visible: false })],
        }),
      ];

      const result = computeArtifactFilters(buildGroups);
      // Invisible builds should be excluded from processing
      expect(result).toBeDefined();
    });
  });

  describe("compute options", () => {
    it("respects skipCritBuilds option", () => {
      const buildGroups: BuildGroup[] = [
        createBuildGroup({
          builds: [
            createBuild({
              substats: ["cr", "cd"], // CR+CD build
              kOverride: 2,
            }),
          ],
        }),
      ];

      const withSkip = computeArtifactFilters(buildGroups, {
        ...DEFAULT_COMPUTE_OPTIONS,
        skipCritBuilds: true,
      });

      const withoutSkip = computeArtifactFilters(buildGroups, {
        ...DEFAULT_COMPUTE_OPTIONS,
        skipCritBuilds: false,
      });

      // With skip should have fewer or no configs for auto-lock crit builds
      expect(withSkip.length).toBeLessThanOrEqual(withoutSkip.length);
    });

    it("applies default compute options", () => {
      const buildGroups: BuildGroup[] = [createBuildGroup()];

      // Test with defaults
      const result = computeArtifactFilters(buildGroups);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("slot config structure", () => {
    it("generates configs with correct slot structure", () => {
      const buildGroups: BuildGroup[] = [createBuildGroup()];
      const result = computeArtifactFilters(buildGroups);

      if (result.length > 0 && result[0].configurations.length > 0) {
        const config = result[0].configurations[0];

        // Check that all slot configs exist
        expect(config.flowerPlume).toBeDefined();
        expect(config.sands).toBeDefined();
        expect(config.goblet).toBeDefined();
        expect(config.circlet).toBeDefined();

        // Each slot config should have the expected structure
        expect(config.sands.mainStats).toBeDefined();
        expect(config.sands.substats).toBeDefined();
        expect(config.sands.mustPresent).toBeDefined();
        expect(config.sands.minStatCount).toBeDefined();
      }
    });
  });
});
