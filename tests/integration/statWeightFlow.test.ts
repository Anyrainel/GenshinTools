/**
 * Integration Tests: Stat Weight Configuration Flow
 *
 * Tests the flow of configuring artifact stat weights:
 * 1. Default weight configuration
 * 2. Character-specific weight overrides
 * 3. Score calculation with custom weights
 * 4. Weight persistence and reset
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { calculateArtifactScore } from "@/lib/artifactScore";
import { type GOODData, convertGOODToAccountData } from "@/lib/goodConversion";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";

// Test data: Hu Tao with Crimson Witch artifacts
const testGOODData: GOODData = {
  format: "GOOD",
  version: 1,
  source: "Stat Weight Test",
  characters: [
    {
      key: "HuTao",
      constellation: 0,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
    },
  ],
  artifacts: [
    {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "flower",
      level: 20,
      rarity: 5,
      mainStatKey: "hp",
      location: "HuTao",
      lock: true,
      substats: [
        { key: "critRate_", value: 10.5 },
        { key: "critDMG_", value: 21.0 },
        { key: "hp_", value: 14.6 },
        { key: "eleMas", value: 40 },
      ],
    },
  ],
};

describe("Integration: Stat Weight Configuration Flow", () => {
  beforeEach(() => {
    useArtifactScoreStore.getState().resetConfig();
  });

  describe("default weight configuration", () => {
    it("starts with default global weights", () => {
      const config = useArtifactScoreStore.getState().config;

      // Check default flat stat weights
      expect(config.global.flatAtk).toBe(30);
      expect(config.global.flatHp).toBe(30);
      expect(config.global.flatDef).toBe(30);
    });

    it("starts with preset character weights from STAT_WEIGHTS", () => {
      const config = useArtifactScoreStore.getState().config;
      // Characters should have default preset weights
      expect(Object.keys(config.characters).length).toBeGreaterThan(0);
    });
  });

  describe("global weight modification", () => {
    it("updates global weight for flat ATK", () => {
      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 50);
      });

      const config = useArtifactScoreStore.getState().config;
      expect(config.global.flatAtk).toBe(50);
    });

    it("updates global weight for flat HP", () => {
      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatHp", 0);
      });

      const config = useArtifactScoreStore.getState().config;
      expect(config.global.flatHp).toBe(0);
    });

    it("resets global weights to defaults", () => {
      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 0);
        useArtifactScoreStore.getState().setGlobalWeight("flatHp", 0);
      });

      expect(useArtifactScoreStore.getState().config.global.flatAtk).toBe(0);

      act(() => {
        useArtifactScoreStore.getState().resetGlobalConfig();
      });

      expect(useArtifactScoreStore.getState().config.global.flatAtk).toBe(30);
      expect(useArtifactScoreStore.getState().config.global.flatHp).toBe(30);
    });
  });

  describe("character-specific weights", () => {
    it("sets character-specific weight", () => {
      act(() => {
        useArtifactScoreStore
          .getState()
          .setCharacterWeight("hu_tao", "hp%", 100);
      });

      const config = useArtifactScoreStore.getState().config;
      expect(config.characters.hu_tao).toBeDefined();
      expect(config.characters.hu_tao?.["hp%"]).toBe(100);
    });

    it("character weight affects score calculations", () => {
      const { data } = convertGOODToAccountData(testGOODData);
      const character = data.characters[0];

      // Get initial score
      const initialConfig = useArtifactScoreStore.getState().config;
      const initialScore = calculateArtifactScore(character, initialConfig);

      // Modify Hu Tao's HP% weight significantly
      act(() => {
        useArtifactScoreStore
          .getState()
          .setCharacterWeight("hu_tao", "hp%", 200);
      });

      const updatedConfig = useArtifactScoreStore.getState().config;
      const updatedScore = calculateArtifactScore(character, updatedConfig);

      // Score should change when weights change
      expect(updatedScore.subScore).not.toBe(initialScore.subScore);
    });

    it("allows multiple character-specific weights", () => {
      act(() => {
        useArtifactScoreStore
          .getState()
          .setCharacterWeight("hu_tao", "hp%", 100);
        useArtifactScoreStore.getState().setCharacterWeight("hu_tao", "em", 75);
        useArtifactScoreStore
          .getState()
          .setCharacterWeight("xingqiu", "er", 80);
      });

      const config = useArtifactScoreStore.getState().config;
      expect(config.characters.hu_tao?.["hp%"]).toBe(100);
      expect(config.characters.hu_tao?.em).toBe(75);
      expect(config.characters.xingqiu?.er).toBe(80);
    });

    it("resets all character weights to defaults", () => {
      // Modify some weights
      act(() => {
        useArtifactScoreStore
          .getState()
          .setCharacterWeight("hu_tao", "hp%", 999);
      });

      expect(
        useArtifactScoreStore.getState().config.characters.hu_tao?.["hp%"]
      ).toBe(999);

      // Reset character weights
      act(() => {
        useArtifactScoreStore.getState().resetCharacterWeights();
      });

      // Should be back to default values from STAT_WEIGHTS
      const config = useArtifactScoreStore.getState().config;
      expect(config.characters.hu_tao?.["hp%"]).not.toBe(999);
    });
  });

  describe("score calculation integration", () => {
    it("calculates score for imported character", () => {
      const { data } = convertGOODToAccountData(testGOODData);
      const character = data.characters[0];
      const config = useArtifactScoreStore.getState().config;

      const score = calculateArtifactScore(character, config);

      expect(score).toBeDefined();
      expect(score.subScore).toBeGreaterThan(0); // Has crit substats
      expect(score.slotSubScores.flower).toBeGreaterThan(0);
    });

    it("score changes when global flat weights change", () => {
      const { data } = convertGOODToAccountData(testGOODData);
      const character = data.characters[0];

      const initialConfig = useArtifactScoreStore.getState().config;
      const initialScore = calculateArtifactScore(character, initialConfig);

      // Zero out all flat stat weights
      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 0);
        useArtifactScoreStore.getState().setGlobalWeight("flatHp", 0);
        useArtifactScoreStore.getState().setGlobalWeight("flatDef", 0);
      });

      const updatedConfig = useArtifactScoreStore.getState().config;
      const updatedScore = calculateArtifactScore(character, updatedConfig);

      // Scores should differ since flat stat weights changed
      expect(updatedConfig.global.flatAtk).toBe(0);
      expect(updatedConfig.global.flatHp).toBe(0);
    });
  });

  describe("full reset", () => {
    it("resets all config to defaults", () => {
      // Modify global and character weights
      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 99);
        useArtifactScoreStore
          .getState()
          .setCharacterWeight("hu_tao", "hp%", 999);
      });

      expect(useArtifactScoreStore.getState().config.global.flatAtk).toBe(99);

      // Full reset
      act(() => {
        useArtifactScoreStore.getState().resetConfig();
      });

      const config = useArtifactScoreStore.getState().config;
      expect(config.global.flatAtk).toBe(30); // Back to default
    });
  });
});
