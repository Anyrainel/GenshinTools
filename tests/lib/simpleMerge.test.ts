import type {
  MainStatPlus,
  SetConfig,
  SlotConfig,
  SubStat,
} from "@/data/types";
import { DEFAULT_SIMPLE_MERGE_OPTIONS, simpleMerge } from "@/lib/simpleMerge";
import { describe, expect, it } from "vitest";

// Helper to create a slot config for testing
function createSlotConfig(overrides: Partial<SlotConfig> = {}): SlotConfig {
  return {
    mainStats: ["atk%"] as MainStatPlus[],
    substats: ["cr", "cd", "atk%", "er"] as SubStat[],
    mustPresent: ["cr", "cd"] as SubStat[],
    minStatCount: 4,
    ...overrides,
  };
}

// Helper to create a complete SetConfig for testing
function createSetConfig(overrides: Partial<SetConfig> = {}): SetConfig {
  return {
    flowerPlume: createSlotConfig(),
    sands: createSlotConfig(),
    goblet: createSlotConfig({ mainStats: ["anemo%"] as MainStatPlus[] }),
    circlet: createSlotConfig({ mainStats: ["cr"] as MainStatPlus[] }),
    servedCharacters: [
      {
        characterId: "kaedehara_kazuha",
        hasPerfectMerge: true,
        has4pcBuild: true,
      },
    ],
    ...overrides,
  };
}

