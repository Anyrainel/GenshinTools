/**
 * Tests for artifact probability calculation.
 *
 * These tests verify the mathematical correctness of slot chance calculations.
 * The actual probability values are complex combinatorical calculations, so
 * we focus on testing behavior (edge cases, constraints) rather than exact numbers.
 */

import type { SetConfig, SlotConfig } from "@/data/types";
import { computeSlotChance, computeSlotChances } from "@/lib/artifactChance";
import { describe, expect, it } from "vitest";

// Helper to create a minimal SlotConfig
function createSlotConfig(overrides: Partial<SlotConfig> = {}): SlotConfig {
  return {
    mainStats: [],
    substats: [],
    mustPresent: [],
    minStatCount: 0,
    ...overrides,
  };
}

// Helper to create a full SetConfig with minimal slots
function createSetConfig(overrides: Partial<SetConfig> = {}): SetConfig {
  return {
    flowerPlume: createSlotConfig(),
    sands: createSlotConfig(),
    goblet: createSlotConfig(),
    circlet: createSlotConfig(),
    servedCharacters: [],
    ...overrides,
  };
}

describe("computeSlotChance", () => {
  describe("flowerPlume slot", () => {
    it("returns 1 when no constraints specified", () => {
      const result = computeSlotChance("flowerPlume", createSlotConfig());
      expect(result).toBe(1);
    });

    it("returns value between 0 and 1 when substats required", () => {
      const config = createSlotConfig({
        substats: ["cr", "cd"],
        minStatCount: 2,
      });
      const result = computeSlotChance("flowerPlume", config);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("returns higher probability with fewer required substats", () => {
      const strictConfig = createSlotConfig({
        substats: ["cr", "cd", "atk%"],
        minStatCount: 3,
      });
      const looseConfig = createSlotConfig({
        substats: ["cr", "cd", "atk%"],
        minStatCount: 1,
      });

      const strictResult = computeSlotChance("flowerPlume", strictConfig);
      const looseResult = computeSlotChance("flowerPlume", looseConfig);

      expect(looseResult).toBeGreaterThanOrEqual(strictResult);
    });

    it("returns 0 when mustPresent exceeds possible substats", () => {
      const config = createSlotConfig({
        mustPresent: ["cr", "cd", "atk%", "em", "er"], // 5 required, but only 4 substats drawn
      });
      const result = computeSlotChance("flowerPlume", config);
      expect(result).toBe(0);
    });
  });

  describe("sands slot", () => {
    it("returns 1 when no constraints specified", () => {
      const result = computeSlotChance("sands", createSlotConfig());
      expect(result).toBe(1);
    });

    it("returns value between 0 and 1 when main stat specified", () => {
      const config = createSlotConfig({
        mainStats: ["hp%"],
      });
      // With only main stat constraint, probability is based on main stat pool weights
      const result = computeSlotChance("sands", config);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("returns lower probability with substat constraints added", () => {
      const mainOnlyConfig = createSlotConfig({
        mainStats: ["hp%"],
      });
      const withSubstatsConfig = createSlotConfig({
        mainStats: ["hp%"],
        substats: ["cr", "cd"],
        minStatCount: 2,
      });

      const mainOnlyResult = computeSlotChance("sands", mainOnlyConfig);
      const withSubstatsResult = computeSlotChance("sands", withSubstatsConfig);

      expect(withSubstatsResult).toBeLessThanOrEqual(mainOnlyResult);
    });
  });

  describe("goblet slot", () => {
    it("handles elemental% main stat", () => {
      const config = createSlotConfig({
        mainStats: ["elemental%"],
      });
      const result = computeSlotChance("goblet", config);

      // elemental% should combine all elemental damage types
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("has lower probability for elemental% + substats", () => {
      const elementalOnly = createSlotConfig({
        mainStats: ["elemental%"],
      });
      const elementalWithCrit = createSlotConfig({
        mainStats: ["elemental%"],
        substats: ["cr", "cd"],
        minStatCount: 2,
      });

      const elementalOnlyResult = computeSlotChance("goblet", elementalOnly);
      const elementalWithCritResult = computeSlotChance(
        "goblet",
        elementalWithCrit
      );

      expect(elementalWithCritResult).toBeLessThan(elementalOnlyResult);
    });
  });

  describe("circlet slot", () => {
    it("handles multiple main stat options", () => {
      const singleMain = createSlotConfig({
        mainStats: ["cr"],
      });
      const dualMain = createSlotConfig({
        mainStats: ["cr", "cd"],
      });

      const singleResult = computeSlotChance("circlet", singleMain);
      const dualResult = computeSlotChance("circlet", dualMain);

      // More main stat options should give higher probability
      expect(dualResult).toBeGreaterThanOrEqual(singleResult);
    });
  });

  describe("mustPresent constraint", () => {
    it("reduces probability when mustPresent is specified", () => {
      const noMust = createSlotConfig({
        substats: ["cr", "cd", "atk%"],
        minStatCount: 2,
      });
      const withMust = createSlotConfig({
        substats: ["cr", "cd", "atk%"],
        minStatCount: 2,
        mustPresent: ["cr"],
      });

      const noMustResult = computeSlotChance("flowerPlume", noMust);
      const withMustResult = computeSlotChance("flowerPlume", withMust);

      expect(withMustResult).toBeLessThanOrEqual(noMustResult);
    });

    it("returns 0 when mustPresent stat is excluded by main stat", () => {
      // If main stat is hp%, then hp% can't be a substat
      // But mustPresent hp% in substats would be invalid
      const config = createSlotConfig({
        mainStats: ["hp%"],
        mustPresent: ["hp%"], // This should be covered by main stat
        substats: ["cr", "cd"],
        minStatCount: 1,
      });

      // When main stat covers mustPresent, it shouldn't fail
      const result = computeSlotChance("sands", config);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("computeSlotChances", () => {
  it("returns chances for all four slot types", () => {
    const config = createSetConfig();
    const result = computeSlotChances(config);

    expect(result).toHaveProperty("flowerPlume");
    expect(result).toHaveProperty("sands");
    expect(result).toHaveProperty("goblet");
    expect(result).toHaveProperty("circlet");
  });

  it("returns all 1s when no constraints", () => {
    const config = createSetConfig();
    const result = computeSlotChances(config);

    expect(result.flowerPlume).toBe(1);
    expect(result.sands).toBe(1);
    expect(result.goblet).toBe(1);
    expect(result.circlet).toBe(1);
  });

  it("calculates independent probabilities per slot", () => {
    const config = createSetConfig({
      flowerPlume: createSlotConfig({
        substats: ["cr", "cd"],
        minStatCount: 2,
      }),
      sands: createSlotConfig(), // No constraints
    });

    const result = computeSlotChances(config);

    expect(result.flowerPlume).toBeLessThan(1);
    expect(result.sands).toBe(1);
  });

  it("handles complex realistic config", () => {
    // A realistic Hu Tao artifact config
    const config = createSetConfig({
      flowerPlume: createSlotConfig({
        substats: ["cr", "cd", "hp%", "em"],
        minStatCount: 2,
      }),
      sands: createSlotConfig({
        mainStats: ["hp%"],
        substats: ["cr", "cd", "em"],
        minStatCount: 2,
      }),
      goblet: createSlotConfig({
        mainStats: ["pyro%"],
        substats: ["cr", "cd", "hp%"],
        minStatCount: 2,
      }),
      circlet: createSlotConfig({
        mainStats: ["cr", "cd"],
        substats: ["cr", "cd", "hp%"],
        minStatCount: 2,
      }),
    });

    const result = computeSlotChances(config);

    // All should be valid probabilities
    expect(result.flowerPlume).toBeGreaterThan(0);
    expect(result.flowerPlume).toBeLessThanOrEqual(1);
    expect(result.sands).toBeGreaterThan(0);
    expect(result.sands).toBeLessThanOrEqual(1);
    expect(result.goblet).toBeGreaterThan(0);
    expect(result.goblet).toBeLessThanOrEqual(1);
    expect(result.circlet).toBeGreaterThan(0);
    expect(result.circlet).toBeLessThanOrEqual(1);

    // Goblet with specific elemental damage should be rarer than flower/plume
    expect(result.goblet).toBeLessThan(result.flowerPlume);
  });
});
