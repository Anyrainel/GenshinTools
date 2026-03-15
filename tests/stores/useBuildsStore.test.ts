import type { Build, BuildPayloadV5 } from "@/data/types";
import { getCachedPreset } from "@/lib/artifact-builds/buildPresetRegistry";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/artifact-builds/buildPresetRegistry", () => ({
  getCachedPreset: vi.fn(() => null),
  loadPreset: vi.fn(() => Promise.resolve(null)),
}));

const mockGetCachedPreset = vi.mocked(getCachedPreset);

// Reset store before each test
beforeEach(() => {
  useBuildsStore.getState().clearAll();
});

describe("useBuildsStore", () => {
  describe("initial state", () => {
    it("starts with empty maps", () => {
      const state = useBuildsStore.getState();
      expect(state.characterToBuildIds).toEqual({});
      expect(state.builds).toEqual({});
      expect(state.activePresetId).toBeNull();
      expect(state.presetDeletedBuildIds).toEqual([]);
      expect(state.hiddenCharacters).toEqual({});
    });

    it("has default compute options", () => {
      const state = useBuildsStore.getState();
      expect(state.computeOptions).toBeDefined();
      expect(state.computeOptions.mergeAlgorithm).toBe("smartMerge");
    });
  });

  describe("newBuild", () => {
    it("creates a new build with generated ID", () => {
      useBuildsStore.getState().newBuild("test-character");

      const state = useBuildsStore.getState();
      const buildIds = state.getBuildIds("test-character");
      expect(buildIds.length).toBe(1);

      const build = state.getBuild(buildIds[0]);
      expect(build).toBeDefined();
      expect(build?.characterId).toBe("test-character");
    });

    it("creates multiple builds for same character", async () => {
      const characterId = "test-character";

      useBuildsStore.getState().newBuild(characterId);
      // Small delay to ensure unique timestamp-based IDs
      await new Promise((resolve) => setTimeout(resolve, 5));
      useBuildsStore.getState().newBuild(characterId);

      const state = useBuildsStore.getState();
      const buildIds = state.getBuildIds(characterId);
      expect(buildIds.length).toBe(2);
    });

    it("generates unique IDs for each build", async () => {
      const characterId = "test-character";

      useBuildsStore.getState().newBuild(characterId);
      // Small delay to ensure unique timestamp-based IDs
      await new Promise((resolve) => setTimeout(resolve, 5));
      useBuildsStore.getState().newBuild(characterId);

      const state = useBuildsStore.getState();
      const buildIds = state.getBuildIds(characterId);
      expect(buildIds[0]).not.toBe(buildIds[1]);
    });
  });

  describe("setBuild", () => {
    it("updates build properties", () => {
      const state = useBuildsStore.getState();
      const characterId = "test-character";

      state.newBuild(characterId);
      const buildId = state.getBuildIds(characterId)[0];

      state.setBuild(buildId, { name: "Updated Name" });

      const build = state.getBuild(buildId);
      expect(build?.name).toBe("Updated Name");
    });

    it("preserves other properties when partially updating", () => {
      const state = useBuildsStore.getState();
      const characterId = "test-character";

      state.newBuild(characterId);
      const buildId = state.getBuildIds(characterId)[0];
      const originalBuild = state.getBuild(buildId);

      state.setBuild(buildId, { name: "New Name" });

      const updatedBuild = state.getBuild(buildId);
      expect(updatedBuild?.characterId).toBe(originalBuild?.characterId);
    });

    it("copy-on-write: initializes from baseBuild when build doesn't exist locally", () => {
      const baseBuild = {
        id: "preset-build-1",
        characterId: "char1",
        name: "Preset Original",
        visible: true,
        composition: "4pc" as const,
        artifactSet: "gladiators_finale",
        sandsWeights: [{ stat: "atk%" as const, weight: 100 }],
        gobletWeights: [{ stat: "pyro%" as const, weight: 100 }],
        circletWeights: [{ stat: "cr" as const, weight: 100 }],
        normalizer: 0,
        substats: [
          { stat: "cr" as const, weight: 100 },
          { stat: "cd" as const, weight: 100 },
        ],
      };

      // Build doesn't exist in the local store yet
      expect(
        useBuildsStore.getState().getBuild("preset-build-1")
      ).toBeUndefined();

      // setBuild with baseBuild should create it via copy-on-write
      useBuildsStore
        .getState()
        .setBuild("preset-build-1", { name: "User Override" }, baseBuild);

      const result = useBuildsStore.getState().getBuild("preset-build-1");
      expect(result).toBeDefined();
      expect(result!.name).toBe("User Override");
      expect(result!.characterId).toBe("char1");
      expect(result!.artifactSet).toBe("gladiators_finale");
      // Should also be tracked in character ordering
      expect(useBuildsStore.getState().getBuildIds("char1")).toContain(
        "preset-build-1"
      );
    });
  });

  describe("removeBuild", () => {
    it("removes build from store", () => {
      const state = useBuildsStore.getState();
      const characterId = "test-character";

      state.newBuild(characterId);
      const buildId = state.getBuildIds(characterId)[0];

      state.removeBuild(characterId, buildId);

      expect(state.getBuild(buildId)).toBeUndefined();
      expect(state.getBuildIds(characterId).length).toBe(0);
    });
  });

  describe("copyBuild", () => {
    it("creates a copy of existing build with same properties", async () => {
      const characterId = "test-character";

      // Create initial build
      useBuildsStore.getState().newBuild(characterId);
      let state = useBuildsStore.getState();
      const originalId = state.getBuildIds(characterId)[0];

      // Set name and copy (with delay to ensure unique timestamp-based ID)
      useBuildsStore.getState().setBuild(originalId, { name: "Original" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      useBuildsStore.getState().copyBuild(characterId, originalId);

      // Re-fetch state after mutations
      state = useBuildsStore.getState();
      const buildIds = state.getBuildIds(characterId);
      expect(buildIds.length).toBe(2);

      // Find the copy (the one that's not the original)
      const copyId = buildIds.find((id: string) => id !== originalId);
      expect(copyId).toBeDefined();

      const original = state.getBuild(originalId);
      const copy = state.getBuild(copyId!);
      expect(copy).toBeDefined();
      expect(copy?.id).not.toBe(original?.id);
      expect(copy?.name).toBe(original?.name);
    });
  });

  describe("character visibility", () => {
    it("sets character hidden state", () => {
      const characterId = "test-character";

      useBuildsStore.getState().setCharacterHidden(characterId, true);
      expect(useBuildsStore.getState().hiddenCharacters[characterId]).toBe(
        true
      );

      // Setting to false removes the key (storage optimization)
      useBuildsStore.getState().setCharacterHidden(characterId, false);
      expect(
        useBuildsStore.getState().hiddenCharacters[characterId]
      ).toBeFalsy();
    });

    it("toggles character hidden state", () => {
      const characterId = "test-character";

      useBuildsStore.getState().toggleCharacterHidden(characterId);
      expect(useBuildsStore.getState().hiddenCharacters[characterId]).toBe(
        true
      );

      // Toggling again removes the key (storage optimization)
      useBuildsStore.getState().toggleCharacterHidden(characterId);
      expect(
        useBuildsStore.getState().hiddenCharacters[characterId]
      ).toBeFalsy();
    });
  });

  describe("computeOptions", () => {
    it("updates partial compute options", () => {
      useBuildsStore
        .getState()
        .setComputeOptions({ mergeAlgorithm: "greedyMerge" });

      const state = useBuildsStore.getState();
      expect(state.computeOptions.mergeAlgorithm).toBe("greedyMerge");
      // Other options should remain unchanged
      expect(state.computeOptions.expandElementalGoblet).toBeDefined();
    });
  });

  describe("clearAll", () => {
    it("resets all state to initial values", () => {
      // Add some data
      useBuildsStore.getState().newBuild("char-1");
      useBuildsStore.getState().setCharacterHidden("char-1", true);
      useBuildsStore.getState().setMetadata("Author", "Description");

      // Clear
      useBuildsStore.getState().clearAll();

      // Re-fetch state after clear
      const state = useBuildsStore.getState();
      expect(state.characterToBuildIds).toEqual({});
      expect(state.builds).toEqual({});
      expect(state.hiddenCharacters).toEqual({});
      expect(state.author).toBe("");
      expect(state.description).toBe("");
    });
  });

  describe("metadata", () => {
    it("sets author and description", () => {
      useBuildsStore.getState().setMetadata("Test Author", "Test Description");

      const state = useBuildsStore.getState();
      expect(state.author).toBe("Test Author");
    });
  });

  describe("importBuilds", () => {
    it("imports V5 payload correctly", () => {
      const v5Payload = {
        version: 5,
        author: "Test",
        description: "Desc",
        builds: {
          "b-1": {
            id: "b-1",
            characterId: "char1",
            name: "B1",
            visible: true,
            composition: "4pc",
            substats: [],
            sandsWeights: [],
            gobletWeights: [],
            circletWeights: [],
            normalizer: 0,
          },
        },
        characterBuilds: {
          char1: ["b-1"],
        },
        characterWeapons: {},
        computeOptions: {},
      } as unknown as BuildPayloadV5;

      useBuildsStore.getState().importBuilds(v5Payload);

      const state = useBuildsStore.getState();
      expect(state.builds["b-1"]).toBeDefined();
      expect(state.getBuildIds("char1")).toContain("b-1");
      expect(state.author).toBe("Test");
    });

    it("imports V4 legacy payload correctly", () => {
      const v4Payload = {
        version: 4,
        author: "Legacy",
        description: "Legacy Desc",
        data: [
          {
            characterId: "char1",
            builds: [
              {
                id: "v4-b1",
                name: "Legacy Build",
                visible: true,
                composition: "4pc" as const,
                artifactSet: "gladiators_finale",
                sandsWeights: [{ stat: "atk%" as const, weight: 100 }],
                gobletWeights: [{ stat: "pyro%" as const, weight: 100 }],
                circletWeights: [{ stat: "cr" as const, weight: 100 }],
                normalizer: 0,
                substats: [
                  { stat: "cr" as const, weight: 100 },
                  { stat: "cd" as const, weight: 100 },
                ],
              },
            ],
            weapons: ["staff_of_homa"],
            hidden: true,
          },
        ],
      };

      useBuildsStore
        .getState()
        .importBuilds(v4Payload as unknown as BuildPayloadV5);

      const state = useBuildsStore.getState();
      expect(state.builds["v4-b1"]).toBeDefined();
      expect(state.builds["v4-b1"].characterId).toBe("char1");
      expect(state.getBuildIds("char1")).toContain("v4-b1");
      expect(state.characterWeapons.char1).toEqual(["staff_of_homa"]);
      expect(state.hiddenCharacters.char1).toBe(true);
    });

    it("resets activePresetId to null on import", () => {
      // Set up a preset first
      useBuildsStore.getState().setActivePreset("some-preset");
      expect(useBuildsStore.getState().activePresetId).toBe("some-preset");

      useBuildsStore.getState().importBuilds({
        version: 5,
        author: "",
        description: "",
        builds: {},
        characterBuilds: {},
        characterWeapons: {},
      } as BuildPayloadV5);

      expect(useBuildsStore.getState().activePresetId).toBeNull();
    });
  });

  describe("moveBuild", () => {
    it("moves a build up in the ordering", async () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      await new Promise((r) => setTimeout(r, 5));
      useBuildsStore.getState().newBuild(charId);

      const ids = useBuildsStore.getState().getBuildIds(charId);
      const [first, second] = ids;

      useBuildsStore.getState().moveBuild(charId, [...ids], second, "up");

      const reordered = useBuildsStore.getState().getBuildIds(charId);
      expect(reordered[0]).toBe(second);
      expect(reordered[1]).toBe(first);
    });

    it("moves a build down in the ordering", async () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      await new Promise((r) => setTimeout(r, 5));
      useBuildsStore.getState().newBuild(charId);

      const ids = useBuildsStore.getState().getBuildIds(charId);
      const [first, second] = ids;

      useBuildsStore.getState().moveBuild(charId, [...ids], first, "down");

      const reordered = useBuildsStore.getState().getBuildIds(charId);
      expect(reordered[0]).toBe(second);
      expect(reordered[1]).toBe(first);
    });

    it("no-ops when moving first build up", () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);

      const ids = useBuildsStore.getState().getBuildIds(charId);
      useBuildsStore.getState().moveBuild(charId, [...ids], ids[0], "up");

      expect(useBuildsStore.getState().getBuildIds(charId)).toEqual(ids);
    });

    it("no-ops when moving last build down", async () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      await new Promise((r) => setTimeout(r, 5));
      useBuildsStore.getState().newBuild(charId);

      const ids = useBuildsStore.getState().getBuildIds(charId);
      useBuildsStore.getState().moveBuild(charId, [...ids], ids[1], "down");

      expect(useBuildsStore.getState().getBuildIds(charId)).toEqual(ids);
    });
  });

  describe("deleteBuild", () => {
    it("removes build and tracks deletion in presetDeletedBuildIds", () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      const buildId = useBuildsStore.getState().getBuildIds(charId)[0];

      useBuildsStore.getState().deleteBuild(charId, buildId);

      expect(useBuildsStore.getState().getBuild(buildId)).toBeUndefined();
      expect(useBuildsStore.getState().getBuildIds(charId)).toHaveLength(0);
      expect(useBuildsStore.getState().presetDeletedBuildIds).toContain(
        buildId
      );
    });
  });

  describe("revertBuild", () => {
    it("removes local override while keeping ordering", () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      const buildId = useBuildsStore.getState().getBuildIds(charId)[0];

      // Modify the build locally
      useBuildsStore.getState().setBuild(buildId, { name: "Modified" });
      expect(useBuildsStore.getState().getBuild(buildId)?.name).toBe(
        "Modified"
      );

      // Revert: removes local override
      useBuildsStore.getState().revertBuild(charId, buildId);

      // Build removed from local store, but ordering preserved
      expect(useBuildsStore.getState().getBuild(buildId)).toBeUndefined();
      expect(useBuildsStore.getState().getBuildIds(charId)).toContain(buildId);
    });

    it("un-marks previously deleted build", () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      const buildId = useBuildsStore.getState().getBuildIds(charId)[0];

      // Delete then revert
      useBuildsStore.getState().deleteBuild(charId, buildId);
      expect(useBuildsStore.getState().presetDeletedBuildIds).toContain(
        buildId
      );

      useBuildsStore.getState().revertBuild(charId, buildId);
      expect(useBuildsStore.getState().presetDeletedBuildIds).not.toContain(
        buildId
      );
    });
  });

  describe("subscribePreset", () => {
    const presetPayload: BuildPayloadV5 = {
      version: 5,
      id: "test-preset",
      author: "Preset Author",
      description: "Preset Desc",
      builds: {
        "p-1": {
          id: "p-1",
          characterId: "char1",
          name: "Preset Build",
          visible: true,
          composition: "4pc",
          substats: [],
          sandsWeights: [],
          gobletWeights: [],
          circletWeights: [],
          normalizer: 0,
        },
      },
      characterBuilds: { char1: ["p-1"] },
      characterWeapons: { char1: ["some_weapon"] },
    };

    it("sets activePresetId and metadata", () => {
      useBuildsStore.getState().subscribePreset("test-preset", presetPayload);

      const state = useBuildsStore.getState();
      expect(state.activePresetId).toBe("test-preset");
      expect(state.author).toBe("Preset Author");
    });

    it("populates characterToBuildIds from preset", () => {
      useBuildsStore.getState().subscribePreset("test-preset", presetPayload);

      expect(useBuildsStore.getState().getBuildIds("char1")).toContain("p-1");
    });

    it("preserves custom builds appended after preset builds", () => {
      // Create a custom build first
      useBuildsStore.getState().newBuild("char1");
      const customId = useBuildsStore.getState().getBuildIds("char1")[0];

      // Subscribe to preset
      useBuildsStore.getState().subscribePreset("test-preset", presetPayload);

      const ids = useBuildsStore.getState().getBuildIds("char1");
      // Preset builds first, then custom
      expect(ids[0]).toBe("p-1");
      expect(ids).toContain(customId);
    });

    it("deduplicates perfectly identical local custom builds", () => {
      // 1. Setup a local build that mimics the preset exactly
      useBuildsStore.getState().newBuild("char1");
      const localId = useBuildsStore.getState().getBuildIds("char1")[0];

      const identicalBuild: Build = {
        id: localId,
        characterId: "char1",
        name: "Preset Build", // Same name
        visible: true,
        composition: "4pc",
        artifactSet: undefined,
        minCons: undefined,
        roles: undefined,
        styles: undefined,
        halfSet1: undefined,
        halfSet2: undefined,
        substats: [],
        sandsWeights: [],
        gobletWeights: [],
        circletWeights: [],
        normalizer: 0,
      };

      // Update local build to perfectly match the incoming preset
      useBuildsStore.getState().setBuild(localId, identicalBuild);

      // Verify the local ID exists before
      expect(useBuildsStore.getState().getBuildIds("char1")).toContain(localId);

      // 2. Subscribe to preset
      useBuildsStore.getState().subscribePreset("test-preset", presetPayload);

      // 3. The identical local build should have been deleted
      const ids = useBuildsStore.getState().getBuildIds("char1");

      // The preset ID should be there
      expect(ids).toContain("p-1");

      // But the identical custom ID should NOT be there
      expect(ids).not.toContain(localId);

      // And the build payload deleted from memory
      expect(useBuildsStore.getState().getBuild(localId)).toBeUndefined();
    });

    it("resets presetDeletedBuildIds", () => {
      // Add a deleted ID
      useBuildsStore.getState().newBuild("char1");
      const buildId = useBuildsStore.getState().getBuildIds("char1")[0];
      useBuildsStore.getState().deleteBuild("char1", buildId);
      expect(useBuildsStore.getState().presetDeletedBuildIds.length).toBe(1);

      // Subscribe clears deletions
      useBuildsStore.getState().subscribePreset("test-preset", presetPayload);
      expect(useBuildsStore.getState().presetDeletedBuildIds).toEqual([]);
    });

    it("does not overwrite existing weapon customizations", () => {
      useBuildsStore.getState().setCharacterWeapons("char1", ["custom_weapon"]);

      useBuildsStore.getState().subscribePreset("test-preset", presetPayload);

      // Custom weapon preserved over preset default
      expect(useBuildsStore.getState().getCharacterWeapons("char1")).toEqual([
        "custom_weapon",
      ]);
    });
  });

  describe("setCharacterWeapons", () => {
    it("stores weapon IDs for a character", () => {
      useBuildsStore
        .getState()
        .setCharacterWeapons("char1", ["weapon_a", "weapon_b"]);

      expect(useBuildsStore.getState().getCharacterWeapons("char1")).toEqual([
        "weapon_a",
        "weapon_b",
      ]);
    });

    it("clears weapons when given empty array", () => {
      useBuildsStore.getState().setCharacterWeapons("char1", ["weapon_a"]);
      useBuildsStore.getState().setCharacterWeapons("char1", []);

      expect(useBuildsStore.getState().getCharacterWeapons("char1")).toEqual(
        []
      );
    });

    it("caps weapons at 5", () => {
      useBuildsStore
        .getState()
        .setCharacterWeapons("char1", [
          "w1",
          "w2",
          "w3",
          "w4",
          "w5",
          "w6",
          "w7",
        ]);

      expect(
        useBuildsStore.getState().getCharacterWeapons("char1").length
      ).toBe(5);
    });
  });

  describe("setActivePreset", () => {
    it("sets preset ID and clears deleted builds list", () => {
      // Simulate some deleted IDs
      useBuildsStore.getState().newBuild("char1");
      const buildId = useBuildsStore.getState().getBuildIds("char1")[0];
      useBuildsStore.getState().deleteBuild("char1", buildId);

      useBuildsStore.getState().setActivePreset("new-preset");

      const state = useBuildsStore.getState();
      expect(state.activePresetId).toBe("new-preset");
      expect(state.presetDeletedBuildIds).toEqual([]);
    });

    it("clears preset when set to null", () => {
      useBuildsStore.getState().setActivePreset("some-preset");
      useBuildsStore.getState().setActivePreset(null);

      expect(useBuildsStore.getState().activePresetId).toBeNull();
    });
  });

  describe("setBuild composition switch", () => {
    it("clears halfSet fields when switching to 4pc", () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      const buildId = useBuildsStore.getState().getBuildIds(charId)[0];

      // Set 2pc+2pc first
      useBuildsStore.getState().setBuild(buildId, {
        composition: "2pc+2pc",
        halfSet1: 1,
        halfSet2: 2,
      });
      expect(useBuildsStore.getState().getBuild(buildId)?.halfSet1).toBe(1);

      // Switch to 4pc — should clear halfSet fields
      useBuildsStore
        .getState()
        .setBuild(buildId, { composition: "4pc", artifactSet: "vv" });

      const build = useBuildsStore.getState().getBuild(buildId);
      expect(build?.composition).toBe("4pc");
      expect(build?.halfSet1).toBeUndefined();
      expect(build?.halfSet2).toBeUndefined();
    });

    it("clears artifactSet when switching to 2pc+2pc", () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      const buildId = useBuildsStore.getState().getBuildIds(charId)[0];

      // Set 4pc first
      useBuildsStore.getState().setBuild(buildId, {
        composition: "4pc",
        artifactSet: "viridescent_venerer",
      });
      expect(useBuildsStore.getState().getBuild(buildId)?.artifactSet).toBe(
        "viridescent_venerer"
      );

      // Switch to 2pc+2pc — should clear artifactSet
      useBuildsStore.getState().setBuild(buildId, {
        composition: "2pc+2pc",
        halfSet1: 1,
        halfSet2: 2,
      });

      const build = useBuildsStore.getState().getBuild(buildId);
      expect(build?.composition).toBe("2pc+2pc");
      expect(build?.artifactSet).toBeUndefined();
    });
  });

  // ─── Preset-aware flows ───────────────────────────────────────────
  // These tests mock getCachedPreset to simulate an active preset.
  // NOTE: Zustand+Immer replaces state on each set(). Getter functions
  // (getBuild, getBuildIds, etc.) use get() and always return fresh state.
  // Direct property reads (presetDeletedBuildIds, hiddenCharacters) must
  // use useBuildsStore.getState() after mutations.
  describe("preset build lifecycle", () => {
    const presetBuild1: Build = {
      id: "p-1",
      characterId: "char1",
      name: "Preset Build 1",
      visible: true,
      composition: "4pc",
      artifactSet: "gladiators_finale",
      sandsWeights: [{ stat: "atk%", weight: 100 }],
      gobletWeights: [{ stat: "pyro%", weight: 100 }],
      circletWeights: [{ stat: "cr", weight: 100 }],
      normalizer: 0,
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
      ],
    };
    const presetBuild2: Build = {
      id: "p-2",
      characterId: "char1",
      name: "Preset Build 2",
      visible: true,
      composition: "4pc",
      artifactSet: "crimson_witch_of_flames",
      sandsWeights: [{ stat: "hp%", weight: 100 }],
      gobletWeights: [{ stat: "pyro%", weight: 100 }],
      circletWeights: [{ stat: "cr", weight: 100 }],
      normalizer: 0,
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "hp%", weight: 100 },
      ],
    };
    const presetBuild3: Build = {
      id: "p-3",
      characterId: "char2",
      name: "Char2 Preset",
      visible: true,
      composition: "4pc",
      artifactSet: "emblem_of_severed_fate",
      sandsWeights: [{ stat: "er", weight: 100 }],
      gobletWeights: [{ stat: "hydro%", weight: 100 }],
      circletWeights: [{ stat: "cr", weight: 100 }],
      normalizer: 0,
      substats: [
        { stat: "cr", weight: 100 },
        { stat: "er", weight: 100 },
      ],
    };

    const testPreset: BuildPayloadV5 = {
      version: 5,
      id: "test-preset",
      author: "Preset Author",
      description: "Test",
      builds: {
        "p-1": presetBuild1,
        "p-2": presetBuild2,
        "p-3": presetBuild3,
      },
      characterBuilds: { char1: ["p-1", "p-2"], char2: ["p-3"] },
      characterWeapons: { char1: ["weapon_a"], char2: ["weapon_b"] },
    };

    /** Shorthand to get fresh state after mutations */
    const fresh = () => useBuildsStore.getState();

    beforeEach(() => {
      // Configure mock to return our preset
      mockGetCachedPreset.mockReturnValue(testPreset);
      // Subscribe to the preset (populates characterToBuildIds)
      useBuildsStore.getState().subscribePreset("test-preset", testPreset);
    });

    afterEach(() => {
      mockGetCachedPreset.mockReturnValue(null);
    });

    // ── revertBuild ────────────────────────────────────────────────
    describe("revertBuild with preset", () => {
      it("reverts a modified preset build back to preset version", () => {
        // Edit preset build → creates local override (Copy-on-Write)
        fresh().setBuild("p-1", { name: "User Modified" }, presetBuild1);
        expect(fresh().getBuild("p-1")?.name).toBe("User Modified");

        // Revert → removes local override
        fresh().revertBuild("char1", "p-1");

        // Local override gone
        expect(fresh().getBuild("p-1")).toBeUndefined();
        // But ordering preserved — both preset builds still listed
        expect(fresh().getBuildIds("char1")).toContain("p-1");
        expect(fresh().getBuildIds("char1")).toContain("p-2");
        // Not marked as deleted
        expect(fresh().presetDeletedBuildIds).not.toContain("p-1");
      });

      it("preserves sibling builds when reverting one", () => {
        fresh().setBuild("p-1", { name: "Modified" }, presetBuild1);
        fresh().revertBuild("char1", "p-1");

        expect(fresh().getBuildIds("char1")).toEqual(["p-1", "p-2"]);
      });

      it("does not affect other characters when reverting", () => {
        fresh().setBuild("p-1", { name: "Modified" }, presetBuild1);
        fresh().revertBuild("char1", "p-1");

        expect(fresh().getBuildIds("char2")).toEqual(["p-3"]);
      });
    });

    // ── removeBuild vs deleteBuild vs revertBuild contract ────────
    describe("delete vs revert contract", () => {
      it("deleteBuild removes from ordering and marks as deleted", () => {
        fresh().deleteBuild("char1", "p-1");

        expect(fresh().getBuildIds("char1")).not.toContain("p-1");
        expect(fresh().presetDeletedBuildIds).toContain("p-1");
        // p-2 still present
        expect(fresh().getBuildIds("char1")).toContain("p-2");
      });

      it("removeBuild removes from ordering and tracks preset deletion", () => {
        fresh().removeBuild("char1", "p-1");

        expect(fresh().getBuildIds("char1")).not.toContain("p-1");
        expect(fresh().presetDeletedBuildIds).toContain("p-1");
      });

      it("revertBuild keeps in ordering and does NOT mark as deleted", () => {
        // First modify to create local override
        fresh().setBuild("p-1", { name: "Modified" }, presetBuild1);
        fresh().revertBuild("char1", "p-1");

        expect(fresh().getBuildIds("char1")).toContain("p-1");
        expect(fresh().presetDeletedBuildIds).not.toContain("p-1");
        expect(fresh().getBuild("p-1")).toBeUndefined();
      });
    });

    // ── setBuild Copy-on-Write ordering ───────────────────────────
    describe("setBuild copy-on-write preserves preset ordering", () => {
      it("preserves all sibling preset builds when COW initializes ordering", () => {
        // Clear characterToBuildIds to simulate edge case
        useBuildsStore.setState({ characterToBuildIds: {} });

        // COW edit on p-1 should initialize from preset ordering
        fresh().setBuild("p-1", { name: "Edited" }, presetBuild1);

        const ids = fresh().getBuildIds("char1");
        expect(ids).toContain("p-1");
        expect(ids).toContain("p-2");
      });

      it("appends non-preset build when COW initializes from preset", () => {
        // Clear ordering for char1 only
        useBuildsStore.setState({ characterToBuildIds: { char2: ["p-3"] } });

        const newBuild: Build = {
          id: "custom-1",
          characterId: "char1",
          name: "Custom",
          visible: true,
          composition: "4pc",
          sandsWeights: [],
          gobletWeights: [],
          circletWeights: [],
          normalizer: 0,
          substats: [],
        };
        fresh().setBuild("custom-1", { name: "Custom" }, newBuild);

        const ids = fresh().getBuildIds("char1");
        expect(ids).toContain("p-1");
        expect(ids).toContain("p-2");
        expect(ids).toContain("custom-1");
      });

      it("does not duplicate IDs when COW build already in preset ordering", () => {
        useBuildsStore.setState({ characterToBuildIds: {} });
        fresh().setBuild("p-1", { name: "Edited" }, presetBuild1);

        const ids = fresh().getBuildIds("char1");
        const p1Count = ids.filter((id) => id === "p-1").length;
        expect(p1Count).toBe(1);
      });
    });

    // ── restoreCharacter ──────────────────────────────────────────
    describe("restoreCharacter", () => {
      it("removes all local overrides for the character", () => {
        fresh().setBuild("p-1", { name: "Modified 1" }, presetBuild1);
        fresh().setBuild("p-2", { name: "Modified 2" }, presetBuild2);
        expect(fresh().getBuild("p-1")).toBeDefined();
        expect(fresh().getBuild("p-2")).toBeDefined();

        fresh().restoreCharacter("char1");

        expect(fresh().getBuild("p-1")).toBeUndefined();
        expect(fresh().getBuild("p-2")).toBeUndefined();
      });

      it("restores preset ordering", () => {
        fresh().newBuild("char1");
        const customId = fresh()
          .getBuildIds("char1")
          .find((id) => !id.startsWith("p-"))!;

        fresh().restoreCharacter("char1");

        expect(fresh().getBuildIds("char1")).toEqual(["p-1", "p-2"]);
        expect(fresh().getBuild(customId)).toBeUndefined();
      });

      it("un-deletes preset builds for the character", () => {
        fresh().deleteBuild("char1", "p-1");
        expect(fresh().presetDeletedBuildIds).toContain("p-1");

        fresh().restoreCharacter("char1");

        expect(fresh().presetDeletedBuildIds).not.toContain("p-1");
        expect(fresh().getBuildIds("char1")).toContain("p-1");
      });

      it("restores weapons from preset", () => {
        fresh().setCharacterWeapons("char1", ["custom_sword"]);
        expect(fresh().getCharacterWeapons("char1")).toEqual(["custom_sword"]);

        fresh().restoreCharacter("char1");

        expect(fresh().getCharacterWeapons("char1")).toEqual(["weapon_a"]);
      });

      it("clears hidden status", () => {
        fresh().setCharacterHidden("char1", true);
        expect(fresh().hiddenCharacters.char1).toBe(true);

        fresh().restoreCharacter("char1");

        expect(fresh().hiddenCharacters.char1).toBeUndefined();
      });

      it("does not affect other characters", () => {
        fresh().setBuild("p-3", { name: "Modified" }, presetBuild3);
        fresh().restoreCharacter("char1");

        expect(fresh().getBuild("p-3")?.name).toBe("Modified");
        expect(fresh().getBuildIds("char2")).toEqual(["p-3"]);
      });
    });

    // ── Multiple edits then revert ────────────────────────────────
    describe("multiple edits then revert", () => {
      it("reverts to original preset after multiple sequential edits", () => {
        fresh().setBuild("p-1", { name: "Edit 1" }, presetBuild1);
        fresh().setBuild("p-1", { name: "Edit 2" });
        fresh().setBuild("p-1", { artifactSet: "shimenawas_reminiscence" });

        expect(fresh().getBuild("p-1")?.name).toBe("Edit 2");
        expect(fresh().getBuild("p-1")?.artifactSet).toBe(
          "shimenawas_reminiscence"
        );

        fresh().revertBuild("char1", "p-1");

        expect(fresh().getBuild("p-1")).toBeUndefined();
        expect(fresh().getBuildIds("char1")).toContain("p-1");
      });
    });

    // ── Delete then restore ───────────────────────────────────────
    describe("delete preset builds then restore", () => {
      it("restores all deleted builds for a character", () => {
        fresh().deleteBuild("char1", "p-1");
        fresh().deleteBuild("char1", "p-2");
        expect(fresh().getBuildIds("char1")).toHaveLength(0);
        expect(fresh().presetDeletedBuildIds).toContain("p-1");
        expect(fresh().presetDeletedBuildIds).toContain("p-2");

        fresh().restoreCharacter("char1");

        expect(fresh().getBuildIds("char1")).toEqual(["p-1", "p-2"]);
        expect(fresh().presetDeletedBuildIds).not.toContain("p-1");
        expect(fresh().presetDeletedBuildIds).not.toContain("p-2");
      });
    });

    // ── Edit + delete + restore ───────────────────────────────────
    describe("edit, delete, and restore combined", () => {
      it("handles edit → delete → restoreCharacter correctly", () => {
        // Edit p-1
        fresh().setBuild("p-1", { name: "User Changed" }, presetBuild1);
        // Delete p-2
        fresh().deleteBuild("char1", "p-2");

        // Partial state: p-1 modified, p-2 deleted
        expect(fresh().getBuild("p-1")?.name).toBe("User Changed");
        expect(fresh().getBuildIds("char1")).toEqual(["p-1"]);

        // Restore everything
        fresh().restoreCharacter("char1");

        expect(fresh().getBuild("p-1")).toBeUndefined();
        expect(fresh().getBuildIds("char1")).toEqual(["p-1", "p-2"]);
        expect(fresh().presetDeletedBuildIds).not.toContain("p-2");
      });
    });
  });
});
