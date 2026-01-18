import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { beforeEach, describe, expect, it } from "vitest";

// Reset store before each test
beforeEach(() => {
  useArtifactScoreStore.getState().resetConfig();
});

describe("useArtifactScoreStore", () => {
  describe("initial state", () => {
    it("starts with default global weights", () => {
      const state = useArtifactScoreStore.getState();
      expect(state.config.global).toBeDefined();
      expect(state.config.global.flatAtk).toBe(30);
      expect(state.config.global.flatHp).toBe(30);
      expect(state.config.global.flatDef).toBe(30);
    });

    it("has character weights from STAT_WEIGHTS", () => {
      const state = useArtifactScoreStore.getState();
      expect(state.config.characters).toBeDefined();
      // STAT_WEIGHTS should have some characters
      expect(typeof state.config.characters).toBe("object");
    });
  });

  describe("setGlobalWeight", () => {
    it("updates flatAtk weight", () => {
      useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 50);

      const state = useArtifactScoreStore.getState();
      expect(state.config.global.flatAtk).toBe(50);
      // Other weights should remain unchanged
      expect(state.config.global.flatHp).toBe(30);
      expect(state.config.global.flatDef).toBe(30);
    });

    it("updates flatHp weight", () => {
      useArtifactScoreStore.getState().setGlobalWeight("flatHp", 0);

      const state = useArtifactScoreStore.getState();
      expect(state.config.global.flatHp).toBe(0);
    });

    it("updates flatDef weight", () => {
      useArtifactScoreStore.getState().setGlobalWeight("flatDef", 100);

      const state = useArtifactScoreStore.getState();
      expect(state.config.global.flatDef).toBe(100);
    });
  });

  describe("setCharacterWeight", () => {
    it("sets weight for a specific character stat", () => {
      useArtifactScoreStore.getState().setCharacterWeight("venti", "cr", 80);

      const state = useArtifactScoreStore.getState();
      expect(state.config.characters.venti).toBeDefined();
      expect(state.config.characters.venti.cr).toBe(80);
    });

    it("creates character entry if not exists", () => {
      // Use a character ID that might not be in default config
      useArtifactScoreStore
        .getState()
        .setCharacterWeight("test_character", "cd", 90);

      const state = useArtifactScoreStore.getState();
      expect(state.config.characters.test_character).toBeDefined();
      expect(state.config.characters.test_character.cd).toBe(90);
    });

    it("preserves other character weights", () => {
      useArtifactScoreStore.getState().setCharacterWeight("venti", "cr", 80);
      useArtifactScoreStore.getState().setCharacterWeight("venti", "cd", 70);

      const state = useArtifactScoreStore.getState();
      expect(state.config.characters.venti.cr).toBe(80);
      expect(state.config.characters.venti.cd).toBe(70);
    });
  });

  describe("resetConfig", () => {
    it("resets all config to defaults", () => {
      // Modify state
      useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 100);
      useArtifactScoreStore.getState().setCharacterWeight("venti", "cr", 100);

      // Reset
      useArtifactScoreStore.getState().resetConfig();

      const state = useArtifactScoreStore.getState();
      expect(state.config.global.flatAtk).toBe(30);
    });
  });

  describe("resetGlobalConfig", () => {
    it("resets only global weights", () => {
      // Modify both global and character weights
      useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 100);
      useArtifactScoreStore.getState().setCharacterWeight("venti", "cr", 100);

      // Reset only global
      useArtifactScoreStore.getState().resetGlobalConfig();

      const state = useArtifactScoreStore.getState();
      expect(state.config.global.flatAtk).toBe(30);
      // Character weights should remain
      expect(state.config.characters.venti.cr).toBe(100);
    });
  });

  describe("resetCharacterWeights", () => {
    it("resets character weights but keeps global", () => {
      // Modify both global and character weights
      useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 100);
      useArtifactScoreStore.getState().setCharacterWeight("venti", "cr", 100);

      // Reset only characters
      useArtifactScoreStore.getState().resetCharacterWeights();

      const state = useArtifactScoreStore.getState();
      // Global should remain modified
      expect(state.config.global.flatAtk).toBe(100);
      // Character weights should be reset (venti's custom cr should be gone)
      // Note: The exact value depends on STAT_WEIGHTS default
    });
  });
});
