import type {
  MainStatPlus,
  SetConfig,
  SlotConfig,
  SubStat,
} from "@/data/types";
import {
  SLOT_KEYS,
  areArraysEqualIgnoreOrder,
  areSlotsStructurallyEqual,
  cloneConfig,
  cloneSlot,
  dedupe,
  intersection,
  mergeConfigGroup,
  mergeConfigMetadata,
  orderedUnion,
  reorderSubstats,
  slotFingerprint,
} from "@/lib/artifact-builds/mergeUtils";
import { describe, expect, it } from "vitest";

function makeSlot(overrides: Partial<SlotConfig> = {}): SlotConfig {
  return {
    mainStats: ["atk%"] as MainStatPlus[],
    substats: ["cr", "cd", "atk%"] as SubStat[],
    mustPresent: ["cr", "cd"] as SubStat[],
    minStatCount: 3,
    ...overrides,
  };
}

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

describe("cloneSlot", () => {
  it("produces a value-equal but distinct object", () => {
    const slot = makeSlot();
    const cloned = cloneSlot(slot);
    expect(cloned).toEqual(slot);
    expect(cloned).not.toBe(slot);
    expect(cloned.mainStats).not.toBe(slot.mainStats);
    expect(cloned.substats).not.toBe(slot.substats);
    expect(cloned.mustPresent).not.toBe(slot.mustPresent);
  });

  it("mutations on clone do not affect original", () => {
    const slot = makeSlot();
    const cloned = cloneSlot(slot);
    cloned.substats.push("er");
    cloned.mustPresent.push("er");
    cloned.minStatCount = 99;
    expect(slot.substats).not.toContain("er");
    expect(slot.mustPresent).not.toContain("er");
    expect(slot.minStatCount).toBe(3);
  });
});

describe("cloneConfig", () => {
  it("produces a value-equal but distinct object", () => {
    const config = makeConfig(["cr", "cd"], ["cr"], 2, "char1");
    const cloned = cloneConfig(config);
    expect(cloned).toEqual(config);
    expect(cloned).not.toBe(config);
    for (const key of SLOT_KEYS) {
      expect(cloned[key]).not.toBe(config[key]);
    }
    expect(cloned.servedCharacters).not.toBe(config.servedCharacters);
    expect(cloned.servedCharacters[0]).not.toBe(config.servedCharacters[0]);
  });

  it("mutations on clone do not affect original", () => {
    const config = makeConfig(["cr", "cd"], ["cr"], 2, "char1");
    const cloned = cloneConfig(config);
    cloned.flowerPlume.substats.push("em");
    cloned.servedCharacters.push({
      characterId: "extra",
      hasPerfectMerge: false,
      has4pcBuild: false,
    });
    expect(config.flowerPlume.substats).not.toContain("em");
    expect(config.servedCharacters).toHaveLength(1);
  });
});