describe("simpleMerge", () => {
  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      const result = simpleMerge([]);
      expect(result).toEqual([]);
    });

    it("returns single config unchanged for single-element input", () => {
      const config = createSetConfig();
      const result = simpleMerge([config]);

      expect(result.length).toBe(1);
      expect(result[0].servedCharacters[0].characterId).toBe(
        "kaedehara_kazuha"
      );
    });
  });

  describe("identical config merging", () => {
    it("merges two identical configs into one", () => {
      const config1 = createSetConfig();
      const config2 = createSetConfig({
        servedCharacters: [
          { characterId: "venti", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });

      const result = simpleMerge([config1, config2]);

      // Should merge into one config since substats/mustPresent/minStatCount are identical
      expect(result.length).toBe(1);
      // Both characters should be served
      expect(result[0].servedCharacters.length).toBe(2);
      expect(result[0].servedCharacters.map((c) => c.characterId)).toContain(
        "kaedehara_kazuha"
      );
      expect(result[0].servedCharacters.map((c) => c.characterId)).toContain(
        "venti"
      );
    });

    it("does not merge configs with different substats", () => {
      const config1 = createSetConfig();
      const config2 = createSetConfig({
        flowerPlume: createSlotConfig({
          substats: ["hp%", "def%", "em", "er"] as SubStat[],
          mustPresent: [] as SubStat[],
        }),
        sands: createSlotConfig({
          substats: ["hp%", "def%", "em", "er"] as SubStat[],
          mustPresent: [] as SubStat[],
        }),
        goblet: createSlotConfig({
          mainStats: ["anemo%"] as MainStatPlus[],
          substats: ["hp%", "def%", "em", "er"] as SubStat[],
          mustPresent: [] as SubStat[],
        }),
        circlet: createSlotConfig({
          mainStats: ["cr"] as MainStatPlus[],
          substats: ["hp%", "def%", "em", "er"] as SubStat[],
          mustPresent: [] as SubStat[],
        }),
        servedCharacters: [
          { characterId: "venti", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });

      const result = simpleMerge([config1, config2]);

      // Should NOT merge - different substats
      expect(result.length).toBe(2);
    });
  });

  describe("with default options", () => {
    it("only applies Step 1 (identical merge) with default options", () => {
      // Default options have mergeSingleFlexVariants=false and findRigidCommonSubset=false
      const config1 = createSetConfig();
      const config2 = createSetConfig({
        servedCharacters: [
          { characterId: "venti", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });

      const result = simpleMerge(
        [config1, config2],
        DEFAULT_SIMPLE_MERGE_OPTIONS
      );

      expect(result.length).toBe(1);
      expect(result[0].servedCharacters.length).toBe(2);
    });
  });

  describe("with mergeSingleFlexVariants enabled", () => {
    it("merges pick-one patterns with same mustPresent and k=|mustPresent|+1", () => {
      // Create two configs that match the pick-one pattern
      // k = 3, mustPresent = [cr, cd], so k = |mustPresent| + 1
      const createPickOneSlot = (
        extraSubstat: SubStat,
        mainStats: MainStatPlus[] = ["atk%"]
      ): SlotConfig => ({
        mainStats,
        substats: ["cr", "cd", extraSubstat] as SubStat[],
        mustPresent: ["cr", "cd"] as SubStat[],
        minStatCount: 3,
      });

      const config1 = createSetConfig({
        flowerPlume: createPickOneSlot("atk%"),
        sands: createPickOneSlot("atk%"),
        goblet: createPickOneSlot("atk%", ["anemo%"]),
        circlet: createPickOneSlot("atk%", ["cr"]),
        servedCharacters: [
          { characterId: "char1", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });

      const config2 = createSetConfig({
        flowerPlume: createPickOneSlot("er"),
        sands: createPickOneSlot("er"),
        goblet: createPickOneSlot("er", ["anemo%"]),
        circlet: createPickOneSlot("er", ["cr"]),
        servedCharacters: [
          { characterId: "char2", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });

      const result = simpleMerge([config1, config2], {
        mergeSingleFlexVariants: true,
        findRigidCommonSubset: false,
      });

      // Should merge since they have same mustPresent and k = |mustPresent| + 1
      expect(result.length).toBe(1);
      // The substats should now include both atk% and er
      expect(result[0].flowerPlume.substats).toContain("atk%");
      expect(result[0].flowerPlume.substats).toContain("er");
    });
  });

  describe("with findRigidCommonSubset enabled", () => {
    it("promotes rigid configs (n=k) that share k-1 common substats", () => {
      // Create rigid configs where n = k (all substats are required)
      // k = 2, so they need to share at least 1 common substat
      const createRigidSlot = (
        substats: SubStat[],
        mainStats: MainStatPlus[] = ["atk%"]
      ): SlotConfig => ({
        mainStats,
        substats,
        mustPresent: substats, // n = k (rigid)
        minStatCount: substats.length,
      });

      const config1 = createSetConfig({
        flowerPlume: createRigidSlot(["cr", "cd"]),
        sands: createRigidSlot(["cr", "cd"]),
        goblet: createRigidSlot(["cr", "cd"], ["anemo%"]),
        circlet: createRigidSlot(["cr", "cd"], ["cr"]),
        servedCharacters: [
          { characterId: "char1", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });

      const config2 = createSetConfig({
        flowerPlume: createRigidSlot(["cr", "atk%"]),
        sands: createRigidSlot(["cr", "atk%"]),
        goblet: createRigidSlot(["cr", "atk%"], ["anemo%"]),
        circlet: createRigidSlot(["cr", "atk%"], ["cr"]),
        servedCharacters: [
          { characterId: "char2", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });

      const result = simpleMerge([config1, config2], {
        mergeSingleFlexVariants: false,
        findRigidCommonSubset: true,
      });

      // Should merge since they share 1 common substat (cr) and k=2
      expect(result.length).toBe(1);
      // The result should have the common subset (cr) as mustPresent
      expect(result[0].flowerPlume.mustPresent).toContain("cr");
    });
  });

  describe("served characters metadata", () => {
    it("preserves hasPerfectMerge as AND of merged configs", () => {
      const config1 = createSetConfig({
        servedCharacters: [
          { characterId: "char1", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });
      const config2 = createSetConfig({
        servedCharacters: [
          { characterId: "char1", hasPerfectMerge: false, has4pcBuild: true },
        ],
      });

      const result = simpleMerge([config1, config2]);

      // Same character merged - hasPerfectMerge should be false (AND of true, false)
      expect(result.length).toBe(1);
      const char1 = result[0].servedCharacters.find(
        (c) => c.characterId === "char1"
      );
      expect(char1?.hasPerfectMerge).toBe(false);
    });

    it("preserves has4pcBuild as OR of merged configs", () => {
      const config1 = createSetConfig({
        servedCharacters: [
          { characterId: "char1", hasPerfectMerge: true, has4pcBuild: false },
        ],
      });
      const config2 = createSetConfig({
        servedCharacters: [
          { characterId: "char1", hasPerfectMerge: true, has4pcBuild: true },
        ],
      });

      const result = simpleMerge([config1, config2]);

      // Same character merged - has4pcBuild should be true (OR of false, true)
      expect(result.length).toBe(1);
      const char1 = result[0].servedCharacters.find(
        (c) => c.characterId === "char1"
      );
      expect(char1?.has4pcBuild).toBe(true);
    });
  });
});
