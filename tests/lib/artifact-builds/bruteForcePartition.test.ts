import { describe, expect, it } from "vitest";
import type { MainStatPlus, SubStat } from "@/data/enums";
import type { BuildConfig, SlotConfig } from "@/data/types";
import {
  bruteForcePartition,
  bruteForcePartitionAsync,
} from "@/lib/artifact-builds/bruteForcePartition";

function makeSlot(
  substats: SubStat[],
  mustPresent: SubStat[],
  minStatCount: number,
  mainStats: MainStatPlus[] = []
): SlotConfig {
  return { mainStats, substats, mustPresent, minStatCount };
}

function makeConfig(
  substats: SubStat[],
  mustPresent: SubStat[],
  minStatCount: number,
  characterId: string
): BuildConfig {
  const slot = makeSlot(substats, mustPresent, minStatCount);
  return {
    flowerPlume: { ...slot },
    sands: { ...slot, mainStats: ["atk%"] },
    goblet: { ...slot, mainStats: ["anemo%"] },
    circlet: { ...slot, mainStats: ["cr"] },
    servedCharacters: [
      { characterId, hasPerfectMerge: true, has4pcBuild: true },
    ],
  };
}

describe("bruteForcePartition", () => {
  it("returns empty for empty input", () => {
    expect(bruteForcePartition([])).toEqual([]);
  });

  it("returns single config unchanged", () => {
    const input = [makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "a")];
    const result = bruteForcePartition(input);
    expect(result).toHaveLength(1);
  });

  it("merges identical configs into one", () => {
    const a = makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "a");
    const b = makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "b");
    const result = bruteForcePartition([a, b]);
    // Identical fingerprints → coalesced → single config
    expect(result).toHaveLength(1);
  });

  it("keeps highly incompatible configs separate when split improves worst-case", () => {
    // Disjoint substat pools force a split
    const a = makeConfig(["cr", "cd"], ["cr", "cd"], 2, "a");
    const b = makeConfig(["hp%", "def%"], ["hp%", "def%"], 2, "b");
    const result = bruteForcePartition([a, b]);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("result length never exceeds min(input.length, 3)", () => {
    const a = makeConfig(["cr", "cd", "atk%", "er"], ["cr", "cd"], 3, "a");
    const b = makeConfig(["cr", "cd", "atk%", "em"], ["cr", "cd"], 3, "b");
    const result = bruteForcePartition([a, b]);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("output never exceeds 3 configs (in-game loadout cap)", () => {
    const configs = [
      makeConfig(["cr", "cd", "atk%"], ["cr"], 2, "a"),
      makeConfig(["cr", "cd", "hp%"], ["cr"], 2, "b"),
      makeConfig(["cr", "cd", "def%"], ["cr"], 2, "c"),
      makeConfig(["cr", "cd", "em"], ["cr"], 2, "d"),
    ];
    const result = bruteForcePartition(configs);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe("bruteForcePartitionAsync", () => {
  it("produces same result as sync version", async () => {
    const a = makeConfig(["cr", "cd", "atk%"], ["cr", "cd"], 3, "a");
    const b = makeConfig(["hp%", "def%", "em"], ["hp%", "def%"], 3, "b");
    const ac = new AbortController();

    const syncResult = bruteForcePartition([a, b]);
    const asyncResult = await bruteForcePartitionAsync([a, b], ac.signal);

    expect(asyncResult).toHaveLength(syncResult.length);
  });

  it("throws on pre-aborted signal", async () => {
    const a = makeConfig(["cr", "cd", "atk%"], ["cr"], 2, "a");
    const b = makeConfig(["hp%", "def%", "em"], ["hp%"], 2, "b");
    const ac = new AbortController();
    ac.abort();

    await expect(bruteForcePartitionAsync([a, b], ac.signal)).rejects.toThrow(
      "Aborted"
    );
  });

  it("passes through single config without checking abort", async () => {
    const ac = new AbortController();
    ac.abort(); // Even though aborted, single config bypasses the loop
    const input = [makeConfig(["cr", "cd"], ["cr"], 2, "a")];
    const result = await bruteForcePartitionAsync(input, ac.signal);
    expect(result).toHaveLength(1);
  });
});
