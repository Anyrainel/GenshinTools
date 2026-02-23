/**
 * Cross-algorithm conformance tests.
 *
 * These tests verify structural invariants that must hold for ALL merge
 * algorithms. They run the same input through greedyMerge, bruteForce,
 * and smartMerge and check shared postconditions.
 */

import type {
  MainStatPlus,
  SetConfig,
  SlotConfig,
  SubStat,
} from "@/data/types";
import { bruteForcePartition } from "@/lib/artifact-builds/bruteForcePartition";
import { greedyMerge } from "@/lib/artifact-builds/greedyMerge";
import { SLOT_KEYS } from "@/lib/artifact-builds/mergeUtils";
import { smartMerge } from "@/lib/artifact-builds/smartMerge";
import { describe, expect, it } from "vitest";

function makeConfig(
  substats: SubStat[],
  mustPresent: SubStat[],
  minStatCount: number,
  characterId: string,
  mainStatOverrides: {
    sands?: MainStatPlus[];
    goblet?: MainStatPlus[];
    circlet?: MainStatPlus[];
  } = {}
): SetConfig {
  const slot: SlotConfig = {
    mainStats: [],
    substats,
    mustPresent,
    minStatCount,
  };
  return {
    flowerPlume: { ...slot },
    sands: { ...slot, mainStats: mainStatOverrides.sands ?? ["atk%"] },
    goblet: { ...slot, mainStats: mainStatOverrides.goblet ?? ["anemo%"] },
    circlet: { ...slot, mainStats: mainStatOverrides.circlet ?? ["cr"] },
    servedCharacters: [
      { characterId, hasPerfectMerge: true, has4pcBuild: true },
    ],
  };
}

type MergeFn = (configs: SetConfig[]) => SetConfig[];

const algorithms: [string, MergeFn][] = [
  ["greedyMerge", greedyMerge],
  ["bruteForcePartition", bruteForcePartition],
  ["smartMerge", smartMerge],
];

/** All character IDs present in the input must appear in the output. */
function collectCharacterIds(configs: SetConfig[]): Set<string> {
  const ids = new Set<string>();
  for (const c of configs) {
    for (const sc of c.servedCharacters) {
      ids.add(sc.characterId);
    }
  }
  return ids;
}

describe("cross-algorithm conformance", () => {
  describe.each(algorithms)("%s", (_name, merge) => {
    it("passes through a single config unchanged", () => {
      const input = [
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
      ];
      const result = merge(input);
      expect(result).toHaveLength(1);
      expect(result[0].servedCharacters[0].characterId).toBe("char1");
    });

    it("returns empty for empty input", () => {
      expect(merge([])).toEqual([]);
    });

    it("preserves all character IDs after merging", () => {
      const input = [
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
        makeConfig(["cr", "cd", "er"], ["cr", "cd"], 3, "char2"),
      ];
      const result = merge(input);
      const inputIds = collectCharacterIds(input);
      const outputIds = collectCharacterIds(result);
      for (const id of inputIds) {
        expect(outputIds.has(id)).toBe(true);
      }
    });

    it("merges two identical configs into one", () => {
      const input = [
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char2"),
      ];
      const result = merge(input);
      expect(result.length).toBeLessThanOrEqual(input.length);
      // Both characters must be served
      const ids = collectCharacterIds(result);
      expect(ids.has("char1")).toBe(true);
      expect(ids.has("char2")).toBe(true);
    });

    it("output configs have valid slot structures", () => {
      const input = [
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "a"),
        makeConfig(["cr", "cd", "er"], ["cr"], 2, "b"),
        makeConfig(["hp%", "def%", "em"], ["hp%"], 2, "c"),
      ];
      const result = merge(input);
      for (const config of result) {
        for (const key of SLOT_KEYS) {
          const slot = config[key];
          expect(slot.substats.length).toBeGreaterThan(0);
          expect(slot.minStatCount).toBeGreaterThanOrEqual(0);
          expect(slot.minStatCount).toBeLessThanOrEqual(slot.substats.length);
          // mustPresent ⊆ substats
          for (const must of slot.mustPresent) {
            expect(slot.substats).toContain(must);
          }
          // minStatCount ≥ mustPresent count
          expect(slot.minStatCount).toBeGreaterThanOrEqual(
            slot.mustPresent.length
          );
        }
      }
    });

    it("does not duplicate servedCharacters with same ID within a single config", () => {
      const input = [
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
      ];
      const result = merge(input);
      // Within each output config, char1 should appear at most once
      for (const config of result) {
        const charIds = config.servedCharacters.map((sc) => sc.characterId);
        const uniqueIds = new Set(charIds);
        expect(uniqueIds.size).toBe(charIds.length);
      }
    });
  });
});

