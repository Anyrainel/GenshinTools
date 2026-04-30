import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Build, BuildPayloadV5 } from "@/data/types";
import { migrateBuildsStore } from "@/stores/migration/builds";
import { useBuildsStore } from "@/stores/useBuildsStore";

const presetCache = vi.hoisted(() => new Map<string, BuildPayloadV5>());

vi.mock("@/lib/artifact-builds/buildPresetRegistry", () => ({
  cacheBuildPreset: vi.fn((id: string, payload: BuildPayloadV5) => {
    presetCache.set(id, payload);
    if (payload.id) presetCache.set(payload.id, payload);
  }),
  getCachedBuildPreset: vi.fn((id: string | null) =>
    id ? (presetCache.get(id) ?? null) : null
  ),
  loadBuildPreset: vi.fn((id: string) =>
    Promise.resolve(presetCache.get(id) ?? null)
  ),
}));

// Reset store before each test
beforeEach(() => {
  useBuildsStore.getState().clearAll();
  presetCache.clear();
});

describe("useBuildsStore", () => {
  describe("initial state", () => {
    it("starts with empty maps", () => {
      const state = useBuildsStore.getState();
      expect(state.deltas).toEqual([]);
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
    it("removes custom build without creating a preset tombstone", () => {
      const charId = "test-char";
      useBuildsStore.getState().newBuild(charId);
      const buildId = useBuildsStore.getState().getBuildIds(charId)[0];

      useBuildsStore.getState().deleteBuild(charId, buildId);

      expect(useBuildsStore.getState().getBuild(buildId)).toBeUndefined();
      expect(useBuildsStore.getState().getBuildIds(charId)).toHaveLength(0);
      expect(useBuildsStore.getState().presetDeletedBuildIds).toEqual([]);
      expect(useBuildsStore.getState().deltas).not.toContainEqual(
        expect.objectContaining({ id: buildId })
      );
    });
  });

  describe("revertBuild", () => {
    it("removes preset override while keeping ordering", () => {
      const charId = "test-char";
      const buildId = "preset-build";
      const presetBuild: Build = {
        id: buildId,
        characterId: charId,
        name: "Preset",
        visible: true,
        composition: "4pc",
        substats: [],
        sandsWeights: [],
        gobletWeights: [],
        circletWeights: [],
        normalizer: 0,
      };
      useBuildsStore.getState().subscribePreset("test-preset", {
        version: 5,
        id: "test-preset",
        author: "",
        description: "",
        builds: { [buildId]: presetBuild },
        characterBuilds: { [charId]: [buildId] },
        characterWeapons: {},
      });

      // Modify the build locally
      useBuildsStore
        .getState()
        .setBuild(buildId, { name: "Modified" }, presetBuild);
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
      const buildId = "preset-build";
      const presetBuild: Build = {
        id: buildId,
        characterId: charId,
        name: "Preset",
        visible: true,
        composition: "4pc",
        substats: [],
        sandsWeights: [],
        gobletWeights: [],
        circletWeights: [],
        normalizer: 0,
      };
      useBuildsStore.getState().subscribePreset("test-preset", {
        version: 5,
        id: "test-preset",
        author: "",
        description: "",
        builds: { [buildId]: presetBuild },
        characterBuilds: { [charId]: [buildId] },
        characterWeapons: {},
      });

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

    it("deduplicates on hydration and preserves the custom order index", () => {
      const state = useBuildsStore.getState();
      state.newBuild("char1");
      const customId = state.getBuildIds("char1")[0];
      state.setBuild(customId, { name: "Custom Build" });

      state.newBuild("char1");
      const duplicateId = state.getBuildIds("char1")[1];
      state.setBuild(duplicateId, {
        id: duplicateId,
        characterId: "char1",
        name: "Preset Build",
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
      });

      state.setActivePreset("test-preset");
      state.hydratePreset("test-preset", presetPayload);

      expect(useBuildsStore.getState().getBuildIds("char1")).toEqual([
        customId,
        "p-1",
      ]);
      expect(useBuildsStore.getState().deltas).toContainEqual({
        kind: "preset",
        id: "p-1",
        displayIndex: 1,
      });
      expect(useBuildsStore.getState().getBuild(duplicateId)).toBeUndefined();
    });

    it("keeps modified custom builds during hydration dedupe", () => {
      const state = useBuildsStore.getState();
      state.newBuild("char1");
      const customId = state.getBuildIds("char1")[0];
      state.setBuild(customId, {
        name: "Modified",
        visible: true,
        composition: "4pc",
        substats: [],
        sandsWeights: [],
        gobletWeights: [],
        circletWeights: [],
        normalizer: 0,
      });

      state.setActivePreset("test-preset");
      state.hydratePreset("test-preset", presetPayload);

      expect(useBuildsStore.getState().getBuildIds("char1")).toContain(
        customId
      );
      expect(useBuildsStore.getState().getBuild(customId)?.name).toBe(
        "Modified"
      );
    });

    it("resets presetDeletedBuildIds", () => {
      useBuildsStore.getState().subscribePreset("test-preset", presetPayload);
      useBuildsStore.getState().deleteBuild("char1", "p-1");
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
        halfSet1: "cryo%-15",
        halfSet2: "hp%-20",
      });
      expect(useBuildsStore.getState().getBuild(buildId)?.halfSet1).toBe(
        "cryo%-15"
      );

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
        halfSet1: "cryo%-15",
        halfSet2: "hp%-20",
      });

      const build = useBuildsStore.getState().getBuild(buildId);
      expect(build?.composition).toBe("2pc+2pc");
      expect(build?.artifactSet).toBeUndefined();
    });
  });

  describe("migration", () => {
    it("converts legacy build maps into preset deltas", () => {
      const customBuild: Build = {
        id: "custom-1",
        characterId: "char1",
        name: "Custom",
        visible: true,
        composition: "4pc",
        substats: [],
        sandsWeights: [],
        gobletWeights: [],
        circletWeights: [],
        normalizer: 0,
      };

      const migrated = migrateBuildsStore(
        {
          builds: { "custom-1": customBuild },
          characterToBuildIds: {
            char1: ["preset-1", "custom-1"],
          },
          presetDeletedBuildIds: ["preset-2"],
          validationErrors: {},
        },
        5
      );

      expect(migrated.deltas).toEqual(
        expect.arrayContaining([
          { kind: "preset", id: "preset-1", displayIndex: 0 },
          {
            kind: "custom",
            id: "custom-1",
            value: expect.objectContaining({ id: "custom-1" }),
            displayIndex: 1,
          },
          { kind: "preset", id: "preset-2", deleted: true },
        ])
      );
    });
  });
});