describe("orderedUnion", () => {
  it("unions two arrays preserving order from first, then second", () => {
    expect(orderedUnion(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("handles empty first array", () => {
    expect(orderedUnion([], ["x", "y"])).toEqual(["x", "y"]);
  });

  it("handles empty second array", () => {
    expect(orderedUnion(["x", "y"], [])).toEqual(["x", "y"]);
  });

  it("handles both empty", () => {
    expect(orderedUnion([], [])).toEqual([]);
  });

  it("handles disjoint arrays", () => {
    expect(orderedUnion(["a", "b"], ["c", "d"])).toEqual(["a", "b", "c", "d"]);
  });

  it("handles identical arrays (no duplicates in output)", () => {
    expect(orderedUnion(["a", "b"], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("handles superset relation", () => {
    expect(orderedUnion(["a", "b", "c"], ["b"])).toEqual(["a", "b", "c"]);
  });

  it("deduplicates within a single array", () => {
    expect(orderedUnion(["a", "a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("intersection", () => {
  it("returns common elements preserving first-array order", () => {
    expect(intersection(["a", "b", "c"], ["c", "b"])).toEqual(["b", "c"]);
  });

  it("returns empty for disjoint", () => {
    expect(intersection(["a"], ["b"])).toEqual([]);
  });

  it("handles empty arrays", () => {
    expect(intersection([], ["a"])).toEqual([]);
    expect(intersection(["a"], [])).toEqual([]);
  });

  it("deduplicates result", () => {
    expect(intersection(["a", "a", "b"], ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("dedupe", () => {
  it("removes duplicates preserving first occurrence", () => {
    expect(dedupe(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("handles empty array", () => {
    expect(dedupe([])).toEqual([]);
  });

  it("handles unique array", () => {
    expect(dedupe(["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("areArraysEqualIgnoreOrder", () => {
  it("returns true for equal multisets", () => {
    expect(areArraysEqualIgnoreOrder(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("returns false for different lengths", () => {
    expect(areArraysEqualIgnoreOrder(["a"], ["a", "b"])).toBe(false);
  });

  it("returns false for different elements", () => {
    expect(areArraysEqualIgnoreOrder(["a", "b"], ["a", "c"])).toBe(false);
  });

  it("handles empty arrays", () => {
    expect(areArraysEqualIgnoreOrder([], [])).toBe(true);
  });

  it("handles duplicate elements correctly", () => {
    expect(areArraysEqualIgnoreOrder(["a", "a", "b"], ["a", "b", "a"])).toBe(
      true
    );
    expect(areArraysEqualIgnoreOrder(["a", "a", "b"], ["a", "b", "b"])).toBe(
      false
    );
  });
});

describe("areSlotsStructurallyEqual", () => {
  it("returns true for slots with same substats/mustPresent/k", () => {
    const a = makeSlot();
    const b = makeSlot();
    expect(areSlotsStructurallyEqual(a, b)).toBe(true);
  });

  it("ignores mainStats differences", () => {
    const a = makeSlot({ mainStats: ["atk%"] });
    const b = makeSlot({ mainStats: ["hp%"] });
    expect(areSlotsStructurallyEqual(a, b)).toBe(true);
  });

  it("returns false for different substats", () => {
    const a = makeSlot({ substats: ["cr", "cd", "atk%"] as SubStat[] });
    const b = makeSlot({ substats: ["cr", "cd", "er"] as SubStat[] });
    expect(areSlotsStructurallyEqual(a, b)).toBe(false);
  });

  it("returns false for different mustPresent", () => {
    const a = makeSlot({ mustPresent: ["cr", "cd"] as SubStat[] });
    const b = makeSlot({ mustPresent: ["cr"] as SubStat[] });
    expect(areSlotsStructurallyEqual(a, b)).toBe(false);
  });

  it("returns false for different minStatCount", () => {
    const a = makeSlot({ minStatCount: 2 });
    const b = makeSlot({ minStatCount: 3 });
    expect(areSlotsStructurallyEqual(a, b)).toBe(false);
  });
});

describe("slotFingerprint", () => {
  it("produces a deterministic string", () => {
    const slot = makeSlot();
    const fp = slotFingerprint(slot);
    expect(typeof fp).toBe("string");
    expect(fp).toBe(slotFingerprint(slot));
  });

  it("is order-independent for substats and mustPresent", () => {
    const a = makeSlot({
      substats: ["cr", "cd", "atk%"] as SubStat[],
      mustPresent: ["cd", "cr"] as SubStat[],
    });
    const b = makeSlot({
      substats: ["atk%", "cr", "cd"] as SubStat[],
      mustPresent: ["cr", "cd"] as SubStat[],
    });
    expect(slotFingerprint(a)).toBe(slotFingerprint(b));
  });

  it("differs for different minStatCount", () => {
    const a = makeSlot({ minStatCount: 2 });
    const b = makeSlot({ minStatCount: 3 });
    expect(slotFingerprint(a)).not.toBe(slotFingerprint(b));
  });
});

describe("reorderSubstats", () => {
  it("places mustPresent first, remainder after", () => {
    const result = reorderSubstats(
      ["atk%", "cr", "cd", "er"] as SubStat[],
      ["cr", "cd"] as SubStat[]
    );
    expect(result[0]).toBe("cr");
    expect(result[1]).toBe("cd");
    expect(result).toContain("atk%");
    expect(result).toContain("er");
    expect(result).toHaveLength(4);
  });

  it("handles empty mustPresent", () => {
    const result = reorderSubstats(
      ["atk%", "er"] as SubStat[],
      [] as SubStat[]
    );
    expect(result).toEqual(["atk%", "er"]);
  });

  it("handles duplicate mustPresent entries", () => {
    const result = reorderSubstats(
      ["cr", "cd", "atk%"] as SubStat[],
      ["cr", "cr", "cd"] as SubStat[]
    );
    // Dedup mustPresent: [cr, cd], remainder: [atk%]
    expect(result).toEqual(["cr", "cd", "atk%"]);
  });
});

describe("mergeConfigGroup", () => {
  it("throws on empty input", () => {
    expect(() => mergeConfigGroup([])).toThrow(
      "Cannot merge empty config group"
    );
  });

  it("clones a single config", () => {
    const config = makeConfig(["cr", "cd"], ["cr"], 2, "char1");
    const result = mergeConfigGroup([config]);
    expect(result).toEqual(config);
    expect(result).not.toBe(config);
  });

  it("unions main stats across configs", () => {
    const a = makeConfig(["cr", "cd"], ["cr"], 2, "a", { sands: ["atk%"] });
    const b = makeConfig(["cr", "cd"], ["cr"], 2, "b", { sands: ["hp%"] });
    const merged = mergeConfigGroup([a, b]);
    expect(merged.sands.mainStats).toContain("atk%");
    expect(merged.sands.mainStats).toContain("hp%");
  });

  it("unions substats across configs", () => {
    const a = makeConfig(
      ["cr", "cd"] as SubStat[],
      ["cr"] as SubStat[],
      2,
      "a"
    );
    const b = makeConfig(
      ["cr", "er"] as SubStat[],
      ["cr"] as SubStat[],
      2,
      "b"
    );
    const merged = mergeConfigGroup([a, b]);
    expect(merged.flowerPlume.substats).toContain("cr");
    expect(merged.flowerPlume.substats).toContain("cd");
    expect(merged.flowerPlume.substats).toContain("er");
  });

  it("intersects mustPresent across configs", () => {
    const a = makeConfig(
      ["cr", "cd"] as SubStat[],
      ["cr", "cd"] as SubStat[],
      2,
      "a"
    );
    const b = makeConfig(
      ["cr", "er"] as SubStat[],
      ["cr"] as SubStat[],
      2,
      "b"
    );
    const merged = mergeConfigGroup([a, b]);
    expect(merged.flowerPlume.mustPresent).toEqual(["cr"]);
  });

  it("takes min of minStatCount, clamped to [mustPresent.length, substats.length]", () => {
    const a = makeConfig(
      ["cr", "cd", "atk%"] as SubStat[],
      ["cr", "cd"] as SubStat[],
      3,
      "a"
    );
    const b = makeConfig(
      ["cr", "er"] as SubStat[],
      ["cr"] as SubStat[],
      2,
      "b"
    );
    const merged = mergeConfigGroup([a, b]);
    // substats union = [cr, cd, atk%, er] (4), mustPresent intersect = [cr] (1)
    // min(3, 2) = 2, clamped to [1, 4] → 2
    expect(merged.flowerPlume.minStatCount).toBe(2);
  });

  it("unions servedCharacters", () => {
    const a = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "char1");
    const b = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "char2");
    const merged = mergeConfigGroup([a, b]);
    expect(merged.servedCharacters).toHaveLength(2);
    expect(merged.servedCharacters.map((c) => c.characterId)).toEqual([
      "char1",
      "char2",
    ]);
  });

  it("does not duplicate servedCharacters with same ID", () => {
    const a = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "char1");
    const b = makeConfig(["cd"] as SubStat[], [] as SubStat[], 1, "char1");
    const merged = mergeConfigGroup([a, b]);
    expect(merged.servedCharacters).toHaveLength(1);
  });
});

describe("mergeConfigMetadata", () => {
  it("unions main stats per slot", () => {
    const target = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "a", {
      sands: ["atk%"],
    });
    const source = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "b", {
      sands: ["hp%"],
    });
    mergeConfigMetadata(target, source);
    expect(target.sands.mainStats).toContain("atk%");
    expect(target.sands.mainStats).toContain("hp%");
  });

  it("merges servedCharacters: AND hasPerfectMerge, OR has4pcBuild", () => {
    const target = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "char1");
    target.servedCharacters[0].hasPerfectMerge = true;
    target.servedCharacters[0].has4pcBuild = false;

    const source = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "char1");
    source.servedCharacters[0].hasPerfectMerge = false;
    source.servedCharacters[0].has4pcBuild = true;

    mergeConfigMetadata(target, source);
    expect(target.servedCharacters).toHaveLength(1);
    expect(target.servedCharacters[0].hasPerfectMerge).toBe(false);
    expect(target.servedCharacters[0].has4pcBuild).toBe(true);
  });

  it("adds new characters from source", () => {
    const target = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "a");
    const source = makeConfig(["cr"] as SubStat[], [] as SubStat[], 1, "b");
    mergeConfigMetadata(target, source);
    expect(target.servedCharacters).toHaveLength(2);
  });
});