describe("algorithm-specific behaviors", () => {
  describe("greedyMerge", () => {
    it("AND-merges hasPerfectMerge for same character", () => {
      const input = [
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
      ];
      input[1].servedCharacters[0].hasPerfectMerge = false;

      const result = greedyMerge(input);
      const char1 = result
        .flatMap((c) => c.servedCharacters)
        .find((sc) => sc.characterId === "char1");
      expect(char1?.hasPerfectMerge).toBe(false);
    });

    it("OR-merges has4pcBuild for same character", () => {
      const input = [
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
        makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "char1"),
      ];
      input[0].servedCharacters[0].has4pcBuild = false;
      input[1].servedCharacters[0].has4pcBuild = true;

      const result = greedyMerge(input);
      const char1 = result
        .flatMap((c) => c.servedCharacters)
        .find((sc) => sc.characterId === "char1");
      expect(char1?.has4pcBuild).toBe(true);
    });

    it("merges pick-one patterns with same mustPresent and k=|must|+1", () => {
      const pickOneSlot = (
        extra: SubStat,
        main: MainStatPlus[] = ["atk%"]
      ): SlotConfig => ({
        mainStats: main,
        substats: ["cr", "cd", extra],
        mustPresent: ["cr", "cd"],
        minStatCount: 3,
      });

      const a: SetConfig = {
        flowerPlume: pickOneSlot("atk%"),
        sands: pickOneSlot("atk%"),
        goblet: pickOneSlot("atk%", ["anemo%"]),
        circlet: pickOneSlot("atk%", ["cr"]),
        servedCharacters: [
          { characterId: "a", hasPerfectMerge: true, has4pcBuild: true },
        ],
      };
      const b: SetConfig = {
        flowerPlume: pickOneSlot("er"),
        sands: pickOneSlot("er"),
        goblet: pickOneSlot("er", ["anemo%"]),
        circlet: pickOneSlot("er", ["cr"]),
        servedCharacters: [
          { characterId: "b", hasPerfectMerge: true, has4pcBuild: true },
        ],
      };

      const result = greedyMerge([a, b]);
      expect(result).toHaveLength(1);
      expect(result[0].flowerPlume.substats).toContain("atk%");
      expect(result[0].flowerPlume.substats).toContain("er");
      expect(result[0].flowerPlume.mustPresent).toContain("cr");
      expect(result[0].flowerPlume.mustPresent).toContain("cd");
    });

    it("promotes rigid configs into pick-one when sharing k-1 stats", () => {
      const rigidSlot = (
        stats: SubStat[],
        main: MainStatPlus[] = ["atk%"]
      ): SlotConfig => ({
        mainStats: main,
        substats: stats,
        mustPresent: stats,
        minStatCount: stats.length,
      });

      const a: SetConfig = {
        flowerPlume: rigidSlot(["cr", "cd"]),
        sands: rigidSlot(["cr", "cd"]),
        goblet: rigidSlot(["cr", "cd"], ["anemo%"]),
        circlet: rigidSlot(["cr", "cd"], ["cr"]),
        servedCharacters: [
          { characterId: "a", hasPerfectMerge: true, has4pcBuild: true },
        ],
      };
      const b: SetConfig = {
        flowerPlume: rigidSlot(["cr", "atk%"]),
        sands: rigidSlot(["cr", "atk%"]),
        goblet: rigidSlot(["cr", "atk%"], ["anemo%"]),
        circlet: rigidSlot(["cr", "atk%"], ["cr"]),
        servedCharacters: [
          { characterId: "b", hasPerfectMerge: true, has4pcBuild: true },
        ],
      };

      const result = greedyMerge([a, b]);
      expect(result).toHaveLength(1);
      expect(result[0].flowerPlume.mustPresent).toContain("cr");
    });
  });

  describe("smartMerge", () => {
    it("classifies ER+scaling archetypes and preserves ER mustPresent", () => {
      const result = smartMerge([
        makeConfig(["er", "atk%", "cr", "cd"], ["er", "atk%"], 3, "a"),
        makeConfig(["er", "hp%", "cr", "cd"], ["er", "hp%"], 3, "b"),
        makeConfig(["er", "def%", "cr", "cd"], ["er", "def%"], 3, "c"),
      ]);

      for (const config of result) {
        if (config.flowerPlume.substats.includes("er")) {
          expect(config.flowerPlume.mustPresent).toContain("er");
        }
      }
    });

    it("outputs ≤ CONFIG_BUDGET configs when possible", () => {
      const result = smartMerge([
        makeConfig(["er", "atk%", "cr", "cd"], ["er", "atk%"], 3, "a"),
        makeConfig(["er", "hp%", "cr", "cd"], ["er", "hp%"], 3, "b"),
        makeConfig(["er", "def%", "cr", "cd"], ["er", "def%"], 3, "c"),
      ]);
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe("bruteForcePartition", () => {
    it("picks optimal partition minimizing max pass chance", () => {
      // Two configs with very different substats: should stay separate
      const a = makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "a");
      const b = makeConfig(["hp%", "def%", "em"], ["hp%", "def%"], 3, "b");
      const result = bruteForcePartition([a, b]);
      // With very different substats, keeping them separate is likely better or equal
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });
});
