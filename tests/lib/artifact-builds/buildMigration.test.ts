import { describe, expect, it } from "vitest";
import type { Build } from "@/data/types";
import { migrateBuild } from "@/lib/artifact-builds/buildMigration";

// Helpers

/** Minimal build object with just the fields migrateBuild touches. */
function makeBuild(
  halfSet1?: number | string,
  halfSet2?: number | string
): Build {
  return {
    halfSet1,
    halfSet2,
  } as Build;
}

/**
 * Build shape as persisted at V4 (BUILD_DATA_VERSION = 4).
 *
 * Fields: id, characterId, name, visible, composition, artifactSet?, halfSet1?
 * (number), halfSet2? (number), sands (MainStat[]), goblet (MainStat[]),
 * circlet (MainStat[]), substats (string[]), kOverride? (number).
 */
function makeV4Build(overrides: Record<string, unknown> = {}): Build {
  return {
    id: "v4-test",
    characterId: "hutao",
    name: "V4 Build",
    visible: true,
    composition: "4pc",
    artifactSet: "crimson_witch_of_flames",
    halfSet1: 9, // numeric legacy ID → atk%-18
    halfSet2: 7, // numeric legacy ID → em-80
    sands: ["hp%"],
    goblet: ["pyro%"],
    circlet: ["cr"],
    substats: ["cr", "cd", "hp%", "em"], // plain string array (V4 format)
    kOverride: 1.5,
    ...overrides,
  } as unknown as Build;
}

/**
 * Build shape as persisted at early V5 (after substats migration, before
 * halfSet string migration and before weighted main stats).
 *
 * substats are WeightedSubStat[], but sands/goblet/circlet are still plain
 * MainStat[], halfSets are still numbers, no sandsWeights/normalizer.
 */
function makeEarlyV5Build(overrides: Record<string, unknown> = {}): Build {
  return {
    id: "v5-early-test",
    characterId: "hutao",
    name: "Early V5 Build",
    visible: true,
    composition: "2pc+2pc",
    halfSet1: 2, // numeric → hp%-20
    halfSet2: 14, // numeric → pyro%-15
    sands: ["hp%", "em"],
    goblet: ["pyro%"],
    circlet: ["cr", "cd"],
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "hp%", weight: 80 },
      { stat: "em", weight: 60 },
    ],
    ...overrides,
  } as unknown as Build;
}

/**
 * Build shape as persisted at mid V5 (after halfSet string migration, before
 * weighted main stats). halfSets are strings, but sands/goblet/circlet are
 * still plain arrays, no sandsWeights/normalizer.
 */
function makeMidV5Build(overrides: Record<string, unknown> = {}): Build {
  return {
    id: "v5-mid-test",
    characterId: "raiden",
    name: "Mid V5 Build",
    visible: true,
    composition: "2pc+2pc",
    halfSet1: "atk%-18",
    halfSet2: "er-20",
    sands: ["er", "atk%"],
    goblet: ["electro%"],
    circlet: ["cr", "cd"],
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 70 },
      { stat: "er", weight: 50 },
    ],
    ...overrides,
  } as unknown as Build;
}

/**
 * Build shape as persisted at late V5 (current format).
 * Has sandsWeights/gobletWeights/circletWeights and normalizer.
 */
function makeCurrentBuild(overrides: Record<string, unknown> = {}): Build {
  return {
    id: "v5-current-test",
    characterId: "raiden",
    name: "Current Build",
    visible: true,
    composition: "4pc",
    artifactSet: "emblem_of_severed_fate",
    substats: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 100 },
      { stat: "atk%", weight: 70 },
      { stat: "er", weight: 50 },
    ],
    sandsWeights: [
      { stat: "er", weight: 100 },
      { stat: "atk%", weight: 60 },
    ],
    gobletWeights: [{ stat: "electro%", weight: 100 }],
    circletWeights: [
      { stat: "cr", weight: 100 },
      { stat: "cd", weight: 80 },
    ],
    normalizer: 5.2,
    ...overrides,
  } as unknown as Build;
}

// Tests

