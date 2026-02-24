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

  describe("resetConfig", () => {
    it("resets global config to defaults", () => {
      useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 100);
      useArtifactScoreStore.getState().resetConfig();

      const state = useArtifactScoreStore.getState();
      expect(state.config.global.flatAtk).toBe(30);
    });
  });

  describe("resetGlobalConfig", () => {
    it("resets only global weights", () => {
      useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 100);
      useArtifactScoreStore.getState().resetGlobalConfig();

      const state = useArtifactScoreStore.getState();
      expect(state.config.global.flatAtk).toBe(30);
    });
  });
});
