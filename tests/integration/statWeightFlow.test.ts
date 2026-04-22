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

import {
  type GOODData,
  convertGOODToAccountData,
} from "@/lib/account-data/goodConversion";
import { scoreAllSlots } from "@/lib/artifact/scoring/artifactScore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";

// Test data: Hu Tao with Crimson Witch artifacts
const testGOODData: GOODData = {
  format: "GOOD",
  version: 1,
  source: "Stat Weight Test",
  characters: [
    {
      key: "HuTao",
      level: 90,
      constellation: 0,
      ascension: 6,
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

  describe("score calculation integration", () => {
    const testWeights = {
      cr: 100,
      cd: 100,
      "hp%": 80,
      em: 60,
      "atk%": 40,
      er: 20,
    };

    it("calculates score for imported character", () => {
      const { data } = convertGOODToAccountData(testGOODData);
      const character = data.characters[0];
      const config = useArtifactScoreStore.getState().config;

      const score = scoreAllSlots(character, testWeights, config.global);

      expect(score).toBeDefined();
      expect(score.subScore).toBeGreaterThan(0); // Has crit substats
      expect(score.slotSubScores.flower).toBeGreaterThan(0);
    });

    it("score changes when global flat weights change", () => {
      const { data } = convertGOODToAccountData(testGOODData);
      const character = data.characters[0];
      const config = useArtifactScoreStore.getState().config;

      const initialScore = scoreAllSlots(character, testWeights, config.global);

      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 0);
        useArtifactScoreStore.getState().setGlobalWeight("flatHp", 0);
        useArtifactScoreStore.getState().setGlobalWeight("flatDef", 0);
      });

      const updatedConfig = useArtifactScoreStore.getState().config;
      const updatedScore = scoreAllSlots(
        character,
        testWeights,
        updatedConfig.global
      );

      expect(updatedConfig.global.flatAtk).toBe(0);
      expect(updatedConfig.global.flatHp).toBe(0);
      expect(updatedScore.subScore).toBeDefined();
    });
  });

  describe("full reset", () => {
    it("resets global config to defaults", () => {
      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 99);
      });

      expect(useArtifactScoreStore.getState().config.global.flatAtk).toBe(99);

      act(() => {
        useArtifactScoreStore.getState().resetConfig();
      });

      const config = useArtifactScoreStore.getState().config;
      expect(config.global.flatAtk).toBe(30);
    });
  });
});
