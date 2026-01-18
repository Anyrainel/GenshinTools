import { useBuildsStore } from "@/stores/useBuildsStore";
import { beforeEach, describe, expect, it } from "vitest";

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
      expect(state.hiddenCharacters).toEqual({});
    });

    it("has default compute options", () => {
      const state = useBuildsStore.getState();
      expect(state.computeOptions).toBeDefined();
      expect(state.computeOptions.skipCritBuilds).toBe(false);
    });
  });

  describe("newBuild", () => {
    it("creates a new build with generated ID", () => {
      useBuildsStore.getState().newBuild("test-character");

      const state = useBuildsStore.getState();
      const buildIds = state.getCharacterBuildIds("test-character");
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
      const buildIds = state.getCharacterBuildIds(characterId);
      expect(buildIds.length).toBe(2);
    });

    it("generates unique IDs for each build", async () => {
      const characterId = "test-character";

      useBuildsStore.getState().newBuild(characterId);
      // Small delay to ensure unique timestamp-based IDs
      await new Promise((resolve) => setTimeout(resolve, 5));
      useBuildsStore.getState().newBuild(characterId);

      const state = useBuildsStore.getState();
      const buildIds = state.getCharacterBuildIds(characterId);
      expect(buildIds[0]).not.toBe(buildIds[1]);
    });
  });

  describe("setBuild", () => {
    it("updates build properties", () => {
      const state = useBuildsStore.getState();
      const characterId = "test-character";

      state.newBuild(characterId);
      const buildId = state.getCharacterBuildIds(characterId)[0];

      state.setBuild(buildId, { name: "Updated Name" });

      const build = state.getBuild(buildId);
      expect(build?.name).toBe("Updated Name");
    });

    it("preserves other properties when partially updating", () => {
      const state = useBuildsStore.getState();
      const characterId = "test-character";

      state.newBuild(characterId);
      const buildId = state.getCharacterBuildIds(characterId)[0];
      const originalBuild = state.getBuild(buildId);

      state.setBuild(buildId, { name: "New Name" });

      const updatedBuild = state.getBuild(buildId);
      expect(updatedBuild?.characterId).toBe(originalBuild?.characterId);
    });
  });

  describe("removeBuild", () => {
    it("removes build from store", () => {
      const state = useBuildsStore.getState();
      const characterId = "test-character";

      state.newBuild(characterId);
      const buildId = state.getCharacterBuildIds(characterId)[0];

      state.removeBuild(characterId, buildId);

      expect(state.getBuild(buildId)).toBeUndefined();
      expect(state.getCharacterBuildIds(characterId).length).toBe(0);
    });
  });

  describe("copyBuild", () => {
    it("creates a copy of existing build with same properties", async () => {
      const characterId = "test-character";

      // Create initial build
      useBuildsStore.getState().newBuild(characterId);
      let state = useBuildsStore.getState();
      const originalId = state.getCharacterBuildIds(characterId)[0];

      // Set name and copy (with delay to ensure unique timestamp-based ID)
      useBuildsStore.getState().setBuild(originalId, { name: "Original" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      useBuildsStore.getState().copyBuild(characterId, originalId);

      // Re-fetch state after mutations
      state = useBuildsStore.getState();
      const buildIds = state.getCharacterBuildIds(characterId);
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
      useBuildsStore.getState().setComputeOptions({ skipCritBuilds: true });

      const state = useBuildsStore.getState();
      expect(state.computeOptions.skipCritBuilds).toBe(true);
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
      expect(state.description).toBe("Test Description");
    });
  });
});