describe("migrateBuild", () => {
  // --- halfSet ID migration -------------------------------------------------
  describe("halfSet ID migration", () => {
    it("migrates numeric halfSet IDs to string IDs", () => {
      const build = makeBuild(1, 9);
      migrateBuild(build);
      expect(build.halfSet1).toBe("cryo%-15");
      expect(build.halfSet2).toBe("atk%-18");
    });

    it("handles all legacy numeric IDs", () => {
      const expected: Record<number, string> = {
        1: "cryo%-15",
        2: "hp%-20",
        3: "def%-30",
        4: "electro%-15",
        5: "electro-res-40",
        6: "geo%-15",
        7: "em-80",
        8: "burst-dmg%-20",
        9: "atk%-18",
        10: "phys%-25",
        11: "hydro%-15",
        12: "heal%-15",
        13: "pyro-res-40",
        14: "pyro%-15",
        15: "er-20",
        16: "anemo%-15",
        17: "heal%-15",
        18: "shield-35",
        19: "dendro%-15",
        20: "na-ca-dmg%-15",
        21: "skill-dmg%-20",
        22: "nightsoul-energy-6",
        23: "nightsoul-dmg%-15",
        24: "plunge-dmg%-25",
      };

      for (const [num, str] of Object.entries(expected)) {
        const build = makeBuild(Number(num), undefined);
        migrateBuild(build);
        expect(build.halfSet1).toBe(str);
      }
    });

    it("is idempotent on already-migrated string IDs", () => {
      const build = makeBuild("cryo%-15", "atk%-18");
      migrateBuild(build);
      expect(build.halfSet1).toBe("cryo%-15");
      expect(build.halfSet2).toBe("atk%-18");
    });

    it("handles undefined halfSets", () => {
      const build = makeBuild(undefined, undefined);
      migrateBuild(build);
      expect(build.halfSet1).toBeUndefined();
      expect(build.halfSet2).toBeUndefined();
    });

    it("handles mixed: one numeric, one already-migrated", () => {
      const build = makeBuild(7, "er-20");
      migrateBuild(build);
      expect(build.halfSet1).toBe("em-80");
      expect(build.halfSet2).toBe("er-20");
    });

    it("handles string-encoded numbers from JSON (e.g. '17')", () => {
      const build = makeBuild("17", "5");
      migrateBuild(build);
      expect(build.halfSet1).toBe("heal%-15");
      expect(build.halfSet2).toBe("electro-res-40");
    });

    it("clears unknown string IDs to undefined", () => {
      const build = makeBuild("nonexistent-id", undefined);
      migrateBuild(build);
      expect(build.halfSet1).toBeUndefined();
    });

    it("maps duplicate IDs 12 and 17 both to heal%-15", () => {
      const build12 = makeBuild(12, undefined);
      const build17 = makeBuild(17, undefined);
      migrateBuild(build12);
      migrateBuild(build17);
      expect(build12.halfSet1).toBe("heal%-15");
      expect(build17.halfSet1).toBe("heal%-15");
    });
  });

  // --- Weighted main stat migration ----------------------------------------
  describe("weighted main stat migration", () => {
    it("converts legacy sands/goblet/circlet arrays to weighted format", () => {
      const build = makeMidV5Build();
      migrateBuild(build);
      expect(build.sandsWeights).toEqual([
        { stat: "er", weight: 100 },
        { stat: "atk%", weight: 100 },
      ]);
      expect(build.gobletWeights).toEqual([{ stat: "electro%", weight: 100 }]);
      expect(build.circletWeights).toEqual([
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
      ]);
    });

    it("removes legacy sands/goblet/circlet fields after migration", () => {
      const build = makeMidV5Build();
      migrateBuild(build);
      const raw = build as Record<string, unknown>;
      expect(raw.sands).toBeUndefined();
      expect(raw.goblet).toBeUndefined();
      expect(raw.circlet).toBeUndefined();
    });

    it("does not overwrite existing sandsWeights with legacy data", () => {
      const build = makeCurrentBuild();
      // Sneak a legacy field onto the object to simulate mixed state
      (build as Record<string, unknown>).sands = ["def%"];
      migrateBuild(build);
      // Existing sandsWeights should be preserved, not overwritten
      expect(build.sandsWeights).toEqual([
        { stat: "er", weight: 100 },
        { stat: "atk%", weight: 60 },
      ]);
    });

    it("initializes empty arrays when both legacy and new fields are missing", () => {
      const build = {} as Build;
      migrateBuild(build);
      expect(build.sandsWeights).toEqual([]);
      expect(build.gobletWeights).toEqual([]);
      expect(build.circletWeights).toEqual([]);
    });
  });

  // --- Normalizer migration ------------------------------------------------
  describe("normalizer migration", () => {
    it("computes normalizer when missing", () => {
      const build = makeMidV5Build();
      migrateBuild(build);
      expect(build.normalizer).toBeTypeOf("number");
      expect(build.normalizer).toBeGreaterThan(0);
    });

    it("does not recompute normalizer when already set", () => {
      const build = makeCurrentBuild({ normalizer: 42 });
      migrateBuild(build);
      expect(build.normalizer).toBe(42);
    });

    it("computes normalizer even when normalizer is null (JSON null)", () => {
      const build = makeCurrentBuild({ normalizer: null });
      migrateBuild(build);
      expect(build.normalizer).toBeTypeOf("number");
      expect(build.normalizer).toBeGreaterThan(0);
    });

    it("preserves normalizer of 0 (does not recompute)", () => {
      // normalizer == null check: 0 != null is true, so 0 is preserved
      const build = makeCurrentBuild({ normalizer: 0 });
      migrateBuild(build);
      expect(build.normalizer).toBe(0);
    });
  });

  // --- Historical data shapes (real-world rehydration) ---------------------
  describe("historical data shapes", () => {
    it("V4 build: migrates halfSets, converts sands→weights, computes normalizer", () => {
      const build = makeV4Build();
      migrateBuild(build);

      // halfSets migrated from numeric
      expect(build.halfSet1).toBe("atk%-18");
      expect(build.halfSet2).toBe("em-80");

      // Legacy sands/goblet/circlet → weighted (all weight 100)
      expect(build.sandsWeights).toEqual([{ stat: "hp%", weight: 100 }]);
      expect(build.gobletWeights).toEqual([{ stat: "pyro%", weight: 100 }]);
      expect(build.circletWeights).toEqual([{ stat: "cr", weight: 100 }]);

      // Legacy fields removed
      const raw = build as Record<string, unknown>;
      expect(raw.sands).toBeUndefined();
      expect(raw.goblet).toBeUndefined();
      expect(raw.circlet).toBeUndefined();

      // kOverride left alone (removed by store-level migration, not migrateBuild)
      expect(raw.kOverride).toBe(1.5);

      // Normalizer computed (substats are still string[] from V4 — migration
      // handles this gracefully via ?? [])
      expect(build.normalizer).toBeTypeOf("number");
    });

    it("early V5 build: migrates halfSets and sands→weights, computes normalizer", () => {
      const build = makeEarlyV5Build();
      migrateBuild(build);

      // halfSets migrated
      expect(build.halfSet1).toBe("hp%-20");
      expect(build.halfSet2).toBe("pyro%-15");

      // Weighted main stats created from legacy arrays
      expect(build.sandsWeights).toEqual([
        { stat: "hp%", weight: 100 },
        { stat: "em", weight: 100 },
      ]);
      expect(build.gobletWeights).toEqual([{ stat: "pyro%", weight: 100 }]);
      expect(build.circletWeights).toEqual([
        { stat: "cr", weight: 100 },
        { stat: "cd", weight: 100 },
      ]);

      // Normalizer computed from weighted substats
      expect(build.normalizer).toBeTypeOf("number");
      expect(build.normalizer).toBeGreaterThan(0);
    });

    it("mid V5 build: halfSets already strings, migrates sands→weights", () => {
      const build = makeMidV5Build();
      migrateBuild(build);

      // halfSets unchanged (already strings)
      expect(build.halfSet1).toBe("atk%-18");
      expect(build.halfSet2).toBe("er-20");

      // Main stats migrated
      expect(build.sandsWeights.length).toBe(2);
      expect(build.gobletWeights.length).toBe(1);
      expect(build.circletWeights.length).toBe(2);

      expect(build.normalizer).toBeGreaterThan(0);
    });

    it("current build: idempotent, nothing changes", () => {
      const build = makeCurrentBuild();
      const snapshot = JSON.parse(JSON.stringify(build));
      migrateBuild(build);
      expect(build).toEqual(snapshot);
    });
  });

  // --- Defensive handling of corrupted / unexpected data -------------------
  describe("corrupted data", () => {
    it("handles sandsWeights as undefined (same-version rehydration bug)", () => {
      // This is the exact scenario that caused "e.sandsWeights is not iterable":
      // data persisted at V5 before sandsWeights was added, rehydrated without
      // version change so migrate() never ran.
      const build = {
        id: "rehydrated",
        characterId: "xiangling",
        name: "Rehydrated",
        visible: true,
        composition: "4pc",
        substats: [
          { stat: "cr", weight: 100 },
          { stat: "cd", weight: 100 },
        ],
        // sandsWeights, gobletWeights, circletWeights, normalizer all MISSING
      } as unknown as Build;

      migrateBuild(build);

      expect(Array.isArray(build.sandsWeights)).toBe(true);
      expect(Array.isArray(build.gobletWeights)).toBe(true);
      expect(Array.isArray(build.circletWeights)).toBe(true);
      expect(build.normalizer).toBeTypeOf("number");
    });

    it("handles sandsWeights as non-array truthy value", () => {
      const build = {
        sandsWeights: "corrupted",
        gobletWeights: {},
        circletWeights: 42,
      } as unknown as Build;
      migrateBuild(build);
      expect(Array.isArray(build.sandsWeights)).toBe(true);
      expect(Array.isArray(build.gobletWeights)).toBe(true);
      expect(Array.isArray(build.circletWeights)).toBe(true);
    });

    it("handles sandsWeights as null (JSON null)", () => {
      const build = {
        sandsWeights: null,
        gobletWeights: null,
        circletWeights: null,
      } as unknown as Build;
      migrateBuild(build);
      expect(Array.isArray(build.sandsWeights)).toBe(true);
      expect(Array.isArray(build.gobletWeights)).toBe(true);
      expect(Array.isArray(build.circletWeights)).toBe(true);
    });

    it("handles legacy sands as non-array (single string instead of array)", () => {
      const build = {
        sands: "hp%", // should be ["hp%"]
        goblet: null,
        circlet: undefined,
      } as unknown as Build;
      migrateBuild(build);
      // Non-array legacy sands is treated as empty
      expect(build.sandsWeights).toEqual([]);
      expect(build.gobletWeights).toEqual([]);
      expect(build.circletWeights).toEqual([]);
    });

    it("handles completely empty object", () => {
      const build = {} as Build;
      migrateBuild(build);
      expect(build.halfSet1).toBeUndefined();
      expect(build.halfSet2).toBeUndefined();
      expect(Array.isArray(build.sandsWeights)).toBe(true);
      expect(Array.isArray(build.gobletWeights)).toBe(true);
      expect(Array.isArray(build.circletWeights)).toBe(true);
      expect(build.normalizer).toBeTypeOf("number");
    });

    it("handles missing substats gracefully during normalizer computation", () => {
      // substats is undefined → ?? [] fallback in normalizer computation
      const build = {
        sands: ["atk%"],
        goblet: ["pyro%"],
        circlet: ["cr"],
      } as unknown as Build;
      migrateBuild(build);
      expect(build.normalizer).toBeTypeOf("number");
    });
  });

  // --- Idempotency ----------------------------------------------------------
  describe("idempotency", () => {
    it("running migrateBuild twice produces identical results", () => {
      const build = makeV4Build();
      migrateBuild(build);
      const after1 = JSON.parse(JSON.stringify(build));
      migrateBuild(build);
      const after2 = JSON.parse(JSON.stringify(build));
      expect(after2).toEqual(after1);
    });

    it("running migrateBuild three times on early V5 is stable", () => {
      const build = makeEarlyV5Build();
      migrateBuild(build);
      migrateBuild(build);
      migrateBuild(build);
      const result = JSON.parse(JSON.stringify(build));
      // Re-run on a fresh copy to compare
      const fresh = makeEarlyV5Build();
      migrateBuild(fresh);
      expect(result).toEqual(JSON.parse(JSON.stringify(fresh)));
    });
  });
});
